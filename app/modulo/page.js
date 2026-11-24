'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ModuloContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tema = searchParams.get('tema');
  
  const [modulo, setModulo] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function construirModulo() {
      if (!tema) {
        setCargando(false);
        return;
      }
      
      try {
        const res = await fetch('/api/generar-modulo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Le pasamos a la IA el tema exacto que eligió el usuario en la pantalla anterior
          body: JSON.stringify({ 
            feedbackIA: `Genera el módulo técnico paso a paso para el tema: ${tema}` 
          })
        });
        
        if (!res.ok) throw new Error("Error en la respuesta del servidor");
        
        const data = await res.json();
        setModulo(data);
      } catch (error) {
        console.error("Error cargando el módulo:", error);
      } finally {
        setCargando(false);
      }
    }
    
    construirModulo();
  }, [tema]);

  if (cargando) {
    return (
      <div className="p-12 text-center mt-20 flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-6"></div>
        <p className="text-zinc-400 text-lg">
          Diseñando módulo 3D personalizado para:<br/>
          <span className="text-blue-400 font-bold mt-2 inline-block">{tema}</span>
        </p>
      </div>
    );
  }

  if (!modulo) {
    return (
      <div className="p-12 text-center mt-20">
        <h2 className="text-red-500 text-xl font-bold mb-4">Error al cargar el módulo</h2>
        <button onClick={() => router.back()} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
          Volver al Diagnóstico
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 pt-12">
      {/* Botón de regreso */}
      <button 
        onClick={() => router.back()} 
        className="mb-6 text-zinc-400 hover:text-white flex items-center gap-2 transition-colors font-medium">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Volver a la Ruta de Aprendizaje
      </button>
      
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Panel Izquierdo: Teoría e Instrucciones (Generado por IA) */}
        <div className="lg:w-1/3 bg-zinc-900 p-6 rounded-xl border border-zinc-800 h-fit shadow-xl shadow-black/50">
          <h1 className="text-2xl font-bold mb-4 text-blue-400">{modulo.titulo || tema}</h1>
          <p className="text-zinc-300 mb-8 leading-relaxed whitespace-pre-wrap">{modulo.teoria}</p>
          
          <h2 className="text-lg font-medium mb-4 text-zinc-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            Pasos en el Simulador:
          </h2>
          
          <div className="space-y-3">
            {modulo.pasos3D && modulo.pasos3D.map((p, idx) => (
              <div key={idx} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex gap-4 items-center">
                <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex shrink-0 items-center justify-center font-bold shadow-lg shadow-blue-900/50">
                  {p.paso}
                </span>
                <p className="text-sm text-zinc-300">{p.accion}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Panel Derecho: El Visor 3D */}
        <div className="lg:w-2/3 bg-zinc-950 rounded-xl border border-zinc-800 min-h-[600px] flex items-center justify-center relative overflow-hidden group shadow-xl shadow-black/50">
          
          {/* Grid de fondo estilo blueprint/técnico */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          
          <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center">
             <div className="w-20 h-20 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center justify-center mb-6 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
             </div>
             <h3 className="text-xl font-bold text-zinc-200 mb-2">Simulador 3D en Espera</h3>
             <p className="text-zinc-500 max-w-md">
               Aquí se renderizará el modelo .glb de Volvo.<br/>
               En espera del código fuente del equipo 3D.
             </p>
          </div>
        </div>
        
      </div>
    </div>
  );
}

// Next.js requiere envolver los componentes que usan searchParams en un Suspense
export default function ModuloPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-zinc-400 mt-20">Iniciando entorno...</div>}>
      <ModuloContent />
    </Suspense>
  );
}