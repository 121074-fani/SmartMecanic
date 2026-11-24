export async function POST(request) {
  try {
    const { respuestasTecnico, preguntas } = await request.json();
    const apiKey = process.env.GROQ_API_KEY;
    
    const prompt = `Actúa como un instructor maestro de Volvo. 
    Preguntas: ${JSON.stringify(preguntas)}. 
    Respuestas del técnico: ${JSON.stringify(respuestasTecnico)}. 
    
    Evalúa el desempeño e identifica qué temas debe reforzar.
    REGLA DE ORO: Devuelve ÚNICAMENTE un JSON. Cero texto extra, cero markdown.
    Estructura estricta:
    {
      "feedback": "2 párrafos de retroalimentación directa explicando sus errores.",
      "modulos": [
        {
          "titulo": "Título del módulo (ej. Diagnóstico Common Rail)",
          "descripcion": "Breve explicación de qué aprenderá a hacer en este módulo práctico."
        }
      ]
    }`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b", // El modelo que sí te funciona
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1
      })
    });

    if (!response.ok) throw new Error("Fallo en la conexión directa");

    const data = await response.json();
    let textoRespuesta = data.choices[0].message.content;
    
    // Extractor de JSON para evitar errores por formato de la IA
    const jsonMatch = textoRespuesta.match(/\{[\s\S]*\}/);
    textoRespuesta = jsonMatch ? jsonMatch[0] : textoRespuesta.replace(/```json/g, '').replace(/```/g, '').trim();

    return Response.json(JSON.parse(textoRespuesta));
  } catch (error) {
    console.error("❌ ERROR EN EVALUACIÓN:", error);
    return Response.json({ error: 'Error de IA' }, { status: 500 });
  }
}