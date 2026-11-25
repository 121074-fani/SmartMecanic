/* =========================================================
   Técnicos del Mañana — Contenido del prototipo
   NOTA: contenido técnico de EJEMPLO con fines de prototipo.
   En producción, todo proviene de documentación autorizada
   y validada por especialistas (ver "Escalabilidad").
   ========================================================= */

const COMPETENCIAS = [
  { id: 'hv',     name: 'Seguridad de alto voltaje',          short: 'Seg. AV',      icon: '{{i:bolt}}' },
  { id: 'ev',     name: 'Tren motriz eléctrico',              short: 'Eléctrico',    icon: '{{i:battery}}' },
  { id: 'diesel', name: 'Motores diésel',                     short: 'Diésel',       icon: '{{i:fuel}}' },
  { id: 'elec',   name: 'Sistemas eléctricos y electrónicos', short: 'Electrónica',  icon: '{{i:plug}}' },
  { id: 'sw',     name: 'Software y actualización',           short: 'Software',     icon: '{{i:chip}}' },
  { id: 'con',    name: 'Conectividad y redes',               short: 'Conectividad', icon: '{{i:signal}}' },
  { id: 'diag',   name: 'Metodología de diagnóstico',         short: 'Diagnóstico',  icon: '{{i:search}}' },
];

const ROLES = {
  diesel: { name: 'Técnico diésel',                       weights: { hv: 1.0, ev: 0.7, diesel: 1.4, elec: 1.0, sw: 0.8, con: 0.8, diag: 1.2 } },
  ev:     { name: 'Técnico de electromovilidad',          weights: { hv: 1.5, ev: 1.4, diesel: 0.6, elec: 1.2, sw: 1.0, con: 0.9, diag: 1.2 } },
  elec:   { name: 'Técnico de electrónica y diagnóstico', weights: { hv: 1.0, ev: 1.0, diesel: 0.7, elec: 1.4, sw: 1.3, con: 1.3, diag: 1.4 } },
  nuevo:  { name: 'Aprendiz / nuevo ingreso',             weights: { hv: 1.4, ev: 1.0, diesel: 1.0, elec: 1.1, sw: 0.9, con: 0.9, diag: 1.3 } },
};

