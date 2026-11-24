export async function GET() {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    const prompt = `Eres un instructor de Volvo. Genera 10 preguntas de opción múltiple avanzadas sobre mecánica diésel (Common Rail, DPF) y eléctricos (baterías, LOTO, inversores).
    REGLA DE ORO: Devuelve ÚNICAMENTE un arreglo JSON válido. CERO texto introductorio. CERO markdown.
    Estructura estricta: [{"id": "q1", "texto": "¿...?", "opciones": ["A", "B", "C"], "correcta": 1, "tema": "Cat"}]`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b", // <-- El modelo estrella que SÍ tienes activo
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ RECHAZO DE GROQ:", errorText);
      return Response.json({ error: "Fallo en API de Groq" }, { status: 500 });
    }

    const data = await response.json();
    let textoRespuesta = data.choices[0].message.content;
    
    console.log("✅ RESPUESTA CRUDA DE GROQ:", textoRespuesta);
    
    const jsonMatch = textoRespuesta.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      textoRespuesta = jsonMatch[0];
    } else {
      textoRespuesta = textoRespuesta.replace(/```json/g, '').replace(/```/g, '').trim();
    }
    
    return Response.json(JSON.parse(textoRespuesta));
  } catch (error) {
    console.error("❌ ERROR INTERNO DEL SERVIDOR:", error.message);
    return Response.json({ error: "Error procesando IA" }, { status: 500 });
  }
}