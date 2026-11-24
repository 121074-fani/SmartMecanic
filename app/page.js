import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-screen">
      <h1 className="text-4xl md:text-5xl font-bold mb-4 text-zinc-100">
        Técnicos del Mañana
      </h1>
      <p className="text-lg md:text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
        Sistema Inteligente de Entrenamiento para Autobuses. 
        Desarrollo de competencias mediante micro aprendizaje y simulación 3D.
      </p>
      
      <Link 
        href="/diagnostico"
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl transition-colors shadow-lg"
      >
        Iniciar Evaluación de Competencias
      </Link>
    </div>
  );
}