/* ---------- Banco de preguntas: 5 por competencia, nivel 1-3 ---------- */
const QUESTIONS = [
  // Seguridad AV
  { id: 'hv-1', c: 'hv', lvl: 1, q: '¿Qué color identifica normalmente el cableado de alto voltaje en vehículos?', o: ['Naranja', 'Rojo', 'Azul', 'Verde'], a: 0, exp: 'Por convención de la industria, los conductores de alto voltaje son de color naranja.' },
  { id: 'hv-2', c: 'hv', lvl: 1, q: 'Antes de trabajar en un sistema de alto voltaje, el primer requisito es:', o: ['Estar capacitado/autorizado y seguir el procedimiento de desenergización del fabricante', 'Tener un multímetro cualquiera', 'Que el autobús esté apagado desde hace una hora', 'Usar guantes de carnaza'], a: 0, exp: 'Solo personal calificado, siguiendo el procedimiento oficial de desenergización, puede intervenir sistemas AV.' },
  { id: 'hv-3', c: 'hv', lvl: 2, q: '¿Qué es el MSD (Manual Service Disconnect)?', o: ['Un dispositivo para aislar manualmente la batería AV interrumpiendo el circuito', 'Un software de diagnóstico', 'Un fusible del sistema de 24 V', 'El interruptor de luces de servicio'], a: 0, exp: 'El MSD abre físicamente el circuito de la batería AV para aislarla durante el servicio.' },
  { id: 'hv-4', c: 'hv', lvl: 2, q: 'Tras desconectar el sistema AV, ¿por qué se espera un tiempo antes de intervenir?', o: ['Para que se descarguen los capacitores del inversor y convertidores', 'Para que se enfríe el aceite del motor', 'Para que el software se reinicie', 'No es necesario esperar'], a: 0, exp: 'Los capacitores pueden mantener tensión peligrosa varios minutos después de abrir el circuito.' },
  { id: 'hv-5', c: 'hv', lvl: 3, q: 'Para verificar correctamente la ausencia de tensión se debe:', o: ['Probar el instrumento en una fuente conocida, medir, y volver a probar el instrumento', 'Confiar en la lectura del tablero', 'Medir una sola vez en cualquier punto', 'Tocar el conector con el dorso de la mano'], a: 0, exp: 'La prueba "viva–muerta–viva" confirma que el instrumento funciona antes y después de la medición.' },
  // Tren motriz eléctrico
  { id: 'ev-1', c: 'ev', lvl: 1, q: 'En un autobús eléctrico, el inversor:', o: ['Convierte la CC de la batería en CA para el motor de tracción', 'Carga la batería de 24 V', 'Enfría la batería', 'Controla las puertas'], a: 0, exp: 'El inversor transforma corriente continua en alterna trifásica para el motor.' },
  { id: 'ev-2', c: 'ev', lvl: 1, q: 'El frenado regenerativo:', o: ['Usa el motor como generador para recargar la batería', 'Calienta los frenos para mejorar el agarre', 'Solo funciona en autobuses diésel', 'Desconecta la batería al frenar'], a: 0, exp: 'Al desacelerar, el motor actúa como generador y devuelve energía a la batería.' },
  { id: 'ev-3', c: 'ev', lvl: 2, q: 'El convertidor DC/DC sirve para:', o: ['Alimentar el sistema de 24 V a partir de la batería de alto voltaje', 'Convertir CA de la red en CC', 'Aumentar la potencia del motor', 'Medir el aislamiento'], a: 0, exp: 'El DC/DC reduce la alta tensión para alimentar el sistema de baja tensión (24 V).' },
  { id: 'ev-4', c: 'ev', lvl: 2, q: '¿Qué significa SOC?', o: ['Estado de carga (State of Charge)', 'Estado de salud de la batería', 'Sistema de control de ocupación', 'Sobre-corriente'], a: 0, exp: 'SOC es el estado de carga; SOH (State of Health) es el estado de salud.' },
  { id: 'ev-5', c: 'ev', lvl: 3, q: 'Una "falla de aislamiento" en el sistema AV indica:', o: ['Resistencia baja entre un conductor AV y el chasis (posible fuga a masa)', 'Que la batería está demasiado fría', 'Que el cable de carga es muy corto', 'Que el inversor está apagado'], a: 0, exp: 'El monitor de aislamiento detecta cuando la resistencia entre AV y chasis cae por debajo de un umbral seguro.' },
  // Diésel
  { id: 'diesel-1', c: 'diesel', lvl: 1, q: '¿Qué función tiene el turbocompresor en un motor diésel?', o: ['Aumentar la densidad del aire de admisión usando la energía de los gases de escape', 'Enfriar el refrigerante', 'Inyectar combustible', 'Filtrar partículas'], a: 0, exp: 'La turbina aprovecha los gases de escape para mover el compresor que sobrealimenta la admisión.' },
  { id: 'diesel-2', c: 'diesel', lvl: 1, q: 'Humo negro excesivo en el escape indica típicamente:', o: ['Combustión incompleta por exceso de combustible o falta de aire', 'Quema de aceite', 'Refrigerante en la cámara', 'Funcionamiento normal'], a: 0, exp: 'Negro = combustible sin quemar (mezcla rica). Azul suele ser aceite; blanco, refrigerante o vapor.' },
  { id: 'diesel-3', c: 'diesel', lvl: 2, q: '¿Para qué sirve el DPF (filtro de partículas diésel)?', o: ['Atrapar hollín y eliminarlo mediante regeneración', 'Reducir NOx con urea', 'Filtrar el combustible', 'Enfriar los gases de recirculación'], a: 0, exp: 'El DPF retiene partículas y las quema periódicamente (regeneración).' },
  { id: 'diesel-4', c: 'diesel', lvl: 2, q: 'El sistema SCR reduce NOx usando:', o: ['Solución de urea (AdBlue/DEF) inyectada antes del catalizador', 'Aceite de motor', 'Agua destilada', 'Refrigerante'], a: 0, exp: 'La urea se descompone en amoniaco, que reacciona con NOx en el catalizador SCR.' },
  { id: 'diesel-5', c: 'diesel', lvl: 3, q: 'Baja presión de sobrealimentación con un turbo que gira libremente y sin fugas de aceite. ¿Qué revisas antes de reemplazar el turbo?', o: ['Fugas en mangueras/intercooler y el actuador de geometría variable', 'Reemplazar el turbo directamente', 'Cambiar los inyectores', 'Vaciar el tanque de combustible'], a: 0, exp: 'Una fuga en el lado de presión o un actuador defectuoso causa el mismo síntoma a menor costo.' },
  // Eléctricos y electrónicos
  { id: 'elec-1', c: 'elec', lvl: 1, q: 'Los autobuses suelen usar un sistema de baja tensión de:', o: ['24 V', '12 V', '110 V', '600 V'], a: 0, exp: 'Los vehículos pesados normalmente usan 24 V (dos baterías de 12 V en serie).' },
  { id: 'elec-2', c: 'elec', lvl: 1, q: 'Para medir corriente con un multímetro, este se conecta:', o: ['En serie con el circuito', 'En paralelo con la carga', 'Entre positivo y chasis', 'No se puede medir corriente'], a: 0, exp: 'La corriente se mide en serie (o con pinza amperimétrica).' },
  { id: 'elec-3', c: 'elec', lvl: 2, q: 'Una caída de tensión alta en un conector bajo carga indica:', o: ['Resistencia elevada por corrosión o mal contacto', 'Que el circuito funciona perfecto', 'Exceso de corriente en la batería', 'Un fusible nuevo'], a: 0, exp: 'Toda caída significativa en un punto de unión revela resistencia indeseada.' },
  { id: 'elec-4', c: 'elec', lvl: 2, q: 'Ley de Ohm: con 24 V y una resistencia de 8 Ω, la corriente es:', o: ['3 A', '192 A', '0.33 A', '16 A'], a: 0, exp: 'I = V / R = 24 / 8 = 3 A.' },
  { id: 'elec-5', c: 'elec', lvl: 3, q: 'Para encontrar un consumo parásito que descarga las baterías de 24 V:', o: ['Medir la corriente en reposo tras el tiempo de "sueño" de los módulos y retirar fusibles uno a uno', 'Cambiar las baterías', 'Medir la tensión con el motor encendido', 'Desconectar el alternador'], a: 0, exp: 'Hay que esperar a que las ECU entren en reposo y aislar el circuito que mantiene el consumo.' },
  // Software
  { id: 'sw-1', c: 'sw', lvl: 1, q: 'Antes de actualizar el software de una ECU se debe asegurar:', o: ['Alimentación estable (mantenedor de baterías) y la versión correcta autorizada', 'Que el motor esté encendido a altas RPM', 'Que el autobús esté en movimiento', 'Nada en particular'], a: 0, exp: 'Una caída de tensión durante la programación puede dejar la ECU inutilizable.' },
  { id: 'sw-2', c: 'sw', lvl: 1, q: 'Un código de falla (DTC) indica:', o: ['La condición detectada por una ECU en un circuito o función, no necesariamente la pieza dañada', 'Siempre la pieza que hay que cambiar', 'El kilometraje del autobús', 'Un error del operador'], a: 0, exp: 'El DTC orienta el diagnóstico; la causa raíz se confirma con pruebas.' },
  { id: 'sw-3', c: 'sw', lvl: 2, q: 'Un DTC "histórico" o "inactivo" significa:', o: ['La falla ocurrió en el pasado pero no está presente ahora', 'La falla está activa en este momento', 'El código fue borrado', 'La ECU está dañada'], a: 0, exp: 'Útil para fallas intermitentes: revisa condiciones en las que ocurrió (datos congelados).' },
  { id: 'sw-4', c: 'sw', lvl: 2, q: 'Después de reemplazar una ECU, normalmente se requiere:', o: ['Programarla/configurarla con los parámetros del vehículo', 'Nada, funciona al conectar', 'Cambiar las baterías', 'Reiniciar el tablero 10 veces'], a: 0, exp: 'Las ECU nuevas necesitan software y parámetros específicos del vehículo.' },
  { id: 'sw-5', c: 'sw', lvl: 3, q: 'Si una actualización de software se interrumpe a la mitad:', o: ['No desconectar; seguir el procedimiento de recuperación del fabricante con alimentación estable', 'Desconectar la batería y reintentar al día siguiente', 'Reemplazar la ECU inmediatamente', 'Arrancar el motor para reiniciar'], a: 0, exp: 'Las herramientas oficiales suelen tener un modo de recuperación; desconectar empeora el problema.' },
  // Conectividad
  { id: 'con-1', c: 'con', lvl: 1, q: 'La red CAN en un vehículo sirve para:', o: ['Comunicar las unidades de control (ECU) entre sí', 'Cargar la batería', 'Conectar el aire acondicionado', 'Alimentar las luces'], a: 0, exp: 'CAN es el bus de datos por el que las ECU intercambian información.' },
  { id: 'con-2', c: 'con', lvl: 1, q: 'La telemática de flota permite:', o: ['Monitorear a distancia ubicación, estado y fallas del vehículo', 'Aumentar la potencia del motor', 'Cambiar el aceite automáticamente', 'Reemplazar el diagnóstico en taller'], a: 0, exp: 'Los datos remotos permiten mantenimiento predictivo y diagnóstico anticipado.' },
  { id: 'con-3', c: 'con', lvl: 2, q: 'Resistencia esperada entre CAN-H y CAN-L (sistema apagado, dos terminaciones de 120 Ω):', o: ['≈ 60 Ω', '≈ 120 Ω', '≈ 0 Ω', '≈ 240 Ω'], a: 0, exp: 'Dos resistencias de 120 Ω en paralelo dan 60 Ω.' },
  { id: 'con-4', c: 'con', lvl: 2, q: 'Protocolo de comunicación/diagnóstico estándar en vehículos pesados:', o: ['SAE J1939', 'HDMI', 'Bluetooth LE', 'USB 1.0'], a: 0, exp: 'J1939 es el estándar sobre CAN más usado en vehículos pesados.' },
  { id: 'con-5', c: 'con', lvl: 3, q: 'Si mides 120 Ω entre CAN-H y CAN-L, lo más probable es:', o: ['Una resistencia de terminación ausente o un tramo abierto', 'La red está normal', 'Un corto entre CAN-H y CAN-L', 'Una ECU con software antiguo'], a: 0, exp: 'Solo se "ve" una terminación: falta la otra o el cable está abierto.' },
  // Diagnóstico
  { id: 'diag-1', c: 'diag', lvl: 1, q: 'El primer paso de un diagnóstico estructurado es:', o: ['Confirmar la queja y recopilar información (síntomas, DTC, historial)', 'Cambiar la pieza más probable', 'Borrar todos los códigos', 'Hacer una prueba de ruta larga'], a: 0, exp: 'Sin confirmar la queja y reunir datos, el diagnóstico se vuelve adivinanza.' },
  { id: 'diag-2', c: 'diag', lvl: 1, q: '¿Por qué no se cambian piezas "para probar"?', o: ['Eleva costos, no confirma la causa raíz y puede introducir nuevas fallas', 'Porque las piezas nunca fallan', 'Porque es más rápido diagnosticar', 'No hay problema en hacerlo'], a: 0, exp: 'La sustitución sin evidencia es la principal fuente de reparaciones repetidas.' },
  { id: 'diag-3', c: 'diag', lvl: 2, q: 'DTC de sensor "fuera de rango". ¿Qué verificas antes de cambiar el sensor?', o: ['Alimentación, masa y señal del circuito y su conector', 'La presión de las llantas', 'El nivel de combustible', 'Nada, se cambia el sensor'], a: 0, exp: 'El cableado y conectores fallan con frecuencia igual o mayor que los sensores.' },
  { id: 'diag-4', c: 'diag', lvl: 2, q: 'Verificar una reparación implica:', o: ['Borrar códigos, hacer prueba funcional/de ruta y confirmar que la falla no regresa', 'Entregar el vehículo de inmediato', 'Solo borrar los códigos', 'Preguntar al operador si siente algo raro'], a: 0, exp: 'Una reparación no verificada es una reparación incompleta.' },
  { id: 'diag-5', c: 'diag', lvl: 3, q: 'Con fallas de comunicación simultáneas en varias ECU, sospechas primero de:', o: ['Un problema común: red CAN, alimentación o masa compartida', 'Que todas las ECU fallaron a la vez', 'El software de cada ECU por separado', 'El operador'], a: 0, exp: 'Muchos síntomas a la vez suelen tener una causa común.' },
];

