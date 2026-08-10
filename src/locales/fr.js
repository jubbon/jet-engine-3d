/* French. The prototype is a CFM56, half of it Safran, so the terminology here
 * is the one the manufacturer uses: soufflante for the fan, aube for a blade,
 * tuyère for the nozzle, taux de dilution for the bypass ratio, flux
 * secondaire for the bypass duct. Decimal commas in the prose. */

export default {
  'app.title': 'Turboréacteur à double flux — modèle 3D interactif',
  'app.loading': 'Assemblage du moteur…',
  'panel.h1': 'Turboréacteur à double flux',
  'panel.sub': 'Double flux à fort taux de dilution · modèle interactif',

  'panel.flow.title': 'Écoulements d’air',
  'panel.flow.hint': 'flux secondaire froid et jet chaud',
  'panel.cut.title': 'Voir l’intérieur',
  'panel.cut.hint': 'carters en coupe, rotor visible',
  'panel.sound.title': 'Son du moteur',
  'panel.sound.hint': 'synthétisé à partir de N1 et N2',
  'panel.volume': 'Volume',

  'power.start': 'Démarrer le moteur',
  'power.shutdown': 'Arrêter le moteur',
  'power.hint.starting': 'entraînement par le démarreur, allumage…',
  'power.hint.stopping': 'coupure carburant, rotors en ralentissement…',
  'power.hint.running': 'coupure carburant, ralentissement du rotor',
  'power.hint.off': 'démarreur, allumage, accélération jusqu’au ralenti',
  'mode.off': 'ARRÊTÉ',
  'mode.start': 'DÉMARRAGE',
  'mode.run': 'EN MARCHE',
  'mode.stop': 'ARRÊT · RALENTISSEMENT',
  'panel.state': 'État',
  'panel.timescale': 'Échelle de temps',
  'panel.throttle': 'Puissance moteur (manette)',
  'panel.rev.title': 'Inverseur de poussée',
  'panel.reverser': 'Inverseur',
  'rev.stowed': 'RENTRÉ',
  'rev.deploying': 'DÉPLOIEMENT',
  'rev.deployed': 'DÉPLOYÉ',
  'rev.stowing': 'RENTRÉE',
  'rev.hint.deploy': 'le capot mobile recule, les portes ferment le flux secondaire',
  'rev.hint.stow': 'les portes s’ouvrent, le capot mobile revient en place',
  'rev.hint.moving': 'le capot est en mouvement, le moteur est maintenu au ralenti',
  'rev.hint.off': 'le moteur doit tourner',

  'gauge.n1.sub': 'soufflante',
  'gauge.n2.sub': 'rotor HP',
  'gauge.t4.sub': 'avant turbine HP',
  'gauge.thrust.label': 'Poussée',
  'gauge.thrust.sub': 'calculée',

  'amb.title': 'Conditions ambiantes',
  'amb.altitude': 'Altitude',
  'amb.isa': 'Écart au standard',
  'amb.rh': 'Humidité relative',
  'amb.t.sub': 'air extérieur',
  'amb.td.sub': 'point de rosée',
  'amb.e.sub': 'vapeur, Pa',
  'amb.rhi.sub': 'par rapport à la glace',

  'trail.title': 'Traînée de condensation',
  'trail.eta': 'Rendement propulsif',
  'trail.tform.sub': 'se forme en dessous',
  'trail.tmix.sub': 'à la tuyère',
  'verdict.none': 'PAS DE TRAÎNÉE',
  'verdict.short-lived': 'ÉPHÉMÈRE',
  'verdict.persistent': 'PERSISTANTE',

  'hint.trail.persistent':
    'L’air est {margin} °C sous le seuil, une traînée se forme donc ; il est sursaturé par rapport à la glace, si bien que la traînée s’étale au lieu de s’évaporer. {where}.',
  'hint.trail.shortLived':
    'L’air est {margin} °C sous le seuil, une traînée se forme donc ; par rapport à la glace il n’est pas saturé, si bien que les cristaux s’évaporent en quelques secondes. {where}.',
  'hint.trail.none': 'L’air est {margin} °C au-dessus du seuil — pas de traînée. {where}.',

  'where.higher.stop': '{km} km plus haut elle cesserait de se former',
  'where.lower.stop': '{km} km plus bas elle cesserait de se former',
  'where.higher.start': '{km} km plus haut elle commencerait à se former',
  'where.lower.start': '{km} km plus bas elle commencerait à se former',
  'where.nowhere': 'Nulle part entre le sol et {max} km cet air ne se comporterait autrement',

  'cut.angle': 'Angle de coupe',
  'cut.rotation': 'Rotation de la coupe',
  'explode.label': 'Éclater les modules',

  'toggle.xray': 'Carters transparents',
  'toggle.nacelle': 'Nacelle',
  'toggle.labels': 'Étiquettes des modules',
  'toggle.lines': 'Lignes de courant',
  'toggle.haze': 'Gaz d’échappement',
  'toggle.trail': 'Traînée de condensation',
  'toggle.spin': 'Rotation des rotors',
  'toggle.orbit': 'Orbite de la caméra',

  'footer.mouse': 'Clic gauche — orbite · molette — zoom · clic droit — translation',
  'footer.keys1': 'Space — écoulements · C — coupe · X — transparence · S — son',
  'footer.keys2': 'E — démarrage/arrêt · R — inverseur · H — gaz · T — traînée',
  'footer.keys3': '1…9, 0 — vues',

  'legend.title': 'Écoulements',
  'legend.bypass.name': 'Flux secondaire',
  'legend.bypass.text': ' — air froid, ~15…50 °C au niveau de la mer. Jusqu’à 80 % de la poussée.',
  'legend.compression.name': 'Compression',
  'legend.compression.text': ' — dans le compresseur l’air est chauffé à 600 °C.',
  'legend.combustion.name': 'Combustion',
  'legend.combustion.text': ' — 1800…2000 °C dans le tube à flamme.',
  'legend.jet.name': 'Jet chaud',
  'legend.jet.text': ' — détente dans la turbine et la tuyère, 550 °C.',

  'stations.head.station': 'section',
  'stations.head.t': 'T, °C',
  'stations.head.p': 'P, bar',
  'station.intake': 'Entrée d’air',
  'station.bypass': 'Flux secondaire',
  'station.booster': 'Après le booster',
  'station.hpc': 'Après le compresseur HP',
  'station.combustor': 'Chambre de combustion',
  'station.hpt': 'Après la turbine HP',
  'station.nozzle': 'Sortie de tuyère',

  'view.overview': 'Vue d’ensemble',
  'view.cutaway': 'Coupe',
  'view.front': 'De face',
  'view.fan': 'Soufflante',
  'view.hpc': 'Compresseur HP',
  'view.combustor': 'Chambre de combustion',
  'view.turbine': 'Turbine',
  'view.nozzle': 'Tuyère et jet',
  'view.behind': 'De l’arrière, dans le jet',
  'view.contrail': 'Traînée de condensation',

  'label.nacelle': 'Nacelle',
  'label.reverser': 'Inverseur',
  'label.fan': 'Soufflante',
  'label.booster': 'Booster',
  'label.hpc': 'Compresseur HP',
  'label.combustor': 'Chambre de combustion',
  'label.hpt': 'Turbine HP',
  'label.lpt': 'Turbine BP',
  'label.nozzle': 'Tuyère',
  'label.shafts': 'Arbres BP / HP',
  'label.accessory': 'Boîtier d’accessoires',

  'module.nacelle.title': 'Nacelle et entrée d’air',
  'module.nacelle.info':
    'Virole d’entrée d’air avec dégivrage, capots de soufflante et flux secondaire. Dimension maximale 2,44 m, longueur jusqu’à la sortie de la tuyère de soufflante 3,18 m. Le bas et la lèvre sont aplatis (la « bajoue de hamster ») : l’aile du 737 est basse au-dessus du sol.',
  'module.reverser.title': 'Inverseur de poussée',
  'module.reverser.info':
    'Inverseur à grilles du flux secondaire. Le capot mobile recule de 0,45 m et découvre les aubes de déviation ; douze portes d\'obturation traversent la veine, entraînées par des bielles reliées à la paroi fixe plutôt que motorisées, de sorte qu\'elles ne se ferment qu\'en fin de course. Le flux primaire n\'est pas touché : seul l\'air de la soufflante est dévié, et il fournit en inversion environ un cinquième de la poussée au décollage.',
  'module.fan.title': 'Soufflante (N1)',
  'module.fan.info':
    '24 aubes à large corde, corde maximale 0,279 m. Diamètre 1,549 m, 5175 tr/min à la puissance de décollage. Produit jusqu’à 80 % de la poussée en refoulant l’air dans le flux secondaire. Taux de dilution 5,1.',
  'module.booster.title': 'Booster, compresseur BP (N1)',
  'module.booster.info':
    'Compresseur basse pression : 3 étages sur l’arbre de soufflante. Il porte l’air du flux primaire à environ 2,5 bar avant le compresseur HP.',
  'module.hpc.title': 'Compresseur haute pression (N2)',
  'module.hpc.info':
    '9 étages. Il comprime l’air d’un facteur d’environ 11 ; avec la soufflante et le booster cela donne un taux de compression global d’environ 28 et un échauffement à 550-600 °C. Une partie de l’air est prélevée pour le refroidissement de la turbine et la climatisation.',
  'module.combustor.title': 'Chambre de combustion',
  'module.combustor.info':
    'Chambre annulaire à 20 injecteurs. Le carburant brûle à 1800-2000 °C ; l’air du compresseur HP refroidit le tube à flamme par film. Environ 25 % de l’air seulement participe à la combustion, le reste sert au refroidissement et à la dilution.',
  'module.hpt.title': 'Turbine haute pression (N2)',
  'module.hpt.info':
    '1 étage. Des aubes monocristallines à refroidissement interne par air et revêtement céramique travaillent dans un gaz à 1500 °C, au-dessus du point de fusion de l’alliage. Un seul étage suffit car il encaisse une forte chute de pression à grande vitesse périphérique : il entraîne le compresseur HP à environ 14 500 tr/min.',
  'module.lpt.title': 'Turbine basse pression (N1)',
  'module.lpt.info':
    '4 étages de grand diamètre. Elle extrait l’énergie restante du gaz et entraîne la soufflante et le booster par un long arbre (5175 tr/min à la puissance de décollage).',
  'module.exhaust.title': 'Carter arrière de turbine et tuyère primaire',
  'module.exhaust.info':
    'Les bras du carter arrière portent le palier de l’arbre BP et redressent le tourbillonnement du gaz. Le cône central forme la tuyère ; le jet sort à 400-500 m/s et 550-600 °C.',
  'module.cowl.title': 'Paroi interne du flux secondaire',
  'module.cowl.info':
    'La paroi qui sépare le flux secondaire froid du corps chaud. Sous elle se logent les accessoires, la tuyauterie et l’isolation thermique.',
  'module.shafts.title': 'Arbres des rotors',
  'module.shafts.info':
    'Deux arbres coaxiaux : l’arbre BP (soufflante + booster + turbine BP) passe à l’intérieur de l’arbre HP creux (compresseur HP + turbine HP). Les rotors tournent indépendamment à des régimes différents.',
  'module.accessory.title': 'Boîtier d’accessoires et équipements',
  'module.accessory.info':
    'Un renvoi d’angle sur l’arbre HP entraîne les pompes à carburant et à huile, les générateurs et le démarreur. La tuyauterie de prélèvement d’air et les calculateurs FADEC sont là aussi. Sur le 737, le boîtier a été déplacé de dessous le moteur vers le côté — et c’est précisément ce qui a permis d’aplatir le bas de la nacelle.',

  /* ------------------------ compressor stability ---------------------- */
  'panel.stability': 'Stabilité',
  'panel.sm': 'Marge au pompage',
  'surge.clear': 'STABLE',
  'surge.surging': 'POMPAGE',
  'surge.stall': 'DÉCROCHÉ',
  'surge.hint.clear': 'Le compresseur travaille dans sa marge. Poussez la manette d\'un coup du ralenti à la butée et ce ne sera plus le cas : le carburant arrive en une fraction de seconde, le rotor met des secondes, et dans cet intervalle la chambre est alimentée pour un régime que le compresseur n\'a pas atteint.',
  'surge.hint.surging': 'L\'écoulement a décroché et le gaz est refoulé vers l\'avant par l\'entrée d\'air, plusieurs fois par seconde. Réduisez la manette maintenant et le moteur récupérera ; maintenez-la et le régime se figera.',
  'surge.hint.stall': 'Décrochage figé : les rotors sont bloqués bas, la veine gazeuse chauffe et la poussée a disparu. Aucun mouvement de manette n\'y remédiera, seulement un arrêt.',
  'surge.hint.off': 'le moteur doit tourner',

  /* --------------------------- compressor map -------------------------- */
  'map.title': 'Champ du compresseur',
  'map.line.surge': 'ligne de pompage',
  'map.line.working': 'ligne de fonctionnement',
  'map.line.point': 'point de fonctionnement',
  'map.axis.pr': '↑ taux de compression',
  'map.axis.flow': 'débit corrigé →',
  'map.caveat': 'La ligne de pompage est un tableau de valeurs plausibles, non un calcul : le modèle ne résout aucune équation de gazodynamique.',
};
