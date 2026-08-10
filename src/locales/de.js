/* German. Terminology as MTU and Lufthansa Technik use it: Hochdruckverdichter
 * and Niederdruckturbine for the spools, Nebenstromkanal for the bypass duct,
 * Nebenstromverhältnis for the bypass ratio, Hilfsgerätegetriebe for the
 * accessory gearbox, Schaufel for a blade. Decimal commas in the prose. */

export default {
  'app.title': 'Mantelstromtriebwerk — interaktives 3D-Modell',
  'app.loading': 'Triebwerk wird zusammengebaut…',
  'panel.h1': 'Mantelstromtriebwerk',
  'panel.sub': 'Turbofan mit hohem Nebenstromverhältnis · interaktives Modell',

  'panel.flow.title': 'Luftströmungen',
  'panel.flow.hint': 'kalter Nebenstromkanal und heißer Strahl',
  'panel.cut.title': 'Hineinsehen',
  'panel.cut.hint': 'Gehäuse im Schnitt, Rotor sichtbar',
  'panel.sound.title': 'Triebwerksgeräusch',
  'panel.sound.hint': 'aus N1 und N2 synthetisiert',
  'panel.volume': 'Lautstärke',

  'power.start': 'Triebwerk anlassen',
  'power.shutdown': 'Triebwerk abstellen',
  'power.hint.starting': 'Anlasser dreht durch, Zündung…',
  'power.hint.stopping': 'Kraftstoff abgestellt, Rotoren laufen aus…',
  'power.hint.running': 'Kraftstoffabschaltung, Rotorauslauf',
  'power.hint.off': 'Anlasser, Zündung, Beschleunigung auf Leerlauf',
  'mode.off': 'ABGESTELLT',
  'mode.start': 'ANLASSEN',
  'mode.run': 'IN BETRIEB',
  'mode.stop': 'ABSTELLEN · AUSLAUF',
  'panel.state': 'Zustand',
  'panel.timescale': 'Zeitmaßstab',
  'panel.throttle': 'Triebwerksleistung (Schubhebel)',
  'panel.rev.title': 'Schubumkehr',
  'panel.reverser': 'Umkehrschub',
  'rev.stowed': 'EINGEFAHREN',
  'rev.deploying': 'FÄHRT AUS',
  'rev.deployed': 'AUSGEFAHREN',
  'rev.stowing': 'FÄHRT EIN',
  'rev.hint.deploy': 'die Schiebehaube fährt zurück, die Klappen sperren den Nebenstrom',
  'rev.hint.stow': 'die Klappen öffnen, die Schiebehaube fährt zurück in ihre Lage',
  'rev.hint.moving': 'die Haube fährt, das Triebwerk wird im Leerlauf gehalten',
  'rev.hint.off': 'das Triebwerk muss laufen',

  'gauge.n1.sub': 'Fan',
  'gauge.n2.sub': 'Hochdruckrotor',
  'gauge.t4.sub': 'vor der HD-Turbine',
  'gauge.thrust.label': 'Schub',
  'gauge.thrust.sub': 'berechnet',

  'amb.title': 'Umgebungsbedingungen',
  'amb.altitude': 'Höhe',
  'amb.isa': 'Abweichung vom Standard',
  'amb.rh': 'Relative Luftfeuchte',
  'amb.t.sub': 'Außenluft',
  'amb.td.sub': 'Taupunkt',
  'amb.e.sub': 'Dampf, Pa',
  'amb.rhi.sub': 'über Eis',

  'trail.title': 'Kondensstreifen',
  'trail.eta': 'Vortriebswirkungsgrad',
  'trail.tform.sub': 'entsteht unterhalb',
  'trail.tmix.sub': 'an der Düse',
  'verdict.none': 'KEIN STREIFEN',
  'verdict.short-lived': 'KURZLEBIG',
  'verdict.persistent': 'BESTÄNDIG',

  'hint.trail.persistent':
    'Die Luft liegt {margin} °C unter der Schwelle, es entsteht also ein Streifen; sie ist über Eis übersättigt, sodass der Streifen sich ausbreitet statt zu verdunsten. {where}.',
  'hint.trail.shortLived':
    'Die Luft liegt {margin} °C unter der Schwelle, es entsteht also ein Streifen; über Eis ist sie nicht gesättigt, sodass die Kristalle innerhalb von Sekunden verdunsten. {where}.',
  'hint.trail.none': 'Die Luft liegt {margin} °C über der Schwelle — kein Streifen. {where}.',

  'where.higher.stop': '{km} km höher würde er ausbleiben',
  'where.lower.stop': '{km} km tiefer würde er ausbleiben',
  'where.higher.start': '{km} km höher würde er einsetzen',
  'where.lower.start': '{km} km tiefer würde er einsetzen',
  'where.nowhere': 'Nirgends zwischen dem Boden und {max} km verhielte sich diese Luft anders',

  'cut.angle': 'Schnittwinkel',
  'cut.rotation': 'Schnittdrehung',
  'explode.label': 'Module auseinanderziehen',

  'toggle.xray': 'Transparente Gehäuse',
  'toggle.nacelle': 'Gondel',
  'toggle.labels': 'Modulbeschriftungen',
  'toggle.lines': 'Stromlinien',
  'toggle.haze': 'Abgasstrahl',
  'toggle.trail': 'Kondensstreifen',
  'toggle.spin': 'Rotordrehung',
  'toggle.orbit': 'Kameraumlauf',

  'footer.mouse': 'Linke Maustaste — drehen · Mausrad — zoomen · rechte Maustaste — verschieben',
  'footer.keys1': 'Space — Strömungen · C — Schnitt · X — Durchsicht · S — Ton',
  'footer.keys2': 'E — Start/Abstellen · R — Umkehrschub · H — Abgas · T — Kondensstreifen',
  'footer.keys3': '1…9, 0 — Ansichten',

  'legend.title': 'Strömungen',
  'legend.bypass.name': 'Nebenstromkanal',
  'legend.bypass.text': ' — kalte Luft, ~15…50 °C auf Meereshöhe. Bis zu 80 % des Schubs.',
  'legend.compression.name': 'Verdichtung',
  'legend.compression.text': ' — im Verdichter wird die Luft auf 600 °C erwärmt.',
  'legend.combustion.name': 'Verbrennung',
  'legend.combustion.text': ' — 1800…2000 °C im Flammrohr.',
  'legend.jet.name': 'Heißer Strahl',
  'legend.jet.text': ' — Entspannung durch Turbine und Düse, 550 °C.',

  'stations.head.station': 'Schnitt',
  'stations.head.t': 'T, °C',
  'stations.head.p': 'P, bar',
  'station.intake': 'Einlauf',
  'station.bypass': 'Nebenstromkanal',
  'station.booster': 'Nach dem Booster',
  'station.hpc': 'Nach dem HD-Verdichter',
  'station.combustor': 'Brennkammer',
  'station.hpt': 'Nach der HD-Turbine',
  'station.nozzle': 'Düsenaustritt',

  'view.overview': 'Übersicht',
  'view.cutaway': 'Schnitt',
  'view.front': 'Von vorn',
  'view.fan': 'Fan',
  'view.hpc': 'Hochdruckverdichter',
  'view.combustor': 'Brennkammer',
  'view.turbine': 'Turbine',
  'view.nozzle': 'Düse und Strahl',
  'view.behind': 'Von hinten, im Gasstrahl',
  'view.contrail': 'Kondensstreifen',

  'label.nacelle': 'Gondel',
  'label.reverser': 'Umkehrschub',
  'label.fan': 'Fan',
  'label.booster': 'Booster',
  'label.hpc': 'HD-Verdichter',
  'label.combustor': 'Brennkammer',
  'label.hpt': 'HD-Turbine',
  'label.lpt': 'ND-Turbine',
  'label.nozzle': 'Düse',
  'label.shafts': 'ND- / HD-Wellen',
  'label.accessory': 'Hilfsgerätegetriebe',

  'module.nacelle.title': 'Gondel und Lufteinlauf',
  'module.nacelle.info':
    'Einlaufring mit Enteisung, Fanhauben und Nebenstromkanal. Größte Abmessung 2,44 m, Länge bis zum Austritt der Fandüse 3,18 m. Unterseite und Lippe sind abgeflacht (die „Hamsterbacke“): die Tragfläche der 737 sitzt tief über dem Boden.',
  'module.reverser.title': 'Schubumkehr',
  'module.reverser.info':
    'Kaskaden-Schubumkehr des Nebenstromkanals. Die Schiebehaube fährt 0,45 m nach hinten und gibt die Umlenkgitter frei; zwölf Sperrklappen legen sich quer in den Kanal - von Zugstangen zur festen Wand herumgezogen, nicht angetrieben, und deshalb schließen sie erst gegen Ende des Wegs. Der Kernstrom bleibt unberührt: umgelenkt wird nur die Fanluft, und sie liefert in der Umkehr etwa ein Fünftel des Startschubs.',
  'module.fan.title': 'Fan (N1)',
  'module.fan.info':
    '24 Schaufeln großer Profiltiefe, größte Sehne 0,279 m. Durchmesser 1,549 m, 5175 min⁻¹ bei Startleistung. Erzeugt bis zu 80 % des Schubs, indem er Luft in den Nebenstromkanal fördert. Nebenstromverhältnis 5,1.',
  'module.booster.title': 'Booster, Niederdruckverdichter (N1)',
  'module.booster.info':
    'Niederdruckverdichter: 3 Stufen auf der Fanwelle. Er bringt die Kernluft vor dem Hochdruckverdichter auf etwa 2,5 bar.',
  'module.hpc.title': 'Hochdruckverdichter (N2)',
  'module.hpc.info':
    '9 Stufen. Er verdichtet die Luft um etwa das Elffache; zusammen mit Fan und Booster ergibt das ein Gesamtdruckverhältnis von rund 28 und eine Erwärmung auf 550-600 °C. Ein Teil der Luft wird für die Turbinenkühlung und die Klimatisierung abgezapft.',
  'module.combustor.title': 'Brennkammer',
  'module.combustor.info':
    'Ringbrennkammer mit 20 Einspritzdüsen. Der Kraftstoff verbrennt bei 1800-2000 °C; Luft aus dem Hochdruckverdichter kühlt das Flammrohr als Film. Nur etwa 25 % der Luft nimmt an der Verbrennung teil, der Rest dient der Kühlung und Verdünnung.',
  'module.hpt.title': 'Hochdruckturbine (N2)',
  'module.hpt.info':
    '1 Stufe. Einkristalline Schaufeln mit innerer Luftkühlung und Keramikbeschichtung arbeiten in Gas von 1500 °C — oberhalb des Schmelzpunkts der Legierung. Eine Stufe genügt, weil sie bei hoher Umfangsgeschwindigkeit ein großes Druckgefälle aufnimmt: sie treibt den Hochdruckverdichter mit rund 14 500 min⁻¹ an.',
  'module.lpt.title': 'Niederdruckturbine (N1)',
  'module.lpt.info':
    '4 Stufen großen Durchmessers. Sie entnimmt dem Gas die restliche Energie und treibt über eine lange Welle Fan und Booster an (5175 min⁻¹ bei Startleistung).',
  'module.exhaust.title': 'Turbinenaustrittsgehäuse und Kerndüse',
  'module.exhaust.info':
    'Die Streben des Austrittsgehäuses tragen das Lager der ND-Welle und richten den Drall aus dem Gas. Der Zentralkörper formt die Düse; der Strahl tritt mit 400-500 m/s und 550-600 °C aus.',
  'module.cowl.title': 'Innenwand des Nebenstromkanals',
  'module.cowl.info':
    'Die Wand, die den kalten Nebenstromkanal vom heißen Kerntriebwerk trennt. Darunter liegen die Hilfsgeräte, die Rohrleitungen und die Wärmedämmung.',
  'module.shafts.title': 'Rotorwellen',
  'module.shafts.info':
    'Zwei koaxiale Wellen: die ND-Welle (Fan + Booster + ND-Turbine) läuft in der hohlen HD-Welle (HD-Verdichter + HD-Turbine). Die Rotoren drehen unabhängig voneinander mit verschiedenen Drehzahlen.',
  'module.accessory.title': 'Hilfsgerätegetriebe und Hilfsgeräte',
  'module.accessory.info':
    'Ein Kegelradabtrieb von der HD-Welle treibt die Kraftstoff- und Ölpumpen, die Generatoren und den Anlasser an. Auch die Zapfluftleitungen und die FADEC-Rechner sitzen hier. Bei der 737 wurde das Getriebe von unterhalb des Triebwerks an die Seite verlegt — und genau das erlaubte es, die Unterseite der Gondel abzuflachen.',
};