/* ---------- Micro-lecciones (3–6 min) ---------- */
const LESSONS = [
  { id: 'hv1', comp: 'hv', level: 1, min: 5, title: 'Desenergización segura del sistema AV', ref: 'DOC-HV-01 §2',
    cards: [
      { t: 'Riesgo real', b: 'Las baterías de tracción operan a cientos de volts en corriente continua. Un contacto puede causar electrocución o quemaduras por arco eléctrico.' },
      { t: 'EPP correcto', b: 'Guantes dieléctricos de la clase adecuada (inspeccionados con prueba de aire antes de usar), protección facial y herramienta aislada.' },
      { t: 'Secuencia', b: '1) Llave fuera y en tu bolsillo · 2) Desconectar 24 V · 3) Retirar el MSD · 4) Bloquear y etiquetar (LOTO) · 5) Esperar el tiempo de descarga indicado.' },
      { t: 'Nunca', b: 'Nunca abras cubiertas AV ni desconectes conectores naranja con el sistema energizado. El tablero en 0 V NO es una verificación.' },
    ],
    key: 'Desenergizar = aislar (MSD) + bloquear (LOTO) + esperar descarga + verificar.',
    check: { q: '¿Qué paso va justo después de retirar el MSD?', o: ['Bloquear y etiquetar (LOTO) y esperar el tiempo de descarga', 'Abrir la cubierta de la batería', 'Arrancar el autobús para probar', 'Desconectar el inversor'], a: 0 } },
  { id: 'hv2', comp: 'hv', level: 2, min: 4, title: 'Verificación de ausencia de tensión', ref: 'DOC-HV-01 §3',
    cards: [
      { t: 'Instrumento adecuado', b: 'Multímetro con categoría de medición CAT III/IV para la tensión del sistema y puntas en buen estado.' },
      { t: 'Viva – muerta – viva', b: 'Prueba el instrumento en una fuente conocida, mide en los puntos indicados por el manual y vuelve a probar el instrumento.' },
      { t: 'Puntos de medición', b: 'Mide positivo–negativo, positivo–chasis y negativo–chasis en los puntos de prueba definidos.' },
    ],
    key: 'Sin verificación con instrumento probado, el sistema se considera ENERGIZADO.',
    check: { q: '¿Por qué se prueba el multímetro antes y después?', o: ['Para asegurar que una lectura de 0 V no se deba a un instrumento dañado', 'Para calibrarlo', 'Por costumbre', 'Para cargar su batería'], a: 0 } },
  { id: 'ev1', comp: 'ev', level: 1, min: 4, title: 'Arquitectura del autobús eléctrico', ref: 'DOC-EV-01 §1',
    cards: [
      { t: 'Batería de tracción', b: 'Paquetes de alta tensión (techo y/o chasis) con su sistema de gestión (BMS) que controla SOC, temperatura y aislamiento.' },
      { t: 'Inversor y motor', b: 'El inversor convierte CC en CA para el motor de tracción. Al frenar, el motor regenera energía.' },
      { t: 'DC/DC y auxiliares', b: 'El DC/DC alimenta el sistema de 24 V. Compresor de aire, A/C y dirección pueden ser eléctricos de AV.' },
      { t: 'Térmica', b: 'Circuitos de enfriamiento mantienen batería y electrónica en su ventana de temperatura.' },
    ],
    key: 'Batería → inversor → motor; DC/DC alimenta 24 V; BMS supervisa todo.',
    check: { q: '¿Qué componente alimenta el sistema de 24 V en un autobús eléctrico?', o: ['El convertidor DC/DC', 'El inversor de tracción', 'El motor eléctrico', 'El puerto de carga'], a: 0 } },
  { id: 'ev2', comp: 'ev', level: 2, min: 5, title: 'Monitoreo de aislamiento y fallas típicas', ref: 'DOC-EV-02 §1',
    cards: [
      { t: 'Qué mide', b: 'El monitor de aislamiento compara la resistencia entre el circuito AV y el chasis contra un umbral seguro.' },
      { t: 'Síntoma', b: 'Advertencia de falla de aislamiento; el vehículo puede no entrar en READY para proteger a las personas.' },
      { t: 'Localización', b: 'Con el sistema desenergizado, se mide con megóhmetro por segmentos: batería, inversor, motor, compresor, calefactor, etc.' },
      { t: 'Pista clave', b: 'Si el valor cae al activar un consumidor (p. ej. A/C), sospecha de ese circuito y su arnés.' },
    ],
    key: 'Aislamiento bajo → desenergizar → megóhmetro por segmentos → causa raíz.',
    check: { q: '¿Qué instrumento localiza un aislamiento degradado?', o: ['Megóhmetro (probador de aislamiento)', 'Multímetro en continuidad', 'Pinza amperimétrica', 'Escáner de temperatura'], a: 0 } },
  { id: 'diesel1', comp: 'diesel', level: 1, min: 4, title: 'Admisión, turbo y combustión', ref: 'DOC-DI-01 §1',
    cards: [
      { t: 'Aire', b: 'El turbo comprime el aire; el intercooler lo enfría para aumentar su densidad.' },
      { t: 'Combustible', b: 'El sistema de inyección dosifica el combustible según la carga; sin aire suficiente, aparece humo negro.' },
      { t: 'Colores de humo', b: 'Negro: mezcla rica / falta de aire · Azul: aceite · Blanco: refrigerante o combustible sin quemar en frío.' },
    ],
    key: 'Humo negro + pérdida de potencia = revisa primero la entrada de aire.',
    check: { q: 'Humo negro y baja potencia sugieren primero revisar:', o: ['El sistema de admisión de aire y sobrealimentación', 'El refrigerante', 'Las luces', 'El aceite de la transmisión'], a: 0 } },
  { id: 'diesel2', comp: 'diesel', level: 2, min: 5, title: 'Postratamiento: DPF y SCR', ref: 'DOC-DI-02 §1',
    cards: [
      { t: 'DPF', b: 'Atrapa partículas de hollín. Se limpia con regeneración pasiva (temperatura) o activa (controlada por la ECU).' },
      { t: 'SCR', b: 'Inyecta AdBlue/DEF antes del catalizador para convertir NOx en nitrógeno y agua.' },
      { t: 'Reglas', b: 'Nunca retirar ni anular el postratamiento: es ilegal y daña el motor y el ambiente.' },
    ],
    key: 'DPF = hollín (regeneración); SCR = NOx (urea).',
    check: { q: '¿Qué fluido usa el sistema SCR?', o: ['AdBlue/DEF (urea)', 'Aceite', 'Diésel', 'Refrigerante'], a: 0 } },
  { id: 'elec1', comp: 'elec', level: 1, min: 4, title: 'Mediciones básicas en 24 V', ref: 'DOC-EL-01 §1',
    cards: [
      { t: 'Tensión', b: 'Se mide en paralelo. Verifica la batería en reposo y bajo carga.' },
      { t: 'Corriente', b: 'Se mide en serie o con pinza. Cuidado con el rango del fusible del multímetro.' },
      { t: 'Ley de Ohm', b: 'V = I × R. Te permite predecir qué valor deberías leer.' },
    ],
    key: 'Tensión en paralelo, corriente en serie, y siempre compara con lo esperado.',
    check: { q: 'Con 24 V y 6 Ω, ¿qué corriente esperas?', o: ['4 A', '144 A', '0.25 A', '30 A'], a: 0 } },
  { id: 'elec2', comp: 'elec', level: 2, min: 5, title: 'Caída de tensión y consumos parásitos', ref: 'DOC-EL-01 §2',
    cards: [
      { t: 'Caída de tensión', b: 'Con el circuito bajo carga, mide entre ambos lados de una unión: más de unos cientos de mV indica resistencia indeseada.' },
      { t: 'Consumo parásito', b: 'Espera a que las ECU entren en reposo, mide corriente y retira fusibles uno a uno hasta encontrar el circuito.' },
      { t: 'Conectores', b: 'Corrosión, pines expandidos y humedad son causas frecuentes de fallas intermitentes.' },
    ],
    key: 'La caída de tensión bajo carga revela lo que la continuidad no muestra.',
    check: { q: '¿Cuándo se mide la caída de tensión?', o: ['Con el circuito funcionando bajo carga', 'Con todo desconectado', 'Con el multímetro en ohms', 'Nunca'], a: 0 } },
  { id: 'sw1', comp: 'sw', level: 1, min: 3, title: 'DTC, datos congelados y en vivo', ref: 'DOC-SW-01 §1',
    cards: [
      { t: 'DTC', b: 'Describe la condición detectada, no la pieza a cambiar.' },
      { t: 'Activo vs histórico', b: 'Activo: presente ahora. Histórico: ocurrió antes; revisa los datos congelados.' },
      { t: 'Datos en vivo', b: 'Compara valores reales contra los esperados en las mismas condiciones.' },
    ],
    key: 'El DTC orienta; los datos y las pruebas confirman.',
    check: { q: 'Un DTC histórico indica:', o: ['Una falla que ocurrió pero no está activa ahora', 'Una falla activa', 'Un sensor nuevo', 'Que la ECU está apagada'], a: 0 } },
  { id: 'sw2', comp: 'sw', level: 2, min: 4, title: 'Programación segura de ECU', ref: 'DOC-SW-02 §1',
    cards: [
      { t: 'Antes', b: 'Mantenedor de baterías, versión autorizada, consumidores apagados, conexión estable de la herramienta.' },
      { t: 'Durante', b: 'No desconectar, no arrancar, no abrir puertas que activen módulos.' },
      { t: 'Después', b: 'Verifica la versión instalada, borra DTC y realiza prueba funcional.' },
    ],
    key: 'Alimentación estable y versión correcta: sin excepciones.',
    check: { q: 'Durante una programación, la principal causa de ECU dañada es:', o: ['Caída de alimentación', 'Temperatura ambiente', 'El color del cable', 'El kilometraje'], a: 0 } },
  { id: 'con1', comp: 'con', level: 1, min: 4, title: 'Red CAN y J1939', ref: 'DOC-CO-01 §1',
    cards: [
      { t: 'Bus de datos', b: 'Las ECU comparten información por dos hilos trenzados: CAN-High y CAN-Low.' },
      { t: 'Terminaciones', b: 'Dos resistencias de 120 Ω en los extremos; en paralelo se miden ≈ 60 Ω.' },
      { t: 'J1939', b: 'Estándar de mensajes y diagnóstico en vehículos pesados.' },
    ],
    key: '≈60 Ω normal · ≈120 Ω falta una terminación · ≈0 Ω corto.',
    check: { q: 'Una red CAN sana medida entre CAN-H y CAN-L (apagada) da:', o: ['≈ 60 Ω', '≈ 120 Ω', '≈ 0 Ω', 'Infinito'], a: 0 } },
  { id: 'con2', comp: 'con', level: 2, min: 4, title: 'Telemática y diagnóstico remoto', ref: 'DOC-CO-02 §1',
    cards: [
      { t: 'Gateway', b: 'Concentra datos de las redes del vehículo y los envía a la nube de forma segura.' },
      { t: 'Uso en taller', b: 'Permite ver fallas antes de que llegue la unidad y preparar piezas y herramientas.' },
      { t: 'Sin comunicación', b: 'Si varias ECU "desaparecen", sospecha primero de red, alimentación o masa común.' },
    ],
    key: 'La telemática adelanta el diagnóstico, no lo reemplaza.',
    check: { q: 'Varias ECU sin comunicación a la vez sugiere:', o: ['Una causa común de red, alimentación o masa', 'Que todas fallaron', 'Un error del operador', 'Software antiguo en cada una'], a: 0 } },
  { id: 'diag1', comp: 'diag', level: 1, min: 4, title: 'Método de diagnóstico en 6 pasos', ref: 'DOC-DG-01 §1',
    cards: [
      { t: '1–2', b: 'Confirmar la queja · Recopilar información (DTC, datos congelados, historial, boletines).' },
      { t: '3–4', b: 'Formular hipótesis · Probar desde lo más probable y fácil hacia lo complejo.' },
      { t: '5–6', b: 'Reparar la causa raíz · Verificar la reparación y documentar.' },
    ],
    key: 'Confirmar → recopilar → hipótesis → probar → reparar → verificar.',
    check: { q: '¿Cuál es el último paso del método?', o: ['Verificar la reparación y documentar', 'Cambiar piezas', 'Borrar códigos', 'Entregar el vehículo'], a: 0 } },
  { id: 'diag2', comp: 'diag', level: 2, min: 4, title: 'Causa raíz y fallas intermitentes', ref: 'DOC-DG-01 §2',
    cards: [
      { t: 'Causa raíz', b: 'Pregunta "¿por qué?" hasta llegar a la causa física (p. ej., roce de arnés), no al síntoma.' },
      { t: 'Intermitentes', b: 'Reproduce las condiciones: temperatura, vibración, carga. Usa datos congelados.' },
      { t: 'Prueba de movimiento', b: 'Mueve arneses y conectores mientras observas datos en vivo.' },
    ],
    key: 'Reparar el síntoma garantiza que la falla regrese.',
    check: { q: 'Un arnés AV dañado por roce: ¿cuál es la causa raíz?', o: ['La fijación incorrecta que permite el roce', 'El cable', 'El DTC', 'El monitor de aislamiento'], a: 0 } },
];

