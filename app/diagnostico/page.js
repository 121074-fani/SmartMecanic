'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DiagnosticoPage() {
  const router = useRouter();
  const [preguntas, setPreguntas] = useState([]);
  const [respuestas, setRespuestas] = useState({});
  const [estado, setEstado] = useState('cargando_examen');
  const [feedbackIA, setFeedbackIA] = useState('');
  const [modulosGenerados, setModulosGenerados] = useState([]);

  useEffect(() => {
    async function generarExamen() {
      try {
        const res = await fetch('/api/generar-quiz');
        
        if (!res.ok) throw new Error("El servidor no pudo generar el JSON");
        
        const data = await res.json();
        
        // Escudo: Solo avanza si la IA mandó un arreglo real
        if (Array.isArray(data) && data.length > 0) {
          setPreguntas(data);
          setEstado('listo');
        } else {
          console.error("Respuesta inválida de la IA:", data);
          setEstado('error_ia');
        }
      } catch (error) {
        console.error("Error de conexión:", error);
        setEstado('error_ia');
      }
    }
    generarExamen();
  }, []);

  const manejarSeleccion = (pIndex, opcionTexto) => {
    setRespuestas({ ...respuestas, [pIndex]: opcionTexto });
  };

  const evaluarConIA = async () => {
    setEstado('evaluando');
    try {
      const res = await fetch('/api/evaluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respuestasTecnico: respuestas,
          preguntas: preguntas.map(p => ({
            pregunta: p.texto,
            respuestaCorrecta: p.opciones[p.correcta]
          }))
        })
      });
      const data = await res.json();
      
      // Guardamos la retroalimentación y el menú de módulos
      setFeedbackIA(data.feedback || "Ocurrió un error al generar la evaluación.");
      setModulosGenerados(data.modulos || []);
      setEstado('feedback');
      
    } catch (error) {
      console.error(error);
      setEstado('error_ia');
    }
  };

  if (estado === 'cargando_examen') {
    return <div className="p-12 text-center text-zinc-400 mt-20">Conectando con la IA de Groq...</div>;
  }

  // Pantalla de error amigable
  if (estado === 'error_ia') {
    return (
      <div className="p-12 text-center mt-20">
        <h2 className="text-red-500 text-xl font-bold mb-4">Error de Inteligencia Artificial</h2>
        <p className="text-zinc-400 mb-6">El servidor de IA devolvió un formato incorrecto o está saturado.</p>
        <button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg">
          Reintentar Conexión
        </button>
      </div>
    );
  }

  // Pantalla de Feedback con Tarjetas de Módulos
  if (estado === 'feedback') {
    return (
      <div className="max-w-4xl mx-auto p-6 pt-12">
        <h1 className="text-3xl font-bold mb-6 text-zinc-100">Evaluación del Instructor IA</h1>
        
        {/* Sección de Retroalimentación General */}
        <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl mb-10 shadow-lg">
          <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed text-lg">
            {feedbackIA}
          </p>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-blue-400">Tu Ruta de Aprendizaje Sugerida</h2>
        <p className="text-zinc-400 mb-6">Basado en tus áreas de oportunidad, hemos generado estos módulos de práctica específicos para ti. Selecciona uno para comenzar:</p>
        
        {/* Cuadrícula de Módulos Generados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modulosGenerados && modulosGenerados.length > 0 ? (
            modulosGenerados.map((mod, idx) => (
              <div key={idx} className="bg-zinc-950 p-6 rounded-xl border border-blue-900/50 hover:border-blue-500 transition-all flex flex-col justify-between group">
                <div>
                  <h3 className="text-xl font-bold text-zinc-100 mb-3">{mod.titulo}</h3>
                  <p className="text-sm text-zinc-400 mb-6">{mod.descripcion}</p>
                </div>
                <button 
                  onClick={() => router.push(`/modulo?tema=${encodeURIComponent(mod.titulo)}`)}
                  className="w-full bg-blue-900/40 group-hover:bg-blue-600 text-blue-200 group-hover:text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                  Entrar a Práctica 3D
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center p-8 bg-zinc-900 rounded-xl text-zinc-400">
              No se generaron módulos adicionales. ¡Felicidades, tuviste un puntaje perfecto!
            </div>
          )}
        </div>
      </div>
    );
  }

  // Último escudo antes de dibujar el examen
  if (!Array.isArray(preguntas)) return null;

  // Pantalla Principal (El Examen)
  return (
    <div className="max-w-3xl mx-auto p-6 pt-12">
      <h1 className="text-3xl font-bold mb-2 text-zinc-100">Evaluación Dinámica</h1>
      <p className="text-zinc-400 mb-8">Este cuestionario técnico es generado en tiempo real.</p>
      
      <div className="space-y-8">
        {preguntas.map((pregunta, pIndex) => (
          <div key={pIndex} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <span className="text-xs text-blue-400 font-mono mb-2 block">{pregunta.tema}</span>
            <h2 className="text-lg font-medium mb-4 text-zinc-100">{pregunta.texto}</h2>
            <div className="space-y-3">
              {pregunta.opciones.map((opcion, oIndex) => {
                const seleccionado = respuestas[pIndex] === opcion;
                return (
                  <label key={oIndex} className={`flex items-start p-4 rounded-lg cursor-pointer transition-colors border ${seleccionado ? 'bg-blue-600/20 border-blue-500' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}>
                    <input type="radio" name={`pregunta-${pIndex}`} className="hidden" onChange={() => manejarSeleccion(pIndex, opcion)} />
                    <span className={`text-sm ${seleccionado ? 'text-blue-100' : 'text-zinc-400'}`}>{opcion}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      <button 
        onClick={evaluarConIA} 
        disabled={Object.keys(respuestas).length < preguntas.length || estado === 'evaluando'} 
        className="mt-8 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-4 rounded-xl transition-colors">
        {estado === 'evaluando' ? 'IA analizando respuestas...' : 'Enviar Evaluación'}
      </button>
    </div>
  );
}