# Técnicos del Mañana — Sistema Inteligente de Entrenamiento para Autobuses

Prototipo para el **HackaTec 2026 · Reto 1 Volvo**. Es una aplicación web (HTML + CSS + JavaScript puro, **sin dependencias**) que diagnostica las competencias de cada técnico, le arma una ruta personalizada, lo entrena con micro-aprendizaje y simulación de fallas sobre un **modelo 3D** del autobús, y comprueba con evidencia que aprendió y que lo retiene.

## Cómo ejecutarlo

Opción rápida: abre `index.html` en Chrome o Edge.

Opción recomendada (activa el modo offline/PWA):

```bash
cd tecnicos-del-manana
python3 -m http.server 8000
# abre http://localhost:8000
```

Para probarlo en el teléfono, conéctalo a la misma red Wi-Fi y abre `http://IP-DE-TU-PC:8000`.

## Estructura

```
index.html          Shell de la app (barra lateral, barra superior, contenedor de vistas)
css/styles.css      Estilos (tema oscuro "taller", responsive para móvil)
js/data-modelos.js  Garage: 6 modelos de autobús de referencia, grupos de función 2–9 y qué
                    práctica pertenece a cada grupo según la propulsión
js/data-equipo.js   Equipo simulado: 40 técnicos en 4 talleres con errores, respuestas y pasos
                    fallados (semilla fija) para el análisis de errores comunes
js/data-senala.js   Señala la pieza: motor 3D a gas natural (cambio de bujía) y banco de baterías,
                    pasos de identificación con 3 intentos
js/data-sims.js     Aprende haciendo: escenas 3D de acercamiento (inversor, manguera de intercooler,
                    baterías 24 V) y módulos Saber → Hacer → Demostrar
js/data-taller.js   Taller virtual: 12 herramientas con ficha, fichas técnicas de 22 piezas,
                    tareas de inspección por pieza y 5 procedimientos de reparación
js/data.js          Contenido: competencias, roles, 35 preguntas, 14 micro-lecciones,
                    3 escenarios de falla, documentos "autorizados", componentes 3D, equipo simulado
js/engine3d.js      Motor 3D propio en Canvas 2D: cámara orbital, iluminación, selección por clic,
                    rayos X, modo estéreo VR. Modelo paramétrico de autobús eléctrico y diésel
js/charts.js        Gráficas SVG: radar, barras, líneas
js/app.js           Lógica: estado, router, motor adaptativo, quiz, simulador, RAG local, tablero
sw.js, manifest.json  PWA: caché offline e instalación en el teléfono
```

## Los 6 entregables del reto, en la app

| # | Entregable | Dónde está | Cómo funciona |
|---|---|---|---|
| 1 | Diagnóstico inicial | **Diagnóstico** | Autoevaluación (1–5) + quiz **adaptativo** de 14 preguntas: por cada competencia empieza en nivel medio; si aciertas sube a difícil y si fallas baja a básico. Genera un **mapa de competencias** (radar) y detecta sobreconfianza. |
| 2 | Ruta adaptativa | **Mi ruta** | Prioridad = brecha × peso del rol. Seguridad AV es obligatoria si el dominio es < 70. Se recalcula después de cada lección, práctica, repaso o evaluación (incluye el olvido). |
| 3 | Módulo práctico | **⭐ Practicar** → **Señala la pieza**, **Aprende haciendo**, **Taller virtual**, **Simulador de fallas** y **Modelo 3D** | **Señala la pieza:** el proceso de cambio de bujía tiene 12 pasos sobre un motor 3D ("Señala el borne negativo", "Señala la bobina del cilindro 1", "Señala la bujía", "Señala la llave de torque"…). Hay 3 intentos por paso: cada error se marca en rojo y dice qué pieza tocaste; al segundo error aparece una pista, y al tercero el modelo marca la pieza correcta. Después de cada acierto se explica qué es la pieza y por qué se hace ese paso. **Aprende haciendo:** 3 módulos con tres fases. *Saber* es una micro-cápsula con flujo, riesgos y valores clave, más una pregunta de comprobación. *Hacer* empieza con el mini-juego "Arma tu kit" (con trampas) y sigue con la simulación guiada sobre un acercamiento 3D de las piezas: el inversor con tapa, 4 tornillos en cruz, MSD y barra colectora; la manguera del intercooler con abrazaderas; el banco de baterías de 24 V. *Demostrar* repite el proceso sin pistas, con 5 vidas y cronómetro. Cada error pone la pieza en rojo, enrojece la escena, resta vidas y explica el porqué; las violaciones de seguridad restan 2 vidas y reprueban. Al final hay calificación con estrellas.  **Taller virtual:** 5 procedimientos de reparación (desenergizar y bloquear AV, reemplazar arnés AV, manguera del intercooler, regeneración de DPF, red CAN) con lista de tareas; el técnico toma la herramienta, la aplica sobre la pieza del modelo 3D en el orden correcto, responde decisiones, captura torques y espera tiempos (descarga, regeneración). Las piezas se retiran e instalan con animación, los instrumentos muestran lecturas y hay modo guiado o modo evaluación. Reglas de seguridad: herramienta no aislada en AV, tocar AV sin EPP o intervenir sin verificar ausencia de tensión = violación crítica. **Simulador de fallas:** 3 escenarios con árbol de decisión sobre el modelo 3D (el componente se resalta): eléctrico con falla de aislamiento, diésel con baja sobrealimentación y red CAN. Rúbrica con intentos, errores, tiempo y **violaciones críticas de seguridad**. El escenario AV se bloquea si el técnico no tiene la competencia de seguridad. |
| 4 | Pre / post / diferida | **Evaluaciones** | Pre = diagnóstico; post = forma paralela inmediata; diferida = se desbloquea 7 días simulados después. Calcula la **ganancia normalizada** (Hake) y la **retención** (diferida/post). |
| 5 | Tablero | **Tablero** (Técnico · Equipo · Errores comunes) | Vista del técnico (KPI, radar, pre/post/diferida, errores recurrentes, curva de olvido, historial exportable en xAPI) y del supervisor (mapa de calor del equipo, alertas accionables, ranking, exportación CSV). |
| 6 | Escalabilidad | **Escalabilidad** | Arquitectura, integración con la documentación técnica, escala, operación offline, protección de datos, VR/AR y plan de implementación. |

