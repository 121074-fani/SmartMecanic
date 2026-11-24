'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SimulacionPage() {
  const router = useRouter();
  const [fallaEncontrada, setFallaEncontrada] = useState(false);

  const registrarFalla = () => {
    setFallaEncontrada(true);
    // Aquí es donde en el futuro enviarías el dato al dashboard del instructor
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Barra superior del entorno práctico */}
      <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center z-10">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Módulo Práctico 3D</h1>
          <p className="text-xs text-zinc-400">Inspecciona el modelo y diagnostica la falla</p>
        </div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Finalizar Práctica
        </button>
      </div>

      {/* Visor inmersivo 3D / AR */}
      <div className="flex-1 relative w-full h-full">
        {/* 
          INSTRUCCIONES PARA TU EQUIPO DE DISEÑO 3D:
          1. Guarden su modelo exportado como "motor.glb"
          2. Cópienlo dentro de la carpeta: public/modelos/
        */}
        <model-viewer
          src="/modelos/motor.glb"
          alt="Modelo 3D del motor Volvo"
          ar
          ar-modes="webxr scene-viewer quick-look"
          camera-controls
          auto-rotate
          shadow-intensity="1"
          style={{ width: '100%', height: '100%', backgroundColor: '#09090b' }}
        >
          {/* 
            HOTSPOT (Punto de interacción): 
            El equipo 3D debe ajustar el "data-position" (X Y Z) para que este botón 
            quede flotando exactamente sobre la pieza que está "fallando".
          */}
          <button 
            slot="hotspot-falla1" 
            data-position="0.5 1.2 -0.3" 
            data-normal="0 0 1"
            className="w-6 h-6 bg-red-600/80 hover:bg-red-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(220,38,38,0.8)] cursor-pointer transition-colors"
            onClick={registrarFalla}
          ></button>
        </model-viewer>

        {/* Retroalimentación al usuario al tocar la falla */}
        {fallaEncontrada && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur border border-green-500/50 px-6 py-4 rounded-xl shadow-2xl flex flex-col items-center">
            <span className="text-green-400 font-bold mb-1 text-lg">¡Falla diagnosticada correctamente!</span>
            <span className="text-sm text-zinc-300">Competencia práctica demostrada.</span>
          </div>
        )}
      </div>
    </div>
  );
}