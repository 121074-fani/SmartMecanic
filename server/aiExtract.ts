/**
 * Extracción con IA en el servidor: texto del PDF (pdf.js) → contrato JSON de entrenamiento.
 *
 * Proveedor (primero con clave configurada en el entorno / `.env.local`):
 *   1. ANTHROPIC_API_KEY → Claude (SDK oficial, salida estructurada validada con zod)
 *   2. OPENAI_API_KEY    → OpenAI Chat Completions (JSON mode)      · modelo: OPENAI_MODEL
 *   3. GEMINI_API_KEY    → Gemini generateContent (JSON mime type)  · modelo: GEMINI_MODEL
 * Sin clave, sin internet o con respuesta inválida ⇒ `{ mode: 'local' }` y el cliente usa el motor de reglas.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const COMP = z.enum(['hv', 'ev', 'diesel', 'elec', 'sw', 'con', 'diag']);

export const AiExtractionSchema = z.object({
  documentType: z.enum(['manual_taller', 'catalogo_cursos', 'otro']),
  moduleName: z.string(),
  moduleCode: z.string().nullable(),
  vehicle: z.string(),
  category: z.enum(['ev', 'diesel']),
  rules: z.array(
    z.object({
      rule: z.string(),
      category: z.enum(['Seguridad AV', 'Procedimiento', 'Diagnóstico', 'Mecánica']),
      page: z.number().int(),
      confidence: z.number(),
    }),
  ),
  torques: z.array(
    z.object({
      component: z.string(),
      valueNm: z.number(),
      toleranceNm: z.number().nullable(),
      angleDeg: z.number().nullable(),
      sequence: z.string(),
      tool: z.string(),
      page: z.number().int(),
    }),
  ),
  sbom: z.array(
    z.object({
      code: z.string(),
      description: z.string(),
      criticality: z.enum(['Crítica', 'Alta', 'Media', 'Baja']),
      workshop: z.boolean(),
      rescueKit: z.boolean(),
      qty: z.number().int(),
    }),
  ),
  lessons: z.array(
    z.object({
      comp: COMP,
      level: z.number().int(),
      title: z.string(),
      cards: z.array(z.object({ t: z.string(), b: z.string() })),
      key: z.string(),
      checkQuestion: z.string(),
      checkOptions: z.array(z.string()),
      checkCorrectIndex: z.number().int(),
    }),
  ),
  questions: z.array(
    z.object({
      comp: COMP,
      level: z.number().int(),
      question: z.string(),
      options: z.array(z.string()),
      correctIndex: z.number().int(),
      explanation: z.string(),
    }),
  ),
});
export type AiExtraction = z.infer<typeof AiExtractionSchema>;

export type AiResult =
  | { mode: 'ai'; provider: string; model: string; extraction: AiExtraction }
  | { mode: 'local'; reason: string };

const SYSTEM = `Eres un ingeniero de capacitación técnica para flotas de autobuses (diésel y eléctricos de alto voltaje).
Recibes el texto extraído de un PDF (manual de taller, catálogo de cursos u otro documento técnico), con marcadores [Página N].
Convierte su contenido al contrato JSON solicitado, en español, para una app de entrenamiento de técnicos.

Reglas:
- Usa SOLO información presente en el documento. No inventes valores de par de apriete, códigos de pieza ni normas.
- rules: reglas obligatorias y de procedimiento. Las de seguridad (EPP, LOTO/bloqueo, MSD, descarga de capacitores, verificación de ausencia de tensión / 0 V, OSHA 1910.147, NFPA 70E) van con category "Seguridad AV" en vehículos eléctricos o "Procedimiento" en diésel. confidence entre 0 y 1 según qué tan explícita es la regla en el texto.
- torques: solo pares de apriete explícitos, convertidos a N·m (1 lb·ft = 1.3558 N·m). toleranceNm y angleDeg en null si el texto no los da.
- sbom: solo piezas con código o número de parte explícito.
- lessons: 1 a 4 micro-lecciones (3-5 tarjetas cortas cada una) que enseñen lo más importante del documento; si es un catálogo de cursos, una lección por curso relevante. comp ∈ hv (seguridad AV), ev (tren eléctrico), diesel, elec (24 V/electrónica), sw (software), con (redes/CAN), diag (metodología). level 1 o 2. checkOptions: 4 opciones, checkCorrectIndex = índice de la correcta.
- questions: 4 a 10 preguntas de opción múltiple (4 opciones, una correcta) con nivel 1-3 y explicación citando la página.
- Si el documento no trae algún tipo de dato, devuelve ese arreglo vacío.
- moduleCode: un código tipo MOD-XX-000 solo si aparece en el texto; si no, null.`;

const promptFor = (fileName: string, pages: string[]) =>
  `Archivo: ${fileName}\n\n` + pages.map((p, i) => `[Página ${i + 1}]\n${p}`).join('\n\n');

async function viaClaude(apiKey: string, model: string, fileName: string, pages: string[]): Promise<AiResult> {
  const client = new Anthropic({ apiKey, timeout: 180_000, maxRetries: 1 });
  const res = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    // si el modelo declina por política, la API reintenta con el modelo de respaldo
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(AiExtractionSchema) },
    system: SYSTEM,
    messages: [{ role: 'user', content: promptFor(fileName, pages) }],
  });
  if (res.stop_reason === 'refusal') return { mode: 'local', reason: 'el modelo declinó el documento' };
  if (res.stop_reason === 'max_tokens') return { mode: 'local', reason: 'respuesta de IA truncada (max_tokens)' };
  if (!res.parsed_output) return { mode: 'local', reason: 'respuesta de IA sin JSON válido' };
  return { mode: 'ai', provider: 'Claude', model: res.model, extraction: res.parsed_output };
}

const schemaHint = () => JSON.stringify(z.toJSONSchema(AiExtractionSchema));

async function viaOpenAI(apiKey: string, model: string, fileName: string, pages: string[]): Promise<AiResult> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(180_000),
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${SYSTEM}\n\nResponde con un objeto JSON que cumpla este JSON Schema:\n${schemaHint()}` },
        { role: 'user', content: promptFor(fileName, pages) },
      ],
    }),
  });
  if (!r.ok) return { mode: 'local', reason: `OpenAI HTTP ${r.status}` };
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  const parsed = AiExtractionSchema.safeParse(JSON.parse(j.choices?.[0]?.message?.content ?? 'null'));
  return parsed.success ? { mode: 'ai', provider: 'OpenAI', model, extraction: parsed.data } : { mode: 'local', reason: 'JSON de OpenAI fuera de contrato' };
}

async function viaGemini(apiKey: string, model: string, fileName: string, pages: string[]): Promise<AiResult> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(180_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${SYSTEM}\n\nResponde con JSON que cumpla este JSON Schema:\n${schemaHint()}` }] },
      contents: [{ role: 'user', parts: [{ text: promptFor(fileName, pages) }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!r.ok) return { mode: 'local', reason: `Gemini HTTP ${r.status}` };
  const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const parsed = AiExtractionSchema.safeParse(JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? 'null'));
  return parsed.success ? { mode: 'ai', provider: 'Gemini', model, extraction: parsed.data } : { mode: 'local', reason: 'JSON de Gemini fuera de contrato' };
}

export function aiProvider(env: Record<string, string | undefined>) {
  if (env.ANTHROPIC_API_KEY) return 'Claude';
  if (env.OPENAI_API_KEY) return 'OpenAI';
  if (env.GEMINI_API_KEY) return 'Gemini';
  return null;
}

export async function aiExtract(env: Record<string, string | undefined>, fileName: string, pages: string[]): Promise<AiResult> {
  if (!pages.join('').trim()) return { mode: 'local', reason: 'el PDF no tiene texto extraíble' };
  try {
    if (env.ANTHROPIC_API_KEY) return await viaClaude(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || 'claude-opus-5-5', fileName, pages);
    if (env.OPENAI_API_KEY) return await viaOpenAI(env.OPENAI_API_KEY, env.OPENAI_MODEL || 'gpt-4.1-mini', fileName, pages);
    if (env.GEMINI_API_KEY) return await viaGemini(env.GEMINI_API_KEY, env.GEMINI_MODEL || 'gemini-2.5-flash', fileName, pages);
    return { mode: 'local', reason: 'sin API key de IA configurada' };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { mode: 'local', reason: 'API key de Claude inválida' };
    if (e instanceof Anthropic.RateLimitError) return { mode: 'local', reason: 'límite de uso de la API de Claude' };
    if (e instanceof Anthropic.APIConnectionError) return { mode: 'local', reason: 'sin conexión con la API de IA' };
    if (e instanceof Anthropic.APIError) return { mode: 'local', reason: `error de la API de Claude (${e.status})` };
    return { mode: 'local', reason: `IA no disponible: ${(e as Error).message}` };
  }
}
