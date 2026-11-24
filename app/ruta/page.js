'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Catálogo de módulos recomendados (Micro aprendizaje)
const MODULOS_CATALOGO = {
  mecanica_diesel: {
    id: 'MOD-01',
    titulo: 'Diagnóstico de Motores Diésel',
    etiquetas: ['Teoría', 'Diésel'],
    descripcion: 'Identificación de fallas de presión en sistemas de inyección y pérdida de potencia.',
  },
  seguridad_ev: {
    id: 'MOD-02',
    titulo: 'Seguridad de Alto Voltaje',
    etiquetas: ['Práctica', 'Eléctrico'],
    descripcion: 'Protocolo de desenergización y verificación de ausencia de voltaje en autobuses.',
  },
  diagnostico_electronico: {
    id: 'MOD-03',
    titulo: 'Diagnóstico de Redes Multiplexadas',
    etiquetas: ['Teoría', 'Electrónica'],
    descripcion: 'Uso de multímetro y osciloscopio para medir resistencia en la red CAN Bus.',
  }
};

export default function RutaAdaptativaPage() {
  const router = useRouter();
  const [modulosRecomendados, setModulosRecomendados] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Leemos en qué se equivocó el técnico en el paso anterior
    const brechasGuardadas = localStorage.getItem('brechasTécnico');
    
    if (brechasGuardadas) {
      const brechas = JSON.parse(brechasGuardadas);
      // Filtramos el catálogo para mostrar solo lo que necesita aprender
      const rutaGenerada = brechas.map(brechaId => MODULOS_CATALOGO[brechaId]).filter(Boolean);
      
      // Si tuvo 100% de aciertos, le ponemos un módulo avanzado por defecto
      if (rutaGenerada.length === 0) {
        setModulosRecomendados([MODULOS_CATALOGO.seguridad_ev]);
      } else {
        setModulosRecomendados(rutaGenerada);
      }
    }
    setCargando(false);
  }, []);

  if (cargando) {
    return <div className="p-12 text-center text-zinc-400">Generando tu ruta personalizada...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 pt-12 w-full">
      <h1 className="text-3xl font-bold mb-2 text-zinc-100">Tu Ruta de Aprendizaje</h1>
      <p className="text-zinc-400 mb-8">
        Basado en tu diagnóstico, la inteligencia del sistema ha diseñado esta ruta para cerrar tus brechas de conocimiento.
      </p>

      <div className="space-y-6">
        {modulosRecomendados.map((modulo) => (
          <div key={modulo.id} className="bg-zinc-900 p-6 rounded-xl border border-blue-900/50 relative overflow-hidden">
            {/* Línea decorativa a la izquierda */}
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
            
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-bold text-zinc-100">{modulo.titulo}</h2>
              <span className="bg-zinc-800 text-zinc-300 text-xs px-3 py-1 rounded-full font-mono">
                {modulo.id}
              </span>
            </div>
            
            <p className="text-zinc-400 mb-4">{modulo.descripcion}</p>
            
            <div className="flex gap-2 mb-6">
              {modulo.etiquetas.map(etiqueta => (
                <span key={etiqueta} className="bg-blue-900/30 text-blue-400 text-xs px-2 py-1 rounded">
                  {etiqueta}
                </span>
              ))}
            </div>

            <button 
              onClick={() => router.push('/simulacion')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-lg transition-colors"
            >
              Iniciar Módulo Práctico 3D
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}