/* ---------- Fuentes "autorizadas" para el asistente (RAG local) ---------- */
const DOCS = [
  { id: 'DOC-HV-01 §1', title: 'Manual de seguridad AV — Riesgos', text: 'Los sistemas de alto voltaje AV de autobuses eléctricos operan con cientos de volts en corriente continua. El contacto puede causar electrocución y quemaduras por arco eléctrico. Solo personal capacitado y autorizado puede intervenir. Los cables de alto voltaje son de color naranja.' },
  { id: 'DOC-HV-01 §2', title: 'Manual de seguridad AV — Desenergización', text: 'Procedimiento de desenergización: usar EPP guantes dieléctricos inspeccionados y protección facial; retirar la llave; desconectar baterías de 24 V; retirar el MSD manual service disconnect; bloquear y etiquetar LOTO; esperar el tiempo de descarga de capacitores del inversor indicado por el fabricante antes de intervenir.' },
  { id: 'DOC-HV-01 §3', title: 'Manual de seguridad AV — Verificación', text: 'Verificar ausencia de tensión con multímetro categoría CAT III o CAT IV: probar el instrumento en una fuente conocida, medir positivo negativo, positivo chasis y negativo chasis en los puntos de prueba, y volver a probar el instrumento (viva muerta viva). La lectura del tablero no sustituye la verificación.' },
  { id: 'DOC-HV-01 §4', title: 'Manual de seguridad AV — Reenergización', text: 'Para reenergizar: retirar herramientas, reinstalar cubiertas, medir aislamiento, retirar bloqueo LOTO por la persona que lo colocó, reinstalar MSD, conectar 24 V y verificar ausencia de fallas de aislamiento antes de modo READY.' },
  { id: 'DOC-EV-01 §1', title: 'Arquitectura eléctrica — Componentes', text: 'La batería de tracción alimenta el inversor, que convierte corriente continua en alterna para el motor de tracción. El frenado regenerativo recarga la batería. El convertidor DC/DC alimenta el sistema de 24 V. El BMS gestiona estado de carga SOC, estado de salud SOH, temperatura y balanceo de celdas.' },
  { id: 'DOC-EV-02 §1', title: 'Diagnóstico eléctrico — Falla de aislamiento', text: 'Una falla de aislamiento indica resistencia baja entre el circuito AV y el chasis. El vehículo puede no entrar en READY. Con el sistema desenergizado, medir con megóhmetro por segmentos: batería, inversor, motor, compresor eléctrico de aire acondicionado, calefactor. La continuidad del multímetro no detecta aislamiento degradado. Revisar roces de arnés y fijaciones.' },
  { id: 'DOC-EV-03 §1', title: 'Carga — Puerto y sesión de carga', text: 'Si el autobús no carga: verificar el estado del cargador, el conector y el puerto de carga, la comunicación cargador vehículo y los DTC del sistema de carga. Inspeccionar pines dañados y suciedad. No intervenir el puerto con la sesión activa.' },
  { id: 'DOC-DI-01 §1', title: 'Motor diésel — Admisión y turbo', text: 'El turbocompresor usa la energía de los gases de escape para comprimir el aire de admisión. El intercooler enfría el aire. Baja presión de sobrealimentación: revisar fugas en mangueras, abrazaderas e intercooler con prueba de presión o humo, y el actuador de geometría variable antes de reemplazar el turbo. Humo negro indica falta de aire o exceso de combustible.' },
  { id: 'DOC-DI-02 §1', title: 'Motor diésel — Postratamiento', text: 'El DPF filtro de partículas atrapa hollín y se limpia mediante regeneración pasiva o activa. El SCR reduce NOx inyectando AdBlue DEF urea antes del catalizador. Está prohibido retirar o anular el postratamiento. Tras periodos de humo negro revisar el nivel de hollín del DPF.' },
  { id: 'DOC-DI-03 §1', title: 'Motor diésel — Mantenimiento', text: 'Mantenimiento preventivo diésel: cambio de aceite y filtros según intervalo, drenado del separador de agua del combustible, inspección de bandas, revisión del sistema de enfriamiento y del filtro de aire con su indicador de restricción.' },
  { id: 'DOC-EL-01 §1', title: 'Sistema eléctrico 24 V — Mediciones', text: 'Los autobuses usan 24 V. La tensión se mide en paralelo y la corriente en serie o con pinza amperimétrica. Ley de Ohm V = I x R. Una batería de 24 V en reposo bien cargada mide aproximadamente 25 a 25.6 V.' },
  { id: 'DOC-EL-01 §2', title: 'Sistema eléctrico 24 V — Caída de tensión y parásitos', text: 'Caída de tensión: medir bajo carga a ambos lados de una unión o conector; valores altos indican corrosión o mal contacto. Consumo parásito: esperar el tiempo de reposo de los módulos ECU, medir corriente y retirar fusibles uno a uno.' },
  { id: 'DOC-SW-01 §1', title: 'Software — Códigos de falla', text: 'Un DTC describe una condición detectada por una ECU, no necesariamente la pieza dañada. Activo significa presente; histórico o inactivo ocurrió antes. Los datos congelados registran las condiciones al momento de la falla.' },
  { id: 'DOC-SW-02 §1', title: 'Software — Programación de ECU', text: 'Antes de programar o actualizar una ECU conectar mantenedor de baterías, confirmar versión autorizada y conexión estable. No desconectar durante la actualización. Si se interrumpe, seguir el procedimiento de recuperación de la herramienta oficial. Tras reemplazar una ECU se debe programar y configurar con los parámetros del vehículo.' },
  { id: 'DOC-CO-01 §1', title: 'Conectividad — Red CAN', text: 'La red CAN usa dos hilos CAN-H y CAN-L con dos resistencias de terminación de 120 ohm. Con el sistema apagado la resistencia entre CAN-H y CAN-L debe ser cerca de 60 ohm. 120 ohm indica terminación ausente o tramo abierto; cerca de 0 ohm indica corto. El estándar en vehículos pesados es SAE J1939.' },
  { id: 'DOC-CO-02 §1', title: 'Conectividad — Telemática', text: 'El gateway telemático concentra datos de las redes del vehículo y los envía de forma segura a la nube para monitoreo remoto de ubicación, estado y fallas. Varias ECU sin comunicación suelen indicar un problema común de red, alimentación o masa.' },
  { id: 'DOC-DG-01 §1', title: 'Metodología — Diagnóstico estructurado', text: 'Diagnóstico en seis pasos: confirmar la queja, recopilar información DTC datos congelados historial y boletines, formular hipótesis, probar de lo simple a lo complejo, reparar la causa raíz, verificar la reparación con prueba funcional o de ruta y documentar. No cambiar piezas para probar.' },
];

