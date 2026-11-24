'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PREGUNTAS = [
  {
    id: 'mecanica_diesel',
    texto: '¿Cuál es la causa más común de pérdida de potencia en un motor diésel con sistema common rail?',
    opciones: [
      'Falla en la bujía de encendido',
      'Obstrucción en el filtro de combustible o inyectores',
      'Batería de 12V descargada'
    ],
    correcta: 1,
  },
  {
    id: 'seguridad_ev',
    texto: 'Antes de intervenir el banco de baterías de un autobús eléctrico, el primer paso obligatorio es:',
    opciones: [
      'Desconectar el interruptor de servicio (MSD) y verificar ausencia de voltaje',
      'Drenar el líquido refrigerante de las baterías',
      'Conectar el escáner OBD2 para borrar códigos'
    ],
    correcta: 0,
  },
  {
    id: 'diagnostico_electronico',
    texto: 'Si la red CAN Bus del autobús pierde comunicación, ¿qué herramienta usas para comprobar la resistencia de terminación (60 ohms)?',
    opciones: [
      'Un multímetro en la escala de Ohmios',
      'Un osciloscopio en la escala de Voltios',
      'Un probador de corriente de 12V (lámpara de pruebas)'
    ],
    correcta: 0,
  }
];

export default function DiagnosticoPage() {
  const router = useRouter();
  const [respuestas, setRespuestas] = useState({});
  const [enviando, setEnviando] = useState(false);

  const manejarSeleccion = (preguntaIndex, opcionIndex) => {
    setRespuestas({ ...respuestas, [preguntaIndex]: opcionIndex });
  };

  const procesarDiagnostico = async () => {
    setEnviando(true);
    
    // Evaluamos en qué falló el técnico
    const brechas = [];
    PREGUNTAS.forEach((pregunta, index) => {
      if (respuestas[index] !== pregunta.correcta) {
        brechas.push(pregunta.id);
      }
    });

    // Simulamos carga de red y guardamos localmente las brechas
    setTimeout(() => {
      localStorage.setItem('brechasTécnico', JSON.stringify(brechas));
      router.push('/ruta');
    }, 1500);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 pt-12">
      <h1 className="text-3xl font-bold mb-2 text-zinc-100">Evaluación Inicial de Competencias</h1>
      <p className="text-zinc-400 mb-8">Selecciona la respuesta correcta para identificar tu ruta de aprendizaje.</p>

      <div className="space-y-8">
        {PREGUNTAS.map((pregunta, pIndex) => (
          <div key={pIndex} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h2 className="text-lg font-medium mb-4">{pregunta.texto}</h2>
            <div className="space-y-3">
              {pregunta.opciones.map((opcion, oIndex) => (
                <label 
                  key={oIndex} 
                  className={`flex items-center p-4 rounded-lg cursor-pointer transition-colors border ${
                    respuestas[pIndex] === oIndex 
                      ? 'bg-blue-600/20 border-blue-500' 
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name={`pregunta-${pIndex}`}
                    className="hidden"
                    onChange={() => manejarSeleccion(pIndex, oIndex)}
                  />
                  <span className="text-zinc-300">{opcion}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={procesarDiagnostico}
        disabled={Object.keys(respuestas).length < PREGUNTAS.length || enviando}
        className="mt-8 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-4 rounded-xl transition-colors"
      >
        {enviando ? 'Analizando competencias...' : 'Generar Ruta de Aprendizaje'}
      </button>
    </div>
  );
}