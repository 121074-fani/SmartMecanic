export async function POST(request) {
  try {
    const { feedbackIA } = await request.json();
    const apiKey = process.env.GROQ_API_KEY;
    
    const prompt = `Basado en este feedback de evaluación de un técnico de Volvo: "${feedbackIA}"
    Genera un micro-módulo de entrenamiento enfocado ÚNICAMENTE en lo que falló.
    Devuelve un JSON válido con esta estructura estricta:
    {
      "titulo": "Nombre del módulo (ej. Protocolo LOTO Avanzado)",
      "teoria": "2 párrafos con la explicación técnica real del concepto",
      "pasos3D": [
        {"paso": 1, "accion": "Desconectar switch principal", "piezaDestacada": "switch_msd"},
        {"paso": 2, "accion": "Verificar multímetro", "piezaDestacada": "multimetro"}
      ]
    }`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    if (!response.ok) throw new Error("Fallo al generar el módulo");

    const data = await response.json();
    let textoRespuesta = data.choices[0].message.content;
    const jsonMatch = textoRespuesta.match(/\{[\s\S]*\}/);
    textoRespuesta = jsonMatch ? jsonMatch[0] : textoRespuesta.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return Response.json(JSON.parse(textoRespuesta));
  } catch (error) {
    console.error("Error generando módulo:", error);
    return Response.json({ error: 'Error de IA' }, { status: 500 });
  }
}