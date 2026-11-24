import Script from 'next/script'
import './globals.css'

export const metadata = {
  title: 'Entrenamiento Volvo',
  description: 'Sistema Inteligente de Entrenamiento',
  manifest: '/manifest.json'
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      {/* Aquí aplicamos el color de fondo oscuro y texto claro */}
      <body className="bg-zinc-950 text-zinc-100">
        <Script 
          type="module" 
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"
          strategy="beforeInteractive"
        />
        <main className="min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  )
}