/* ---------- Escenarios prácticos (simulación de fallas) ---------- */
const SCENARIOS = [
  { id: 'ev_aislamiento', title: 'Autobús eléctrico no entra en READY', mode: 'ev', comps: ['hv', 'ev', 'diag'], level: 'Intermedio', min: 8,
    requires: { lesson: 'hv1', mastery: 70 },
    intro: 'Unidad 1042 (eléctrica). El operador reporta que el autobús no entra en modo READY. El tablero muestra: "Falla de aislamiento — servicio requerido".',
    start: 's1',
    nodes: {
      s1: { title: 'Primer contacto', text: 'Llegas a la unidad. ¿Qué haces primero?', focus: 'gateway', opts: [
        { t: 'Conectar la herramienta de diagnóstico y leer códigos de falla (DTC) y datos congelados', ok: true, next: 's2', pts: 10, fb: 'Correcto: primero recopilas información sin intervenir el sistema AV.' },
        { t: 'Abrir la cubierta de la batería del techo para revisarla visualmente', safety: true, tag: 'abrir-av-energizado', fb: 'VIOLACIÓN CRÍTICA: nunca abras componentes AV sin desenergizar y verificar ausencia de tensión.' },
        { t: 'Apagar y encender varias veces hasta que entre en READY', tag: 'reintentos-sin-diagnostico', fb: 'No resuelve la causa y puede ocultar la falla. Primero obtén los DTC.' },
        { t: 'Reemplazar el inversor, que suele ser la causa', tag: 'cambiar-piezas-sin-diagnostico', fb: 'Cambiar piezas sin diagnóstico eleva costos y no confirma la causa raíz.' } ] },
      s2: { title: 'Antes de intervenir', text: 'DTC activo: "Resistencia de aislamiento AV baja". En los datos se ve que el valor cae cuando se activa el A/C. Antes de intervenir físicamente, ¿qué haces?', focus: 'msd', opts: [
        { t: 'Desenergizar: EPP AV, llave fuera, desconectar 24 V, retirar MSD, bloquear y etiquetar (LOTO) y esperar el tiempo de descarga', ok: true, next: 's3', pts: 20, fb: 'Correcto: aíslas la batería y permites la descarga de capacitores.' },
        { t: 'Desconectar conectores naranja con el sistema encendido para aislar más rápido', safety: true, tag: 'desconectar-av-energizado', fb: 'VIOLACIÓN CRÍTICA: riesgo de arco eléctrico y electrocución.' },
        { t: 'Ponerte guantes de nitrilo del taller y comenzar', safety: true, tag: 'epp-inadecuado', fb: 'VIOLACIÓN CRÍTICA: se requieren guantes dieléctricos de la clase adecuada, inspeccionados antes de usar.' } ] },
      s3: { title: 'Confirmar seguridad', text: 'El sistema está bloqueado. ¿Cómo confirmas que es seguro trabajar?', focus: 'inversor', opts: [
        { t: 'Multímetro CAT III/IV: probarlo en fuente conocida, medir en los puntos indicados y volver a probarlo', ok: true, next: 's4', pts: 20, fb: 'Correcto: prueba "viva–muerta–viva".' },
        { t: 'El tablero muestra 0 V en la batería, así que es seguro', safety: true, tag: 'no-verificar-ausencia-tension', fb: 'VIOLACIÓN CRÍTICA: el tablero no sustituye la verificación con instrumento; los capacitores pueden seguir cargados.' },
        { t: 'Medir una sola vez sin probar antes el multímetro', tag: 'verificacion-incompleta', fb: 'Incompleto: si el multímetro falla darías por buena una lectura falsa de 0 V.' } ] },
      s4: { title: 'Localizar la falla', text: 'Ya es seguro trabajar. ¿Cómo localizas el segmento con aislamiento bajo?', focus: 'cable_ac', opts: [
        { t: 'Medir con megóhmetro por segmentos (batería, inversor, motor, compresor A/C, calefactor), aislando cada circuito', ok: true, next: 's5', pts: 25, fb: 'Correcto: el método por segmentos localiza la falla sin cambiar piezas.' },
        { t: 'Reemplazar el paquete de baterías del techo', tag: 'cambiar-piezas-sin-diagnostico', fb: 'Costoso y sin evidencia: el síntoma aparece al activar el A/C.' },
        { t: 'Medir continuidad con el multímetro entre conectores', tag: 'herramienta-incorrecta', fb: 'La continuidad no detecta aislamiento degradado: se requiere megóhmetro.' } ] },
      s5: { title: 'Reparar y verificar', text: 'El megóhmetro indica aislamiento bajo en el arnés del compresor eléctrico de A/C: el forro está dañado por roce contra un soporte. ¿Qué haces?', focus: 'cable_ac', opts: [
        { t: 'Reemplazar el arnés según manual, corregir la fijación, medir aislamiento, reenergizar con el procedimiento, borrar DTC y hacer prueba funcional', ok: true, next: 'end', pts: 25, fb: 'Correcto: reparación verificada y causa raíz (roce) corregida.' },
        { t: 'Encintar el cable dañado y reenergizar', safety: true, tag: 'reparacion-av-no-autorizada', fb: 'VIOLACIÓN CRÍTICA: las reparaciones improvisadas en AV no están permitidas.' },
        { t: 'Reemplazar el arnés y entregar la unidad sin medir de nuevo', tag: 'no-verificar-reparacion', fb: 'Falta verificar: confirma siempre con medición y prueba funcional.' } ] },
    } },
  { id: 'diesel_potencia', title: 'Pérdida de potencia y humo negro', mode: 'diesel', comps: ['diesel', 'diag'], level: 'Básico', min: 6,
    intro: 'Unidad 877 (diésel). El operador reporta falta de potencia en pendientes y humo negro al acelerar. Testigo de falla de motor encendido.',
    start: 's1',
    nodes: {
      s1: { title: 'Recopilar información', text: '¿Cuál es tu primer paso?', focus: 'ecu_motor', opts: [
        { t: 'Leer DTC, datos congelados y confirmar el síntoma con datos en vivo', ok: true, next: 's2', pts: 15, fb: 'Correcto: confirmas la queja con evidencia.' },
        { t: 'Reemplazar el turbo, es la causa típica del humo negro', tag: 'cambiar-piezas-sin-diagnostico', fb: 'Sin evidencia. Un turbo cuesta mucho y quizás no es la causa.' },
        { t: 'Limpiar los inyectores', tag: 'cambiar-piezas-sin-diagnostico', fb: 'Acción sin diagnóstico. Primero confirma la falla y lee los DTC.' } ] },
      s2: { title: 'Interpretar', text: 'DTC: "Presión de sobrealimentación menor a la esperada". En datos en vivo la presión no sube bajo carga; el turbo gira libremente y no tiene fugas de aceite. ¿Siguiente paso?', focus: 'manguera_ic', opts: [
        { t: 'Inspección visual y prueba de fugas del lado de presión: mangueras, abrazaderas e intercooler', ok: true, next: 's3', pts: 25, fb: 'Correcto: lo más probable y económico primero.' },
        { t: 'Reemplazar el turbo', tag: 'cambiar-piezas-sin-diagnostico', fb: 'El turbo gira libre y sin fugas: hay causas más probables.' },
        { t: 'Forzar una regeneración del DPF', tag: 'hipotesis-incorrecta', fb: 'No explica la baja presión de sobrealimentación.' } ] },
      s3: { title: 'Reparar', text: 'La prueba de presión revela una fisura en la manguera de salida del intercooler. ¿Qué haces?', focus: 'manguera_ic', opts: [
        { t: 'Reemplazar la manguera, apretar abrazaderas al torque especificado, borrar DTC y prueba de ruta con datos en vivo', ok: true, next: 's4', pts: 30, fb: 'Correcto: reparación y verificación.' },
        { t: 'Sellar la fisura con cinta de alta temperatura', tag: 'reparacion-provisional', fb: 'Reparación provisional: la falla regresará bajo presión.' },
        { t: 'Reemplazar la manguera y entregar sin prueba', tag: 'no-verificar-reparacion', fb: 'Falta verificar la reparación.' } ] },
      s4: { title: 'Efectos secundarios', text: 'Tras la reparación, el registro indica nivel alto de hollín en el DPF por el periodo con humo negro. ¿Qué haces?', focus: 'postrat', opts: [
        { t: 'Revisar el nivel de hollín y realizar la regeneración según el procedimiento si se requiere', ok: true, next: 'end', pts: 30, fb: 'Correcto: atiendes la consecuencia de la falla original.' },
        { t: 'Retirar el DPF para evitar futuros problemas', safety: true, tag: 'manipular-postratamiento', fb: 'VIOLACIÓN CRÍTICA: retirar el postratamiento está prohibido.' },
        { t: 'Ignorarlo, ya se reparó la manguera', tag: 'ignorar-efecto-secundario', fb: 'El DPF saturado puede causar una nueva falla pronto.' } ] },
    } },
  { id: 'can_comunicacion', title: 'Varias ECU sin comunicación', mode: 'ev', comps: ['con', 'elec', 'diag'], level: 'Intermedio', min: 6,
    intro: 'Unidad 1107. Aparecen DTC de "sin comunicación" en tablero, gateway telemático y control de puertas al mismo tiempo.',
    start: 's1',
    nodes: {
      s1: { title: 'Hipótesis', text: '¿Cuál es tu primera hipótesis?', focus: 'can', opts: [
        { t: 'Un problema común: red CAN, alimentación o masa compartida', ok: true, next: 's2', pts: 25, fb: 'Correcto: muchos síntomas simultáneos suelen tener una causa común.' },
        { t: 'Las tres ECU fallaron; hay que reemplazarlas', tag: 'cambiar-piezas-sin-diagnostico', fb: 'Muy improbable y muy costoso.' },
        { t: 'Actualizar el software de todas las ECU', tag: 'hipotesis-incorrecta', fb: 'Sin evidencia de un problema de software.' } ] },
      s2: { title: 'Medir la red', text: 'Con contacto apagado y baterías desconectadas mides entre CAN-H y CAN-L: 120 Ω. ¿Qué significa?', focus: 'can', opts: [
        { t: 'Falta una terminación o hay un tramo abierto', ok: true, next: 's3', pts: 35, fb: 'Correcto: lo normal sería ≈ 60 Ω.' },
        { t: 'La red está normal', tag: 'interpretacion-can', fb: 'Lo normal son ≈ 60 Ω (dos terminaciones en paralelo).' },
        { t: 'Hay un corto entre CAN-H y CAN-L', tag: 'interpretacion-can', fb: 'Un corto mediría cerca de 0 Ω.' } ] },
      s3: { title: 'Reparar y verificar', text: 'Encuentras el conector del gateway con el pin CAN-L corroído y abierto. ¿Qué haces?', focus: 'gateway', opts: [
        { t: 'Reparar/reemplazar el conector según manual, medir ≈ 60 Ω, verificar comunicación y borrar DTC', ok: true, next: 'end', pts: 40, fb: 'Correcto: reparación verificada.' },
        { t: 'Lavar el conector con agua y reconectar', tag: 'reparacion-provisional', fb: 'El agua empeora la corrosión.' },
        { t: 'Puentear CAN-H con CAN-L', safety: true, tag: 'puentear-red', fb: 'VIOLACIÓN: puentear la red puede dañar módulos y deja el vehículo inoperable.' } ] },
    } },
];

