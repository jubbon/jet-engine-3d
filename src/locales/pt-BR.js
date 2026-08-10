/* Brazilian Portuguese. Aviation usage: nacele for the nacelle, pá for a fan
 * blade and palheta for a compressor or turbine blade, bocal for the nozzle,
 * razão de derivação for the bypass ratio, empuxo for thrust. Decimal commas
 * in the prose. */

export default {
  'app.title': 'Motor turbofan — modelo 3D interativo',
  'app.loading': 'Montando o motor…',
  'panel.h1': 'Motor turbofan',
  'panel.sub': 'Turbofan de alta razão de derivação · modelo interativo',

  'panel.flow.title': 'Fluxos de ar',
  'panel.flow.hint': 'fluxo secundário frio e jato quente',
  'panel.cut.title': 'Ver por dentro',
  'panel.cut.hint': 'carcaças em corte, rotor à vista',
  'panel.sound.title': 'Som do motor',
  'panel.sound.hint': 'sintetizado a partir de N1 e N2',
  'panel.volume': 'Volume',

  'power.start': 'Dar partida no motor',
  'power.shutdown': 'Desligar o motor',
  'power.hint.starting': 'arrasto do motor de partida, ignição…',
  'power.hint.stopping': 'corte de combustível, rotores desacelerando…',
  'power.hint.running': 'corte de combustível, desaceleração do rotor',
  'power.hint.off': 'partida, ignição, aceleração até a marcha lenta',
  'mode.off': 'DESLIGADO',
  'mode.start': 'DANDO PARTIDA',
  'mode.run': 'EM FUNCIONAMENTO',
  'mode.stop': 'CORTE · DESACELERAÇÃO',
  'panel.state': 'Estado',
  'panel.timescale': 'Escala de tempo',
  'panel.throttle': 'Potência do motor (manete)',

  'gauge.n1.sub': 'fan',
  'gauge.n2.sub': 'rotor de alta',
  'gauge.t4.sub': 'antes da turbina de alta',
  'gauge.thrust.label': 'Empuxo',
  'gauge.thrust.sub': 'calculado',

  'amb.title': 'Condições ambientais',
  'amb.altitude': 'Altitude',
  'amb.isa': 'Desvio em relação ao padrão',
  'amb.rh': 'Umidade relativa',
  'amb.t.sub': 'ar externo',
  'amb.td.sub': 'ponto de orvalho',
  'amb.e.sub': 'vapor, Pa',
  'amb.rhi.sub': 'em relação ao gelo',

  'trail.title': 'Rastro de condensação',
  'trail.eta': 'Rendimento propulsivo',
  'trail.tform.sub': 'forma-se abaixo de',
  'trail.tmix.sub': 'no bocal',
  'verdict.none': 'SEM RASTRO',
  'verdict.short-lived': 'EFÊMERO',
  'verdict.persistent': 'PERSISTENTE',

  'hint.trail.persistent':
    'O ar está {margin} °C abaixo do limiar, portanto forma-se rastro; ele está supersaturado em relação ao gelo, de modo que o rastro se espalha em vez de evaporar. {where}.',
  'hint.trail.shortLived':
    'O ar está {margin} °C abaixo do limiar, portanto forma-se rastro; em relação ao gelo não está saturado, de modo que os cristais evaporam em segundos. {where}.',
  'hint.trail.none': 'O ar está {margin} °C acima do limiar — não há rastro. {where}.',

  'where.higher.stop': '{km} km mais alto ele deixaria de se formar',
  'where.lower.stop': '{km} km mais baixo ele deixaria de se formar',
  'where.higher.start': '{km} km mais alto ele começaria a se formar',
  'where.lower.start': '{km} km mais baixo ele começaria a se formar',
  'where.nowhere': 'Em nenhum ponto entre o solo e {max} km este ar se comportaria de outro modo',

  'cut.angle': 'Ângulo do corte',
  'cut.rotation': 'Rotação do corte',
  'explode.label': 'Separar os módulos',

  'toggle.xray': 'Carcaças transparentes',
  'toggle.nacelle': 'Nacele',
  'toggle.labels': 'Rótulos dos módulos',
  'toggle.lines': 'Linhas de corrente',
  'toggle.haze': 'Gases de escape',
  'toggle.trail': 'Rastro de condensação',
  'toggle.spin': 'Rotação dos rotores',
  'toggle.orbit': 'Órbita da câmera',

  'footer.mouse': 'Botão esq. — orbitar · roda — zoom · botão dir. — deslocar',
  'footer.keys1': 'Space — fluxos · C — corte · X — raios X · S — som',
  'footer.keys2': 'E — partida/corte · H — escape · T — rastro',
  'footer.keys3': '1…9, 0 — vistas',

  'legend.title': 'Fluxos',
  'legend.bypass.name': 'Fluxo secundário',
  'legend.bypass.text': ' — ar frio, ~15…50 °C ao nível do mar. Até 80 % do empuxo.',
  'legend.compression.name': 'Compressão',
  'legend.compression.text': ' — no compressor o ar é aquecido até 600 °C.',
  'legend.combustion.name': 'Combustão',
  'legend.combustion.text': ' — 1800…2000 °C no tubo de chama.',
  'legend.jet.name': 'Jato quente',
  'legend.jet.text': ' — expansão pela turbina e pelo bocal, 550 °C.',

  'stations.head.station': 'seção',
  'stations.head.t': 'T, °C',
  'stations.head.p': 'P, bar',
  'station.intake': 'Entrada de ar',
  'station.bypass': 'Fluxo secundário',
  'station.booster': 'Após o booster',
  'station.hpc': 'Após o compressor de alta',
  'station.combustor': 'Câmara de combustão',
  'station.hpt': 'Após a turbina de alta',
  'station.nozzle': 'Saída do bocal',

  'view.overview': 'Visão geral',
  'view.cutaway': 'Corte',
  'view.front': 'De frente',
  'view.fan': 'Fan',
  'view.hpc': 'Compressor de alta',
  'view.combustor': 'Câmara de combustão',
  'view.turbine': 'Turbina',
  'view.nozzle': 'Bocal e jato',
  'view.behind': 'De trás, dentro do jato',
  'view.contrail': 'Rastro de condensação',

  'label.nacelle': 'Nacele',
  'label.reverser': 'Reversor',
  'label.fan': 'Fan',
  'label.booster': 'Booster',
  'label.hpc': 'Compressor AP',
  'label.combustor': 'Câmara de combustão',
  'label.hpt': 'Turbina AP',
  'label.lpt': 'Turbina BP',
  'label.nozzle': 'Bocal',
  'label.shafts': 'Eixos BP / AP',
  'label.accessory': 'Caixa de acessórios',

  'module.nacelle.title': 'Nacele e entrada de ar',
  'module.nacelle.info':
    'Anel de entrada com sistema antigelo, capôs do fan e fluxo secundário. Maior dimensão 2,44 m, comprimento até a saída do bocal do fan 3,18 m. A parte de baixo e o bordo são achatados (a “bochecha de hamster”): a asa do 737 fica baixa em relação ao solo.',
  'module.reverser.title': 'Reversor de empuxo',
  'module.reverser.info':
    'Reversor de grades do fluxo secundário. A capota móvel recua 0,45 m e descobre as palhetas defletoras; doze portas bloqueadoras atravessam o duto, arrastadas por bielas ligadas à parede fixa em vez de acionadas, de modo que só fecham no fim do curso. O fluxo primário não é tocado: apenas o ar do fan é desviado, e na reversão ele rende cerca de um quinto do empuxo de decolagem.',
  'module.fan.title': 'Fan (N1)',
  'module.fan.info':
    '24 pás de corda larga, corda máxima 0,279 m. Diâmetro 1,549 m, 5175 rpm na potência de decolagem. Produz até 80 % do empuxo empurrando ar para o fluxo secundário. Razão de derivação 5,1.',
  'module.booster.title': 'Booster, compressor de baixa pressão (N1)',
  'module.booster.info':
    'Compressor de baixa pressão: 3 estágios no eixo do fan. Eleva o ar do núcleo a cerca de 2,5 bar antes do compressor de alta pressão.',
  'module.hpc.title': 'Compressor de alta pressão (N2)',
  'module.hpc.info':
    '9 estágios. Comprime o ar cerca de 11 vezes; junto com o fan e o booster isso dá uma razão de compressão global de cerca de 28 e aquecimento até 550-600 °C. Parte do ar é sangrada para o resfriamento da turbina e para o ar-condicionado.',
  'module.combustor.title': 'Câmara de combustão',
  'module.combustor.info':
    'Câmara anular com 20 bicos injetores. O combustível queima a 1800-2000 °C; o ar do compressor de alta resfria o tubo de chama por película. Apenas cerca de 25 % do ar participa da combustão, o restante é resfriamento e diluição.',
  'module.hpt.title': 'Turbina de alta pressão (N2)',
  'module.hpt.info':
    '1 estágio. Palhetas monocristalinas com resfriamento interno a ar e revestimento cerâmico trabalham em gás a 1500 °C — acima do ponto de fusão da liga. Um estágio basta porque ele absorve uma grande queda de pressão a alta velocidade periférica: aciona o compressor de alta a cerca de 14 500 rpm.',
  'module.lpt.title': 'Turbina de baixa pressão (N1)',
  'module.lpt.info':
    '4 estágios de grande diâmetro. Extrai a energia restante do gás e aciona o fan e o booster por meio de um eixo longo (5175 rpm na potência de decolagem).',
  'module.exhaust.title': 'Carcaça traseira da turbina e bocal do núcleo',
  'module.exhaust.info':
    'Os montantes da carcaça traseira sustentam o mancal do eixo de baixa e endireitam o giro do gás. O cone central conforma o bocal; o jato sai a 400-500 m/s e 550-600 °C.',
  'module.cowl.title': 'Parede interna do fluxo secundário',
  'module.cowl.info':
    'A parede que separa o fluxo secundário frio do núcleo quente. Sob ela ficam os acessórios, a tubulação e o isolamento térmico.',
  'module.shafts.title': 'Eixos dos rotores',
  'module.shafts.info':
    'Dois eixos coaxiais: o eixo de baixa (fan + booster + turbina de baixa) passa por dentro do eixo oco de alta (compressor de alta + turbina de alta). Os rotores giram de forma independente em rotações diferentes.',
  'module.accessory.title': 'Caixa de acessórios e equipamentos',
  'module.accessory.info':
    'Uma transmissão cônica a partir do eixo de alta aciona as bombas de combustível e de óleo, os geradores e o motor de partida. A tubulação de sangria e as unidades FADEC também ficam aqui. No 737 a caixa foi deslocada de baixo do motor para a lateral — e foi isso que permitiu achatar a parte de baixo da nacele.',
};