### Temas de interés que cubre
- **IA con fuentes controladas:** el *Asistente técnico* recupera fragmentos (BM25) de la biblioteca autorizada y siempre cita la fuente. Si no encuentra una fuente, no inventa la respuesta: la escala al especialista y la registra como brecha de contenido (aparece en las alertas del supervisor). Prueba con: "¿Cuál es el torque de las ruedas?".
- **Repetición espaciada:** cada lección programa repasos a 1, 3, 7 y 21 días. Usa los botones **+1 día / +7 días** para simular el tiempo.
- **Modelo de olvido:** dominio efectivo = dominio × (0.4 + 0.6·e^(−t/estabilidad)). Cada repaso correcto multiplica la estabilidad por 2.2.
- **Gamificación:** XP, niveles, 7 insignias y ranking.
- **VR/AR:** botón **VR** = vista estéreo para visor tipo cardboard; además hay pantalla completa.
- **Offline:** todo corre en el dispositivo (estado en `localStorage` y service worker).

## Navegación
Menú principal: **Inicio · Mi ruta · Practicar · Evaluar · Asistente · Tablero** (y Escalabilidad). *Practicar* abre un **garage tipo videojuego** para elegir el autobús (7900 Electric, 7900 Electric Articulated, 7900 Hybrid, 8900, 9700 y 9800) y después los **grupos de función 2–9**; hoy solo están habilitados 2 · Motor y 3 · Sistema eléctrico, y cada uno muestra las prácticas que aplican a la propulsión del modelo. Además agrupa Señala la pieza, Aprende haciendo, Taller, Fallas y Modelo 3D; *Evaluar* agrupa Diagnóstico, Antes/después/diferida y Repasos. En el celular hay una barra inferior con las secciones principales y un botón **Más**.

## Guion sugerido para la demo (6 min)

1. **Inicio:** registra un técnico con el rol "Técnico de electromovilidad".
2. **Diagnóstico:** contesta rápido y muestra el radar y la etiqueta de "Sobreconfianza".
3. **Mi ruta:** explica por qué "Seguridad AV" aparece primero como obligatoria y el candado del escenario eléctrico.
4. **Practicar → Señala la pieza → Cambio de bujía:** toca a propósito la batería completa y luego el cilindro equivocado para mostrar los intentos en rojo; al tercer error el modelo marca la pieza.
4b. **⭐ Aprende haciendo → Inversor:** Saber → arma el kit marcando a propósito los guantes de nitrilo (trampa) → en Hacer toca el MSD con la mano antes de ponerte los guantes para mostrar el error en rojo → completa el proceso → Demostrar.
5. **Taller virtual → Desenergizar y bloquear AV (modo guiado):** toma la llave estándar y toca el inversor para mostrar la violación; después completa el procedimiento y muestra las lecturas del multímetro.
6. **Modelo 3D:** toca el cableado de alto voltaje → pestañas Fallas / Seguridad / Herramientas / Tareas.
7. **Lección hv1:** complétala y muestra que el escenario se desbloquea y que se programaron repasos.
8. **Simulador eléctrico:** elige a propósito "El tablero muestra 0 V" para mostrar la **violación crítica**, termina el escenario y enseña la rúbrica.
9. **Asistente:** haz una pregunta con fuente y otra sin fuente (el torque) para mostrar que no alucina.
10. **Cargar datos demo** → **Tablero** (técnico y supervisor): ganancia, retención, alertas y mapa de calor.
11. **Escalabilidad:** cierra con la arquitectura y el plan de implementación.

## Nota sobre el contenido
El contenido técnico es **de ejemplo** y solo sirve para el prototipo. En producción, todo vendría de documentación autorizada por Volvo y validada por especialistas, como se describe en la sección *Escalabilidad*.

## Cámara: control con la mano (computadora) y realidad aumentada (celular)

- **En la computadora**, el botón de cámara en el visor 3D abre la cámara frontal y el modelo gira siguiendo el movimiento de la mano.
- **En el celular**, el mismo botón dice **AR** y abre la **cámara trasera**: el motor, la batería y las piezas se dibujan encima de lo que ves. Con los sensores de movimiento del teléfono el modelo se queda "fijo" donde apuntaste: si mueves el celular, el motor se desplaza en la pantalla como un objeto real. Se puede seguir tocando piezas, arrastrar para girar y pellizcar para cambiar el tamaño. "Traer al centro" lo vuelve a poner enfrente; si queda fuera de la vista aparece una flecha naranja que indica hacia dónde está.
- La cámara solo funciona en una página segura: `http://localhost` en la computadora, o **https** en el celular (por ejemplo, subiendo la carpeta a Netlify Drop o GitHub Pages). Abrir la IP de la computadora con `http://192.168…` desde el celular no permite usar la cámara.
- Para probar el modo AR en la computadora: agrega `?ar=1` a la dirección (`http://localhost:8000/?ar=1#/senala/bujias`).