const ERROR_LABELS = {
  'abrir-av-energizado': 'Abrir componentes AV energizados',
  'desconectar-av-energizado': 'Desconectar conectores AV energizados',
  'epp-inadecuado': 'EPP inadecuado para AV',
  'no-verificar-ausencia-tension': 'No verificar ausencia de tensión',
  'verificacion-incompleta': 'Verificación de tensión incompleta',
  'reparacion-av-no-autorizada': 'Reparación AV no autorizada',
  'reintentos-sin-diagnostico': 'Reintentos sin diagnóstico',
  'cambiar-piezas-sin-diagnostico': 'Cambiar piezas sin diagnóstico',
  'herramienta-incorrecta': 'Herramienta de medición incorrecta',
  'no-verificar-reparacion': 'No verificar la reparación',
  'hipotesis-incorrecta': 'Hipótesis no sustentada',
  'reparacion-provisional': 'Reparación provisional',
  'manipular-postratamiento': 'Manipular postratamiento',
  'ignorar-efecto-secundario': 'Ignorar efectos secundarios',
  'interpretacion-can': 'Interpretación errónea de medición CAN',
  'puentear-red': 'Puentear la red de datos',
};

/* ---------- Componentes del modelo 3D ---------- */
const COMPONENTS = {
  bateria_av:   { name: 'Baterías de tracción (techo)', comp: 'ev', lesson: 'ev1', doc: 'DOC-EV-01 §1', desc: 'Paquetes de alto voltaje gestionados por el BMS (SOC, SOH, temperatura, aislamiento).' },
  bateria_av2:  { name: 'Batería de tracción (trasera)', comp: 'ev', lesson: 'ev1', doc: 'DOC-EV-01 §1', desc: 'Paquete adicional de alto voltaje en la sección trasera.' },
  msd:          { name: 'MSD — Desconexión de servicio', comp: 'hv', lesson: 'hv1', doc: 'DOC-HV-01 §2', desc: 'Interrumpe físicamente el circuito de la batería AV. Paso obligatorio de la desenergización.' },
  inversor:     { name: 'Inversor de tracción', comp: 'ev', lesson: 'ev1', doc: 'DOC-EV-01 §1', desc: 'Convierte CC en CA trifásica para el motor. Contiene capacitores que requieren tiempo de descarga.' },
  motor_e:      { name: 'Motor eléctrico de tracción', comp: 'ev', lesson: 'ev1', doc: 'DOC-EV-01 §1', desc: 'Impulsa el vehículo y regenera energía al frenar.' },
  dcdc:         { name: 'Convertidor DC/DC', comp: 'ev', lesson: 'ev1', doc: 'DOC-EV-01 §1', desc: 'Alimenta el sistema de 24 V a partir de la batería de alto voltaje.' },
  compresor_ac: { name: 'Compresor eléctrico de A/C', comp: 'ev', lesson: 'ev2', doc: 'DOC-EV-02 §1', desc: 'Consumidor de alto voltaje en el techo. Su arnés puede sufrir roces.' },
  cable_ac:     { name: 'Arnés AV del compresor A/C', comp: 'hv', lesson: 'ev2', doc: 'DOC-EV-02 §1', desc: 'Cableado naranja de alto voltaje hacia el compresor. Revisar fijaciones y roces.' },
  cable_av:     { name: 'Cableado de alto voltaje', comp: 'hv', lesson: 'hv1', doc: 'DOC-HV-01 §1', desc: 'Conductores naranja que unen batería, inversor y consumidores AV.' },
  puerto_carga: { name: 'Puerto de carga', comp: 'ev', lesson: 'ev1', doc: 'DOC-EV-03 §1', desc: 'Conexión al cargador. Revisar pines y comunicación cargador–vehículo.' },
  enfriamiento: { name: 'Sistema de enfriamiento', comp: 'ev', lesson: 'ev1', doc: 'DOC-EV-01 §1', desc: 'Mantiene batería, inversor y motor en su ventana térmica.' },
  gateway:      { name: 'Gateway telemático', comp: 'con', lesson: 'con2', doc: 'DOC-CO-02 §1', desc: 'Concentra los datos de las redes del vehículo y los envía a la nube.' },
  bateria_24:   { name: 'Baterías de 24 V', comp: 'elec', lesson: 'elec1', doc: 'DOC-EL-01 §1', desc: 'Alimentan los módulos y sistemas de baja tensión.' },
  can:          { name: 'Red CAN (J1939)', comp: 'con', lesson: 'con1', doc: 'DOC-CO-01 §1', desc: 'Bus de datos entre ECU. ≈60 Ω entre CAN-H y CAN-L con el sistema apagado.' },
  motor_d:      { name: 'Motor diésel', comp: 'diesel', lesson: 'diesel1', doc: 'DOC-DI-03 §1', desc: 'Motor de combustión trasero de 6 cilindros en línea.' },
  turbo:        { name: 'Turbocompresor', comp: 'diesel', lesson: 'diesel1', doc: 'DOC-DI-01 §1', desc: 'Sobrealimenta la admisión usando los gases de escape.' },
  manguera_ic:  { name: 'Manguera del intercooler', comp: 'diesel', lesson: 'diesel1', doc: 'DOC-DI-01 §1', desc: 'Conduce el aire comprimido. Una fisura causa baja presión de sobrealimentación.' },
  intercooler:  { name: 'Intercooler / radiador', comp: 'diesel', lesson: 'diesel1', doc: 'DOC-DI-01 §1', desc: 'Enfría el aire de admisión y el refrigerante del motor.' },
  postrat:      { name: 'Postratamiento DPF + SCR', comp: 'diesel', lesson: 'diesel2', doc: 'DOC-DI-02 §1', desc: 'Filtro de partículas y reducción catalítica de NOx.' },
  tanque_adblue:{ name: 'Tanque de AdBlue/DEF', comp: 'diesel', lesson: 'diesel2', doc: 'DOC-DI-02 §1', desc: 'Solución de urea para el sistema SCR.' },
  tanque_comb:  { name: 'Tanque de combustible', comp: 'diesel', lesson: 'diesel1', doc: 'DOC-DI-03 §1', desc: 'Almacena el diésel; incluye separador de agua en la línea.' },
  ecu_motor:    { name: 'ECU de motor', comp: 'sw', lesson: 'sw1', doc: 'DOC-SW-01 §1', desc: 'Controla inyección y sobrealimentación; registra DTC y datos congelados.' },
};

