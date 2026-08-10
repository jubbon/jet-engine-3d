/* Spanish. Aviation usage: góndola for the nacelle, álabe for a blade,
 * tobera for the nozzle, índice de derivación for the bypass ratio. "Fan" is
 * kept as the loanword the industry actually uses in Spanish. Decimal commas
 * in the prose, matching what Intl produces in the read-outs. */

export default {
  'app.title': 'Motor turbofán — modelo 3D interactivo',
  'app.loading': 'Montando el motor…',
  'panel.h1': 'Motor turbofán',
  'panel.sub': 'Turbofán de alto índice de derivación · modelo interactivo',

  'panel.flow.title': 'Flujos de aire',
  'panel.flow.hint': 'conducto secundario frío y chorro caliente',
  'panel.cut.title': 'Ver por dentro',
  'panel.cut.hint': 'carcasas seccionadas, se ve el rotor',
  'panel.sound.title': 'Sonido del motor',
  'panel.sound.hint': 'sintetizado a partir de N1 y N2',
  'panel.volume': 'Volumen',

  'power.start': 'Arrancar el motor',
  'power.shutdown': 'Apagar el motor',
  'power.hint.starting': 'arrastre del motor de arranque, encendido…',
  'power.hint.stopping': 'corte de combustible, rotores deteniéndose…',
  'power.hint.running': 'corte de combustible, parada por inercia',
  'power.hint.off': 'arranque, encendido, aceleración hasta ralentí',
  'mode.off': 'APAGADO',
  'mode.start': 'ARRANCANDO',
  'mode.run': 'EN MARCHA',
  'mode.stop': 'PARADA · INERCIA',
  'panel.state': 'Estado',
  'panel.timescale': 'Escala de tiempo',
  'panel.throttle': 'Potencia del motor (palanca)',
  'panel.rev.title': 'Inversor de empuje',
  'panel.reverser': 'Inversor',
  'rev.stowed': 'REPLEGADO',
  'rev.deploying': 'DESPLEGANDO',
  'rev.deployed': 'DESPLEGADO',
  'rev.stowing': 'REPLEGANDO',
  'rev.hint.deploy': 'el manguito retrocede y las puertas cierran el flujo secundario',
  'rev.hint.stow': 'las puertas se abren y el manguito vuelve a su sitio',
  'rev.hint.moving': 'el manguito está en movimiento, el motor se mantiene a ralentí',
  'rev.hint.off': 'el motor debe estar en marcha',

  'gauge.n1.sub': 'fan',
  'gauge.n2.sub': 'rotor de alta',
  'gauge.t4.sub': 'antes de la turbina de alta',
  'gauge.thrust.label': 'Empuje',
  'gauge.thrust.sub': 'calculado',

  'amb.title': 'Condiciones ambientales',
  'amb.altitude': 'Altitud',
  'amb.isa': 'Desviación respecto al estándar',
  'amb.rh': 'Humedad relativa',
  'amb.t.sub': 'aire exterior',
  'amb.td.sub': 'punto de rocío',
  'amb.e.sub': 'vapor, Pa',
  'amb.rhi.sub': 'sobre hielo',

  'trail.title': 'Estela de condensación',
  'trail.eta': 'Rendimiento propulsivo',
  'trail.tform.sub': 'se forma por debajo',
  'trail.tmix.sub': 'en la tobera',
  'verdict.none': 'SIN ESTELA',
  'verdict.short-lived': 'EFÍMERA',
  'verdict.persistent': 'PERSISTENTE',

  'hint.trail.persistent':
    'El aire está {margin} °C por debajo del umbral, así que se forma estela; está sobresaturado respecto al hielo, de modo que la estela se extiende en lugar de evaporarse. {where}.',
  'hint.trail.shortLived':
    'El aire está {margin} °C por debajo del umbral, así que se forma estela; respecto al hielo no está saturado, de modo que los cristales se evaporan en segundos. {where}.',
  'hint.trail.none': 'El aire está {margin} °C por encima del umbral: no hay estela. {where}.',

  'where.higher.stop': '{km} km más arriba dejaría de formarse',
  'where.lower.stop': '{km} km más abajo dejaría de formarse',
  'where.higher.start': '{km} km más arriba empezaría a formarse',
  'where.lower.start': '{km} km más abajo empezaría a formarse',
  'where.nowhere': 'En ningún punto entre el suelo y los {max} km se comportaría este aire de otro modo',

  'cut.angle': 'Ángulo de la sección',
  'cut.rotation': 'Giro de la sección',
  'explode.label': 'Separar los módulos',

  'toggle.xray': 'Carcasas transparentes',
  'toggle.nacelle': 'Góndola',
  'toggle.labels': 'Etiquetas de los módulos',
  'toggle.lines': 'Líneas de corriente',
  'toggle.haze': 'Gases de escape',
  'toggle.trail': 'Estela de condensación',
  'toggle.spin': 'Giro de los rotores',
  'toggle.orbit': 'Órbita de la cámara',

  'footer.mouse': 'Clic izq. — orbitar · rueda — zoom · clic der. — desplazar',
  'footer.keys1': 'Space — flujos · C — sección · X — rayos X · S — sonido',
  'footer.keys2': 'E — arranque/parada · R — inversor · H — gases · T — estela',
  'footer.keys3': '1…9, 0 — vistas',

  'legend.title': 'Flujos',
  'legend.bypass.name': 'Conducto secundario',
  'legend.bypass.text': ' — aire frío, ~15…50 °C a nivel del mar. Hasta el 80 % del empuje.',
  'legend.compression.name': 'Compresión',
  'legend.compression.text': ' — en el compresor el aire se calienta hasta 600 °C.',
  'legend.combustion.name': 'Combustión',
  'legend.combustion.text': ' — 1800…2000 °C en el tubo de llama.',
  'legend.jet.name': 'Chorro caliente',
  'legend.jet.text': ' — expansión por la turbina y la tobera, 550 °C.',

  'stations.head.station': 'sección',
  'stations.head.t': 'T, °C',
  'stations.head.p': 'P, bar',
  'station.intake': 'Entrada de aire',
  'station.bypass': 'Conducto secundario',
  'station.booster': 'Tras el booster',
  'station.hpc': 'Tras el compresor de alta',
  'station.combustor': 'Cámara de combustión',
  'station.hpt': 'Tras la turbina de alta',
  'station.nozzle': 'Salida de la tobera',

  'view.overview': 'Vista general',
  'view.cutaway': 'Sección',
  'view.front': 'Frontal',
  'view.fan': 'Fan',
  'view.hpc': 'Compresor de alta',
  'view.combustor': 'Cámara de combustión',
  'view.turbine': 'Turbina',
  'view.nozzle': 'Tobera y chorro',
  'view.behind': 'Desde atrás, dentro del chorro',
  'view.contrail': 'Estela de condensación',

  'label.nacelle': 'Góndola',
  'label.reverser': 'Inversor',
  'label.fan': 'Fan',
  'label.booster': 'Booster',
  'label.hpc': 'Compresor AP',
  'label.combustor': 'Cámara de combustión',
  'label.hpt': 'Turbina AP',
  'label.lpt': 'Turbina BP',
  'label.nozzle': 'Tobera',
  'label.shafts': 'Ejes BP / AP',
  'label.accessory': 'Caja de accesorios',

  'module.nacelle.title': 'Góndola y entrada de aire',
  'module.nacelle.info':
    'Anillo de entrada con sistema antihielo, capós del fan y conducto secundario. Dimensión máxima 2,44 m, longitud hasta la salida de la tobera del fan 3,18 m. La parte inferior y el labio están achatados (la «bolsa de hámster»): el ala del 737 queda baja sobre el suelo.',
  'module.reverser.title': 'Inversor de empuje',
  'module.reverser.info':
    'Inversor de cascadas del flujo secundario. El manguito se desplaza 0,45 m hacia atrás y descubre los álabes deflectores; doce puertas obturadoras cierran el conducto, arrastradas por bielas a la pared fija en lugar de ir accionadas, de modo que solo cierran al final del recorrido. El flujo primario no se toca: solo se desvía el aire del fan, y en inversión da alrededor de una quinta parte del empuje de despegue.',
  'module.fan.title': 'Fan (N1)',
  'module.fan.info':
    '24 álabes de cuerda ancha, cuerda máxima 0,279 m. Diámetro 1,549 m, 5175 rpm a potencia de despegue. Produce hasta el 80 % del empuje impulsando aire al conducto secundario. Índice de derivación 5,1.',
  'module.booster.title': 'Booster, compresor de baja presión (N1)',
  'module.booster.info':
    'Compresor de baja presión: 3 escalones en el eje del fan. Eleva el aire del núcleo hasta unos 2,5 bar antes del compresor de alta presión.',
  'module.hpc.title': 'Compresor de alta presión (N2)',
  'module.hpc.info':
    '9 escalones. Comprime el aire unas 11 veces; junto con el fan y el booster eso da una relación de compresión global de unos 28 y un calentamiento hasta 550-600 °C. Parte del aire se sangra para refrigerar la turbina y para el aire acondicionado.',
  'module.combustor.title': 'Cámara de combustión',
  'module.combustor.info':
    'Cámara anular con 20 inyectores de combustible. El combustible arde a 1800-2000 °C; el aire del compresor de alta refrigera por película el tubo de llama. Solo un 25 % del aire participa en la combustión, el resto es refrigeración y dilución.',
  'module.hpt.title': 'Turbina de alta presión (N2)',
  'module.hpt.info':
    '1 escalón. Álabes monocristalinos con refrigeración interna por aire y recubrimiento cerámico trabajan en gas a 1500 °C, por encima del punto de fusión de la aleación. Basta un escalón porque asume un gran salto de presión a alta velocidad de álabe: mueve el compresor de alta a unas 14 500 rpm.',
  'module.lpt.title': 'Turbina de baja presión (N1)',
  'module.lpt.info':
    '4 escalones de gran diámetro. Extrae del gas la energía restante y mueve el fan y el booster a través de un eje largo (5175 rpm a potencia de despegue).',
  'module.exhaust.title': 'Bastidor trasero de turbina y tobera del núcleo',
  'module.exhaust.info':
    'Los montantes del bastidor trasero sostienen el cojinete del eje de baja y enderezan el giro del gas. El cono central conforma la tobera; el chorro sale a 400-500 m/s y 550-600 °C.',
  'module.cowl.title': 'Pared interior del conducto secundario',
  'module.cowl.info':
    'La pared que separa el conducto secundario frío del núcleo caliente. Bajo ella se alojan los accesorios, las tuberías y el aislamiento térmico.',
  'module.shafts.title': 'Ejes de los rotores',
  'module.shafts.info':
    'Dos ejes coaxiales: el eje de baja (fan + booster + turbina de baja) pasa por dentro del eje hueco de alta (compresor de alta + turbina de alta). Los rotores giran de forma independiente a distintas velocidades.',
  'module.accessory.title': 'Caja de accesorios y equipos',
  'module.accessory.info':
    'Una transmisión cónica desde el eje de alta acciona las bombas de combustible y de aceite, los generadores y el motor de arranque. Aquí están también las tuberías de sangrado y las unidades FADEC. En el 737 la caja se trasladó de debajo del motor a un lateral, y eso es lo que permitió achatar la parte inferior de la góndola.',
};
