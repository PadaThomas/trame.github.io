/* Bibliothèque d'appareils, connecteurs et types de réseaux par défaut.
 * Chaque modèle porte :
 *  - verified : true si les ports ont été recoupés avec la documentation constructeur (source dans `doc`)
 *  - notes    : précisions / points à vérifier
 * Les modèles personnalisés créés dans l'appli sont stockés dans le projet (project.customTemplates).
 */
(function () {
  // Connecteurs physiques
  const CONNECTORS = [
    'RJ45', 'etherCON', 'SFP', 'SFP+', 'opticalCON', 'XLR3F', 'XLR3M', 'XLR4F', 'XLR5F', 'XLR5M', 'D-SUB 9', 'D-SUB 25',
    'BNC', 'HDMI', 'DisplayPort', 'DVI', 'speakON NL2', 'speakON NL4', 'speakON NL8',
    'powerCON', 'powerCON TRUE1', 'IEC', 'P17', 'Socapex', 'Harting 16', 'Schuko', 'PC16 (2P+T)', 'D-SUB 15', 'MA Link', 'USB-A', 'USB-C', 'MIDI DIN5', 'RCA', 'Jack 6.35', 'Bornier', 'Autre'
  ];

  // Types de réseaux / signaux, avec sous-réseaux (univers DMX, VLAN, etc.)
  // Couleurs des familles = charte TRAME (lumière orange, audio bleu, vidéo violet, réseau turquoise, énergie rouge).
  const SIGNALS = [
    { id: 'eth', name: 'Ethernet', color: '#36C9AD', subLabel: 'VLAN', subnets: [
      { id: 'v10', name: 'VLAN 10 – Lumière (sACN/Art-Net)', color: '#7c4dff' },
      { id: 'v20', name: 'VLAN 20 – Dante primaire', color: '#e91e63' },
      { id: 'v21', name: 'VLAN 21 – Dante secondaire', color: '#f48fb1' },
      { id: 'v30', name: 'VLAN 30 – Vidéo / NDI', color: '#43a047' }
    ] },
    { id: 'dmx', name: 'DMX', color: '#FFAA24', subLabel: 'Univers', subnets: [
      { id: 'u1', name: 'Univers 1', color: '#00bcd4' },
      { id: 'u2', name: 'Univers 2', color: '#ff9800' }
    ] },
    { id: 'audio', name: 'Audio analogique', color: '#21A8EF', subLabel: 'Ligne', subnets: [] },
    { id: 'audionum', name: 'Audio numérique (AES/MADI)', color: '#7CCBF5', subLabel: 'Flux', subnets: [] },
    { id: 'hp', name: 'Haut-parleur (speakON)', color: '#1673AD', subLabel: 'Circuit', subnets: [] },
    { id: 'video', name: 'Vidéo (SDI/HDMI/DP)', color: '#A78BFA', subLabel: 'Source', subnets: [] },
    { id: 'fibre', name: 'Fibre optique', color: '#1E9E86', subLabel: 'Lien', subnets: [] },
    { id: 'intercom', name: 'Intercom', color: '#D9C24A', subLabel: 'Canal', subnets: [] },
    { id: 'ctrl', name: 'Contrôle (MIDI/LTC/USB/GPIO)', color: '#94A3B8', subLabel: 'Bus', subnets: [] },
    { id: 'power', name: 'Alimentation', color: '#E45B65', subLabel: 'Circuit', subnets: [] }
  ];

  const CATEGORIES = [
    { id: 'console', name: 'Consoles lumière' },
    { id: 'audiodesk', name: 'Consoles son' },
    { id: 'node', name: 'Nodes / interfaces' },
    { id: 'switch', name: 'Switches réseau' },
    { id: 'splitter', name: 'Splitters / boosters' },
    { id: 'dimmer', name: 'Gradateurs' },
    { id: 'fixture', name: 'Projecteurs' },
    { id: 'amp', name: 'Amplis / contrôleurs' },
    { id: 'speaker', name: 'Enceintes' },
    { id: 'audio', name: 'Son' },
    { id: 'video', name: 'Vidéo' },
    { id: 'patch', name: 'Boîtes & panneaux de brassage' },
    { id: 'rack', name: 'Baies / racks' },
    { id: 'custom', name: 'Mes appareils' }
  ];

  // Générateur de ports : s('DMX', 4, 'XLR5F', 'dmx', 'out') -> DMX 1..4
  //   opts.letters : A,B,C… au lieu de 1,2,3 ; opts.start : premier index ; opts.pass : traversant (brassage)
  function s(name, count, conn, sig, dir, opts) {
    opts = opts || {};
    const out = [];
    const start = opts.start || 1;
    for (let i = 0; i < count; i++) {
      const idx = opts.letters ? String.fromCharCode(65 + start - 1 + i) : (start + i);
      out.push({ name: count === 1 && !opts.forceIndex ? name : name + ' ' + idx, conn, sig, dir, pass: !!opts.pass });
    }
    return out;
  }
  const ports = (...groups) => groups.flat();

  const MA2_DOC = 'https://help.malighting.com/grandMA2/en/help/key_technical_data.html';
  const MA_CONSOLES_DOC = 'https://help.malighting.com/grandMA3/2.3/HTML/key_consoles_technical_data.html';
  const ETC_DOC = 'https://etcconnect.com/Products/Consoles/Eos-Consoles/Apex/Tech-Specs.aspx';

  const TEMPLATES = [
    // ---------- Consoles lumière ----------
    // Tableau "Technical data – consoles" du manuel grandMA3 (v2.3) : mêmes E/S, seuls DisplayPort / USB / desk light varient.
    ...[
      ['ma3-fullsize', 'grandMA3 full-size', 2, 3, 3, 2],
      ['ma3-fullsize-crv', 'grandMA3 full-size CRV', 5, 3, 3, 2],
      ['ma3-light', 'grandMA3 light', 2, 3, 3, 2],
      ['ma3-light-crv', 'grandMA3 light CRV', 4, 3, 3, 2],
      ['ma3-compact-xt', 'grandMA3 compact XT', 1, 3, 2, 1],
      ['ma3-compact', 'grandMA3 compact', 1, 3, 2, 1],
      ['ma3-replay', 'grandMA3 replay unit', 2, 5, 0, 0]
    ].map(([id, model, dp, usb2, usb3, desk]) => ({
      id, maker: 'MA Lighting', model, cat: 'console', verified: true, doc: MA_CONSOLES_DOC,
      notes: 'D\'après le manuel grandMA3 (Technical data – consoles). DMX A–F en sorties XLR5 femelle, G en entrée XLR5 mâle. Les 3 etherCON sont configurables (MA-Net3, sACN, Art-Net).',
      ports: ports(
        s('Ethernet', 3, 'etherCON', 'eth', 'io'),
        s('DMX', 6, 'XLR5F', 'dmx', 'out', { letters: true }),
        [{ name: 'DMX G (In)', conn: 'XLR5M', sig: 'dmx', dir: 'in' }],
        [{ name: 'LTC', conn: 'XLR3F', sig: 'ctrl', dir: 'in' }, { name: 'Audio In', conn: 'XLR3F', sig: 'audio', dir: 'in' }],
        [{ name: 'MIDI In', conn: 'MIDI DIN5', sig: 'ctrl', dir: 'in' }, { name: 'MIDI Out', conn: 'MIDI DIN5', sig: 'ctrl', dir: 'out' }],
        [{ name: 'GPI', conn: 'D-SUB 9', sig: 'ctrl', dir: 'in' }],
        [{ name: 'S/PDIF In', conn: 'RCA', sig: 'audionum', dir: 'in' }, { name: 'S/PDIF Out', conn: 'RCA', sig: 'audionum', dir: 'out' }],
        s('DisplayPort', dp, 'DisplayPort', 'video', 'out', { forceIndex: true }),
        s('USB 2.0', usb2, 'USB-A', 'ctrl', 'io', { forceIndex: true }),
        s('USB 3.0', usb3, 'USB-A', 'ctrl', 'io', { forceIndex: true }),
        s('Desk light', desk, 'XLR4F', 'power', 'out', { forceIndex: desk > 1 }),
        [{ name: 'Alimentation', conn: 'powerCON TRUE1', sig: 'power', dir: 'in' }]
      )
    })),
    // grandMA2 : tableau "Technical data" du manuel grandMA2
    ...[
      ['ma2-fullsize', 'grandMA2 full-size', 5],
      ['ma2-light', 'grandMA2 light', 5],
      ['ma2-ultralight', 'grandMA2 ultra-light', 4]
    ].map(([id, model, usb]) => ({
      id, maker: 'MA Lighting', model, cat: 'console', verified: true, doc: MA2_DOC,
      notes: 'D\'après le manuel grandMA2 (Technical data). DMX en XLR5 (6 sorties, 1 entrée), 2 etherCON (MA-Net2 / Art-Net / sACN).',
      ports: ports(
        s('Ethernet', 2, 'etherCON', 'eth', 'io'),
        s('DMX Out', 6, 'XLR5F', 'dmx', 'out', { letters: true }),
        [{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }],
        [{ name: 'SMPTE/LTC In', conn: 'XLR3F', sig: 'ctrl', dir: 'in' }, { name: 'Sound In', conn: 'XLR3F', sig: 'audio', dir: 'in' }],
        [{ name: 'MIDI In', conn: 'MIDI DIN5', sig: 'ctrl', dir: 'in' }, { name: 'MIDI Out', conn: 'MIDI DIN5', sig: 'ctrl', dir: 'out' }],
        [{ name: 'Analog remote', conn: 'D-SUB 25', sig: 'ctrl', dir: 'in' }, { name: 'MA Link (fader wing)', conn: 'MA Link', sig: 'ctrl', dir: 'out' }],
        s('DVI', 2, 'DVI', 'video', 'out', { forceIndex: true }),
        s('USB', usb, 'USB-A', 'ctrl', 'io', { forceIndex: true }),
        s('Desk lamp', 2, 'XLR4F', 'power', 'out', { forceIndex: true }),
        [{ name: 'Alimentation', conn: 'powerCON', sig: 'power', dir: 'in' }]
      )
    })),
    { id: 'ma2-onpc-cw', maker: 'MA Lighting', model: 'grandMA2 onPC command wing', cat: 'console', verified: true, doc: MA2_DOC,
      notes: 'Pas d\'etherCON : se connecte au PC en USB. 2 sorties DMX + 1 entrée.',
      ports: ports(s('DMX Out', 2, 'XLR5F', 'dmx', 'out', { letters: true }), [{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'SMPTE/LTC In', conn: 'XLR3F', sig: 'ctrl', dir: 'in' }, { name: 'MIDI In', conn: 'MIDI DIN5', sig: 'ctrl', dir: 'in' }, { name: 'MIDI Out', conn: 'MIDI DIN5', sig: 'ctrl', dir: 'out' }, { name: 'Analog remote', conn: 'D-SUB 15', sig: 'ctrl', dir: 'in' }, { name: 'USB (vers PC)', conn: 'USB-A', sig: 'ctrl', dir: 'io' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },

    // ChamSys : 4 DMX directs + switch réseau intégré
    ...[
      ['chamsys-mq80', 'MagicQ MQ80', '48 univers.'],
      ['chamsys-mq250m', 'MagicQ MQ250M', '64 univers (128 avec extension).'],
      ['chamsys-mq500m', 'MagicQ MQ500M', '256 univers (400 pour le MQ500M+).']
    ].map(([id, model, uni]) => ({
      id, maker: 'ChamSys', model, cat: 'console', verified: false, doc: 'https://chamsyslighting.com/software/networking/',
      notes: '4 sorties DMX directes (RDM) et 4 ports réseau sur switch intégré, ' + uni + ' Type exact des connecteurs réseau (RJ45/etherCON) à confirmer sur la fiche ChamSys.',
      ports: ports(s('Ethernet', 4, 'etherCON', 'eth', 'io'), s('DMX', 4, 'XLR5F', 'dmx', 'out', { letters: true }), [{ name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }])
    })),

    { id: 'ma3-pu-l', maker: 'MA Lighting', model: 'grandMA3 processing unit L', cat: 'node', verified: true,
      doc: 'https://help.malighting.com/grandMA3/2.3/HTML/key_pu_technical_data.html',
      notes: '2U. 8 univers DMX en local, 8 192 paramètres.',
      ports: ports(s('Ethernet', 2, 'etherCON', 'eth', 'io'), s('DMX', 8, 'XLR5F', 'dmx', 'out', { letters: true }), s('USB 2.0', 3, 'USB-A', 'ctrl', 'io', { forceIndex: true }), [{ name: 'Alimentation', conn: 'powerCON TRUE1', sig: 'power', dir: 'in' }]) },
    { id: 'etc-gio5', maker: 'ETC', model: 'Gio @5', cat: 'console', verified: true,
      doc: 'https://www.etcconnect.com/Products/Consoles/Eos-Consoles/Gio-@5/Tech-Specs.aspx',
      notes: '2 ports Gigabit RJ45 + 4 ports DMX/RDM XLR5 (sens reconfigurable : Local Output). Certains loueurs signalent des etherCON supplémentaires : vérifier sur la console.',
      ports: ports(s('Ethernet', 2, 'RJ45', 'eth', 'io'), s('DMX', 4, 'XLR5F', 'dmx', 'out'), s('DisplayPort', 2, 'DisplayPort', 'video', 'out', { forceIndex: true }), [{ name: 'Contacts secs', conn: 'D-SUB 9', sig: 'ctrl', dir: 'in' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'etc-ionxe20', maker: 'ETC', model: 'Ion Xe 20', cat: 'console', verified: true,
      doc: 'https://www.etcconnect.com/WebDocs/Controls/EosFamilyOnlineHelp/en/Content/02_Eos_Family_Product_Overview_and_Setup/Consoles/Ion_Xe_20.htm',
      notes: '2 ports Gigabit RJ45, 4 DMX/RDM XLR5, contacts secs sur D-Sub, 2 sorties DisplayPort.',
      ports: ports(s('Ethernet', 2, 'RJ45', 'eth', 'io'), s('DMX', 4, 'XLR5F', 'dmx', 'out'), s('DisplayPort', 2, 'DisplayPort', 'video', 'out', { forceIndex: true }), [{ name: 'Contacts secs', conn: 'D-SUB 9', sig: 'ctrl', dir: 'in' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'etc-apex10', maker: 'ETC', model: 'Eos Apex 10', cat: 'console', verified: true, doc: ETC_DOC,
      notes: 'Pas de DMX en direct : ajouter des Gadget II dans l\'I/O Garage (2 sorties DMX chacun). 4 ports Gigabit etherCON PoE++ + 2 SFP+ 10 GbE.',
      ports: ports(
        s('Ethernet', 4, 'etherCON', 'eth', 'io'),
        s('SFP+', 2, 'SFP+', 'fibre', 'io'),
        s('DisplayPort', 3, 'DisplayPort', 'video', 'out', { forceIndex: true }),
        s('Littlite', 2, 'XLR3F', 'power', 'out'),
        [{ name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]
      ) },
    { id: 'etc-apex5', maker: 'ETC', model: 'Eos Apex 5', cat: 'console', verified: true, doc: ETC_DOC,
      notes: 'Comme l\'Apex 10 avec 1 Littlite. DMX via Gadget II dans l\'I/O Garage.',
      ports: ports(
        s('Ethernet', 4, 'etherCON', 'eth', 'io'),
        s('SFP+', 2, 'SFP+', 'fibre', 'io'),
        s('DisplayPort', 3, 'DisplayPort', 'video', 'out', { forceIndex: true }),
        [{ name: 'Littlite', conn: 'XLR3F', sig: 'power', dir: 'out' }],
        [{ name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]
      ) },
    { id: 'etc-gadget2', maker: 'ETC', model: 'Gadget II (I/O Garage)', cat: 'node', verified: true, doc: ETC_DOC,
      notes: 'Interface USB → 2 sorties DMX.',
      ports: ports([{ name: 'USB', conn: 'USB-A', sig: 'ctrl', dir: 'in' }], s('DMX Out', 2, 'XLR5F', 'dmx', 'out')) },

    // ---------- Nodes ----------
    { id: 'gen-node4', maker: 'Générique', model: 'Node Art-Net/sACN 4 ports', cat: 'node', verified: false,
      ports: ports([{ name: 'Ethernet', conn: 'etherCON', sig: 'eth', dir: 'io' }], s('DMX', 4, 'XLR5F', 'dmx', 'out'), [{ name: 'Alimentation', conn: 'powerCON', sig: 'power', dir: 'in' }]) },
    { id: 'gen-node8', maker: 'Générique', model: 'Node Art-Net/sACN 8 ports (1U)', cat: 'node', verified: false,
      ports: ports(s('Ethernet', 2, 'etherCON', 'eth', 'io'), s('DMX', 8, 'XLR5F', 'dmx', 'out'), [{ name: 'Alimentation', conn: 'powerCON', sig: 'power', dir: 'in' }]) },

    { id: 'luminex-ln12', maker: 'Luminex', model: 'LumiNode 12', cat: 'node', verified: true,
      doc: 'https://www.luminex.be/products/luminode/luminode-12/',
      notes: '12 ports DMX/RDM isolés, chacun configurable en entrée ou sortie. 2 etherCON 1 Gb avec switch intégré (un en PoE). Existe en version RJ45-DMX.',
      ports: ports(s('Ethernet', 2, 'etherCON', 'eth', 'io'), s('DMX', 12, 'XLR5F', 'dmx', 'io'), [{ name: 'Alimentation', conn: 'powerCON TRUE1', sig: 'power', dir: 'in' }]) },
    { id: 'luminex-ln4', maker: 'Luminex', model: 'LumiNode 4', cat: 'node', verified: true,
      doc: 'https://www.luminex.be/?p=10521',
      notes: '4 ports DMX/RDM configurables entrée/sortie, 2 etherCON 1 Gb, alimentable en PoE (802.3af). Les versions murale et DIN diffèrent.',
      ports: ports(s('Ethernet', 2, 'etherCON', 'eth', 'io'), s('DMX', 4, 'XLR5F', 'dmx', 'io'), [{ name: 'Alimentation', conn: 'powerCON TRUE1', sig: 'power', dir: 'in' }]) },

    ...[['cameo-xnode8', 'XNODE 8', 8], ['cameo-xnode4', 'XNODE 4', 4]].map(([id, model, n]) => ({
      id, maker: 'Cameo', model, cat: 'node', verified: n === 8,
      doc: 'https://www.cameolight.com/en/solutions/rental/lighting-control/network-splitter/20893/xnode-8',
      notes: 'Node Art-Net / sACN, ports DMX 5 broches configurables entrée ou sortie, powerCON in/out.' + (n === 4 ? ' Fiche XNODE 4 déduite du XNODE 8 : à vérifier.' : ''),
      ports: ports([{ name: 'Ethernet', conn: 'RJ45', sig: 'eth', dir: 'io' }], s('DMX', n, 'XLR5F', 'dmx', 'io'), [{ name: 'Alim In', conn: 'powerCON', sig: 'power', dir: 'in' }, { name: 'Alim Out', conn: 'powerCON', sig: 'power', dir: 'out' }])
    })),

    // ---------- Switches ----------
    { id: 'luminex-gc16xt', maker: 'Luminex', model: 'GigaCore 16Xt', cat: 'switch', verified: true,
      doc: 'https://www.luminex.be/?p=1847',
      notes: '12 etherCON Gigabit (10 en face, 2 à l\'arrière) + 4 cages SFP 1 Gb. Version PoE : PoE sur les ports de face uniquement. Modèle arrêté.',
      ports: ports(s('Port', 12, 'etherCON', 'eth', 'io'), s('SFP', 4, 'SFP', 'fibre', 'io', { start: 13 }), [{ name: 'Alimentation', conn: 'powerCON', sig: 'power', dir: 'in' }]) },
    { id: 'netgear-m4250-10g2f', maker: 'Netgear', model: 'M4250-10G2F-PoE+ (AV Line)', cat: 'switch', verified: true,
      doc: 'https://www.storagereview.com/review/netgear-m4250-10g2f-poe-switch-review',
      notes: '8 RJ45 PoE+ (125 W) + 2 RJ45 + 2 SFP 1 Gb + port de management. Ne pas confondre avec le 10G2XF (SFP+ 10 Gb).',
      ports: ports(s('Port PoE+', 8, 'RJ45', 'eth', 'io'), s('Port', 2, 'RJ45', 'eth', 'io', { start: 9 }), s('SFP', 2, 'SFP', 'fibre', 'io', { start: 11 }), [{ name: 'Management', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'gen-sw8', maker: 'Générique', model: 'Switch 8 ports', cat: 'switch', verified: false,
      ports: ports(s('Port', 8, 'RJ45', 'eth', 'io'), [{ name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'gen-sw24', maker: 'Générique', model: 'Switch 24 ports + 4 SFP', cat: 'switch', verified: false,
      ports: ports(s('Port', 24, 'RJ45', 'eth', 'io'), s('SFP', 4, 'SFP', 'fibre', 'io', { start: 25 }), [{ name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'luminex-gc10', maker: 'Luminex', model: 'GigaCore 10', cat: 'switch', verified: false, doc: 'https://www.luminex.be',
      notes: 'À vérifier sur la fiche Luminex (nombre de ports PoE, type de connecteurs).',
      ports: ports(s('Port', 8, 'etherCON', 'eth', 'io'), s('SFP', 2, 'SFP', 'fibre', 'io', { start: 9 }), [{ name: 'Alimentation', conn: 'powerCON', sig: 'power', dir: 'in' }]) },

    // ---------- Splitters ----------
    { id: 'gen-split6', maker: 'Générique', model: 'Splitter DMX 1→6', cat: 'splitter', verified: false,
      ports: ports([{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX Thru', conn: 'XLR5F', sig: 'dmx', dir: 'out' }], s('DMX Out', 6, 'XLR5F', 'dmx', 'out'), [{ name: 'Alimentation', conn: 'powerCON', sig: 'power', dir: 'in' }]) },
    { id: 'gen-split2x4', maker: 'Générique', model: 'Splitter DMX 2×4 (2 univers)', cat: 'splitter', verified: false,
      ports: ports(s('DMX In', 2, 'XLR5M', 'dmx', 'in', { letters: true }), s('DMX Out A', 4, 'XLR5F', 'dmx', 'out'), s('DMX Out B', 4, 'XLR5F', 'dmx', 'out'), [{ name: 'Alimentation', conn: 'powerCON', sig: 'power', dir: 'in' }]) },

    { id: 'swisson-xsp5r', maker: 'Swisson', model: 'XSP-5R', cat: 'splitter', verified: false,
      doc: 'https://www.musicstore.com/en_US/USD/Swisson-X-SP-5R-DMX-Splitter-Single/art-LIG0004214-000',
      notes: 'Rack 19" 1U : 1 entrée + thru, 5 sorties isolées. Source revendeur, fiche Swisson non trouvée.',
      ports: ports([{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX Thru', conn: 'XLR5F', sig: 'dmx', dir: 'out' }], s('DMX Out', 5, 'XLR5F', 'dmx', 'out'), [{ name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'luminex-ls210', maker: 'Luminex', model: 'LumiSplit 2.10', cat: 'splitter', verified: false,
      doc: 'https://www.luminex.be/products/lumisplit/lumisplit-2-10/',
      notes: '2 zones (A et B), 10 sorties. Les entrées existent en face et à l\'arrière : le nombre exact de connecteurs d\'entrée varie selon les sources.',
      ports: ports(s('DMX In', 2, 'XLR5M', 'dmx', 'in', { letters: true }), s('DMX Out', 10, 'XLR5F', 'dmx', 'out'), [{ name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },

    { id: 'botex-dd6-rdm', maker: 'Botex', model: 'DD-6 RDM (5 broches)', cat: 'splitter', verified: false,
      doc: 'https://thomannmusic.com/botex_dmx_splitter_dd_6_rdm.htm',
      notes: 'Splitter 1→6 RDM, sorties isolées galvaniquement, 19". Source revendeur (Thomann).',
      ports: ports([{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX Thru', conn: 'XLR5F', sig: 'dmx', dir: 'out' }], s('DMX Out', 6, 'XLR5F', 'dmx', 'out'), [{ name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'botex-optosplit-3p', maker: 'Botex', model: 'Opto Split Pro 3P', cat: 'splitter', verified: false,
      doc: 'https://www.thomann.co.uk/botex_opto_split_pro_3p.htm',
      notes: 'Splitter 1→8 DMX/RDM, sorties opto-isolées en XLR 3 broches (existe en 5P). Source revendeur.',
      ports: ports([{ name: 'DMX In', conn: 'XLR3M', sig: 'dmx', dir: 'in' }, { name: 'DMX Thru', conn: 'XLR3F', sig: 'dmx', dir: 'out' }], s('DMX Out', 8, 'XLR3F', 'dmx', 'out'), [{ name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },

    // ---------- Gradateurs ----------
    { id: 'botex-dpx620', maker: 'Botex', model: 'DPX-620 II (6 × 16 A)', cat: 'dimmer', verified: false,
      doc: 'https://www.thomann.fr/botex_dpx620_ii_6kanal_dimmer_s.htm',
      notes: 'Bloc 6 voies 16 A, sorties sur prises, 96 A max. Connecteur DMX (3 ou 5 broches) et d\'alimentation à vérifier.',
      ports: ports([{ name: 'DMX In', conn: 'XLR3M', sig: 'dmx', dir: 'in' }, { name: 'DMX Thru', conn: 'XLR3F', sig: 'dmx', dir: 'out' }], s('Voie', 6, 'Schuko', 'power', 'out'), [{ name: 'Alimentation', conn: 'Autre', sig: 'power', dir: 'in' }]) },
    { id: 'gen-dimmer6', maker: 'Générique', model: 'Gradateur 6 × 10 A (bornier)', cat: 'dimmer', verified: false,
      ports: ports([{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX Thru', conn: 'XLR5F', sig: 'dmx', dir: 'out' }], s('Voie', 6, 'Bornier', 'power', 'out'), [{ name: 'Alimentation', conn: 'P17', sig: 'power', dir: 'in' }]) },
    { id: 'gen-dimmer12', maker: 'Générique', model: 'Gradateur 12 × 16 A (PC16)', cat: 'dimmer', verified: false,
      ports: ports([{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX Thru', conn: 'XLR5F', sig: 'dmx', dir: 'out' }], s('Voie', 12, 'PC16 (2P+T)', 'power', 'out'), [{ name: 'Alimentation', conn: 'P17', sig: 'power', dir: 'in' }]) },
    { id: 'gen-dimmer24', maker: 'Générique', model: 'Baie de gradateurs 24 × 3 kW (Socapex)', cat: 'dimmer', verified: false,
      ports: ports([{ name: 'DMX A', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX B', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'Réseau', conn: 'etherCON', sig: 'eth', dir: 'io' }], s('Socapex', 4, 'Socapex', 'power', 'out'), [{ name: 'Alimentation', conn: 'P17', sig: 'power', dir: 'in' }]) },

    // ---------- Projecteurs ----------
    { id: 'cameo-zenit-w600', maker: 'Cameo', model: 'ZENIT W600', cat: 'fixture', verified: false,
      doc: 'https://manualslib.mx/manual/58146/Cameo-Zenit-W600.html?page=5',
      notes: 'DMX in XLR5 mâle / out XLR5 femelle IP65 (manuel). Connecteur d\'alimentation à vérifier.',
      ports: [{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX Out', conn: 'XLR5F', sig: 'dmx', dir: 'out' }, { name: 'Alim In', conn: 'powerCON TRUE1', sig: 'power', dir: 'in' }, { name: 'Alim Out', conn: 'powerCON TRUE1', sig: 'power', dir: 'out' }] },
    { id: 'gen-fixture', maker: 'Générique', model: 'Projecteur DMX', cat: 'fixture', verified: false,
      ports: ports([{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX Thru', conn: 'XLR5F', sig: 'dmx', dir: 'out' }, { name: 'Alim In', conn: 'powerCON TRUE1', sig: 'power', dir: 'in' }, { name: 'Alim Thru', conn: 'powerCON TRUE1', sig: 'power', dir: 'out' }]) },

    // ---------- Son ----------
    { id: 'gen-stagebox', maker: 'Générique', model: 'Stagebox Dante 16/8', cat: 'audio', verified: false,
      ports: ports(s('In', 16, 'XLR3F', 'audio', 'in'), s('Out', 8, 'XLR3M', 'audio', 'out'), [{ name: 'Dante Primaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Dante Secondaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'gen-mixer', maker: 'Générique', model: 'Console son numérique', cat: 'audiodesk', verified: false,
      ports: ports(s('Mic In', 8, 'XLR3F', 'audio', 'in'), s('Out', 4, 'XLR3M', 'audio', 'out'), [{ name: 'Dante Primaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Dante Secondaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'AES Out', conn: 'XLR3M', sig: 'audionum', dir: 'out' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'gen-amp4', maker: 'Générique', model: 'Amplificateur 4 canaux', cat: 'amp', verified: false,
      ports: ports(s('In', 4, 'XLR3F', 'audio', 'in', { letters: true }), [{ name: 'Réseau', conn: 'etherCON', sig: 'eth', dir: 'io' }], s('Out', 4, 'speakON NL4', 'hp', 'out', { letters: true }), [{ name: 'Alimentation', conn: 'powerCON', sig: 'power', dir: 'in' }]) },
    { id: 'gen-speaker', maker: 'Générique', model: 'Enceinte passive', cat: 'speaker', verified: false,
      ports: [{ name: 'In', conn: 'speakON NL4', sig: 'hp', dir: 'in' }, { name: 'Link', conn: 'speakON NL4', sig: 'hp', dir: 'out' }] },

    { id: 'yamaha-rio3224d2', maker: 'Yamaha', model: 'Rio3224-D2', cat: 'audio', verified: true,
      doc: 'https://in.yamaha.com/en/products/proaudio/interfaces/r_series_adda_2/specs.html',
      notes: 'Stagebox Dante 32 in / 16 out analogiques, Dante primaire/secondaire sur etherCON (redondant ou daisy-chain). Les sorties AES/EBU (4 XLR, 8 canaux) sont à confirmer sur la fiche Yamaha.',
      ports: ports(s('In', 32, 'XLR3F', 'audio', 'in'), s('Out', 16, 'XLR3M', 'audio', 'out'), s('AES Out', 4, 'XLR3M', 'audionum', 'out'), [{ name: 'Dante Primaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Dante Secondaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'yamaha-rio1608d2', maker: 'Yamaha', model: 'Rio1608-D2', cat: 'audio', verified: true,
      doc: 'https://in.yamaha.com/en/products/proaudio/interfaces/r_series_adda_2/specs.html',
      notes: 'Stagebox Dante 16 in / 8 out. Dante primaire/secondaire sur etherCON.',
      ports: ports(s('In', 16, 'XLR3F', 'audio', 'in'), s('Out', 8, 'XLR3M', 'audio', 'out'), [{ name: 'Dante Primaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Dante Secondaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'yamaha-ql5', maker: 'Yamaha', model: 'QL5', cat: 'audiodesk', verified: true,
      doc: 'https://usa.yamaha.com/products/proaudio/mixers/ql_series/specs.html',
      notes: '32 entrées micro/ligne XLR, 16 sorties OMNI, Dante primaire/secondaire. 2 slots Mini-YGDAI non représentés.',
      ports: ports(s('Input', 32, 'XLR3F', 'audio', 'in'), s('Omni Out', 16, 'XLR3M', 'audio', 'out'), [{ name: 'Dante Primaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Dante Secondaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Network', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'yamaha-ql1', maker: 'Yamaha', model: 'QL1', cat: 'audiodesk', verified: true,
      doc: 'https://usa.yamaha.com/products/proaudio/mixers/ql_series/specs.html',
      notes: '16 entrées micro/ligne XLR, 8 sorties OMNI, Dante 32×32 (primaire/secondaire).',
      ports: ports(s('Input', 16, 'XLR3F', 'audio', 'in'), s('Omni Out', 8, 'XLR3M', 'audio', 'out'), [{ name: 'Dante Primaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Dante Secondaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Network', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },

    // ---------- Vidéo ----------
    { id: 'bmd-atem-tvs-hd8', maker: 'Blackmagic Design', model: 'ATEM Television Studio HD8 (ISO)', cat: 'video', verified: true,
      doc: 'https://www.blackmagicdesign.com/developer/products/atem/techspecs',
      notes: '8 entrées SDI, 12 sorties SDI (programme, aux, multiview…), 1 HDMI multiview, pas d\'entrée HDMI. Audio : 2 XLR, 2 RCA, MADI 32 can. sur BNC.',
      ports: ports(s('SDI In', 8, 'BNC', 'video', 'in'), s('SDI Out', 12, 'BNC', 'video', 'out'), [{ name: 'HDMI Out', conn: 'HDMI', sig: 'video', dir: 'out' }], s('Audio In', 2, 'XLR3F', 'audio', 'in'), [{ name: 'MADI', conn: 'BNC', sig: 'audionum', dir: 'io' }, { name: 'Ethernet', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'bmd-atem-mini-extreme-iso-g2', maker: 'Blackmagic Design', model: 'ATEM Mini Extreme ISO G2', cat: 'video', verified: true,
      doc: 'https://www.blackmagicdesign.com/products/atemmini/techspecs',
      notes: '8 entrées HDMI, 3 sorties HDMI, 2 entrées audio XLR combo. Le nombre de sorties diffère selon la génération.',
      ports: ports(s('HDMI In', 8, 'HDMI', 'video', 'in'), s('HDMI Out', 3, 'HDMI', 'video', 'out'), s('Audio In', 2, 'XLR3F', 'audio', 'in'), [{ name: 'Ethernet', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: 'USB-C', conn: 'USB-C', sig: 'ctrl', dir: 'io' }, { name: 'Alimentation', conn: 'Autre', sig: 'power', dir: 'in' }]) },
    { id: 'bmd-videohub-20', maker: 'Blackmagic Design', model: 'Smart Videohub 12G 20×20', cat: 'video', verified: false,
      doc: 'https://www.blackmagicdesign.com/products/smartvideohub',
      notes: 'Grille SDI 20 entrées / 20 sorties. Fiche à vérifier.',
      ports: ports(s('SDI In', 20, 'BNC', 'video', 'in'), s('SDI Out', 20, 'BNC', 'video', 'out'), [{ name: 'Ethernet', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'gen-switcher', maker: 'Générique', model: 'Mélangeur vidéo 4 SDI', cat: 'video', verified: false,
      ports: ports(s('SDI In', 4, 'BNC', 'video', 'in'), s('SDI Out', 2, 'BNC', 'video', 'out'), [{ name: 'HDMI Multiview', conn: 'HDMI', sig: 'video', dir: 'out' }, { name: 'Réseau', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }]) },
    { id: 'gen-vp', maker: 'Générique', model: 'Vidéoprojecteur', cat: 'video', verified: false,
      ports: [{ name: 'SDI In', conn: 'BNC', sig: 'video', dir: 'in' }, { name: 'HDMI In', conn: 'HDMI', sig: 'video', dir: 'in' }, { name: 'Réseau', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' }] },
    { id: 'gen-cam', maker: 'Générique', model: 'Caméra', cat: 'video', verified: false,
      ports: [{ name: 'SDI Out', conn: 'BNC', sig: 'video', dir: 'out' }, { name: 'HDMI Out', conn: 'HDMI', sig: 'video', dir: 'out' }, { name: 'Alimentation', conn: 'Autre', sig: 'power', dir: 'in' }] },
    { id: 'gen-conv', maker: 'Générique', model: 'Convertisseur SDI → HDMI', cat: 'video', verified: false,
      ports: [{ name: 'SDI In', conn: 'BNC', sig: 'video', dir: 'in' }, { name: 'SDI Loop', conn: 'BNC', sig: 'video', dir: 'out' }, { name: 'HDMI Out', conn: 'HDMI', sig: 'video', dir: 'out' }] },

    // ---------- Brassage (ports traversants : arrière à gauche, face à droite) ----------
    { id: 'patch-scene', maker: 'Salle', model: 'Boîte de scène (multi)', cat: 'patch', verified: false,
      notes: 'Ports traversants : le côté gauche = liaison vers la régie / baie, le côté droit = face utilisable.',
      ports: ports(s('DMX', 4, 'XLR5F', 'dmx', 'io', { pass: true }), s('RJ45', 2, 'etherCON', 'eth', 'io', { pass: true }), s('XLR', 8, 'XLR3F', 'audio', 'io', { pass: true }), s('SDI', 2, 'BNC', 'video', 'io', { pass: true }), s('HP', 2, 'speakON NL4', 'hp', 'io', { pass: true })) },
    { id: 'wall-2rj-1dmx-1int', maker: 'Salle', model: 'Boîtier mural 2 RJ45 + 1 DMX + 1 Intercom', cat: 'patch', verified: false,
      notes: 'Boîtier encastré. Gauche = départ vers la baie scéno, droite = face. Utilisez « Raccorder à une baie » pour créer la liaison.',
      ports: ports(s('RJ45', 2, 'etherCON', 'eth', 'io', { pass: true }), [{ name: 'DMX', conn: 'XLR5F', sig: 'dmx', dir: 'io', pass: true }, { name: 'Intercom', conn: 'XLR3F', sig: 'intercom', dir: 'io', pass: true }]) },
    { id: 'wall-8rj-2dmx', maker: 'Salle', model: 'Boîtier mural 8 RJ45 + 2 DMX', cat: 'patch', verified: false,
      notes: 'Boîtier encastré. Gauche = départ vers la baie scéno, droite = face.',
      ports: ports(s('RJ45', 8, 'etherCON', 'eth', 'io', { pass: true }), s('DMX', 2, 'XLR5F', 'dmx', 'io', { pass: true })) },
    { id: 'wall-custom', maker: 'Salle', model: 'Boîtier mural (vide)', cat: 'patch', verified: false,
      notes: 'Ajoutez les ports dans l\'inspecteur, par ex. « 2 x RJ45 ; etherCON ; eth ; io ; pass ».',
      ports: [] },
    { id: 'baie-sceno', maker: 'Salle', model: 'Baie scéno (répartiteur)', cat: 'patch', verified: false,
      notes: 'Nœud central : chaque boîtier mural raccordé y crée ses ports (nommés d\'après le boîtier). Droite = arrivées des boîtiers (liaisons fixes), gauche = face de brassage.',
      ports: [] },
    { id: 'patch-rj24', maker: 'Salle', model: 'Panneau de brassage RJ45 24', cat: 'patch', verified: false,
      ports: s('RJ45', 24, 'RJ45', 'eth', 'io', { pass: true }) },
    { id: 'patch-dmx8', maker: 'Salle', model: 'Panneau DMX 8 (1U)', cat: 'patch', verified: false,
      ports: s('DMX', 8, 'XLR5F', 'dmx', 'io', { pass: true }) },
    { id: 'patch-sdi8', maker: 'Salle', model: 'Panneau SDI 8 (1U)', cat: 'patch', verified: false,
      ports: s('SDI', 8, 'BNC', 'video', 'io', { pass: true }) },

    // ---------- Baies ----------
    { id: 'rack-19', maker: 'Salle', model: 'Baie 19"', cat: 'rack', verified: false, ports: [] },

    // ================================================================ Allen & Heath
    // Sources : allen-heath.com (pages dLive MixRacks / Surfaces, Avantis, SQ, Qu, CQ, Everything I/O, ME, IP).
    // Les liaisons SLink / DX / gigaACE / ME passent sur etherCON mais ne sont PAS de l'Ethernet : signal « audio numérique ».
    ...(() => {
      const AH = 'https://www.allen-heath.com/hardware/';
      const ec = (name, dir) => ({ name, conn: 'etherCON', sig: 'audionum', dir: dir || 'io' });
      const net = (name) => ({ name: name || 'Network', conn: 'RJ45', sig: 'eth', dir: 'io' });
      const iec = (name) => ({ name: name || 'Alimentation', conn: 'IEC', sig: 'power', dir: 'in' });
      const ioPort = (n) => s('I/O Port', n, 'Autre', 'audionum', 'io', { forceIndex: n > 1 });
      const wc = [{ name: 'Wordclock In', conn: 'BNC', sig: 'ctrl', dir: 'in' }, { name: 'Wordclock Out', conn: 'BNC', sig: 'ctrl', dir: 'out' }];
      const out = [];
      const add = (t) => out.push(Object.assign({ maker: 'Allen & Heath' }, t));

      // --- dLive MixRacks
      [['DM64', 64, 32], ['DM48', 48, 24], ['DM32', 32, 16], ['DM0', 0, 0]].forEach(([m, i, o]) => add({
        id: 'ah-dlive-' + m.toLowerCase(), model: 'dLive ' + m + ' (MixRack S Class)', cat: 'audiodesk', verified: true, doc: AH + 'dlive-series/dlive-mixracks/',
        notes: `${i} entrées micro/ligne, ${o} sorties ligne, 3 I/O Ports (cartes Dante, MADI, gigaACE…), gigaACE redondant vers la surface, 2 DX redondants, port ME, 2 ports réseau. Alimentation redondante en option.`,
        ports: ports(s('Mic In', i, 'XLR3F', 'audio', 'in'), s('Line Out', o, 'XLR3M', 'audio', 'out'), [ec('gigaACE (surface)'), ec('gigaACE redondant'), ec('DX 1'), ec('DX 2'), ec('DX 1 redondant'), ec('DX 2 redondant'), ec('ME', 'out')], ioPort(3), [net('Network 1'), net('Network 2')], wc, [iec('Alimentation 1'), iec('Alimentation 2 (option)')])
      }));
      [['CDM64', 64, 32], ['CDM48', 48, 24], ['CDM32', 32, 16]].forEach(([m, i, o]) => add({
        id: 'ah-dlive-' + m.toLowerCase(), model: 'dLive ' + m + ' (MixRack C Class)', cat: 'audiodesk', verified: true, doc: AH + 'dlive-series/dlive-mixracks/',
        notes: `${i} entrées micro/ligne, ${o} sorties ligne, 1 I/O Port, gigaACE vers la surface, 2 DX, port ME, 2 ports réseau.`,
        ports: ports(s('Mic In', i, 'XLR3F', 'audio', 'in'), s('Line Out', o, 'XLR3M', 'audio', 'out'), [ec('gigaACE (surface)'), ec('DX 1'), ec('DX 2'), ec('ME', 'out')], ioPort(1), [net('Network 1'), net('Network 2')], wc, [iec()])
      }));
      // --- dLive Surfaces
      ['S7000', 'S5000', 'S3000'].forEach((m) => add({
        id: 'ah-dlive-' + m.toLowerCase(), model: 'dLive ' + m + ' (Surface)', cat: 'audiodesk', verified: true, doc: AH + 'dlive-series/dlive-surfaces/',
        notes: 'Surface S Class : 8 entrées / 8 sorties locales, 2 AES in / 3 AES out, gigaACE redondant vers la MixRack, DX redondant, 2 I/O Ports, 2 réseaux, sortie vidéo.',
        ports: ports(s('Local In', 8, 'XLR3F', 'audio', 'in'), s('Local Out', 8, 'XLR3M', 'audio', 'out'), s('AES In', 2, 'XLR3F', 'audionum', 'in'), s('AES Out', 3, 'XLR3M', 'audionum', 'out'), [ec('gigaACE (MixRack)'), ec('gigaACE redondant'), ec('DX'), ec('DX redondant')], ioPort(2), [net('Network 1'), net('Network 2')], wc, [{ name: 'Vidéo Out', conn: 'DVI', sig: 'video', dir: 'out' }, iec('Alimentation 1'), iec('Alimentation 2 (option)')])
      }));
      ['C3500', 'C2500', 'C1500', 'CTi1500'].forEach((m) => add({
        id: 'ah-dlive-' + m.toLowerCase(), model: 'dLive ' + m + ' (Surface)', cat: 'audiodesk', verified: true, doc: AH + 'dlive-series/dlive-surfaces/',
        notes: 'Surface C Class : 6 entrées / 6 sorties locales, 1 AES in / 1 AES out, gigaACE vers la MixRack, DX, 1 I/O Port, 2 réseaux, sortie vidéo.',
        ports: ports(s('Local In', 6, 'XLR3F', 'audio', 'in'), s('Local Out', 6, 'XLR3M', 'audio', 'out'), [{ name: 'AES In', conn: 'XLR3F', sig: 'audionum', dir: 'in' }, { name: 'AES Out', conn: 'XLR3M', sig: 'audionum', dir: 'out' }, ec('gigaACE (MixRack)'), ec('DX')], ioPort(1), [net('Network 1'), net('Network 2')], wc, [{ name: 'Vidéo Out', conn: 'DVI', sig: 'video', dir: 'out' }, iec()])
      }));
      // --- Avantis
      [['avantis', 'Avantis', 12, 1, 12, 2], ['avantis-solo', 'Avantis Solo', 6, 1, 6, 1]].forEach(([id, m, ai, ei, ao, eo]) => add({
        id: 'ah-' + id, model: m + ' (et version Ultra)', cat: 'audiodesk', verified: true, doc: AH + 'avantis/',
        notes: `${ai} entrées analogiques + ${ei} AES stéréo, ${ao} sorties + ${eo} AES stéréo, 2 I/O Ports 128×128 (gigaACE, DX, Dante, SLink, MADI…). Réseau pour Director / MixPad.`,
        ports: ports(s('Local In', ai, 'XLR3F', 'audio', 'in'), s('Local Out', ao, 'XLR3M', 'audio', 'out'), s('AES In', ei, 'XLR3F', 'audionum', 'in'), s('AES Out', eo, 'XLR3M', 'audionum', 'out'), ioPort(2), [net(), iec()])
      }));
      // --- SQ / SQ+
      [['sq-5', 'SQ-5 / SQ5+', 16, 12], ['sq-6', 'SQ-6 / SQ6+', 24, 14], ['sq-7', 'SQ-7 / SQ7+', 32, 16], ['sq-rack', 'SQ-Rack', 32, 12]].forEach(([id, m, i, o]) => add({
        id: 'ah-' + id, model: m, cat: 'audiodesk', verified: id === 'sq-5' || id === 'sq-rack', doc: AH + 'sq/',
        notes: `${i} entrées micro XLR, entrées stéréo ligne, ${o} sorties XLR + 2 sorties jack, sortie AES, port SLink (stageboxes, ME), I/O Port 64×64 (Dante, MADI, Waves, SLink), USB 32×32.` + (id === 'sq-6' || id === 'sq-7' ? ' Répartition XLR / jack des sorties à vérifier.' : ''),
        ports: ports(s('Mic In', i, 'XLR3F', 'audio', 'in'), [{ name: 'Talkback', conn: 'XLR3F', sig: 'audio', dir: 'in' }], s('ST In', id === 'sq-rack' ? 6 : 4, 'Jack 6.35', 'audio', 'in'), s('Out', o, 'XLR3M', 'audio', 'out'), s('Alt Out', 2, 'Jack 6.35', 'audio', 'out'), [{ name: 'AES Out', conn: 'XLR3M', sig: 'audionum', dir: 'out' }, ec('SLink')], ioPort(1), [net(), { name: 'USB-B (audio)', conn: 'Autre', sig: 'ctrl', dir: 'io' }, { name: 'USB-A (SQ-Drive)', conn: 'USB-A', sig: 'ctrl', dir: 'io' }, iec()])
      }));
      // --- Qu (nouvelle gamme) : chaque modèle existe en version « D » avec Dante 16×16 sur etherCON
      [['qu-3', 'Qu-3', 16, 8, 1, false], ['qu-5', 'Qu-5', 16, 12, 2, true], ['qu-6', 'Qu-6', 24, 16, 2, true], ['qu-7', 'Qu-7', 32, 20, 2, true]].forEach(([id, m, i, o, st, tb]) => [false, true].forEach((dante) => add({
        id: 'ah-' + id + (dante ? 'd' : ''), model: m + (dante ? 'D' : ''), cat: 'audiodesk', verified: id === 'qu-3' || id === 'qu-5', doc: AH + 'qu/',
        notes: `${i} entrées combo XLR/jack, ${o} sorties XLR, ${st} entrée(s) stéréo ligne (2 jacks), sortie AES, SLink 128×128 (stageboxes Everything I/O, ME), USB-C 32×32.` + (dante ? ' Dante 16×16 sur etherCON (32×32 en option).' : '') + (id === 'qu-6' || id === 'qu-7' ? ' Détail des sorties jack à vérifier.' : ''),
        ports: ports(s('In', i, 'XLR3F', 'audio', 'in'), tb ? [{ name: 'Talkback', conn: 'XLR3F', sig: 'audio', dir: 'in' }] : [], s('ST In', st * 2, 'Jack 6.35', 'audio', 'in'), s('Out', o, 'XLR3M', 'audio', 'out'), id === 'qu-3' ? [] : s('Alt Out', 2, 'Jack 6.35', 'audio', 'out'), [{ name: 'AES Out', conn: 'XLR3M', sig: 'audionum', dir: 'out' }, ec('SLink')], dante ? [{ name: 'Dante', conn: 'etherCON', sig: 'eth', dir: 'io' }] : [], [{ name: 'USB-C (audio)', conn: 'USB-C', sig: 'ctrl', dir: 'io' }, { name: 'USB-A', conn: 'USB-A', sig: 'ctrl', dir: 'io' }, iec()])
      })));
      // --- CQ
      [['cq-12t', 'CQ-12T', 10, 2, 'Jack 6.35'], ['cq-18t', 'CQ-18T', 16, 2, 'Jack 6.35'], ['cq-20b', 'CQ-20B', 16, 4, 'XLR3M']].forEach(([id, m, i, st, monConn]) => add({
        id: 'ah-' + id, model: m, cat: 'audiodesk', verified: true, doc: AH + 'cq/' + id + '/',
        notes: `${i} entrées micro/ligne (XLR et combos), ${st} entrées jack stéréo, 2 sorties Main XLR, 6 sorties retours. USB-B audio, Bluetooth, carte SD.` + (id !== 'cq-12t' ? ' Wi-Fi intégré.' : ''),
        ports: ports(s('In', i, 'XLR3F', 'audio', 'in'), s('ST In', st, 'Jack 6.35', 'audio', 'in'), s('Main', 2, 'XLR3M', 'audio', 'out', { letters: false }), s('Mon', 6, monConn, 'audio', 'out'), [{ name: 'USB-B (audio)', conn: 'Autre', sig: 'ctrl', dir: 'io' }, { name: 'Alimentation', conn: 'Autre', sig: 'power', dir: 'in' }])
      }));

      // --- Everything I/O : expanders DX (96 kHz)
      const dx = (id, m, i, o, extra, notes, power) => add({ id: 'ah-' + id, model: m, cat: 'audio', verified: true, doc: AH + 'everything-i-o/' + id + '/', notes,
        ports: ports(s('In', i, 'XLR3F', 'audio', 'in'), s('Out', o, 'XLR3M', 'audio', 'out'), extra, power || [iec()]) });
      dx('dx168', 'DX168', 16, 8, [ec('DX A'), ec('DX B (redondant / cascade)')], 'Stagebox DX 16 in / 8 out 96 kHz. Port B : redondance ou cascade d\'un 2e expander. dLive, Avantis, SQ, Qu 96k, AHM.');
      dx('dx164-w', 'DX164-W', 16, 4, [ec('DX A'), ec('DX B (redondant / cascade)')], 'Boîtier mural DX 16 in / 4 out 96 kHz.', [iec(), { name: 'Secours 12 V DC', conn: 'Bornier', sig: 'power', dir: 'in' }]);
      dx('dx012', 'DX012', 0, 12, [ec('DX A'), ec('DX B (redondant / cascade)')], '12 sorties XLR (analogiques, ou 4/8 en AES stéréo sur les sorties 5-12). 1U.');
      dx('gx4816', 'GX4816', 48, 16, [ec('SLink / gigaACE'), ec('DX 1'), ec('DX 2')], 'Expander 48 in / 16 out 96 kHz (5U). Se branche sur le SLink (SQ, Qu, Avantis) ou une carte gigaACE (dLive). DX 2 peut alimenter le système ME (sauf dLive / AHM).');
      add({ id: 'ah-dx32', model: 'DX32', cat: 'audio', verified: true, doc: AH + 'everything-i-o/dx32/', notes: 'Expander modulaire 4 slots de 8 canaux (entrées / sorties analogiques ou AES, modules PRIME). 4U, double alimentation.',
        ports: ports(s('Slot', 4, 'Autre', 'audio', 'io'), [ec('DX A'), ec('DX B (redondant)'), iec('Alimentation 1'), iec('Alimentation 2 (option)')]) });
      add({ id: 'ah-dx88-p', model: 'DX88-P', cat: 'audio', verified: true, doc: AH + 'everything-i-o/dx88-p/', notes: '8 entrées micro/ligne et 8 sorties ligne sur borniers Phoenix / Euroblock. DX A vers la console, DX B en cascade (RJ45). Alimentation à vérifier.',
        ports: ports(s('In', 8, 'Bornier', 'audio', 'in'), s('Out', 8, 'Bornier', 'audio', 'out'), [{ name: 'DX A', conn: 'RJ45', sig: 'audionum', dir: 'io' }, { name: 'DX B (cascade)', conn: 'RJ45', sig: 'audionum', dir: 'io' }, { name: 'Alimentation', conn: 'Autre', sig: 'power', dir: 'in' }]) });
      add({ id: 'ah-dx-hub', model: 'DX Hub', cat: 'audio', verified: true, doc: AH + 'everything-i-o/dx-hub/', notes: '4 ports DX Link 32×32 (2 expanders par port, ou 1 DX32), relié à la console par un seul câble (SLink ou carte gigaACE). Alimentation à vérifier.',
        ports: ports([ec('Liaison console (SLink / gigaACE)')], s('DX', 4, 'etherCON', 'audionum', 'io'), [{ name: 'Alimentation', conn: 'Autre', sig: 'power', dir: 'in' }]) });
      // --- AudioRacks 48 kHz
      dx('ar2412', 'AR2412', 24, 12, [ec('SLink (console)'), ec('Expander (AR84 / AB168)'), ec('Monitor (ME)', 'out')], 'AudioRack 24 in / 12 out 48 kHz (3U). Port Expander pour un AR84 / AB168, port Monitor vers le système ME.');
      dx('ar84', 'AR84', 8, 4, [ec('SLink (console / expander amont)')], 'AudioRack 8 in / 4 out 48 kHz (1U).');
      dx('ab168', 'AB168', 16, 8, [ec('SLink (console)'), ec('Expander / ME')], 'Stagebox 16 in / 8 out 48 kHz. 2e port : cascade d\'un expander ou système ME.');
      // --- Dante
      const dt = (id, m, ins, outs, conn, extra, notes) => add({ id: 'ah-' + id, model: m, cat: 'audio', verified: true, doc: AH + 'everything-i-o/' + id + '/', notes,
        ports: ports(s('In', ins, conn.in, 'audio', 'in'), s('Out', outs, conn.out, 'audio', 'out'), extra) });
      dt('dt168', 'DT168', 16, 8, { in: 'XLR3F', out: 'XLR3M' }, [{ name: 'Dante Primaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Dante Secondaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, iec()], 'Stagebox Dante 16 in / 8 out 48/96 kHz. Primaire / secondaire (redondance ou chaînage).');
      dt('dt164-w', 'DT164-W', 16, 4, { in: 'XLR3F', out: 'XLR3M' }, [{ name: 'Dante Primaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'Dante Secondaire', conn: 'etherCON', sig: 'eth', dir: 'io' }, iec(), { name: 'Secours 12 V DC', conn: 'Bornier', sig: 'power', dir: 'in' }], 'Boîtier mural Dante 16 in / 4 out.');
      dt('dt22', 'DT22', 2, 2, { in: 'Bornier', out: 'Bornier' }, [{ name: 'Dante (PoE)', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: '12 V DC', conn: 'Autre', sig: 'power', dir: 'in' }], 'Interface Dante 2 in / 2 out sur Phoenix. Alimentée en PoE ou 12 V.');
      dt('dt20', 'DT20', 2, 0, { in: 'XLR3F', out: 'XLR3M' }, [{ name: 'Dante (PoE)', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: '12 V DC', conn: 'Autre', sig: 'power', dir: 'in' }], 'Interface Dante 2 entrées micro/ligne (combos). PoE ou 12 V.');
      dt('dt02', 'DT02', 0, 2, { in: 'XLR3F', out: 'XLR3M' }, [{ name: 'Dante (PoE)', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: '12 V DC', conn: 'Autre', sig: 'power', dir: 'in' }], 'Interface Dante 2 sorties XLR. PoE ou 12 V.');
      // --- ME (retours personnels) et contrôleurs IP
      [['me-1', 'ME-1', '40 sources'], ['me-500', 'ME-500', '16 voies']].forEach(([id, m, n]) => add({
        id: 'ah-' + id, model: m, cat: 'audio', verified: true, doc: AH + 'me-series/' + id + '/', notes: `Mixeur personnel ${n}. Alimenté en PoE par le ME-U ou par secteur ; chaînable (ME In → Thru).`,
        ports: [ec('ME In', 'in'), ec('ME Thru', 'out'), { name: 'Casque 6.35', conn: 'Jack 6.35', sig: 'audio', dir: 'out' }, { name: 'Casque 3.5', conn: 'Autre', sig: 'audio', dir: 'out' }].concat(id === 'me-1' ? [{ name: 'Aux In', conn: 'Autre', sig: 'audio', dir: 'in' }] : [], [{ name: 'Alimentation', conn: 'Autre', sig: 'power', dir: 'in' }])
      }));
      add({ id: 'ah-me-u', model: 'ME-U', cat: 'audio', verified: true, doc: AH + 'me-series/me-u/', notes: 'Hub PoE 10 ports pour ME-1 / ME-500 (audio + alimentation). Carte d\'entrée : console A&H, Dante, MADI ou DiGiCo.',
        ports: ports([ec('Entrée (carte)', 'in')], s('ME', 10, 'etherCON', 'audionum', 'out'), [ec('Link (2e hub)', 'out'), net(), iec()]) });
      [['ip8', 'IP8', '8 faders'], ['ip6', 'IP6', '6 rotatifs']].forEach(([id, m, n]) => add({
        id: 'ah-' + id, model: m, cat: 'audio', verified: id === 'ip8', doc: AH + 'ip-series/' + id + '/', notes: `Contrôleur réseau ${n} pour dLive, Avantis et AHM. PoE ou alimentation 12 V.`,
        ports: [{ name: 'Network (PoE)', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: '12 V DC', conn: 'Autre', sig: 'power', dir: 'in' }] }));
      return out;
    })(),

    // ================================================================ Robert Juliat
    // Sully 650SX : fiche DSEN381 (data in XLR5 mâle + etherCON RJ45, out XLR5 femelle, powerCON TRUE1 in/out).
    ...(() => {
      const RJ = 'https://www.robertjuliat.com/';
      const dmx = [{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX Out', conn: 'XLR5F', sig: 'dmx', dir: 'out' }];
      const pw = [{ name: 'Alim In', conn: 'powerCON TRUE1', sig: 'power', dir: 'in' }, { name: 'Alim Out', conn: 'powerCON TRUE1', sig: 'power', dir: 'out' }];
      const eth = [{ name: 'Ethernet In (Art-Net / sACN)', conn: 'etherCON', sig: 'eth', dir: 'in' }];
      const f = (id, model, verified, doc, notes, withEth) => ({ id: 'rj-' + id, maker: 'Robert Juliat', model, cat: 'fixture', verified, doc: RJ + doc, notes, ports: ports(dmx, withEth ? eth : [], pw) });
      return [
        f('sully-650sx', 'Sully 650SX (651/653/654SX)', true, 'profilespots/SULLY_650SX.html', 'Découpe LED blanche 115 W. Node Ethernet-DMX intégré : entrée RJ45 (DMX, RDM, Art-Net, sACN), sortie DMX pour chaîner.', true),
        f('sully-650sx-4c', 'Sully 650SX 4C', false, 'profilespots/SULLY_650SX-4C.html', 'Découpe LED 4 couleurs 200 W, DMX / RDM. Entrée réseau uniquement avec le module « DN » (T/650DNSX4C) : à vérifier.', false),
        f('sully-305l', 'Sully 305L (Fresnel / PC)', false, 'singlelenslum/SULLY_305L.html', 'Projecteur LED blanc 115 W, lentille 150 mm. Réglages RDM ou interface web : entrée réseau à vérifier.', true),
        f('sully-315l-4c', 'Sully 315L 4C (Fresnel / PC)', false, 'singlelenslum/SULLY_315L-4C.html', 'Projecteur LED 4 couleurs 200 W, lentille 200 mm. DMX / RDM.', false),
        f('sully-1156', 'Sully 1156 (poursuite)', false, 'followspots/SULLY_1156.html', 'Poursuite LED 115 W, pilotage local et DMX. Connecteurs à vérifier.', false),
        f('zep2-340lf2', 'Zep² 340LF2 (Fresnel 150 W)', false, 'singlelenslum/ZEP2_340_LED.html', 'Gamme Zep² arrêtée. DMX local et distant (DMX sans fil en option). Connecteurs à vérifier.', false),
        f('zep2-360lf2', 'Zep² 360LF2 (Fresnel 300 W)', false, 'singlelenslum/ZEP2_360_LED.html', 'Gamme Zep² arrêtée. Connecteurs à vérifier.', false),
        f('zep2-640sx2', 'Zep² 640SX2 (découpe 150 W)', false, 'profilespots/ZEP640SX.html', 'Gamme Zep² arrêtée. Jusqu\'à 19 appareils sur une prise 16 A. Connecteurs à vérifier.', false),
        f('zep2-660sx2', 'Zep² 660SX2 (découpe 300 W)', false, 'profilespots/ZEP_660SX.html', 'Gamme Zep² arrêtée (existe aussi en VW). Connecteurs à vérifier.', false)
      ];
    })(),

    // ================================================================ Robe
    // robe.cz, rubrique « Electrical specification and connections » de chaque produit.
    ...(() => {
      const R = 'https://www.robe.cz/';
      const dmx = [{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX Thru', conn: 'XLR5F', sig: 'dmx', dir: 'out' }];
      const ethIn = [{ name: 'Ethernet In', conn: 'RJ45', sig: 'eth', dir: 'in' }];
      const epass = [{ name: 'Ethernet 1 (Epass)', conn: 'RJ45', sig: 'eth', dir: 'io' }, { name: 'Ethernet 2 (Epass)', conn: 'RJ45', sig: 'eth', dir: 'io' }];
      const pw = (c) => [{ name: 'Alim In', conn: c || 'powerCON TRUE1', sig: 'power', dir: 'in' }];
      const f = (slug, model, net, notes, power, verified) => ({ id: 'robe-' + slug, maker: 'Robe', model, cat: 'fixture', verified: verified !== false, doc: R + slug, notes, ports: ports(dmx, net, power || pw()) });
      const xlr = ' DMX en XLR 3 et 5 broches (seul le 5 broches est représenté).';
      return [
        f('megapointe', 'MegaPointe', ethIn, 'Spot / beam / wash à lampe 470 W.' + xlr),
        f('esprite', 'ESPRITE', ethIn, 'Spot LED.' + xlr + ' Switch Epass en option.'),
        f('forte', 'FORTE', epass, 'Spot LED forte puissance.' + xlr + ' Switch Ethernet Epass intégré (in/out).'),
        f('t1-profile', 'T1 Profile', ethIn, 'Découpe LED multispectrale.' + xlr + ' Epass en option.'),
        f('t2-profile', 'T2 Profile', epass, 'Découpe LED multispectrale.' + xlr + ' Switch Epass intégré. Connecteur d\'alimentation à vérifier.'),
        f('t11-profile', 'T11 Profile', ethIn, 'Découpe LED automatique (non motorisée). Epass en option.'),
        f('painte', 'PAINTE', ethIn, 'Spot LED compact. Epass en option.'),
        f('pointe', 'Pointe', epass, 'Spot / beam à lampe.' + xlr, pw('powerCON')),
        f('spiider', 'SPIIDER', epass, 'Wash LED.' + xlr + ' Switch Ethernet intégré.'),
        f('ledbeam-150', 'LEDBeam 150', [], 'Mini lyre wash LED, DMX / RDM uniquement. Connecteur d\'alimentation à vérifier.', null, false),
        f('spikie', 'Spikie', [], 'Mini lyre beam / wash LED, DMX / RDM uniquement. Connecteur d\'alimentation à vérifier.', null, false),
        f('ledwash-600', 'LEDWash 600', ethIn, 'Wash LED.' + xlr),
        f('iforte', 'iFORTE (IP65)', epass, 'Version IP65 du FORTE : connecteurs XLR5 et RJ45 Seetronic IP65. Alimentation IP65 à vérifier.', pw('Autre')),
        f('ipainte', 'iPAINTE (IP65)', ethIn, 'Version IP65 du PAINTE. Ethernet in/out sur demande. Alimentation IP65 à vérifier.', pw('Autre'))
      ];
    })(),

    // ================================================================ Starway
    // starway.eu : les protocoles sont indiqués (DMX, RDM, Art-Net, sACN, Kling-Net) mais pas toujours les connecteurs → à vérifier.
    ...(() => {
      const S = 'https://starway.eu/fr/produits/';
      const dmx = [{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX Out', conn: 'XLR5F', sig: 'dmx', dir: 'out' }];
      const pw = [{ name: 'Alim In', conn: 'powerCON TRUE1', sig: 'power', dir: 'in' }, { name: 'Alim Out', conn: 'powerCON TRUE1', sig: 'power', dir: 'out' }];
      const eth = [{ name: 'Ethernet (Art-Net / sACN)', conn: 'RJ45', sig: 'eth', dir: 'in' }];
      const f = (slug, model, withEth, notes, verified) => ({ id: 'starway-' + slug, maker: 'Starway', model, cat: 'fixture', verified: !!verified, doc: S + slug, notes, ports: ports(dmx, withEth ? eth : [], pw) });
      return [
        f('lusso', 'Lusso', true, 'Lyre spot LED blanche 320 W. DMX, Art-Net, sACN, RDM. Connecteurs à vérifier.'),
        f('dino', 'Dino', true, 'Lyre spot LED IP20. Connecteurs à vérifier.'),
        f('enzo', 'Enzo', true, 'Lyre. DMX, Art-Net, sACN, RDM. Connecteurs à vérifier.'),
        f('daytona', 'Daytona', true, 'Lyre. DMX, Art-Net, sACN, Kling-Net, RDM. Connecteurs à vérifier.'),
        f('modena', 'Modena', true, 'Lyre. DMX, Art-Net, sACN, Kling-Net, RDM. Connecteurs à vérifier.'),
        f('baracca-360', 'Baracca 360', true, 'Lyre à effets CK Effect. DMX, Art-Net, sACN, RDM. Connecteurs à vérifier.'),
        f('aperta', 'Aperta', true, 'Lyre beam, pan / tilt infinis. DMX, Art-Net, Kling-Net, RDM. Connecteurs à vérifier.'),
        f('modena-wet', 'Modena WET (IP65)', true, 'Version IP65. Connecteurs IP65 à vérifier.'),
        f('superfast-wet', 'Superfast WET (IP65)', true, 'Lyre IP65 200 W, solution sans fil intégrée. Connecteurs IP65 à vérifier.'),
        f('parkolor-60hd', 'ParKolor 60 HD (IP65)', false, 'PAR LED IP65. Seetronic TRUE1 in/out et XLR 5 (IP65).', true),
        f('astra-180-hdl', 'Astra 180 HDL (IP65)', false, 'Projecteur LED IP65 12 × 15 W. Seetronic TRUE1 in/out et XLR 5 (IP65).', true),
        f('titan-1230-hdl', 'Titan 1230 HDL', true, 'Barre LED pixel. DMX, Art-Net, Kling-Net. Connecteurs à vérifier.'),
        f('profile-250', 'Profile 250 (gamme Heritage)', false, 'Découpe LED théâtre. Connecteurs à vérifier.'),
        f('profile-500', 'Profile 500 (gamme Heritage)', false, 'Découpe LED théâtre. Connecteurs à vérifier.'),
        f('fresnel-250', 'Fresnel 250 (gamme Heritage)', false, 'Fresnel LED théâtre. Connecteurs à vérifier.'),
        f('fresnel500', 'Fresnel 500 (gamme Heritage)', false, 'Fresnel LED théâtre. Connecteurs à vérifier.')
      ];
    })(),
    // ================================================================ Martin, Ayrton, Clay Paky
    // Connecteurs relevés sur les fiches « Connections / Connectors » des sites constructeurs.
    ...(() => {
      const out = [];
      const dmx = [{ name: 'DMX In', conn: 'XLR5M', sig: 'dmx', dir: 'in' }, { name: 'DMX Thru', conn: 'XLR5F', sig: 'dmx', dir: 'out' }];
      const pwr = (conn, thru) => [{ name: 'Alim In', conn, sig: 'power', dir: 'in' }].concat(thru ? [{ name: 'Alim Thru', conn, sig: 'power', dir: 'out' }] : []);
      // eth : null | 'in' (1 port d'entrée) | 'io' (in + out / switch intégré) | 'io2' (2 ports RJ45 in/out)
      const net = (eth, conn) => !eth ? [] : eth === 'in' ? [{ name: 'Ethernet In', conn, sig: 'eth', dir: 'in' }]
        : [{ name: 'Ethernet In', conn, sig: 'eth', dir: 'io' }, { name: 'Ethernet Out', conn, sig: 'eth', dir: 'io' }];
      const make = (maker, prefix, base, ethConn) => (slug, model, eth, pConn, thru, notes, verified) => out.push({
        id: prefix + slug, maker, model, cat: 'fixture', verified: verified !== false, doc: base + slug, notes,
        ports: ports(dmx, net(eth, ethConn), pwr(pConn, thru))
      });
      const T1 = 'powerCON TRUE1', PC = 'powerCON';

      // --- Martin (martin.com/en/products/…)
      const m = make('Martin', 'martin-', 'https://www.martin.com/en/products/', 'etherCON');
      m('mac-ultra-performance', 'MAC Ultra Performance', 'io', T1, false, 'Spot LED 1 150 W. Switch Ethernet intégré avec bypass (Art-Net, sACN, P3).');
      m('mac-ultra-wash', 'MAC Ultra Wash', 'io', T1, false, 'Wash LED. Switch Ethernet intégré avec bypass (Art-Net, sACN, P3).');
      m('mac-viper-profile', 'MAC Viper Profile', null, PC, false, 'Spot à lampe 1 000 W.');
      m('mac-viper-performance', 'MAC Viper Performance', null, PC, false, 'Spot à lampe 1 000 W avec module de couteaux.');
      m('mac-encore-performance-cld', 'MAC Encore Performance CLD', null, T1, false, 'Découpe LED théâtre, silencieuse.');
      m('mac-encore-wash-cld', 'MAC Encore Wash CLD', null, T1, false, 'Wash LED théâtre, silencieux.');
      m('mac-aura-xb', 'MAC Aura XB', null, T1, true, 'Wash LED compact, DMX / RDM.');
      m('mac-aura-pxl', 'MAC Aura PXL', 'io', T1, true, 'Wash LED pixel. Ethernet in/thru avec bypass.');
      m('mac-allure-profile', 'MAC Allure Profile', 'io', T1, true, 'Spot LED. Ethernet in/out.');
      m('mac-one-beam', 'MAC One Beam', 'io', T1, true, 'Mini lyre beam. Ethernet in/thru avec bypass.');
      m('mac-quantum-profile', 'MAC Quantum Profile', null, PC, false, 'Spot LED.');
      m('mac-axiom-hybrid', 'MAC Axiom Hybrid', null, T1, false, 'Lyre hybride beam / spot.');
      m('era-600-profile', 'ERA 600 Profile', null, T1, true, 'Spot LED.');
      m('era-800-performance', 'ERA 800 Performance', null, T1, true, 'Spot LED avec couteaux.');
      m('era-150-wash', 'ERA 150 Wash', null, T1, true, 'Petit wash LED.');
      m('elp-cl', 'ELP CL', null, T1, true, 'Découpe LED couleur (ellipsoïdal).');
      m('elp-ww', 'ELP WW', null, T1, true, 'Découpe LED blanc chaud.');
      m('elp-manet-8f', 'ELP Manet 8F', null, T1, true, 'Fresnel LED.');
      m('rush-mh-6-wash', 'RUSH MH 6 Wash', null, PC, true, 'Wash LED d\'entrée de gamme. DMX aussi en XLR 3 broches.');

      // --- Ayrton (ayrton.eu/produit/…) : récepteur CRMX intégré sur toute la gamme
      const a = make('Ayrton', 'ayrton-', 'https://www.ayrton.eu/produit/', 'etherCON');
      const ip = (txt) => txt + ' Version IP65 : connecteurs XLR 5, RJ45 et TRUE1 TOP étanches.';
      a('mistral', 'Mistral', null, T1, true, 'Spot LED compact. CRMX intégré.');
      a('diablo', 'Diablo', null, T1, true, 'Spot / profile LED compact. CRMX intégré.');
      a('levante', 'Levante', null, T1, true, 'Spot LED. CRMX intégré.');
      a('karif-lt', 'Karif LT', null, T1, true, 'Beam LED. CRMX intégré.');
      a('khamsin', 'Khamsin', 'io', T1, false, 'Profile LED. Ethernet in/out (Art-Net, sACN). CRMX intégré.');
      a('ghibli', 'Ghibli', 'io', T1, false, 'Spot LED. Ethernet in/out. CRMX intégré.');
      a('eurus', 'Eurus', 'io', T1, false, 'Profile LED. Ethernet in/out. CRMX intégré.');
      a('bora', 'Bora', 'io', T1, false, 'Wash / profile LED. Ethernet in/out. CRMX intégré.');
      a('huracan-profile', 'Huracan Profile', 'io', T1, false, 'Profile LED grande puissance. Ethernet in/out. CRMX intégré.');
      a('zonda-3-fx', 'Zonda 3 FX', 'io', T1, true, 'Wash / beam LED. Ethernet in/out. CRMX intégré.');
      a('zonda-9-fx', 'Zonda 9 FX', 'io', T1, false, 'Wash / beam LED. Ethernet in/out. CRMX intégré.');
      a('rivale-profile', 'Rivale Profile (IP65)', 'io', T1, true, ip('Profile LED.'));
      a('perseo-profile', 'Perseo Profile (IP65)', 'io', T1, false, ip('Profile LED.') + ' Existe en IP66 avec queues de câble.');
      a('perseo-beam', 'Perseo Beam (IP65)', 'io', T1, false, ip('Beam LED.'));
      a('cobra', 'Cobra (IP65)', 'io', T1, false, ip('Beam laser.'));
      a('domino-profile', 'Domino Profile (IP65)', 'io', T1, false, ip('Profile LED.') + ' Existe en IP66 avec queues de câble.');
      a('domino-lt', 'Domino LT (IP65)', 'io', T1, false, ip('Profile LED.'));
      a('argo-6-fx', 'Argo 6 FX (IP65)', 'io', T1, true, ip('Wash / beam LED.'));
      a('magicdot-neo', 'MagicDot Neo (IP65)', 'io', T1, true, ip('Wash LED à rotation infinie.'));
      a('kyalami', 'Kyalami (IP65)', 'io', T1, true, ip('Spot LED.'));

      // --- Clay Paky (claypaky.it/products/…)
      const c = make('Clay Paky', 'cp-', 'https://www.claypaky.it/products/', 'RJ45');
      c('sharpy-plus', 'Sharpy Plus', 'in', T1, false, 'Hybride beam / spot.');
      c('sharpy-plus-aqua', 'Sharpy Plus Aqua (IP66)', 'in', T1, false, 'Version IP66 du Sharpy Plus.');
      c('sharpy-legacy', 'Sharpy (legacy)', null, PC, false, 'Beam à lampe. DMX en XLR 3 et 5 broches. Connecteur d\'alimentation à vérifier.', false);
      c('ultimo-sharpy', 'Ultimo Sharpy', 'io', T1, false, 'Beam nouvelle génération. Ethernet in/out.');
      c('skylos', 'Skylos', 'in', T1, true, 'Beam / skytracker longue portée.');
      c('xtylos-aqua', 'Xtylos Aqua (IP66)', 'in', T1, true, 'Beam laser IP66. Sortie secteur pour chaîner.');
      c('mini-xtylos', 'Mini Xtylos', 'in', T1, false, 'Petit beam laser.');
      c('arolla-profile-hp', 'Arolla Profile HP', 'in', T1, false, 'Profile LED grande puissance. DMX aussi en XLR 3 broches.');
      c('arolla-profile-mp', 'Arolla Profile MP', 'in', T1, true, 'Profile LED.');
      c('arolla-spot-mp', 'Arolla Spot MP', 'in', T1, true, 'Spot LED.');
      c('arolla-aqua', 'Arolla Aqua (IP66)', 'in', T1, false, 'Profile LED IP66.');
      c('sinfonya-profile-600', 'Sinfonya Profile 600', 'in', T1, true, 'Profile LED théâtre.');
      c('actoris-profile-fc', 'Actoris Profile FC', 'io', T1, true, 'Découpe LED full colour.');
      c('orkis-fresnel', 'Orkis Fresnel', 'in', T1, false, 'Fresnel LED.');
      c('rhapsodya', 'Rhapsodya', 'io2', T1, false, 'Profile LED. 2 RJ45 in/out.');
      c('mini-b', 'Mini-B', 'in', T1, true, 'Petit wash / beam LED.');
      c('midib', 'Midi-B', 'in', T1, false, 'Wash / beam LED.');
      c('b-eye-k30', 'B-EYE K30', 'io', T1, false, 'Wash à effets LED. Ethernet in/out.');
      c('hy-b-eye-k25', 'HY B-EYE K25', 'in', T1, true, 'Hybride wash / beam. DMX aussi en XLR 3 broches.');
      c('axcor-spot400', 'Axcor Spot 400', 'in', T1, false, 'Spot LED.');
      c('volero-wave', 'Volero Wave', 'io', T1, true, 'Barre à effets. Switch Ethernet in/out.');
      c('tambora-batten', 'Tambora Batten', 'in', T1, false, 'Barre LED.');
      return out;
    })(),
    // ================================================================ L-Acoustics (l-acoustics.com/products/…)
    // Contrôleurs amplifiés : réseau Milan-AVB sur 2 etherCON, entrées XLR (1-2 commutables analogique / AES3).
    ...(() => {
      const B = 'https://www.l-acoustics.com/products/';
      const avb = [{ name: 'AVB 1 (Milan)', conn: 'etherCON', sig: 'eth', dir: 'io' }, { name: 'AVB 2 (Milan)', conn: 'etherCON', sig: 'eth', dir: 'io' }];
      const xlrIO = ports(s('In', 4, 'XLR3F', 'audio', 'in'), s('Link', 4, 'XLR3M', 'audio', 'out'));
      const amp = (id, model, outs, notes, verified, power, inputs) => ({ id: 'la-' + id, maker: 'L-Acoustics', model, cat: 'amp', verified: verified !== false, doc: B + id + '/', notes,
        ports: ports(inputs || xlrIO, avb, outs, [{ name: 'Secteur', conn: power || 'powerCON', sig: 'power', dir: 'in' }]) });
      const spk = (id, model, cnx, notes, verified) => ({ id: 'la-' + id, maker: 'L-Acoustics', model, cat: 'speaker', verified: verified !== false, doc: B + id + '/', notes, ports: cnx });
      const inLink = [{ name: 'IN', conn: 'speakON NL4', sig: 'hp', dir: 'in' }, { name: 'LINK', conn: 'speakON NL4', sig: 'hp', dir: 'out' }];
      return [
        amp('la4x', 'LA4X', s('Out', 4, 'speakON NL4', 'hp', 'out'), '4 canaux. Entrées : 4 XLR femelles (1-2 commutables analogique / AES3) + 4 XLR mâles de link. Milan-AVB 1 Gb/s. Connecteur secteur à vérifier (powerCON).'),
        amp('la12x', 'LA12X', [{ name: 'Out 1-2', conn: 'speakON NL4', sig: 'hp', dir: 'out' }, { name: 'Out 3-4', conn: 'speakON NL4', sig: 'hp', dir: 'out' }, { name: 'Out 1-4 (CA-COM)', conn: 'Autre', sig: 'hp', dir: 'out' }], '4 canaux haute puissance. Sorties : 2 speakON 4 points + 1 CA-COM 8 points. Entrées : 4 XLR (1-2 analogique / AES3) + 4 links. Milan-AVB redondant. Connecteur secteur à vérifier (powerCON 32 A).'),
        amp('la7-16', 'LA7.16', [{ name: 'Out 1-16 (SC32)', conn: 'Autre', sig: 'hp', dir: 'out' }], '16 canaux. Sortie sur 1 connecteur SC32. Entrée : bornier 12 points (AES3 ou analogique + GPIO). Milan-AVB redondant. Secteur powerCON 32 A.', true, 'powerCON',
          [{ name: 'Bornier 12 pts (AES3 / analogique / GPIO)', conn: 'Bornier', sig: 'audio', dir: 'in' }]),
        amp('la7-16i', 'LA7.16i', s('Out', 8, 'Bornier', 'hp', 'out'), 'Version installation du LA7.16 : 8 borniers femelles 4 points (16 canaux). Milan-AVB ou AES67. Secteur powerCON 32 A.', true, 'powerCON',
          [{ name: 'Bornier 12 pts (AES3 / analogique / GPIO)', conn: 'Bornier', sig: 'audio', dir: 'in' }]),
        amp('la2xi', 'LA2Xi', s('Out', 4, 'Bornier', 'hp', 'out'), 'Contrôleur amplifié d\'installation 4 canaux. Entrées sur borniers 3 points (1-2 analogique / AES3), Milan-AVB ou AES67, GPIO. Sorties sur borniers : à vérifier.', false, 'IEC',
          ports(s('In', 4, 'Bornier', 'audio', 'in'))),
        spk('a10-wide', 'A10 Wide', inLink, 'Enceinte line source / point source, ouverture large. 2 speakON 4 points (entrée + link). Pilotée par LA4X / LA12X.'),
        spk('a10-focus', 'A10 Focus', inLink, 'Enceinte line source / point source, ouverture étroite (longue portée). 2 speakON 4 points (entrée + link). Pilotée par LA4X / LA12X.'),
        spk('a15-wide', 'A15 Wide', inLink, 'Grande sœur de l\'A10 Wide. speakON IN / LINK.'),
        spk('a15-focus', 'A15 Focus', inLink, 'Grande sœur de l\'A10 Focus. speakON IN / LINK.'),
        spk('x12', 'X12', inLink, 'Coaxiale 12" (façade, retour de scène). speakON IN / LINK.'),
        spk('x8', 'X8', inLink, 'Coaxiale 8". speakON IN / LINK.'),
        spk('x15-hiq', 'X15 HiQ', inLink, 'Retour de scène coaxial 15". speakON IN / LINK.'),
        spk('ks21', 'KS21', inLink, 'Sub 21". Le site constructeur indique « 2 borniers 4 points push-in » alors que la version tournée est connue en 2 speakON : à vérifier.', false),
        spk('ks28', 'KS28', [{ name: 'IN', conn: 'speakON NL4', sig: 'hp', dir: 'in' }], 'Sub 2 × 18". 1 speakON 4 points d\'après le site (vérifier la présence d\'un link).', false),
        spk('syva', 'Syva', [{ name: 'IN', conn: 'speakON NL4', sig: 'hp', dir: 'in' }, { name: 'IN (bornier)', conn: 'Bornier', sig: 'hp', dir: 'in' }], 'Colonne. 1 speakON 4 points, 1 bornier 2 points et 1 AutoConnect (vers Syva Low / Sub).')
      ];
    })(),

    // ================================================================ QSC — enceintes amplifiées
    ...(() => {
      const B = 'https://www.qscaudio.com/resource-files/productresources/spk/k.2/q_spk_k2_specs.pdf';
      const k2 = [{ name: 'In A (Mic/Line)', conn: 'XLR3F', sig: 'audio', dir: 'in' }, { name: 'In B (Hi-Z/Line)', conn: 'XLR3F', sig: 'audio', dir: 'in' }, { name: 'In C (mini-jack stéréo)', conn: 'Autre', sig: 'audio', dir: 'in' },
        { name: 'Thru A', conn: 'XLR3M', sig: 'audio', dir: 'out' }, { name: 'Thru B', conn: 'XLR3M', sig: 'audio', dir: 'out' }, { name: 'Mix Out', conn: 'XLR3M', sig: 'audio', dir: 'out' }, { name: 'Secteur', conn: 'IEC', sig: 'power', dir: 'in' }];
      const k = (id, model, notes) => ({ id: 'qsc-' + id, maker: 'QSC', model, cat: 'speaker', verified: true, doc: B, notes, ports: k2 });
      const sub = (id, model) => ({ id: 'qsc-' + id, maker: 'QSC', model, cat: 'speaker', verified: false, doc: 'https://www.qscaudio.com/', notes: 'Sub amplifié. Entrées combo et sorties XLR à vérifier.',
        ports: [{ name: 'In A', conn: 'XLR3F', sig: 'audio', dir: 'in' }, { name: 'In B', conn: 'XLR3F', sig: 'audio', dir: 'in' }, { name: 'Out A', conn: 'XLR3M', sig: 'audio', dir: 'out' }, { name: 'Out B', conn: 'XLR3M', sig: 'audio', dir: 'out' }, { name: 'Secteur', conn: 'IEC', sig: 'power', dir: 'in' }] });
      const kNotes = 'Enceinte amplifiée 2 000 W. Entrées : 2 combos XLR / jack (A : micro/ligne, B : Hi-Z/ligne) + mini-jack stéréo. Sorties : 2 XLR de recopie (Thru A / B) + 1 XLR Mix Out.';
      return [k('k8-2', 'K8.2', kNotes), k('k10-2', 'K10.2', kNotes), k('k12-2', 'K12.2', kNotes), sub('ks112', 'KS112'), sub('ks118', 'KS118')];
    })(),
  ];

  window.LIBRARY = { CONNECTORS, SIGNALS, CATEGORIES, TEMPLATES, portGen: s };
})();