const BADGES = {
  primer_paso:   { name: 'Primer paso',          icon: '{{i:flag}}', desc: 'Completaste el diagnóstico inicial' },
  micro_5:       { name: 'Micro-aprendiz',       icon: '{{i:book}}', desc: 'Completaste 5 micro-lecciones' },
  guardian_av:   { name: 'Guardián AV',          icon: '{{i:shield}}', desc: 'Escenario eléctrico sin violaciones de seguridad' },
  detective:     { name: 'Detective de fallas',  icon: '{{i:search}}', desc: 'Escenario con 100% al primer intento' },
  memoria:       { name: 'Memoria de acero',     icon: '{{i:layers}}', desc: 'Retención diferida ≥ 80%' },
  constante:     { name: 'Constancia',           icon: '{{i:repeat}}', desc: '5 repasos espaciados completados' },
  mejora:        { name: 'Gran salto',           icon: '{{i:trendUp}}', desc: 'Ganancia normalizada ≥ 0.5 en el post-test' },
};

/* ---------- Equipo simulado para el tablero del supervisor ---------- */
const TEAM_SEED = [
  { name: 'A. Ramírez',  role: 'ev',     xp: 1340, pre: 48, post: 81, delayed: 74, viol: 0, m: { hv: 88, ev: 82, diesel: 45, elec: 76, sw: 70, con: 64, diag: 80 }, errs: ['verificacion-incompleta'] },
  { name: 'M. Torres',   role: 'diesel', xp: 980,  pre: 55, post: 77, delayed: 70, viol: 1, m: { hv: 52, ev: 41, diesel: 90, elec: 70, sw: 62, con: 58, diag: 78 }, errs: ['no-verificar-ausencia-tension', 'cambiar-piezas-sin-diagnostico'] },
  { name: 'L. Hernández',role: 'elec',   xp: 1510, pre: 62, post: 88, delayed: 83, viol: 0, m: { hv: 80, ev: 75, diesel: 60, elec: 92, sw: 88, con: 90, diag: 89 }, errs: [] },
  { name: 'J. Castillo', role: 'nuevo',  xp: 420,  pre: 28, post: 63, delayed: 51, viol: 2, m: { hv: 45, ev: 38, diesel: 50, elec: 47, sw: 40, con: 35, diag: 52 }, errs: ['abrir-av-energizado', 'cambiar-piezas-sin-diagnostico', 'no-verificar-reparacion'] },
  { name: 'R. Gómez',    role: 'ev',     xp: 1120, pre: 51, post: 79, delayed: 69, viol: 0, m: { hv: 84, ev: 77, diesel: 40, elec: 68, sw: 66, con: 60, diag: 71 }, errs: ['herramienta-incorrecta'] },
  { name: 'P. Vargas',   role: 'diesel', xp: 760,  pre: 44, post: 70, delayed: 58, viol: 1, m: { hv: 58, ev: 46, diesel: 84, elec: 61, sw: 50, con: 48, diag: 66 }, errs: ['cambiar-piezas-sin-diagnostico', 'reparacion-provisional'] },
  { name: 'S. Méndez',   role: 'elec',   xp: 1260, pre: 58, post: 84, delayed: 79, viol: 0, m: { hv: 74, ev: 70, diesel: 55, elec: 88, sw: 85, con: 86, diag: 84 }, errs: ['interpretacion-can'] },
  { name: 'D. Ortega',   role: 'nuevo',  xp: 310,  pre: 31, post: 58, delayed: 47, viol: 1, m: { hv: 49, ev: 36, diesel: 44, elec: 42, sw: 39, con: 33, diag: 47 }, errs: ['no-verificar-ausencia-tension', 'cambiar-piezas-sin-diagnostico'] },
];

/* ---------- Modelos 3D que acompañan a cada micro-lección ----------
   views: vistas disponibles (detalle de un conjunto o autobús completo con rayos X)
   focus: piezas que se listan y se pueden resaltar en esa vista */
const BUS_EV_FOCUS = ['bateria_av', 'msd', 'inversor', 'motor_e', 'dcdc', 'cable_av', 'enfriamiento', 'bateria_24'];
const LESSON_3D = {
  hv1:     [{ name: 'Inversor y MSD', scene: 'inversor', hide: ['busbar', 'caps'], focus: ['bateria', 'msd', 'msd_base', 'lock', 'lid', 'housing', 'tp'] }, { name: 'Autobús eléctrico', mode: 'ev', focus: ['msd', 'bateria_av', 'cable_av', 'inversor', 'bateria_24'] }],
  hv2:     [{ name: 'Puntos de prueba', scene: 'inversor', hide: ['caps'], focus: ['tp', 'busbar', 'msd', 'lock', 'housing', 'bateria'] }, { name: 'Autobús eléctrico', mode: 'ev', focus: ['msd', 'inversor', 'cable_av', 'bateria_av'] }],
  ev1:     [{ name: 'Autobús eléctrico', mode: 'ev', focus: BUS_EV_FOCUS.concat(['puerto_carga']) }, { name: 'Inversor y motor', scene: 'inversor', hide: ['busbar', 'caps', 'lock'], focus: ['bateria', 'housing', 'motor', 'msd'] }],
  ev2:     [{ name: 'Autobús eléctrico', mode: 'ev', focus: ['compresor_ac', 'cable_ac', 'bateria_av', 'inversor', 'motor_e', 'cable_av'] }],
  diesel1: [{ name: 'Turbo e intercooler', scene: 'intercooler', hide: ['crack'], focus: ['turbo', 'hose', 'intercooler', 'clamp1', 'clamp2', 'block'] }, { name: 'Autobús diésel', mode: 'diesel', focus: ['motor_d', 'turbo', 'manguera_ic', 'intercooler', 'tanque_comb', 'ecu_motor'] }],
  diesel2: [{ name: 'Autobús diésel', mode: 'diesel', focus: ['postrat', 'tanque_adblue', 'motor_d', 'ecu_motor', 'turbo'] }],
  elec1:   [{ name: 'Baterías de 24 V', scene: 'baterias', focus: ['batA', 'batB', 'a_pos', 'b_neg', 'jumper', 'cable_pos', 'cable_neg', 'bracket'] }, { name: 'Autobús', mode: 'ev', focus: ['bateria_24', 'dcdc', 'can'] }],
  elec2:   [{ name: 'Baterías de 24 V', scene: 'baterias', focus: ['jumper', 'a_pos', 'a_neg', 'b_pos', 'b_neg', 'cable_pos', 'cable_neg', 'batA', 'batB'] }, { name: 'Autobús', mode: 'ev', focus: ['bateria_24', 'dcdc', 'gateway'] }],
  sw1:     [{ name: 'Autobús diésel', mode: 'diesel', focus: ['ecu_motor', 'can', 'gateway', 'motor_d', 'turbo'] }],
  sw2:     [{ name: 'Autobús diésel', mode: 'diesel', focus: ['ecu_motor', 'bateria_24', 'can', 'gateway'] }, { name: 'Baterías de 24 V', scene: 'baterias', focus: ['batA', 'batB', 'cable_pos', 'cable_neg'] }],
  con1:    [{ name: 'Autobús', mode: 'ev', focus: ['can', 'gateway', 'inversor', 'bateria_24'] }],
  con2:    [{ name: 'Autobús', mode: 'ev', focus: ['gateway', 'can', 'bateria_24', 'bateria_av'] }],
  diag1:   [{ name: 'Turbo e intercooler', scene: 'intercooler', focus: ['hose', 'crack', 'clamp1', 'clamp2', 'turbo', 'intercooler'] }, { name: 'Autobús diésel', mode: 'diesel', focus: ['ecu_motor', 'motor_d', 'turbo', 'manguera_ic'] }],
  diag2:   [{ name: 'Autobús eléctrico', mode: 'ev', focus: ['cable_ac', 'compresor_ac', 'cable_av', 'can', 'gateway'] }, { name: 'Baterías de 24 V', scene: 'baterias', focus: ['a_pos', 'jumper', 'cable_neg', 'bracket'] }],
};

/* Descripción corta de las piezas de los conjuntos en detalle */
const DETAIL_INFO = {
  bateria:  'Paquete de tracción de alto voltaje (≈650 V CC). Nunca se interviene sin desenergizar y verificar.',
  msd_base: 'Alojamiento del MSD. Al retirar el MSD el circuito de la batería queda abierto físicamente.',
  msd:      'Desconexión manual de servicio: se retira para aislar la batería. Guárdalo contigo mientras trabajas.',
  lock:     'Candado y etiqueta personal (LOTO): impide que alguien reinstale el MSD mientras trabajas.',
  housing:  'Carcasa del inversor: dentro hay capacitores que conservan carga unos minutos tras desconectar.',
  lid:      'Tapa de la zona de alto voltaje. Solo se abre con el sistema desenergizado y verificado.',
  bolt1: 'Tornillo de la tapa (M8). Se retira con herramienta aislada.', bolt2: 'Tornillo de la tapa (M8). Se retira con herramienta aislada.',
  bolt3: 'Tornillo de la tapa (M8). Se retira con herramienta aislada.', bolt4: 'Tornillo de la tapa (M8). Se retira con herramienta aislada.',
  busbar:   'Barra colectora de CC+: lleva la corriente de la batería al inversor.',
  tp:       'Puntos de prueba: aquí se verifica ausencia de tensión (+/–, +/chasis, –/chasis) con multímetro CAT III/IV.',
  motor:    'Motor de tracción: recibe CA trifásica del inversor y regenera energía al frenar.',
  block:    'Bloque del motor diésel: aquí ocurre la combustión del aire comprimido con el combustible.',
  turbo:    'Turbocompresor: usa los gases de escape para comprimir el aire de admisión.',
  hose:     'Manguera del intercooler: lleva el aire comprimido. Una fuga causa humo negro y pérdida de potencia.',
  crack:    'Fisura en la manguera: el aire se escapa, baja la presión de sobrealimentación (falla típica).',
  clamp1:   'Abrazadera: sella la unión de la manguera. Floja = fuga de aire.', clamp2: 'Abrazadera: sella la unión de la manguera. Floja = fuga de aire.',
  intercooler: 'Intercooler: enfría el aire comprimido para que sea más denso y mejore la combustión.',
  batA:     'Batería A de 12 V. Conectada en serie con la B forma los 24 V del autobús.',
  batB:     'Batería B de 12 V. Conectada en serie con la A forma los 24 V del autobús.',
  a_pos:    'Borne positivo de la batería A. Revisa corrosión y apriete: causa común de caída de tensión.',
  a_neg:    'Borne negativo de la batería A, unido por el puente a la batería B.',
  b_pos:    'Borne positivo de la batería B, unido por el puente a la batería A.',
  b_neg:    'Borne negativo de la batería B: va a chasis (masa). Se desconecta primero y se conecta al final.',
  cable_pos:'Cable positivo principal: alimenta el sistema de 24 V. Aquí se mide corriente con pinza.',
  jumper:   'Puente entre baterías (A– a B+): une las dos de 12 V en serie. Mide caída de tensión bajo carga.',
  cable_neg:'Cable negativo a chasis (masa). Una mala masa provoca fallas raras en varios módulos a la vez.',
  bracket:  'Sujetador: evita que las baterías se muevan; la vibración daña bornes y cables.',
};

/* Palabras que, si aparecen en la tarjeta, resaltan esa pieza en el modelo */
const PART_KEYWORDS = {
  msd: ['MSD'], lock: ['LOTO', 'etiquet', 'bloquear'], bateria: ['baterías de tracción', 'batería de tracción', 'cientos de volts', 'Batería de tracción'],
  bateria_av: ['batería de tracción', 'Batería de tracción', 'BMS', 'Paquetes'], tp: ['Puntos de medición', 'puntos indicados', 'puntos de prueba', 'ausencia', 'multímetro', 'Multímetro'],
  lid: ['cubiertas AV', 'cubierta'], housing: ['conectores naranja', 'descarga'], inversor: ['inversor'], motor: ['motor de tracción', 'regenera'], motor_e: ['motor de tracción', 'regenera', 'motor'],
  dcdc: ['DC/DC'], enfriamiento: ['enfriamiento', 'Térmica'], compresor_ac: ['A/C', 'compresor', 'consumidor'], cable_ac: ['arnés', 'Arnés'], cable_av: ['circuito AV', 'chasis', 'conectores naranja'],
  turbo: ['turbo'], intercooler: ['intercooler'], hose: ['admisión', 'aire', 'Aire'], manguera_ic: ['admisión', 'aire'], block: ['combustión', 'inyección', 'Combustible', 'humo'],
  postrat: ['DPF', 'SCR', 'catalizador', 'postratamiento'], tanque_adblue: ['AdBlue', 'DEF', 'urea'], motor_d: ['motor', 'humo'], tanque_comb: ['combustible'],
  batA: ['Tensión', 'paralelo', 'reposo'], cable_pos: ['Corriente', 'serie', 'pinza', 'consumo', 'Consumo'], jumper: ['unión', 'Caída', 'caída'], a_pos: ['Conectores', 'Corrosión', 'corrosión'], cable_neg: ['masa', 'chasis'], bracket: ['vibración'],
  ecu_motor: ['ECU', 'DTC', 'Datos', 'datos', 'versión'], gateway: ['Gateway', 'nube', 'telemática', 'Telemática'], can: ['CAN', 'J1939', 'Ω', 'red', 'comunicación'], bateria_24: ['Mantenedor', 'alimentación', '24 V'],
  crack: ['Confirmar', 'hipótesis', 'Causa raíz', 'causa'], clamp1: ['Reparar', 'Verificar'],
};