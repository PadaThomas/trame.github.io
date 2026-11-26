/* TRAME — Dessinez • Connectez • Pilotez. Éditeur de synoptique réseau / DMX / son / vidéo.
 * Application statique sans dépendances. Données sauvegardées dans localStorage + export JSON.
 */
(function () {
  'use strict';
  const APP_HTML = '<!doctype html>\n' + document.documentElement.outerHTML;
  const L = window.LIBRARY;
  const STORE_KEY = 'synoptique.project.v1';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const ROOM_COLORS = ['#2f7df6', '#e65100', '#2e7d32', '#8e24aa', '#00838f', '#c62828', '#6d4c41'];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------------------------------------------------------- état
  let project;
  const ui = {
    tab: 'canvas', mode: 'detail', showRooms: true, bundle: true, avoid: true, tidy: true, libOpen: new Set(), filters: {},
    selected: null,            // {type:'device'|'cable'|'bundle', id}
    multi: new Set(),          // câbles sélectionnés avec Maj+clic (pour regrouper)
    pending: null,             // {d,p,s} premier port cliqué
    carry: null,               // réglages d'un câble à rebrancher
    view: { x: 40, y: 40, k: 0.9 },
    drag: null
  };

  function emptyProject() {
    return { name: 'Nouveau projet', rooms: [], signals: clone(L.SIGNALS), customTemplates: [], devices: [], cables: [], groups: {}, validations: {} };
  }

  function allTemplates() { return L.TEMPLATES.concat(project.customTemplates || []).map(withValidation); }

  // ---------------------------------------------------------------- validation des modèles « à vérifier »
  // Une validation = { date, note, ports? } ; ports = liste corrigée (remplace celle du modèle).
  // Enregistrée dans le projet (voyage avec le fichier) ET dans ce navigateur (vaut pour tous les projets).
  const VAL_STORE = 'synoptique.validations';
  let _gvals = {};
  try { _gvals = JSON.parse(localStorage.getItem(VAL_STORE) || '{}') || {}; } catch (e) { _gvals = {}; }
  function saveGVals() { try { localStorage.setItem(VAL_STORE, JSON.stringify(_gvals)); } catch (e) { /* ignore */ } }
  function validationOf(id) { return (project && project.validations && project.validations[id]) || _gvals[id] || null; }
  function withValidation(t) { const v = validationOf(t.id); return v && v.ports ? Object.assign({}, t, { ports: v.ports, corrected: true }) : t; }
  function isGeneric(t) { return t.maker === 'Générique' || t.maker === 'Salle'; }
  function needsCheck(t) { return !!t && !t.verified && !isGeneric(t) && (!t.custom || t.web); }
  function toCheck(t) { return needsCheck(t) && !validationOf(t.id); }
  function baseTemplate(id) { return L.TEMPLATES.concat(project.customTemplates || []).find((t) => t.id === id); }
  const portKey = (ps) => JSON.stringify((ps || []).map((p) => [p.name, p.conn, p.sig, p.dir, !!p.pass]));
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('fr-FR'); } catch (e) { return ''; } }

  function validateModal(id) {
    const base = baseTemplate(id); if (!base) return;
    const v = validationOf(id);
    const t = withValidation(base);
    const placed = project.devices.filter((d) => d.tpl === id);
    const lines = t.ports.map((p) => `${p.name} ; ${p.conn} ; ${p.sig} ; ${p.dir}${p.pass ? ' ; ; pass' : ''}`).join('\n');
    openModal(`<h2>Vérifier : ${esc(t.maker)} ${esc(t.model)}</h2>
      <p class="muted">Comparez les ports avec la documentation du constructeur, corrigez-les si besoin, puis validez. La validation est gardée dans le projet et dans ce navigateur.</p>
      ${v ? `<p class="badge ok" style="display:block;padding:6px 8px;font-size:12px">Validé le ${esc(fmtDate(v.date))}${v.ports ? ' — ports corrigés' : ''}${v.note ? ' — ' + esc(v.note) : ''}</p>` : ''}
      ${t.doc ? `<p><a href="${esc(t.doc)}" target="_blank" rel="noopener">Ouvrir la documentation constructeur ↗</a></p>` : '<p class="muted">Pas de lien de documentation.</p>'}
      ${t.notes ? `<p class="muted" style="font-size:12px">${esc(t.notes)}</p>` : ''}
      <div class="field"><label>Ports — une ligne par port : <code>nom ; connecteur ; signal ; sens</code> (ou <code>quantité x nom ; …</code>)</label>
        <textarea id="vPorts" rows="14">${esc(lines)}</textarea></div>
      <div id="vPreview" class="muted"></div>
      <div class="field"><label>Commentaire (source vérifiée, par qui…)</label><input id="vNote" value="${esc((v && v.note) || '')}" placeholder="ex : vérifié sur l'appareil du théâtre, fiche 2026"></div>
      ${placed.length ? `<label class="chk"><input type="checkbox" id="vApply" checked> Mettre à jour les ${placed.length} appareil(s) déjà placé(s) si les ports changent</label>` : ''}
      <div class="modal-actions">${v ? '<button id="vUnval" class="danger">Retirer la validation</button>' : ''}<button id="vCancel">Annuler</button><button class="primary" id="vOk">Valider ce modèle</button></div>`);
    const preview = () => {
      try {
        const ps = parseQuickPorts($('#vPorts').value);
        const changed = portKey(ps) !== portKey(base.ports);
        $('#vPreview').textContent = ps.length + ' ports' + (changed ? ' — modifiés par rapport à la bibliothèque' : ' — identiques à la bibliothèque');
      } catch (e) { $('#vPreview').textContent = '⚠︎ ' + e.message; }
    };
    $('#vPorts').oninput = preview; preview();
    $('#vCancel').onclick = closeModal;
    $('#vOk').onclick = () => {
      let ps;
      try { ps = parseQuickPorts($('#vPorts').value); } catch (e) { notify(e.message); return; }
      if (!ps.length) { notify('Aucun port.'); return; }
      const changed = portKey(ps) !== portKey(base.ports);
      const val = { date: new Date().toISOString(), note: $('#vNote').value.trim() };
      if (changed) val.ports = ps.map((p) => ({ name: p.name, conn: p.conn, sig: p.sig, dir: p.dir, pass: !!p.pass }));
      project.validations = project.validations || {};
      project.validations[id] = val; _gvals[id] = val; saveGVals();
      const before = portKey(t.ports);
      if ($('#vApply') && $('#vApply').checked && portKey(val.ports || base.ports) !== before) placed.forEach((d) => updateDevicePorts(d, val.ports || base.ports));
      closeModal(); commit();
      flash('Modèle validé : ' + t.model);
    };
    if ($('#vUnval')) $('#vUnval').onclick = () => {
      if (project.validations) delete project.validations[id];
      delete _gvals[id]; saveGVals();
      closeModal(); commit();
      flash('Validation retirée' + (v && v.ports ? ' (les appareils déjà placés gardent leurs ports corrigés)' : ''));
    };
  }

  // Remplace les ports d'un appareil placé, en gardant ceux qui existent encore (même nom) et leurs câbles
  function updateDevicePorts(d, newPorts) {
    const old = d.ports.slice();
    d.ports = newPorts.map((np) => {
      const i = old.findIndex((o) => o.name === np.name);
      const keep = i >= 0 ? old.splice(i, 1)[0] : null;
      return Object.assign({ id: keep ? keep.id : uid() }, np, keep && keep.side ? { side: keep.side } : {});
    });
    const gone = new Set(old.map((o) => o.id));
    project.cables = project.cables.filter((c) => !((c.a.d === d.id && gone.has(c.a.p)) || (c.b.d === d.id && gone.has(c.b.p))));
    d.ports.forEach((p) => reconcilePort(d, p));
  }
  // bilan des connexions : chaque clic sélectionne le câble problématique suivant
  let issueIdx = -1;
  document.addEventListener('click', (ev) => {
    const n = ev.target.closest && ev.target.closest('[data-nextissue]');
    if (!n) return;
    const want = n.dataset.nextissue;
    if (want === 'dmx') {
      const ids = [...dmxConflicts().keys()]; if (!ids.length) return;
      issueIdx = (issueIdx + 1) % ids.length; select({ type: 'device', id: ids[issueIdx] }); return;
    }
    const list = project.cables.filter((c) => { const is = cableAdapterIssue(c); return is && (want === 'bad' ? is.kind === 'impossible' : is.kind !== 'impossible' && !c.adapter); });
    if (!list.length) return;
    issueIdx = (issueIdx + 1) % list.length;
    select({ type: 'cable', id: list[issueIdx].id });
  });
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-validate]');
    if (b) { ev.stopPropagation(); ev.preventDefault(); validateModal(b.dataset.validate); }
  }, true);
  function tplById(id) { return allTemplates().find((t) => t.id === id); }
  function devById(id) { return project.devices.find((d) => d.id === id); }
  function portOf(dev, pid) { return dev && dev.ports.find((p) => p.id === pid); }
  function sigById(id) { return project.signals.find((s) => s.id === id) || { id, name: id, color: '#999', subnets: [] }; }
  function roomById(id) { return project.rooms.find((r) => r.id === id); }
  function subnetOf(cable) { const s = sigById(cable.sig); return (s.subnets || []).find((n) => n.id === cable.sub); }
  function cableColor(c) { const n = subnetOf(c); return n ? n.color : sigById(c.sig).color; }
  function isRack(d) { return d.cat === 'rack'; }
  // ---- Patch DMX (projecteurs, gradateurs) : univers, adresse, mode, nombre de canaux
  const hasPatch = (d) => d && (d.cat === 'fixture' || d.cat === 'dimmer');
  // univers déduit du câble arrivant sur l'entrée DMX (sous-réseau « Univers 2 » → 2)
  function autoUniverse(d) {
    const ins = new Set(d.ports.filter((p) => p.sig === 'dmx' && p.dir === 'in').map((p) => p.id));
    const c = project.cables.find((x) => (x.a.d === d.id && ins.has(x.a.p)) || (x.b.d === d.id && ins.has(x.b.p)));
    const n = c && subnetOf(c);
    if (!n) return '';
    const m = /(\d+)/.exec(n.name);
    return m ? m[1] : n.name;
  }
  function dmxOf(d) {
    const x = d.dmx || {};
    const univ = String(x.univ || '').trim() || autoUniverse(d);
    const addr = parseInt(x.addr, 10), ch = Math.max(1, parseInt(x.ch, 10) || 1);
    return { univ, auto: !String(x.univ || '').trim() && !!univ, addr: addr > 0 ? addr : null, ch, mode: (x.mode || '').trim(), end: addr > 0 ? addr + ch - 1 : null };
  }
  const pad3 = (n) => String(n).padStart(3, '0');
  function dmxLabel(d) {
    const x = dmxOf(d); if (!x.addr) return '';
    return (x.univ ? 'U' + x.univ + ' · ' : '') + pad3(x.addr) + (x.ch > 1 ? '–' + pad3(x.end) : '') + (x.mode ? ' · ' + x.mode : '');
  }
  // conflits : adresses qui se chevauchent dans le même univers, ou qui dépassent 512
  function dmxConflicts() {
    const out = new Map();   // deviceId -> message
    const byU = new Map();
    project.devices.filter(hasPatch).forEach((d) => {
      const x = dmxOf(d); if (!x.addr) return;
      if (x.end > 512) out.set(d.id, 'dépasse le canal 512 (' + pad3(x.addr) + '–' + x.end + ')');
      const k = x.univ || '?';
      (byU.get(k) || byU.set(k, []).get(k)).push({ d, x });
    });
    byU.forEach((list) => {
      list.sort((a, b) => a.x.addr - b.x.addr);
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length && list[j].x.addr <= list[i].x.end; j++) {
        out.set(list[i].d.id, 'chevauche ' + list[j].d.name + ' (' + pad3(list[j].x.addr) + ')');
        out.set(list[j].d.id, 'chevauche ' + list[i].d.name + ' (' + pad3(list[i].x.addr) + '–' + pad3(list[i].x.end) + ')');
      }
    });
    return out;
  }
  // Nom automatique d'une liaison fixe : « départ – arrivée ».
  // Un répartiteur / panneau rangé dans une baie prend le nom de la baie (ex : « Baie scéno »).
  function placeName(id) {
    const d = devById(id); if (!d) return '?';
    const rack = d.parent && devById(d.parent);
    return d.cat === 'patch' && rack ? rack.name : d.name;
  }
  function autoLabel(c) { return c.infra ? placeName(c.a.d) + ' – ' + placeName(c.b.d) : ''; }
  function cableLabel(c) { return c.label || autoLabel(c); }
  function bundleAutoName(cs) {
    const pairs = [...new Set(cs.filter((c) => c.infra).map(autoLabel))];
    return pairs.length === 1 ? pairs[0] : '';
  }

  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(project)); } catch (e) { /* stockage indisponible */ } markDirty(); }
  function commit(opts) { save(); renderAll(opts); }

  // ---------------------------------------------------------------- création
  function instantiate(tpl, x, y) {
    const dev = {
      id: uid(), tpl: tpl.id, name: tpl.model, maker: tpl.maker, model: tpl.model, cat: tpl.cat,
      x: Math.round(x), y: Math.round(y), room: null, parent: null, notes: '', doc: tpl.doc || '',
      ports: (tpl.ports || []).map((p) => Object.assign({ id: uid() }, p))
    };
    if (isRack(dev)) { dev.w = 300; dev.h = 360; }
    // nom unique
    const same = project.devices.filter((d) => d.tpl === tpl.id).length;
    if (same) dev.name = tpl.model + ' ' + (same + 1);
    return dev;
  }

  function addDevice(tpl, x, y, opts) {
    const dev = instantiate(tpl, x, y);
    project.devices.push(dev);
    if (!isRack(dev) && !(opts && opts.noParent)) assignParent(dev);
    ui.selected = { type: 'device', id: dev.id };
    commit();
    return dev;
  }

  function deleteDevice(id) {
    const dev = devById(id);
    if (!dev) return;
    project.devices.forEach((d) => { if (d.parent === id) d.parent = null; });
    project.devices = project.devices.filter((d) => d.id !== id);
    project.cables = project.cables.filter((c) => c.a.d !== id && c.b.d !== id);
    ui.selected = null;
    commit();
  }

  function deleteCable(id) {
    project.cables = project.cables.filter((c) => c.id !== id);
    ui.selected = null;
    commit();
  }

  // Côté de connexion d'un port : choisi par l'utilisateur (port.side), sinon entrées à gauche,
  // sorties/bidir à droite ; les ports traversants ont les deux côtés.
  function defaultSide(port) { return port.side || (port.dir === 'in' ? 'L' : 'R'); }
  // Côté affiché : un périphérique « retourné » (miroir) inverse gauche et droite à l'écran
  function visSide(dev, s) { return dev && dev.mirror ? (s === 'L' ? 'R' : 'L') : s; }

  // Une extrémité est valide si l'appareil et le port existent et que le côté correspond au port.
  // Sinon (port supprimé, sens modifié…) le câble reste affiché en « bout libre » depuis l'autre extrémité.
  function endValid(e) {
    const p = portOf(devById(e.d), e.p);
    return !!p && !e.off && (p.pass || e.s === defaultSide(p));
  }
  function cableLoose(c) { return !endValid(c.a) || !endValid(c.b); }
  function endUsed(e, exceptId) {
    return project.cables.some((c) => c.id !== exceptId && ['a', 'b'].some((k) => c[k].d === e.d && c[k].p === e.p && c[k].s === e.s && endValid(c[k])));
  }

  // Embases de même genre (XLR5F → XLR5F) ou de tailles différentes : il faut un inverseur ou un adaptateur
  function adapterNeeded(conn1, conn2) {
    const m1 = /^XLR(\d)([FM])$/.exec(conn1), m2 = /^XLR(\d)([FM])$/.exec(conn2);
    if (!m1 || !m2) return null;
    if (m1[1] !== m2[1]) return { kind: 'adaptateur', label: 'Adaptateur XLR' + m1[1] + ' / XLR' + m2[1] };
    if (m1[2] === m2[2]) return { kind: 'inverseur', label: 'Inverseur XLR' + m1[1] + (m1[2] === 'F' ? ' mâle/mâle' : ' femelle/femelle') };
    return null;
  }
  // ---- Compatibilité des connecteurs ----
  // famille physique de chaque connecteur du logiciel ('*' = bornier / autre : on ne peut rien conclure)
  const CONN_FAM = {
    'RJ45': 'rj', 'etherCON': 'rj', 'SFP': 'sfp', 'SFP+': 'sfp', 'opticalCON': 'fibre', 'MA Link': 'malink',
    'XLR3F': 'xlr3', 'XLR3M': 'xlr3', 'XLR4F': 'xlr4', 'XLR5F': 'xlr5', 'XLR5M': 'xlr5',
    'Jack 6.35': 'jack', 'RCA': 'rca', 'D-SUB 25': 'dsub25',
    'speakON NL2': 'speakon', 'speakON NL4': 'speakon', 'speakON NL8': 'speakon',
    'BNC': 'bnc', 'HDMI': 'hdmi', 'DisplayPort': 'dp', 'DVI': 'dvi', 'D-SUB 15': 'vga',
    'USB-A': 'usb', 'USB-C': 'usb', 'MIDI DIN5': 'midi', 'D-SUB 9': 'dsub9',
    'powerCON': 'pcon', 'powerCON TRUE1': 'true1', 'IEC': 'iec', 'Schuko': 'schuko', 'PC16 (2P+T)': 'pc16', 'P17': 'p17', 'Socapex': 'soca', 'Harting 16': 'harting',
    'Bornier': '*', 'Autre': '*'
  };
  const FAM_DOM = {
    rj: 'réseau', sfp: 'réseau', fibre: 'réseau', malink: 'réseau',
    xlr3: 'audio', xlr4: 'audio', jack: 'audio', rca: 'audio', dsub25: 'audio', xlr5: 'DMX',
    speakon: 'haut-parleur', bnc: 'vidéo', hdmi: 'vidéo', dp: 'vidéo', dvi: 'vidéo', vga: 'vidéo',
    usb: 'contrôle', midi: 'contrôle', dsub9: 'contrôle',
    pcon: 'alimentation', true1: 'alimentation', iec: 'alimentation', schuko: 'alimentation', pc16: 'alimentation', p17: 'alimentation', soca: 'alimentation', harting: 'alimentation'
  };
  // paires de familles différentes : [type, libellé]   (clé = familles triées)
  const CONN_PAIR = {
    // audio
    'jack|xlr3': ['adaptateur', 'Câble XLR / jack'], 'rca|xlr3': ['adaptateur', 'Câble XLR / RCA'], 'jack|rca': ['adaptateur', 'Câble jack / RCA'],
    'dsub25|xlr3': ['adaptateur', 'Éclateur multipaire D-SUB 25 / XLR'], 'dsub25|jack': ['adaptateur', 'Éclateur multipaire D-SUB 25 / jack'],
    // vidéo
    'dvi|hdmi': ['adaptateur', 'Adaptateur HDMI / DVI'], 'dp|hdmi': ['adaptateur', 'Adaptateur DisplayPort / HDMI'], 'dp|dvi': ['adaptateur', 'Adaptateur DisplayPort / DVI'],
    'bnc|hdmi': ['convertisseur', 'Convertisseur SDI / HDMI'], 'bnc|dp': ['convertisseur', 'Convertisseur SDI / DisplayPort'], 'bnc|dvi': ['convertisseur', 'Convertisseur SDI / DVI'],
    'hdmi|vga': ['convertisseur', 'Convertisseur HDMI / VGA'], 'dp|vga': ['convertisseur', 'Convertisseur DisplayPort / VGA'], 'dvi|vga': ['adaptateur', 'Adaptateur DVI-I / VGA (DVI analogique uniquement)'], 'bnc|vga': ['convertisseur', 'Convertisseur SDI / VGA'],
    // réseau
    'rj|sfp': ['convertisseur', 'Module SFP RJ45 (cuivre)'], 'fibre|rj': ['convertisseur', 'Média-convertisseur fibre / RJ45'], 'fibre|sfp': ['adaptateur', 'Module SFP fibre + jarretière'],
    'malink|rj': ['adaptateur', 'Câble MA-Link / RJ45 (à vérifier selon l\'appareil)'],
    // contrôle
    'midi|usb': ['convertisseur', 'Interface MIDI / USB'], 'dsub9|usb': ['convertisseur', 'Adaptateur série RS-232 / USB'], 'dsub9|midi': ['impossible', ''],
    // passerelles courantes entre familles
    'rj|xlr5': ['adaptateur', 'Adaptateur DMX XLR5 / RJ45'], 'rj|xlr3': ['adaptateur', 'Adaptateur XLR3 / RJ45 (audio ou DMX sur câble réseau)'],
    'hdmi|rj': ['convertisseur', 'Extendeur HDMI sur câble réseau (HDBaseT / IP)'], 'dp|rj': ['convertisseur', 'Extendeur DisplayPort sur câble réseau'], 'dvi|rj': ['convertisseur', 'Extendeur DVI sur câble réseau'],
    'bnc|rj': ['convertisseur', 'Convertisseur SDI / IP (NDI, ST 2110…)'], 'rj|usb': ['convertisseur', 'Adaptateur USB / Ethernet'], 'midi|rj': ['convertisseur', 'Interface MIDI réseau (rtpMIDI)'],
    'usb|xlr5': ['convertisseur', 'Interface USB / DMX'], 'usb|xlr3': ['convertisseur', 'Interface audio USB'], 'jack|usb': ['convertisseur', 'Interface audio USB'], 'rca|usb': ['convertisseur', 'Interface audio USB'],
    'hdmi|xlr3': ['convertisseur', 'Désembeddeur audio HDMI'], 'hdmi|jack': ['convertisseur', 'Désembeddeur audio HDMI'], 'bnc|xlr3': ['convertisseur', 'Désembeddeur audio SDI'],
    'dp|usb': ['adaptateur', 'Adaptateur USB-C / DisplayPort (ou carte de capture)'], 'hdmi|usb': ['convertisseur', 'Adaptateur USB-C / HDMI (ou carte de capture)']
  };
  const COMPAT_WHY = {
    alimentation: 'Un connecteur d\'alimentation (secteur) ne se relie qu\'à une autre alimentation : jamais à un connecteur de signal.',
    'haut-parleur': 'Une sortie haut-parleur transporte de la puissance : elle ne se branche que sur un haut-parleur (ou une entrée haut-parleur), jamais sur une entrée signal.'
  };
  // null = compatible ; sinon { kind: 'impossible' | 'convertisseur' | 'adaptateur' | 'inverseur', label, why }
  function compatIssue(c1, c2) {
    const f1 = CONN_FAM[c1], f2 = CONN_FAM[c2];
    if (!f1 || !f2 || f1 === '*' || f2 === '*') return null;
    const x = adapterNeeded(c1, c2); if (x) return x;           // XLR : genre / nombre de broches
    if (f1 === f2) return f1 === 'usb' && c1 !== c2 ? { kind: 'adaptateur', label: 'Câble USB-A / USB-C' } : null;
    const d1 = FAM_DOM[f1], d2 = FAM_DOM[f2];
    if (d1 === 'alimentation' && d2 === 'alimentation') {
      const multi = ['soca', 'harting'].find((f) => f === f1 || f === f2);
      return { kind: 'adaptateur', label: multi ? 'Éclateur ' + (multi === 'soca' ? 'Socapex' : 'Harting 16') : 'Adaptateur ' + c1 + ' / ' + c2 };
    }
    const why = COMPAT_WHY[d1 === 'alimentation' || d2 === 'alimentation' ? 'alimentation' : (d1 === 'haut-parleur' || d2 === 'haut-parleur') ? 'haut-parleur' : ''];
    const pair = CONN_PAIR[[f1, f2].sort().join('|')];
    if (!why && pair && pair[0] !== 'impossible') return { kind: pair[0], label: pair[1] };
    if (!why && d1 === d2 && !pair) return { kind: 'adaptateur', label: 'Adaptateur ' + c1 + ' / ' + c2 };
    return { kind: 'impossible', label: c1 + ' ↔ ' + c2,
      why: why || 'Familles différentes (' + d1 + ' ↔ ' + d2 + ') : aucune liaison possible entre ces connecteurs, même avec un adaptateur.' };
  }
  function cableAdapterIssue(c) {
    if (cableLoose(c)) return null;
    const pa = portOf(devById(c.a.d), c.a.p), pb = portOf(devById(c.b.d), c.b.p);
    if (!pa || !pb) return null;
    const is = compatIssue(pa.conn, pb.conn);
    // liaisons fixes : seules les connexions impossibles sont signalées (les embases sont posées en complément)
    if (c.infra && is && is.kind !== 'impossible') return null;
    return is;
  }

  function connectPorts(a, b) {
    if (a.d === b.d && a.p === b.p && a.s === b.s) return;
    const pa = portOf(devById(a.d), a.p), pb = portOf(devById(b.d), b.p);
    if (!pa || !pb) return;
    // un point de connexion = un seul câble
    if (endUsed(a) || endUsed(b)) { flash('Ce port est déjà câblé.'); return; }
    // orienter source -> destination
    let src = a, dst = b;
    if (pa.dir === 'in' && pb.dir !== 'in') { src = b; dst = a; }
    const sp = portOf(devById(src.d), src.p);
    const cable = Object.assign({ id: uid(), a: src, b: dst, sig: sp.sig, sub: null, label: '', length: '' }, ui.carry || {});
    ui.carry = null;
    if (!cable.sub) {
      // propager le sous-réseau depuis un câble amont du même appareil (ex. univers d'un splitter)
      const upstream = project.cables.find((c) => c.b.d === src.d && c.sig === cable.sig && c.sub);
      if (upstream) cable.sub = upstream.sub;
    }
    const finish = () => { project.cables.push(cable); ui.selected = { type: 'cable', id: cable.id }; commit(); };
    const issue = compatIssue(pa.conn, pb.conn);
    if (!issue || (cable.infra && issue.kind !== 'impossible')) return finish();
    const da = devById(a.d), db = devById(b.d);
    const ends = `<p class="muted">${esc(da.name)} · ${esc(pa.name)} <b>(${esc(pa.conn)})</b><br>→ ${esc(db.name)} · ${esc(pb.name)} <b>(${esc(pb.conn)})</b></p>`;
    if (issue.kind === 'impossible') {
      // Connexion fausse : alerte rouge ; on peut quand même la tracer (elle reste signalée)
      openModal(`<h2 style="color:var(--danger)">⛔ Connexion impossible</h2>${ends}
        <p style="font-size:14px"><b>${esc(pa.conn)}</b> ne peut pas se relier à <b>${esc(pb.conn)}</b>.</p>
        <p>${esc(issue.why)}</p>
        <div class="modal-actions"><button id="adForce" class="danger">Câbler quand même</button><button class="primary" id="adCancel">Annuler</button></div>`);
      $('#adCancel').onclick = () => { closeModal(); renderCanvas(); };
      $('#adForce').onclick = () => { closeModal(); finish(); flash('Connexion impossible tracée : elle reste signalée en rouge.'); };
      return;
    }
    // Alerte + question : l'inverseur / adaptateur / convertisseur est-il en place ?
    const what = issue.kind === 'inverseur'
      ? `Les deux embases sont ${pa.conn.endsWith('F') ? 'femelles' : 'mâles'} : un câble standard ne peut pas les relier.`
      : /^XLR/.test(pa.conn) && /^XLR/.test(pb.conn) ? 'Les deux connecteurs n\'ont pas le même nombre de broches.'
      : issue.kind === 'convertisseur' ? 'Ces connecteurs ne transportent pas le signal de la même façon : il faut un appareil de conversion.'
      : 'Ces connecteurs ne s\'emboîtent pas directement : il faut un adaptateur ou un câble hybride.';
    openModal(`<h2>⚠︎ ${esc(pa.conn)} → ${esc(pb.conn)}</h2>${ends}
      <p style="font-size:14px">${what}</p>
      <p style="font-size:14px"><b>${issue.kind === 'convertisseur' ? 'Un' : 'Un'} ${esc(issue.label.charAt(0).toLowerCase() + issue.label.slice(1))} est-il en place ?</b></p>
      <div class="modal-actions"><button id="adCancel">Annuler le câble</button><button id="adNo">Non, câbler quand même</button><button class="primary" id="adYes">Oui, ${esc(issue.kind)} en place</button></div>`);
    $('#adCancel').onclick = () => { closeModal(); renderCanvas(); };
    $('#adNo').onclick = () => { closeModal(); cable.adapter = ''; finish(); flash('Câble créé sans ' + issue.kind + ' : il reste signalé en orange.'); };
    $('#adYes').onclick = () => { closeModal(); cable.adapter = issue.label; finish(); };
  }

  function assignParent(dev) {
    if (isRack(dev) || (dev.lock && devById(dev.parent))) return;
    const lay = layout(dev);
    const cx = dev.x + lay.w / 2, cy = dev.y + lay.h / 2;
    const rack = project.devices.find((r) => isRack(r) && cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h);
    dev.parent = rack ? rack.id : null;
    if (rack && rack.room) dev.room = rack.room;
  }

  // ---------------------------------------------------------------- géométrie
  const HEAD = 32, ROW = 17;

  function connectedSet() {
    const set = new Set();
    project.cables.forEach((c) => { ['a', 'b'].forEach((k) => { if (endValid(c[k])) set.add(c[k].d + ':' + c[k].p); }); });
    return set;
  }
  let _conn = new Set();
  let _dmxBad = new Map();
  let _portCable = new Map();
  // Vue simplifiée : seuls les ports câblés avec un câble volant sont affichés.
  // Une liaison fixe n'apparaît que si ses deux bouts sont câblés en volant (le signal la traverse vraiment).
  function simpleVisibleSet() {
    const key = (e) => e.d + ':' + e.p;
    const vis = new Set();
    project.cables.forEach((c) => { if (!c.infra) ['a', 'b'].forEach((k) => { if (endValid(c[k])) vis.add(key(c[k])); }); });
    // bout « actif » d'une liaison fixe : câblé en volant, ou posé sur un vrai appareil (pas un boîtier / panneau de brassage)
    const live = (e) => { const d = devById(e.d); return vis.has(key(e)) || (d && d.cat !== 'patch'); };
    const shown = new Set(vis);
    project.cables.forEach((c) => {
      if (c.infra && endValid(c.a) && endValid(c.b) && live(c.a) && live(c.b)) { shown.add(key(c.a)); shown.add(key(c.b)); }
    });
    return shown;
  }
  let _simple = new Set();

  function portVisible(dev, p) {
    if (ui.filters[p.sig] === false) return false;
    if (ui.mode === 'simple' && !_simple.has(dev.id + ':' + p.id)) return false;
    return true;
  }

  // ---- Lisibilité (vue simplifiée) : ports rangés selon la direction de leurs câbles, tracés droits, câbles parallèles regroupés
  const tidyOn = () => ui.mode === 'simple' && ui.tidy;
  // hauteur moyenne (monde) des extrémités opposées des câbles d'un port : sert à ranger les ports pour éviter les croisements
  function peerY(dev, p) {
    const ys = [];
    ['L', 'R'].forEach((side) => {
      const c = _portCable.get(dev.id + ':' + p.id + ':' + side); if (!c) return;
      const o = c.a.d === dev.id && c.a.p === p.id ? c.b : c.a;
      const od = devById(o.d); if (!od) return;
      const i = Math.max(0, od.ports.findIndex((q) => q.id === o.p));
      ys.push(od.y + HEAD + 6 + Math.min(i, 30) * ROW / 3);
    });
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Infinity;
  }
  function tidySort(dev, list) {
    if (!tidyOn()) return list;
    return list.map((p, i) => ({ p, i, y: peerY(dev, p) })).sort((a, b) => (a.y - b.y) || (a.i - b.i)).map((x) => x.p);
  }
  // appareil à l'autre bout de la liaison fixe de chaque port (portId -> deviceId)
  function infraPeers(dev) {
    const m = new Map();
    project.cables.forEach((c) => {
      if (!c.infra) return;
      if (c.a.d === dev.id && c.b.d !== dev.id) m.set(c.a.p, c.b.d);
      else if (c.b.d === dev.id && c.a.d !== dev.id) m.set(c.b.p, c.a.d);
    });
    return m;
  }
  function layout(dev) {
    if (isRack(dev)) return { w: dev.w, h: dev.h, rows: [], pos: {} };
    const w = ui.mode === 'simple' ? 180 : 240;
    const vis = dev.ports.filter((p) => portVisible(dev, p));
    const pass = tidySort(dev, vis.filter((p) => p.pass));
    // colonnes à l'écran (tient compte du miroir) ; r.left / r.right = colonne visuelle
    const onScreenLeft = (p) => visSide(dev, defaultSide(p)) === 'L';
    const left = tidySort(dev, vis.filter((p) => !p.pass && onScreenLeft(p)));
    const right = tidySort(dev, vis.filter((p) => !p.pass && !onScreenLeft(p)));
    const rows = [];
    // Répartiteur / panneau qui reçoit des liaisons fixes de plusieurs boîtiers : un bloc par boîtier, avec son titre
    const peers = dev.cat === 'patch' ? infraPeers(dev) : null;
    // (on regroupe sur tous les ports traversants ; en vue simplifiée, le titre d'un bloc reste affiché même sans port câblé :
    //  la liaison fixe y aboutit)
    const allPass = dev.ports.filter((p) => p.pass && ui.filters[p.sig] !== false);
    const visSet = new Set(pass.map((p) => p.id));
    const groupsOn = peers && new Set(allPass.map((p) => peers.get(p.id)).filter(Boolean)).size >= 2;
    if (groupsOn) {
      const order = [], by = new Map();
      allPass.forEach((p) => { const k = peers.get(p.id) || ''; if (!by.has(k)) { by.set(k, []); order.push(k); } by.get(k).push(p); });
      order.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : 0));   // ports sans liaison fixe d'abord
      order.forEach((k) => {
        const peer = k && devById(k);
        const shown = tidySort(dev, by.get(k).filter((p) => visSet.has(p.id)));
        if (peer && (shown.length || ui.mode === 'simple')) rows.push({ header: peer.name, peer: k });
        shown.forEach((p) => rows.push({ pass: p, short: peer && p.name.startsWith(peer.name + ' – ') ? p.name.slice(peer.name.length + 3) : null }));
      });
    } else pass.forEach((p) => rows.push({ pass: p }));
    for (let i = 0; i < Math.max(left.length, right.length); i++) rows.push({ left: left[i], right: right[i] });
    const pos = {};
    const X = (s) => (visSide(dev, s) === 'L' ? 0 : w);
    rows.forEach((r, i) => {
      const y = HEAD + 6 + i * ROW + ROW / 2;
      if (r.header) { pos['grp:' + r.peer + ':L'] = { x: X('L'), y }; pos['grp:' + r.peer + ':R'] = { x: X('R'), y }; }
      if (r.pass) { pos[r.pass.id + ':L'] = { x: X('L'), y }; pos[r.pass.id + ':R'] = { x: X('R'), y }; }
      if (r.left) pos[r.left.id + ':' + defaultSide(r.left)] = { x: 0, y };
      if (r.right) pos[r.right.id + ':' + defaultSide(r.right)] = { x: w, y };
    });
    const h = HEAD + 6 + rows.length * ROW + (rows.length ? 6 : 2);
    return { w, h, rows, pos };
  }

  // ---------------------------------------------------------------- rendu SVG
  const svg = $('#canvas'), world = $('#world');
  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, cls, anchor) {
    const t = el('text', { x, y, class: cls, 'text-anchor': anchor || 'start', 'dominant-baseline': 'middle' }, parent);
    t.textContent = str;
    return t;
  }
  function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function applyView() { world.setAttribute('transform', `translate(${ui.view.x},${ui.view.y}) scale(${ui.view.k})`); }

  function renderCanvas() {
    _conn = connectedSet();
    _dmxBad = dmxConflicts();
    _portCable = new Map();
    project.cables.forEach((c) => ['a', 'b'].forEach((k) => { if (endValid(c[k])) _portCable.set(c[k].d + ':' + c[k].p + ':' + c[k].s, c); }));
    _simple = simpleVisibleSet();
    const lr = $('#layer-rooms'), lk = $('#layer-racks'), lc = $('#layer-cables'), ld = $('#layer-devices');
    [lr, lk, lc, ld].forEach((g) => { g.innerHTML = ''; });
    const layouts = {};
    project.devices.forEach((d) => { layouts[d.id] = layout(d); });
    // une baie s'agrandit pour contenir ses appareils
    project.devices.filter(isRack).forEach((r) => {
      project.devices.filter((k) => k.parent === r.id).forEach((k) => {
        const l = layouts[k.id];
        r.w = Math.max(r.w, k.x - r.x + l.w + 20); r.h = Math.max(r.h, k.y - r.y + l.h + 20);
      });
      layouts[r.id] = layout(r);
    });

    buildObstacles(layouts);

    // Cadres de zones (la barre de titre sert de poignée pour déplacer toute la zone)
    if (ui.showRooms) {
      project.rooms.forEach((room) => {
        const ds = project.devices.filter((d) => d.room === room.id);
        if (!ds.length) return;
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        ds.forEach((d) => { const l = layouts[d.id]; x1 = Math.min(x1, d.x); y1 = Math.min(y1, d.y); x2 = Math.max(x2, d.x + l.w); y2 = Math.max(y2, d.y + l.h); });
        const P = 28, fx = x1 - P, fy = y1 - P - 18, fw = x2 - x1 + 2 * P;
        el('rect', { x: fx, y: fy, width: fw, height: y2 - y1 + 2 * P + 18, rx: 14, class: 'room-frame', fill: room.color, 'fill-opacity': 0.06, stroke: room.color }, lr);
        const head = el('g', { class: 'room-head', 'data-room': room.id }, lr);
        el('path', { d: `M${fx},${fy + 14} a14 14 0 0 1 14 -14 h${fw - 28} a14 14 0 0 1 14 14 v12 h-${fw} z`, fill: room.color, 'fill-opacity': 0.16 }, head);
        text(head, fx + 12, fy + 14, '⠿ ' + room.name, 'room-label').setAttribute('fill', room.color);
        el('title', {}, head).textContent = 'Glisser pour déplacer toute la zone « ' + room.name + ' »';
      });
    }

    // Baies
    project.devices.filter(isRack).forEach((r) => {
      const g = el('g', { class: 'rack' + (sel('device', r.id) ? ' selected' : ''), 'data-dev': r.id, transform: `translate(${r.x},${r.y})` }, lk);
      el('rect', { width: r.w, height: r.h, rx: 6, class: 'rack-body' }, g);
      el('rect', { width: r.w, height: 26, rx: 6, class: 'rack-head' }, g);
      text(g, 10, 13, trunc(r.name, 40), 'dev-title');
      el('rect', { x: r.w - 12, y: r.h - 12, width: 12, height: 12, class: 'rack-resize', 'data-resize': r.id }, g);
    });

    // Appareils
    project.devices.filter((d) => !isRack(d)).forEach((d) => {
      const lay = layouts[d.id];
      const g = el('g', { class: 'dev' + (sel('device', d.id) ? ' selected' : ''), 'data-dev': d.id, transform: `translate(${d.x},${d.y})` }, ld);
      el('rect', { width: lay.w, height: lay.h, rx: 6, class: 'dev-body' }, g);
      el('path', { d: `M0 6 a6 6 0 0 1 6 -6 h${lay.w - 12} a6 6 0 0 1 6 6 v${HEAD - 6} h-${lay.w} z`, class: 'dev-head' }, g);
      const room = roomById(d.room);
      if (room) el('rect', { x: 0, y: HEAD - 3, width: lay.w, height: 3, fill: room.color }, g);
      text(g, 8, 11, trunc(d.name, (ui.mode === 'simple' ? 24 : 32) - (d.ip ? 14 : 0)), 'dev-title');
      if (d.ip) {
        const ipT = text(g, lay.w - 8, 11, d.ip + ' ↗', 'dev-ip', 'end');
        ipT.dataset.url = configUrl(d);
        el('title', {}, ipT).textContent = 'Ouvrir la page de configuration : ' + configUrl(d);
      }
      const patch = hasPatch(d) ? dmxLabel(d) : '';
      text(g, 8, 24, trunc(d.maker + ' · ' + d.model, patch ? 18 : 40), 'dev-sub');
      if (patch) {
        const bad = _dmxBad.get(d.id);
        const pt = text(g, lay.w - 8, 24, (bad ? '⚠ ' : '') + 'DMX ' + trunc(patch, 26), 'dev-dmx' + (bad ? ' bad' : ''), 'end');
        el('title', {}, pt).textContent = 'Patch DMX : ' + patch + (dmxOf(d).auto ? ' (univers déduit du câble)' : '') + (bad ? '\n⚠ ' + bad : '');
      }
      const detail = ui.mode === 'detail';
      const nameLen = detail ? 14 : 22;
      lay.rows.forEach((r, i) => {
        const y = HEAD + 6 + i * ROW + ROW / 2;
        if (r.header) {
          // titre du bloc : boîtier d'où arrivent ces liaisons
          el('rect', { x: 1, y: y - ROW / 2 + 1, width: lay.w - 2, height: ROW - 2, class: 'port-group-bg' }, g);
          text(g, lay.w / 2, y, '↘ ' + trunc(r.header, 34), 'port-group', 'middle');
          return;
        }
        if (r.pass) {
          const lbl = text(g, lay.w / 2, y, trunc(r.short || r.pass.name, detail ? 28 : 24), 'port-label', 'middle');
          if (detail) { const ts = el('tspan', { class: 'port-conn' }, lbl); ts.textContent = '  ' + r.pass.conn; }
          dot(g, d, r.pass, 'L', lay.pos[r.pass.id + ':L'].x, y); dot(g, d, r.pass, 'R', lay.pos[r.pass.id + ':R'].x, y);
        }
        if (r.left) {
          const t = text(g, 10, y, trunc(r.left.name, nameLen), 'port-label');
          if (detail) { const ts = el('tspan', { class: 'port-conn' }, t); ts.textContent = ' ' + r.left.conn; }
          dot(g, d, r.left, defaultSide(r.left), 0, y);
        }
        if (r.right) {
          const t = text(g, lay.w - 10, y, '', 'port-label', 'end');
          if (detail) { const ts = el('tspan', { class: 'port-conn' }, t); ts.textContent = r.right.conn + ' '; }
          const tn = el('tspan', {}, t); tn.textContent = trunc(r.right.name, nameLen);
          dot(g, d, r.right, defaultSide(r.right), lay.w, y);
        }
      });
    });

    // Câbles : normaux, en bout libre (débranchés) ou regroupés en faisceau (liaisons fixes / groupes manuels)
    const groups = {};
    project.cables.forEach((c) => {
      if (ui.filters[c.sig] === false) return;
      const va = endValid(c.a), vb = endValid(c.b);
      if (!va || !vb) { if (va || vb) drawStub(lc, c, va ? c.a : c.b, layouts); return; }
      let A = endpoint(c.a, layouts), B = endpoint(c.b, layouts);
      // vue simplifiée : une liaison fixe reste tracée même si ses ports sont masqués ;
      // elle aboutit au titre du bloc (baie) ou au bord de l'appareil
      if (c.infra && ui.mode === 'simple') { A = A || anchorPoint(c.a, c.b.d, layouts); B = B || anchorPoint(c.b, c.a.d, layouts); }
      if (!A || !B) return;
      const key = ui.bundle ? groupKeyOf(c) : null;
      if (key) { (groups[key] = groups[key] || []).push({ c, A, B }); return; }
      drawCable(lc, c, A, B);
    });
    Object.keys(groups).forEach((key) => {
      if (groups[key].length < 2) groups[key].forEach(({ c, A, B }) => drawCable(lc, c, A, B));
      else drawBundle(lc, key, groups[key]);
    });
    applyView();
  }

  // Clé de faisceau : groupe manuel, ou liaisons fixes entre les deux mêmes appareils
  function groupKeyOf(c) {
    if (cableLoose(c)) return null;
    if (c.group) return 'g:' + c.group;
    if (c.infra && !c.ungrouped) return 'p:' + [c.a.d, c.b.d].sort().join('|');
    if (tidyOn() && !c.ungrouped && c.a.d !== c.b.d) return 'v:' + [c.a.d, c.b.d].sort().join('|');
    return null;
  }
  function groupInfo(key) {
    project.groups = project.groups || {};
    return project.groups[key] || (project.groups[key] = {});
  }
  function inSel(c) { return sel('cable', c.id) || ui.multi.has(c.id); }
  const mid = (A, B) => ({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });

  // ---------------------------------------------------------------- contournement des appareils
  // Les câbles évitent de passer sous les appareils. Si aucun passage n'existe
  // (appareils collés), le câble garde sa courbe normale et passe dessous.
  let _obst = [];
  const OB_M = 10;   // marge autour d'un appareil
  const OB_G = 18;   // longueur de sortie horizontale d'un port
  function buildObstacles(layouts) {
    _obst = project.devices.filter((d) => !isRack(d)).map((d) => ({ id: d.id, x1: d.x, y1: d.y, x2: d.x + layouts[d.id].w, y2: d.y + layouts[d.id].h }));
    _segs = new Map();
    _occ = new Map();
  }
  // Grille d'occupation : chaque câble déjà dessiné marque les cases (OCC px) qu'il traverse.
  // Une courbe qui recouvre trop un câble existant est re-tracée en contournant ; l'A* évite les cases occupées.
  let _occ = new Map();
  const OCC = 8;
  const occKey = (x, y) => Math.floor(x / OCC) * 100003 + Math.floor(y / OCC);
  function markPath(samples) {
    const seen = new Set();
    samples.forEach((q) => { const k = occKey(q.x, q.y); if (seen.has(k)) return; seen.add(k); _occ.set(k, (_occ.get(k) || 0) + 1); });
  }
  // nombre de cases déjà occupées traversées (hors abords des extrémités, où les câbles d'un même appareil se rejoignent)
  function occHits(samples, A, B) {
    const seen = new Set(); let n = 0;
    samples.forEach((q) => {
      if (Math.hypot(q.x - A.x, q.y - A.y) < 26 || Math.hypot(q.x - B.x, q.y - B.y) < 26) return;
      const k = occKey(q.x, q.y); if (seen.has(k)) return; seen.add(k);
      if (_occ.get(k)) n++;
    });
    return { n, total: seen.size };
  }
  function bezierSamples(A, c1, c2, B) {
    const len = Math.hypot(B.x - A.x, B.y - A.y) + Math.abs(c1.x - A.x) + Math.abs(c2.x - B.x);
    const N = Math.max(16, Math.ceil(len / 4)), out = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      out.push({ x: u * u * u * A.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * B.x, y: u * u * u * A.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * B.y });
    }
    return out;
  }
  function polySamples(pts) {
    const out = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / 4));
      for (let i = 0; i < n; i++) out.push({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n });
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // coût d'occupation d'un segment de grille (cases occupées le long du segment)
  function edgeOcc(x1, y1, x2, y2) {
    if (!_occ.size) return 0;
    const L = Math.abs(x2 - x1) + Math.abs(y2 - y1), n = Math.max(1, Math.round(L / OCC));
    let c = 0;
    for (let i = 0; i <= n; i++) { const v = _occ.get(occKey(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n)); if (v) c += v; }
    return c;
  }
  // Couloirs déjà empruntés par les tracés contournants : 'h:y' / 'v:x' -> [[début, fin], …]
  // Les tracés suivants évitent de s'y superposer (pénalité) et, s'ils doivent les partager, sont décalés en parallèle.
  let _segs = new Map();
  const LANE = 8;
  function segKey(a, b) { return a.y === b.y ? 'h:' + Math.round(a.y) : a.x === b.x ? 'v:' + Math.round(a.x) : null; }
  function segRange(a, b) { return a.y === b.y ? [Math.min(a.x, b.x), Math.max(a.x, b.x)] : [Math.min(a.y, b.y), Math.max(a.y, b.y)]; }
  function laneUse(a, b) {
    const k = segKey(a, b); if (!k) return 0;
    const [r1, r2] = segRange(a, b);
    return (_segs.get(k) || []).filter(([u1, u2]) => Math.min(r2, u2) - Math.max(r1, u1) > 2).length;
  }
  function addSeg(a, b) {
    const k = segKey(a, b); if (!k) return;
    if (!_segs.has(k)) _segs.set(k, []);
    _segs.get(k).push(segRange(a, b));
  }
  // Décale en parallèle les segments intérieurs qui recouvrent un câble existant :
  // on essaie des voies de plus en plus éloignées (±8, ±16, ±24 px) et on prend la première libre hors appareil.
  function spreadLanes(pts) {
    const offs = [0, LANE, -LANE, 2 * LANE, -2 * LANE, 3 * LANE, -3 * LANE];
    const busy = (a, b) => {
      const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / 4));
      let c = 0;
      for (let i = 1; i < n; i++) {
        const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
        if (_obst.some((o) => inside(o, x, y, 2))) return Infinity;
        if (_occ.get(occKey(x, y))) c++;
      }
      return c + laneUse(a, b) * 5;
    };
    for (let k = 1; k < pts.length - 2; k++) {
      const a = pts[k], b = pts[k + 1];
      const h = a.y === b.y, v = a.x === b.x;
      if (!h && !v) continue;
      let best = 0, bestC = Infinity;
      for (const off of offs) {
        const a2 = h ? { x: a.x, y: a.y + off } : { x: a.x + off, y: a.y };
        const b2 = h ? { x: b.x, y: b.y + off } : { x: b.x + off, y: b.y };
        const c = busy(a2, b2) + Math.abs(off) * 0.05;
        if (c < bestC) { bestC = c; best = off; }
        if (c < 0.5) break;
      }
      if (best) { if (h) { a.y += best; b.y += best; } else { a.x += best; b.x += best; } }
    }
    for (let k = 0; k < pts.length - 1; k++) addSeg(pts[k], pts[k + 1]);
    return pts;
  }
  const inside = (o, x, y, m) => x > o.x1 - m && x < o.x2 + m && y > o.y1 - m && y < o.y2 + m;

  function bezierHits(A, c1, c2, B, obs) {
    for (let i = 1; i < 40; i++) {
      const t = i / 40, u = 1 - t;
      const x = u * u * u * A.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * B.x;
      const y = u * u * u * A.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * B.y;
      if (Math.hypot(x - A.x, y - A.y) < 14 || Math.hypot(x - B.x, y - B.y) < 14) continue;
      if (obs.some((o) => inside(o, x, y, 4))) return true;
    }
    return false;
  }

  // Tracé d'un câble de A à B (A.s / B.s = côté de sortie). Renvoie { d, mid }.
  function routed(A, B, sa, sb) {
    const dx = Math.max(40, Math.abs(B.x - A.x) / 2);
    const c1 = { x: A.x + (sa === 'L' ? -dx : dx), y: A.y }, c2 = { x: B.x + (sb === 'L' ? -dx : dx), y: B.y };
    const plain = { d: `M${A.x},${A.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${B.x},${B.y}`, mid: mid(A, B) };
    if (tidyOn()) {
      const pts = orthoRoute(A, B, sa, sb);
      if (pts) { spreadLanes(pts); markPath(polySamples(pts)); return { d: roundedPath(pts), mid: polyMid(pts) }; }
    }
    if (!ui.avoid) return plain;
    const bz = bezierSamples(A, c1, c2, B);
    const hit = occHits(bz, A, B);
    const crowded = hit.n > Math.max(3, hit.total * 0.12);
    if (!crowded && !bezierHits(A, c1, c2, B, _obst)) { markPath(bz); return plain; }
    const pts = orthoRoute(A, B, sa, sb);
    if (!pts) { markPath(bz); return plain; }
    spreadLanes(pts);
    // si le contournement recouvre encore plus que la courbe (et que la courbe ne traverse aucun appareil), on garde la courbe
    const ps = polySamples(pts);
    if (crowded && !bezierHits(A, c1, c2, B, _obst) && occHits(ps, A, B).n >= hit.n) { markPath(bz); return plain; }
    markPath(ps);
    return { d: roundedPath(pts), mid: polyMid(pts) };
  }

  function orthoRoute(A, B, sa, sb) {
    const S = sa ? { x: A.x + (sa === 'L' ? -OB_G : OB_G), y: A.y } : { x: A.x, y: A.y };
    const E = sb ? { x: B.x + (sb === 'L' ? -OB_G : OB_G), y: B.y } : { x: B.x, y: B.y };
    const pad = 400;
    const bx1 = Math.min(S.x, E.x) - pad, bx2 = Math.max(S.x, E.x) + pad, by1 = Math.min(S.y, E.y) - pad, by2 = Math.max(S.y, E.y) + pad;
    // appareils collés : l'obstacle qui recouvre la sortie d'un port est ignoré (le câble passera dessous)
    const obs = _obst.filter((o) => o.x2 > bx1 && o.x1 < bx2 && o.y2 > by1 && o.y1 < by2 && !inside(o, S.x, S.y, OB_M) && !inside(o, E.x, E.y, OB_M))
      .map((o) => ({ x1: o.x1 - OB_M, y1: o.y1 - OB_M, x2: o.x2 + OB_M, y2: o.y2 + OB_M }));
    const R2 = (v) => Math.round(v * 2) / 2;   // demi-pixel : les ports tombent souvent sur x,5
    const uniq = (a) => [...new Set(a.map(R2))].sort((p, q) => p - q);
    // lignes de la grille : bords des obstacles + milieux des espaces libres + couloirs décalés (pour ne pas tous passer au même endroit)
    const withMids = (v) => { const o = v.slice(); for (let k = 0; k < v.length - 1; k++) { const gap = v[k + 1] - v[k]; if (gap > 24) { o.push((v[k] + v[k + 1]) / 2); if (gap > 60) o.push(v[k] + 14, v[k + 1] - 14); } } return uniq(o); };
    const xs = withMids(uniq([S.x, E.x, ...obs.flatMap((o) => [o.x1, o.x2])]));
    const ys = withMids(uniq([S.y, E.y, ...obs.flatMap((o) => [o.y1, o.y2])]));
    const W = xs.length, H = ys.length;
    const blocked = (x, y) => obs.some((o) => x > o.x1 && x < o.x2 && y > o.y1 && y < o.y2);
    const free = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) free[j * W + i] = blocked(xs[i], ys[j]) ? 0 : 1;
    const si = xs.indexOf(R2(S.x)), sj = ys.indexOf(R2(S.y));
    const ei = xs.indexOf(R2(E.x)), ej = ys.indexOf(R2(E.y));
    if (!free[sj * W + si] || !free[ej * W + ei]) return null;
    // A* sur la grille, état = (nœud, direction) ; pénalité à chaque coude
    const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const BEND = 40, OVERLAP = 60, OCC_COST = 14;
    const N = W * H * 4;
    const g = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
    const occCache = new Float32Array(N).fill(-1);
    const heap = [];
    const push = (f, s) => { heap.push([f, s]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const hEst = (i, j) => Math.abs(xs[i] - xs[ei]) + Math.abs(ys[j] - ys[ej]);
    const d0 = sa === 'L' ? 1 : 0;              // on sort du port horizontalement, vers l'extérieur
    const dEnd = sb === 'L' ? 0 : 1;            // on arrive sur le port en venant de l'extérieur
    // départ libre (point de passage) : toutes les directions sont permises sans coude
    (sa ? [d0] : [0, 1, 2, 3]).forEach((dd) => { const s0 = (sj * W + si) * 4 + dd; g[s0] = 0; push(hEst(si, sj), s0); });
    let goal = -1, iter = 0;
    while (heap.length && iter++ < 120000) {
      const [, s] = pop();
      const dir = s & 3, n = s >> 2, i = n % W, j = (n / W) | 0;
      if (i === ei && j === ej) { goal = s; break; }
      for (let nd = 0; nd < 4; nd++) {
        if ((nd ^ 1) === dir && nd >> 1 === dir >> 1) continue; // pas de demi-tour
        const ni = i + DIRS4[nd][0], nj = j + DIRS4[nd][1];
        if (ni < 0 || nj < 0 || ni >= W || nj >= H || !free[nj * W + ni]) continue;
        if (blocked((xs[i] + xs[ni]) / 2, (ys[j] + ys[nj]) / 2)) continue;
        let cost = g[s] + Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]) + (nd !== dir ? BEND : 0);
        const used = _segs.size ? laneUse({ x: xs[i], y: ys[j] }, { x: xs[ni], y: ys[nj] }) : 0;
        if (used) cost += OVERLAP * used + (Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j])) * 0.5 * used;
        const ek = n * 4 + nd;
        let oc = occCache[ek]; if (oc < 0) { oc = edgeOcc(xs[i], ys[j], xs[ni], ys[nj]); occCache[ek] = oc; }
        cost += OCC_COST * oc;
        if (sb && ni === ei && nj === ej && nd !== dEnd) cost += BEND;
        const t = (nj * W + ni) * 4 + nd;
        if (cost < g[t]) { g[t] = cost; prev[t] = s; push(cost + hEst(ni, nj), t); }
      }
    }
    if (goal < 0) return null;
    const pts = [];
    for (let s = goal; s >= 0; s = prev[s]) { const n = s >> 2; pts.unshift({ x: xs[n % W], y: ys[(n / W) | 0] }); }
    pts.unshift({ x: A.x, y: A.y }); pts.push({ x: B.x, y: B.y });
    return cleanPts(pts);
  }
  // retire les doublons et les points alignés
  function cleanPts(raw) {
    const pts = raw.filter((p, k) => k === 0 || Math.hypot(p.x - raw[k - 1].x, p.y - raw[k - 1].y) > 0.5);
    return pts.filter((p, k) => {
      if (k === 0 || k === pts.length - 1) return true;
      const a = pts[k - 1], b = pts[k + 1];
      return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
    });
  }

  function roundedPath(pts) {
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let k = 1; k < pts.length - 1; k++) {
      const a = pts[k - 1], p = pts[k], b = pts[k + 1];
      const r = Math.min(14, Math.hypot(p.x - a.x, p.y - a.y) / 2, Math.hypot(b.x - p.x, b.y - p.y) / 2);
      const u = (q) => { const l = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: p.x + (q.x - p.x) / l * r, y: p.y + (q.y - p.y) / l * r }; };
      const p1 = u(a), p2 = u(b);
      d += ` L${p1.x},${p1.y} Q${p.x},${p.y} ${p2.x},${p2.y}`;
    }
    const z = pts[pts.length - 1];
    return d + ` L${z.x},${z.y}`;
  }

  function polyMid(pts) {
    let tot = 0; for (let k = 1; k < pts.length; k++) tot += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    let half = tot / 2;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k], l = Math.hypot(b.x - a.x, b.y - a.y);
      if (half <= l) return { x: a.x + (b.x - a.x) * half / l, y: a.y + (b.y - a.y) * half / l };
      half -= l;
    }
    return pts[0];
  }

  function drawCable(lc, c, A, B) {
    const R = c.via ? viaRouted(A, c.via, B, A.s, B.s) : routed(A, B, A.s, B.s);
    const d = R.d;
    const pa = portOf(devById(c.a.d), c.a.p), pb = portOf(devById(c.b.d), c.b.p);
    const mismatch = pa.sig !== pb.sig;
    const issue = cableAdapterIssue(c);
    const bad = issue && issue.kind === 'impossible';
    const warn = issue && !bad && !c.adapter;
    const g = el('g', { 'data-cable': c.id }, lc);
    el('path', { d, class: 'cable-hit' }, g);
    el('path', { d, class: 'cable' + (inSel(c) ? ' selected' : '') + (mismatch || bad ? ' mismatch' : '') + (bad ? ' impossible' : '') + (c.infra ? ' infra' : '') + (warn ? ' warn' : ''), stroke: mismatch || bad ? '#E45B65' : cableColor(c) }, g);
    const n = subnetOf(c);
    const M = R.mid;
    const label = bad ? '⛔ Incompatible : ' + issue.label
      : [warn ? '⚠︎ ' + issue.label + ' ?' : '', c.adapter ? '⇄ ' + c.adapter : '', cableLabel(c), n && n.name].filter(Boolean).join(' · ');
    if (label && (ui.mode === 'detail' || warn || bad)) {
      const t = text(g, M.x, M.y - 8, trunc(label, 52), 'cable-label', 'middle');
      t.setAttribute('fill', bad ? '#E45B65' : warn ? '#e65100' : cableColor(c));
    }
    if (sel('cable', c.id)) routeHandle(g, 'c:' + c.id, M);
  }

  // Câble dont une extrémité n'est plus valide : il reste « sorti » de l'appareil, avec un × pour le supprimer
  function drawStub(lc, c, e, layouts) {
    const A = endpoint(e, layouts); if (!A) return;
    const dir = A.s === 'L' ? -1 : 1;
    const E = { x: A.x + dir * 60, y: A.y + 16 };
    const d = `M${A.x},${A.y} C${A.x + dir * 30},${A.y} ${E.x - dir * 12},${E.y} ${E.x},${E.y}`;
    const g = el('g', { 'data-cable': c.id }, lc);
    el('path', { d, class: 'cable-hit' }, g);
    el('path', { d, class: 'cable loose' + (inSel(c) ? ' selected' : ''), stroke: cableColor(c) }, g);
    const x = el('g', { class: 'stub-del', 'data-delcable': c.id, transform: `translate(${E.x},${E.y})` }, g);
    el('circle', { r: 7.5 }, x);
    text(x, 0, 0.5, '×', 'stub-x', 'middle');
    el('title', {}, x).textContent = 'Câble débranché — cliquer pour le supprimer';
  }

  // Faisceau : chaque port rejoint le tronc en éventail ; le tronc se déplace avec sa poignée
  function drawBundle(lc, key, items) {
    const ref = items[0];
    const near = (P, Q) => Math.hypot(P.x - Q.x, P.y - Q.y);
    const s1 = [], s2 = [];
    items.forEach(({ c, A, B }) => {
      const aFirst = c.a.d === ref.c.a.d || (c.b.d !== ref.c.a.d && near(A, ref.A) <= near(B, ref.A));
      if (aFirst) { s1.push({ x: A.x, y: A.y, s: A.s, c }); s2.push({ x: B.x, y: B.y, s: B.s, c }); }
      else { s1.push({ x: B.x, y: B.y, s: B.s, c }); s2.push({ x: A.x, y: A.y, s: A.s, c }); }
    });
    const dir = (s) => (s === 'L' ? -1 : 1);
    const trunkEnd = (pts) => {
      const dd = dir(pts[0].s);
      const xs = pts.map((p) => p.x);
      return { x: (dd < 0 ? Math.min(...xs) : Math.max(...xs)) + dd * 45, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
    };
    const P1 = trunkEnd(s1), P2 = trunkEnd(s2);
    const info = groupInfo(key);
    const TR = info.via ? viaRouted(P1, info.via, P2, s1[0].s, s2[0].s, true) : routed(P1, P2, s1[0].s, s2[0].s);
    const trunk = TR.d;
    const sigs = [...new Set(items.map((i) => i.c.sig))];
    const color = sigs.length === 1 ? sigById(sigs[0]).color : '#7a8699';
    const selected = sel('bundle', key) || items.every((i) => ui.multi.has(i.c.id));
    const g = el('g', { 'data-bundle': key }, lc);
    [[s1, P1], [s2, P2]].forEach(([pts, P]) => pts.forEach((p) => {
      const dd = dir(p.s);
      el('path', { d: `M${p.x},${p.y} C${p.x + dd * 22},${p.y} ${P.x - dd * 18},${P.y} ${P.x},${P.y}`, class: 'fan', stroke: cableColor(p.c) }, g);
    }));
    el('path', { d: trunk, class: 'cable-hit' }, g);
    el('path', { d: trunk, class: 'bundle' + (selected ? ' selected' : ''), stroke: color }, g);
    const M = TR.mid;
    // Sur le synoptique : seulement le nom de la liaison (départ – arrivée). Le contenu reste en info-bulle et dans l'inspecteur.
    const summary = bundleSummary(items.map((i) => i.c));
    const t = text(g, M.x, M.y - 12, info.name || bundleAutoName(items.map((i) => i.c)) || summary, 'cable-label bundle-label', 'middle');
    el('title', {}, t).textContent = summary;
    t.setAttribute('fill', 'currentColor');
    if (sel('bundle', key)) routeHandle(g, 'b:' + key, M);
  }

  function routeHandle(g, id, M) {
    const h = el('circle', { cx: M.x, cy: M.y, r: 7, class: 'route-handle', 'data-route': id }, g);
    el('title', {}, h).textContent = 'Glisser pour déplacer le tracé · double-clic pour le remettre droit';
  }
  // Courbe quadratique passant par V à mi-parcours
  // Point de passage hors des appareils : s'il tombe sur un bloc, on le pousse vers le bord le plus proche
  function pushOut(V) {
    const P = { x: Math.round(V.x), y: Math.round(V.y) };
    const blockedAt = (x, y) => _obst.some((q) => inside(q, x, y, OB_M + 2));
    if (!blockedAt(P.x, P.y)) return P;
    // on avance dans les 4 directions jusqu'à sortir de tous les blocs (y compris des blocs collés), et on garde la plus courte
    let best = null;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      for (let d = 4; d < 1500; d += 4) {
        const x = P.x + dx * d, y = P.y + dy * d;
        if (!blockedAt(x, y)) { if (!best || d < best.d) best = { x: x + dx * 4, y: y + dy * 4, d }; break; }
      }
    });
    return best ? { x: best.x, y: best.y } : P;
  }
  function quadHits(P1, V, P2) {
    const Q = { x: 2 * V.x - (P1.x + P2.x) / 2, y: 2 * V.y - (P1.y + P2.y) / 2 };
    // quadratique = cubique avec points de contrôle aux 2/3
    return bezierHits(P1, { x: P1.x + 2 / 3 * (Q.x - P1.x), y: P1.y + 2 / 3 * (Q.y - P1.y) }, { x: P2.x + 2 / 3 * (Q.x - P2.x), y: P2.y + 2 / 3 * (Q.y - P2.y) }, P2, _obst);
  }
  function viaHalves(A, V, B, sa, sb) {
    const k1 = Math.max(30, Math.abs(V.x - A.x) / 2), k2 = Math.max(30, Math.abs(B.x - V.x) / 2);
    const t = Math.sign(B.x - A.x) || 1;
    return [[A, { x: A.x + (sa === 'L' ? -k1 : k1), y: A.y }, { x: V.x - t * k1 / 2, y: V.y }, V], [V, { x: V.x + t * k2 / 2, y: V.y }, { x: B.x + (sb === 'L' ? -k2 : k2), y: B.y }, B]];
  }
  // Tracé passant par le point choisi à la main ; contourne automatiquement les appareils
  function viaRouted(A, V, B, sa, sb, quad) {
    const curveD = () => (quad ? quadVia(A, V, B) : curveVia(A, V, B, sa, sb));
    const hits = quad ? quadHits(A, V, B) : viaHalves(A, V, B, sa, sb).some((h) => bezierHits(h[0], h[1], h[2], h[3], _obst));
    if (!ui.avoid || !hits) {
      if (!quad) viaHalves(A, V, B, sa, sb).forEach((h) => markPath(bezierSamples(h[0], h[1], h[2], h[3])));
      return { d: curveD(), mid: V };
    }
    const W2 = pushOut(V);
    const p1 = orthoRoute(A, W2, sa, null), p2 = orthoRoute(W2, B, null, sb);
    if (!p1 || !p2) return { d: curveD(), mid: V };
    const pts = cleanPts(p1.concat(p2.slice(1)));
    markPath(polySamples(pts));
    return { d: roundedPath(pts), mid: W2 };
  }
  function quadVia(P1, V, P2) {
    const Q = { x: 2 * V.x - (P1.x + P2.x) / 2, y: 2 * V.y - (P1.y + P2.y) / 2 };
    return `M${P1.x},${P1.y} Q${Q.x},${Q.y} ${P2.x},${P2.y}`;
  }
  // Câble passant par un point V choisi par l'utilisateur
  function curveVia(A, V, B, sa, sb) {
    const k1 = Math.max(30, Math.abs(V.x - A.x) / 2), k2 = Math.max(30, Math.abs(B.x - V.x) / 2);
    const t = Math.sign(B.x - A.x) || 1;
    return `M${A.x},${A.y} C${A.x + (sa === 'L' ? -k1 : k1)},${A.y} ${V.x - t * k1 / 2},${V.y} ${V.x},${V.y}` +
      ` C${V.x + t * k2 / 2},${V.y} ${B.x + (sb === 'L' ? -k2 : k2)},${B.y} ${B.x},${B.y}`;
  }

  // "2 Ethernet · 1 DMX · 1 Intercom"
  function bundleSummary(cables) {
    const n = {};
    cables.forEach((c) => { const k = sigById(c.sig).name.replace(/\s*\(.*\)$/, ''); n[k] = (n[k] || 0) + 1; });
    return Object.entries(n).map(([k, v]) => v + ' ' + k).join(' · ');
  }
  function configUrl(d) {
    if (d.configUrl) return d.configUrl;
    return /^https?:\/\//.test(d.ip) ? d.ip : 'http://' + d.ip + '/';
  }

  function dot(g, dev, port, side, x, y) {
    const pend = ui.pending && ui.pending.d === dev.id && ui.pending.p === port.id && ui.pending.s === side;
    // extérieur = couleur du type de réseau du connecteur ; intérieur = couleur du câble branché (sous-réseau), sinon vide
    const ring = sigById(port.sig).color;
    const cab = _portCable.get(dev.id + ':' + port.id + ':' + side);
    const inner = cab ? cableColor(cab) : 'var(--dev)';
    const c = el('circle', { cx: x, cy: y, r: 4.6, class: 'port-dot' + (pend ? ' pending' : '') + (cab ? ' used' : ''),
      style: `fill:${inner};stroke:${ring}`, 'data-port': port.id, 'data-pdev': dev.id, 'data-side': side }, g);
    const sub = cab && subnetOf(cab);
    const t = el('title', {}, c); t.textContent = `${port.name} — ${port.conn} — ${sigById(port.sig).name} (${port.dir})` + (cab ? ' · câblé' + (sub ? ' : ' + sub.name : '') : '');
  }

  function anchorPoint(e, peerId, layouts) {
    const dev = devById(e.d), lay = layouts[e.d]; if (!dev || !lay) return null;
    const g = lay.pos['grp:' + peerId + ':' + e.s];
    if (g) return { x: dev.x + g.x, y: dev.y + g.y, s: g.x === 0 ? 'L' : 'R' };
    const left = visSide(dev, e.s) === 'L';
    return { x: dev.x + (left ? 0 : lay.w), y: dev.y + Math.min(lay.h - 6, HEAD + 8), s: left ? 'L' : 'R' };
  }
  function endpoint(e, layouts) {
    const dev = devById(e.d); if (!dev) return null;
    const lay = layouts[e.d]; const p = lay.pos[e.p + ':' + e.s];
    // s = côté visible à l'écran (sert à orienter la courbe du câble)
    return p ? { x: dev.x + p.x, y: dev.y + p.y, s: p.x === 0 ? 'L' : 'R' } : null;
  }

  function curve(A, B, sa, sb) {
    const dx = Math.max(40, Math.abs(B.x - A.x) / 2);
    const c1 = A.x + (sa === 'L' ? -dx : dx), c2 = B.x + (sb === 'L' ? -dx : dx);
    return `M${A.x},${A.y} C${c1},${A.y} ${c2},${B.y} ${B.x},${B.y}`;
  }

  function sel(type, id) { return ui.selected && ui.selected.type === type && ui.selected.id === id; }

  // ---------------------------------------------------------------- interactions canvas
  function toWorld(cx, cy) {
    const r = svg.getBoundingClientRect();
    return { x: (cx - r.left - ui.view.x) / ui.view.k, y: (cy - r.top - ui.view.y) / ui.view.k };
  }

  function capture(ev) { try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* pointeur synthétique */ } }
  // Pointeurs actifs (doigts / stylet) pour le pincement tactile
  const touches = new Map();
  const touchCenter = () => { const p = [...touches.values()]; return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1 }; };
  function startPinch() {
    const c = touchCenter(), r = svg.getBoundingClientRect();
    ui.drag = { kind: 'pinch', c0: { x: c.x - r.left, y: c.y - r.top }, d0: c.d, v0: { ...ui.view } };
  }
  svg.addEventListener('pointerdown', (ev) => {
    const t = ev.target;
    const w = toWorld(ev.clientX, ev.clientY);
    if (ev.pointerType === 'touch') {
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      capture(ev);
      // deux doigts : zoom + déplacement de la vue, sans toucher à la sélection ni au câble en cours
      if (touches.size === 2) { startPinch(); return; }
      if (touches.size > 2) return;
    }
    // clic molette (bouton du milieu) : déplacer la vue, n'importe où, sans rien sélectionner ni désélectionner
    if (ev.button === 1) {
      ev.preventDefault();
      ui.drag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, x0: ui.view.x, y0: ui.view.y, keep: true };
      capture(ev); return;
    }
    if (t.dataset && t.dataset.url) { ev.stopPropagation(); window.open(t.dataset.url, '_blank', 'noopener'); return; }
    // poignée de tracé (câble ou faisceau sélectionné)
    if (t.dataset && t.dataset.route) { ui.drag = { kind: 'route', id: t.dataset.route }; capture(ev); return; }
    // × d'un câble débranché
    const delG = t.closest && t.closest('[data-delcable]');
    if (delG) { deleteCable(delG.dataset.delcable); flash('Câble débranché supprimé.'); return; }
    const bundleG = t.closest && t.closest('[data-bundle]');
    if (bundleG) {
      const key = bundleG.dataset.bundle;
      if (ev.shiftKey) { project.cables.filter((c) => groupKeyOf(c) === key).forEach((c) => toggleMulti(c.id, true)); return refreshSel(); }
      select({ type: 'bundle', id: key }); return;
    }
    if (t.dataset.port) {
      ev.stopPropagation();
      const e = { d: t.dataset.pdev, p: t.dataset.port, s: t.dataset.side };
      if (!ui.pending) { ui.pending = e; renderCanvas(); }
      else { const a = ui.pending; ui.pending = null; $('#tempCable').setAttribute('d', ''); connectPorts(a, e); renderCanvas(); }
      return;
    }
    if (t.dataset.resize) {
      const r = devById(t.dataset.resize);
      ui.drag = { kind: 'resize', id: r.id, sx: w.x, sy: w.y, w0: r.w, h0: r.h };
      capture(ev); return;
    }
    const roomG = t.closest('[data-room]');
    if (roomG) { startZoneDrag(roomG.dataset.room, w); capture(ev); return; }
    const cableG = t.closest('[data-cable]');
    if (cableG) {
      if (ev.shiftKey) { toggleMulti(cableG.dataset.cable); return refreshSel(); }
      select({ type: 'cable', id: cableG.dataset.cable }); return;
    }
    const devG = t.closest('[data-dev]');
    if (devG) {
      const d = devById(devG.dataset.dev);
      select({ type: 'device', id: d.id });
      const kids = isRack(d) ? project.devices.filter((k) => k.parent === d.id).map((k) => ({ k, x: k.x, y: k.y })) : [];
      ui.drag = { kind: 'move', id: d.id, sx: w.x, sy: w.y, x0: d.x, y0: d.y, kids, moved: false };
      capture(ev); return;
    }
    // fond : on déplace la vue ; ce n'est qu'un simple clic (sans glisser) qui annule le câble en cours et désélectionne
    ui.drag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, x0: ui.view.x, y0: ui.view.y, tap: true };
    capture(ev);
  });
  svg.addEventListener('auxclick', (ev) => { if (ev.button === 1) ev.preventDefault(); });
  svg.addEventListener('mousedown', (ev) => { if (ev.button === 1) ev.preventDefault(); });   // pas de défilement automatique

  svg.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch' && touches.has(ev.pointerId)) touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ui.drag && ui.drag.kind === 'pinch') {
      if (touches.size < 2) return;
      const dr = ui.drag, c = touchCenter(), r = svg.getBoundingClientRect();
      const k = Math.min(3, Math.max(0.15, dr.v0.k * c.d / dr.d0));
      const wx = (dr.c0.x - dr.v0.x) / dr.v0.k, wy = (dr.c0.y - dr.v0.y) / dr.v0.k;   // point du monde sous le centre initial
      ui.view.k = k; ui.view.x = (c.x - r.left) - wx * k; ui.view.y = (c.y - r.top) - wy * k;
      applyView(); return;
    }
    const w = toWorld(ev.clientX, ev.clientY);
    if (ui.pending && !(ui.drag && ui.drag.kind === 'pan')) {
      const layouts = {}; const d = devById(ui.pending.d); layouts[d.id] = layout(d);
      const A = endpoint(ui.pending, layouts);
      if (A) $('#tempCable').setAttribute('d', `M${A.x},${A.y} L${w.x},${w.y}`);
    }
    const dr = ui.drag; if (!dr) return;
    if (dr.kind === 'pan') {
      if (Math.hypot(ev.clientX - dr.sx, ev.clientY - dr.sy) > 5) dr.tap = false;
      ui.view.x = dr.x0 + ev.clientX - dr.sx; ui.view.y = dr.y0 + ev.clientY - dr.sy; applyView(); return;
    }
    if (dr.kind === 'route') {
      const V = { x: Math.round(w.x / 5) * 5, y: Math.round(w.y / 5) * 5 };
      if (dr.id.startsWith('c:')) { const c = project.cables.find((x) => x.id === dr.id.slice(2)); if (c) c.via = V; }
      else groupInfo(dr.id.slice(2)).via = V;
      renderCanvas(); return;
    }
    if (dr.kind === 'zone') {
      const dx = Math.round((w.x - dr.sx) / 10) * 10, dy = Math.round((w.y - dr.sy) / 10) * 10;
      dr.items.forEach((o) => { o.obj[o.key] = { x: o.x + dx, y: o.y + dy }; });
      dr.devs.forEach((o) => { o.d.x = o.x + dx; o.d.y = o.y + dy; });
      renderCanvas(); return;
    }
    const d = devById(dr.id);
    if (dr.kind === 'move') {
      const dx = Math.round((w.x - dr.sx) / 10) * 10, dy = Math.round((w.y - dr.sy) / 10) * 10;
      d.x = dr.x0 + dx; d.y = dr.y0 + dy; dr.moved = true;
      // appareil verrouillé dans sa baie : il ne peut pas en sortir
      const rack = d.lock && devById(d.parent);
      if (rack) {
        const lay = layout(d);
        d.x = Math.min(Math.max(d.x, rack.x + 10), rack.x + rack.w - lay.w - 10);
        d.y = Math.min(Math.max(d.y, rack.y + 34), rack.y + rack.h - lay.h - 10);
      }
      dr.kids.forEach((o) => { o.k.x = o.x + dx; o.k.y = o.y + dy; });
      renderCanvas();
    } else if (dr.kind === 'resize') {
      d.w = Math.max(160, Math.round((dr.w0 + w.x - dr.sx) / 10) * 10);
      d.h = Math.max(80, Math.round((dr.h0 + w.y - dr.sy) / 10) * 10);
      renderCanvas();
    }
  });

  let lastTap = { t: 0, id: null };
  function pointerEnd(ev) {
    if (ev.pointerType === 'touch') {
      touches.delete(ev.pointerId);
      if (ui.drag && ui.drag.kind === 'pinch') { if (touches.size === 0) ui.drag = null; return; }
    }
    const dr = ui.drag; ui.drag = null;
    if (ev.type === 'pointercancel') return;
    if (dr && dr.kind === 'pan') {
      if (dr.tap) {   // simple clic sur le fond
        if (ui.pending) { ui.pending = null; $('#tempCable').setAttribute('d', ''); }
        select(null);
      }
      return;
    }
    // double tape sur un appareil (écran tactile) = détail des ports, comme le double-clic
    if (ev.pointerType === 'touch' && dr && dr.kind === 'move' && !dr.moved) {
      const now = performance.now();
      if (lastTap.id === dr.id && now - lastTap.t < 350) { lastTap = { t: 0, id: null }; portDetailModal(dr.id); return; }
      lastTap = { t: now, id: dr.id };
    }
    if (!dr) return;
    if (dr.kind === 'route' || dr.kind === 'zone') { save(); return; }
    const d = devById(dr.id);
    if (dr.kind === 'move' && dr.moved) {
      if (!isRack(d)) { const before = d.parent; assignParent(d); if (before !== d.parent) renderInspector(); }
    }
    if (dr.kind === 'resize') project.devices.filter((k) => !isRack(k)).forEach(assignParent);
    save(); renderCanvas();
  }
  svg.addEventListener('pointerup', pointerEnd);
  svg.addEventListener('pointercancel', pointerEnd);

  svg.addEventListener('dblclick', (ev) => {
    const r = ev.target.dataset && ev.target.dataset.route;
    if (r) {
      if (r.startsWith('c:')) { const c = project.cables.find((x) => x.id === r.slice(2)); if (c) delete c.via; }
      else delete groupInfo(r.slice(2)).via;
      save(); renderCanvas(); return;
    }
    const devG = ev.target.closest('[data-dev]');
    if (devG) portDetailModal(devG.dataset.dev);
  });

  // Zoom autour d'un point de l'écran (coordonnées client)
  function zoomAt(clientX, clientY, factor) {
    const r = svg.getBoundingClientRect();
    const mx = clientX - r.left, my = clientY - r.top;
    const k2 = Math.min(3, Math.max(0.15, ui.view.k * factor));
    ui.view.x = mx - (mx - ui.view.x) * k2 / ui.view.k;
    ui.view.y = my - (my - ui.view.y) * k2 / ui.view.k;
    ui.view.k = k2; applyView();
  }

  // Trackpad : glisser à 2 doigts = défiler (horizontal + vertical), pincer = zoomer.
  // Souris : molette = zoom (Maj + molette = défilement horizontal, Alt + molette = défilement vertical).
  // Le pincement arrive comme une molette avec ctrlKey (Chrome, Firefox, Edge).
  let trackpadUntil = 0;
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? svg.clientHeight : 1;
    const dx = ev.deltaX * unit, dy = ev.deltaY * unit;
    if (ev.ctrlKey || ev.metaKey) { zoomAt(ev.clientX, ev.clientY, Math.exp(-dy * 0.01)); return; }
    // Un trackpad envoie de petits pas en pixels, souvent fractionnaires ou avec un déplacement horizontal.
    // Une fois reconnu, on le garde le temps du geste (inertie comprise).
    const now = performance.now();
    const looksTrackpad = ev.deltaMode === 0 && (dx !== 0 || !Number.isInteger(ev.deltaY) || Math.abs(ev.deltaY) < 40);
    if (looksTrackpad) trackpadUntil = now + 400;
    if (now < trackpadUntil || ev.altKey) {
      ui.view.x -= dx; ui.view.y -= dy; applyView(); return;
    }
    if (ev.shiftKey) { ui.view.x -= dy || dx; applyView(); return; }
    zoomAt(ev.clientX, ev.clientY, Math.exp(-dy * 0.0015));
  }, { passive: false });

  // Safari (macOS) : le pincement du trackpad passe par les événements "gesture"
  let gestureK = 1;
  svg.addEventListener('gesturestart', (ev) => { ev.preventDefault(); gestureK = 1; });
  svg.addEventListener('gesturechange', (ev) => {
    ev.preventDefault();
    if (touches.size >= 2) return;
    zoomAt(ev.clientX, ev.clientY, ev.scale / gestureK);
    gestureK = ev.scale;
  });
  svg.addEventListener('gestureend', (ev) => ev.preventDefault());
  // Pas de zoom de la page entière (iPad / tablettes) : seul l'espace de travail se zoome
  ['gesturestart', 'gesturechange'].forEach((n) => document.addEventListener(n, (ev) => ev.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', (ev) => { if (ev.touches && ev.touches.length > 1) ev.preventDefault(); }, { passive: false });

  svg.addEventListener('dragover', (ev) => ev.preventDefault());
  svg.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text/tpl'); const tpl = tplById(id); if (!tpl) return;
    const w = toWorld(ev.clientX, ev.clientY);
    addDevice(tpl, w.x - 100, w.y - 15);
  });

  function zoomBy(f) {
    const r = svg.getBoundingClientRect(); const mx = r.width / 2, my = r.height / 2;
    const k2 = Math.min(3, Math.max(0.15, ui.view.k * f));
    ui.view.x = mx - (mx - ui.view.x) * k2 / ui.view.k; ui.view.y = my - (my - ui.view.y) * k2 / ui.view.k; ui.view.k = k2; applyView();
  }
  // ---------------------------------------------------------------- Ranger le plan (selon le sens du signal)
  // Sources à gauche, distribution au milieu, destinations à droite ; un bloc par zone ; une baie se déplace avec son contenu.
  let layoutUndo = null;
  function autoArrange() {
    const devs = project.devices;
    if (!devs.length) return;
    const before = { devices: devs.map((d) => ({ id: d.id, x: d.x, y: d.y, w: d.w, h: d.h })), via: project.cables.filter((c) => c.via).map((c) => ({ id: c.id, via: c.via })), groups: JSON.parse(JSON.stringify(project.groups || {})) };
    const unitOf = (id) => { const d = devById(id); if (!d) return null; const r = d.parent && devById(d.parent); return r && isRack(r) ? r.id : d.id; };
    const units = devs.filter((d) => !d.parent || !devById(d.parent) || !isRack(devById(d.parent))).map((d) => d.id);
    // tailles mesurées en vue détaillée (la plus grande) pour qu'aucun appareil ne se chevauche dans l'une ou l'autre vue
    const prevMode = ui.mode; ui.mode = 'detail';
    const layouts = {}; devs.forEach((d) => { layouts[d.id] = layout(d); });
    ui.mode = prevMode;
    // baies : leur contenu est empilé proprement et la baie reprend une taille ajustée
    devs.filter(isRack).forEach((r) => {
      const kids = devs.filter((k) => k.parent === r.id).sort((a, b) => a.y - b.y || a.x - b.x);
      if (!kids.length) return;
      let y = r.y + 40; const w = Math.max(...kids.map((k) => layouts[k.id].w));
      kids.forEach((k) => { k.x = r.x + 20; k.y = y; y += layouts[k.id].h + 20; });
      r.w = w + 40; r.h = y - r.y;
    });
    const size = (id) => { const d = devById(id); return { w: isRack(d) ? d.w : layouts[id].w, h: isRack(d) ? d.h : layouts[id].h }; };
    // graphe orienté source -> destination (hors alimentation)
    const out = new Map(units.map((u) => [u, new Set()])), inc = new Map(units.map((u) => [u, new Set()]));
    project.cables.forEach((c) => {
      if (c.sig === 'power') return;
      const pa = portOf(devById(c.a.d), c.a.p), pb = portOf(devById(c.b.d), c.b.p); if (!pa || !pb) return;
      let srcA;
      if (pa.dir === 'out' || pb.dir === 'in') srcA = true;
      else if (pb.dir === 'out' || pa.dir === 'in') srcA = false;
      else if (c.infra) srcA = devById(c.a.d).ports.length >= devById(c.b.d).ports.length;   // baie -> boîtier
      else srcA = true;
      const u = unitOf(srcA ? c.a.d : c.b.d), v = unitOf(srcA ? c.b.d : c.a.d);
      if (!u || !v || u === v || !out.has(u) || !out.has(v)) return;
      out.get(u).add(v); inc.get(v).add(u);
    });
    // rang = plus long chemin depuis une source (les boucles sont coupées)
    const rank = new Map(), state = new Map();
    const visit = (u) => {
      if (state.get(u) === 2) return rank.get(u);
      if (state.get(u) === 1) return 0;   // boucle
      state.set(u, 1);
      let r = 0; inc.get(u).forEach((p) => { r = Math.max(r, visit(p) + 1); });
      state.set(u, 2); rank.set(u, r); return r;
    };
    units.forEach(visit);
    // zones : chaque zone (ou « sans zone ») est rangée à part
    const zoneOf = (u) => devById(u).room || '';
    const zones = [...new Set(units.map(zoneOf))];
    const zoneRank = (z) => { const us = units.filter((u) => zoneOf(u) === z); return us.reduce((a, u) => a + rank.get(u), 0) / us.length; };
    zones.sort((a, b) => zoneRank(a) - zoneRank(b));
    const GX = 130, GY = 36, ZGAP = 140, MAXW = 2600;
    // 1) bloc de chaque zone : colonnes par rang, ordre par barycentre ; positions relatives au coin du bloc
    const blocks = new Map();
    zones.forEach((z) => {
      const us = units.filter((u) => zoneOf(u) === z);
      const ranks = [...new Set(us.map((u) => rank.get(u)))].sort((a, b) => a - b);
      const cols = ranks.map((r) => us.filter((u) => rank.get(u) === r));
      const idx = new Map(); cols.forEach((col) => col.forEach((u, i) => idx.set(u, i)));
      for (let pass = 0; pass < 4; pass++) {
        cols.forEach((col) => {
          const bary = (u) => { const nb = [...inc.get(u), ...out.get(u)].filter((v) => idx.has(v) && v !== u); return nb.length ? nb.reduce((a, v) => a + idx.get(v), 0) / nb.length : idx.get(u); };
          col.sort((a, b) => bary(a) - bary(b)); col.forEach((u, i) => idx.set(u, i));
        });
      }
      const colW = cols.map((col) => Math.max(...col.map((u) => size(u).w)));
      const colH = cols.map((col) => col.reduce((a, u) => a + size(u).h + GY, -GY));
      const W = colW.reduce((a, w) => a + w + GX, -GX), H = Math.max(...colH);
      const rel = new Map(); let x = 0;
      cols.forEach((col, ci) => {
        let y = (H - colH[ci]) / 2;
        col.forEach((u) => { rel.set(u, { x: x + (colW[ci] - size(u).w) / 2, y }); y += size(u).h + GY; });
        x += colW[ci] + GX;
      });
      blocks.set(z, { W, H, rel });
    });
    // 2) zones « en bout de chaîne » (reliées à une seule autre zone, en aval : boîtiers muraux d'une salle…) : sous la zone qui les dessert
    const zEdges = new Map(zones.map((z) => [z, new Set()]));
    units.forEach((u) => out.get(u).forEach((v) => { const a = zoneOf(u), b = zoneOf(v); if (a !== b) { zEdges.get(a).add(b); zEdges.get(b).add(a); } }));
    const parentZone = new Map();
    zones.forEach((z) => {
      const nb = [...zEdges.get(z)];
      if (nb.length === 1 && zoneRank(z) > zoneRank(nb[0]) && zones.length > 2) parentZone.set(z, nb[0]);
    });
    // pour chaque zone mère, la plus grosse zone en aval continue la ligne principale (le signal va vers la droite)
    const zSize = (z) => units.filter((u) => zoneOf(u) === z).length;
    new Set(parentZone.values()).forEach((pz) => {
      const kids = zones.filter((k) => parentZone.get(k) === pz);
      const main = kids.slice().sort((a, b) => zSize(b) - zSize(a))[0];
      const pzHasMainNext = zones.some((z) => !parentZone.has(z) && z !== pz && zEdges.get(pz).has(z) && zoneRank(z) > zoneRank(pz));
      if (!pzHasMainNext) parentZone.delete(main);
    });
    // 3) placement : zones principales de gauche à droite (retour à la ligne si trop large), zones en bout de chaîne dessous
    const pos = new Map();
    let cx = 0, cy = 0, rowBottom = 0;
    zones.filter((z) => !parentZone.has(z)).forEach((z) => {
      const kids = zones.filter((k) => parentZone.get(k) === z);
      const b = blocks.get(z);
      const colW = Math.max(b.W, ...kids.map((k) => blocks.get(k).W));
      if (cx > 0 && cx + colW > MAXW) { cx = 0; cy = rowBottom + ZGAP; }
      const place = (zz, x0, y0) => blocks.get(zz).rel.forEach((r, u) => pos.set(u, { x: Math.round((x0 + r.x) / 10) * 10, y: Math.round((y0 + r.y) / 10) * 10 }));
      place(z, cx, cy);
      let y = cy + b.H + ZGAP;
      kids.forEach((k) => { place(k, cx, y); y += blocks.get(k).H + ZGAP; });
      rowBottom = Math.max(rowBottom, y - ZGAP);
      cx += colW + ZGAP;
    });
    // application (une baie emmène ses appareils)
    pos.forEach((p, u) => {
      const d = devById(u), dx = p.x - d.x, dy = p.y - d.y;
      d.x = p.x; d.y = p.y;
      if (isRack(d)) devs.forEach((k) => { if (k.parent === d.id) { k.x += dx; k.y += dy; } });
    });
    // les tracés posés à la main n'ont plus de sens après le rangement
    project.cables.forEach((c) => { delete c.via; });
    Object.values(project.groups || {}).forEach((g) => { delete g.via; });
    layoutUndo = before;
    $('#btnUndoArrange').hidden = false;
    commit(); setTimeout(zoomFit, 30);
    flash('Plan rangé selon le sens du signal — Affichage › « Annuler le rangement » pour revenir en arrière.');
  }
  function undoArrange() {
    if (!layoutUndo) return;
    layoutUndo.devices.forEach((o) => { const d = devById(o.id); if (d) { d.x = o.x; d.y = o.y; if (o.w != null) { d.w = o.w; d.h = o.h; } } });
    layoutUndo.via.forEach((o) => { const c = project.cables.find((x) => x.id === o.id); if (c) c.via = o.via; });
    project.groups = layoutUndo.groups;
    layoutUndo = null; $('#btnUndoArrange').hidden = true;
    commit(); setTimeout(zoomFit, 30); flash('Rangement annulé.');
  }

  function zoomFit() {
    if (!project.devices.length) return;
    const b = world.getBBox(); const r = svg.getBoundingClientRect();
    const k = Math.min(2, Math.min((r.width - 60) / b.width, (r.height - 60) / b.height));
    ui.view.k = k; ui.view.x = (r.width - b.width * k) / 2 - b.x * k; ui.view.y = (r.height - b.height * k) / 2 - b.y * k; applyView();
  }
  $('#zoomIn').onclick = () => zoomBy(1.2);
  $('#zoomOut').onclick = () => zoomBy(1 / 1.2);
  $('#zoomFit').onclick = zoomFit;

  document.addEventListener('keydown', (ev) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (ev.key === 'Escape') { ui.pending = null; $('#tempCable').setAttribute('d', ''); closeModal(); renderCanvas(); }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && ui.selected) {
      ev.preventDefault();
      if (ui.selected.type === 'device') deleteDevice(ui.selected.id); else deleteCable(ui.selected.id);
    }
  });

  function select(s) { ui.selected = s; ui.multi.clear(); renderCanvas(); renderInspector(); }

  // Déplacement d'une zone entière : ses appareils, le contenu de ses baies,
  // et les tracés (câbles / faisceaux) qui restent à l'intérieur de la zone.
  function startZoneDrag(roomId, w) {
    const ids = new Set(project.devices.filter((d) => d.room === roomId).map((d) => d.id));
    project.devices.forEach((d) => { if (d.parent && ids.has(d.parent)) ids.add(d.id); });
    const devs = project.devices.filter((d) => ids.has(d.id)).map((d) => ({ d, x: d.x, y: d.y }));
    const inside = (c) => ids.has(c.a.d) && ids.has(c.b.d);
    const items = [];
    project.cables.forEach((c) => { if (c.via && inside(c)) items.push({ obj: c, key: 'via', x: c.via.x, y: c.via.y }); });
    Object.keys(project.groups || {}).forEach((key) => {
      const info = project.groups[key];
      const cs = project.cables.filter((c) => groupKeyOf(c) === key);
      if (info.via && cs.length && cs.every(inside)) items.push({ obj: info, key: 'via', x: info.via.x, y: info.via.y });
    });
    ui.selected = null; ui.multi.clear(); renderInspector();
    ui.drag = { kind: 'zone', sx: w.x, sy: w.y, devs, items };
  }
  // Maj+clic : ajoute / retire des câbles d'une sélection multiple (pour les regrouper)
  function toggleMulti(id, forceOn) {
    if (ui.selected && ui.selected.type === 'cable') ui.multi.add(ui.selected.id);
    if (ui.selected && ui.selected.type === 'bundle') project.cables.filter((c) => groupKeyOf(c) === ui.selected.id).forEach((c) => ui.multi.add(c.id));
    ui.selected = null;
    if (ui.multi.has(id) && !forceOn) ui.multi.delete(id); else ui.multi.add(id);
  }
  function refreshSel() { renderCanvas(); renderInspector(); }

  // ---------------------------------------------------------------- panneaux latéraux
  function renderLibrary() {
    const q = $('#libSearch').value.trim().toLowerCase();
    const box = $('#library'); box.innerHTML = '';
    let total = 0;
    const onlyCheck = $('#libToCheck').checked;
    if (q || onlyCheck) $('#libWrap').open = true;
    const nCheck = allTemplates().filter(toCheck).length;
    $('#libToCheckCount').textContent = nCheck ? '(' + nCheck + ')' : '— tout est validé ✓';
    L.CATEGORIES.forEach((cat) => {
      const items = allTemplates().filter((t) => (t.custom ? 'custom' : t.cat) === cat.id)
        .filter((t) => !q || (t.maker + ' ' + t.model).toLowerCase().includes(q))
        .filter((t) => !onlyCheck || toCheck(t));
      if (!items.length) return;
      total += items.length;
      const det = document.createElement('details'); det.open = !!q || onlyCheck || ui.libOpen.has(cat.id);
      det.addEventListener('toggle', () => { if (q || onlyCheck) return; if (det.open) ui.libOpen.add(cat.id); else ui.libOpen.delete(cat.id); });
      det.innerHTML = `<summary>${esc(cat.name)} <span class="muted">(${items.length})</span></summary>`;
      items.forEach((t) => {
        const it = document.createElement('div'); it.className = 'lib-item'; it.draggable = true;
        const v = validationOf(t.id);
        const badge = v ? `<span class="badge ok click" data-validate="${esc(t.id)}" title="Validé le ${esc(fmtDate(v.date))}${v.ports ? ' (ports corrigés)' : ''}${v.note ? ' — ' + esc(v.note) : ''}. Cliquer pour revoir.">validé ✓</span>`
          : needsCheck(t) ? `<span class="badge warn click" data-validate="${esc(t.id)}" title="Ports non confirmés par la doc constructeur. Cliquer pour vérifier et valider.">${t.web ? 'web · ' : ''}à vérifier</span>`
          : t.custom ? '<span class="badge">perso</span>'
          : isGeneric(t) ? '<span class="badge muted" title="Modèle générique, à adapter">générique</span>'
          : '<span class="badge" title="Ports recoupés avec la doc constructeur">doc ✓</span>';
        it.innerHTML = `<div><div>${esc(t.model)}</div><div class="maker">${esc(t.maker)} · ${t.ports.length} ports</div></div>${badge}`;
        it.title = (t.notes || '') + (t.doc ? '\nSource : ' + t.doc : '') + '\nGlisser sur le synoptique, ou double-cliquer pour ajouter.';
        it.addEventListener('dragstart', (ev) => ev.dataTransfer.setData('text/tpl', t.id));
        let tapAt = null;
        it.addEventListener('pointerdown', (e) => { tapAt = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null; });
        it.addEventListener('pointerup', (e) => {
          if (!tapAt || e.pointerType !== 'touch' || Math.hypot(e.clientX - tapAt.x, e.clientY - tapAt.y) > 8) return;
          const r = svg.getBoundingClientRect(); const w = toWorld(r.left + r.width / 2 - 120, r.top + r.height / 2 - 60);
          addDevice(t, w.x, w.y, { noParent: true }); flash('Ajouté : ' + t.model);
        });
        it.addEventListener('dblclick', () => { const w = toWorld(svg.getBoundingClientRect().left + 200, svg.getBoundingClientRect().top + 150); addDevice(t, w.x, w.y, { noParent: true }); });
        if (t.custom) {
          it.addEventListener('contextmenu', (ev) => {
            ev.preventDefault();
            confirmBox('Supprimer le modèle « ' + t.model + ' » de la bibliothèque ? (les appareils déjà placés sont conservés)', () => { project.customTemplates = project.customTemplates.filter((x) => x.id !== t.id); commit(); }, 'Supprimer');
          });
        }
        det.appendChild(it);
      });
      box.appendChild(det);
    });
    $('#libCount').textContent = '(' + total + ')';
  }
  $('#libSearch').addEventListener('input', renderLibrary);
  $('#libToCheck').addEventListener('change', renderLibrary);
  // Sections de la barre latérale repliables
  $$('.sidebar h3.fold').forEach((h) => { h.onclick = () => h.parentElement.classList.toggle('folded'); });

  function renderRooms() {
    const box = $('#rooms'); box.innerHTML = '';
    project.rooms.forEach((r) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<input type="color" value="${r.color}"><input class="grow" value="${esc(r.name)}"><span class="muted">${project.devices.filter((d) => d.room === r.id).length}</span><button class="danger" title="Supprimer">×</button>`;
      const [col, name] = $$('input', row);
      col.oninput = () => { r.color = col.value; commit({ keepSide: true }); };
      name.onchange = () => { r.name = name.value; commit({ keepSide: true }); };
      $('button', row).onclick = () => { project.rooms = project.rooms.filter((x) => x !== r); project.devices.forEach((d) => { if (d.room === r.id) d.room = null; }); commit(); };
      box.appendChild(row);
    });
  }
  $('#btnAddRoom').onclick = () => {
    project.rooms.push({ id: uid(), name: 'Zone ' + (project.rooms.length + 1), color: ROOM_COLORS[project.rooms.length % ROOM_COLORS.length] });
    commit();
  };

  function renderFilters() {
    const box = $('#filters'); box.innerHTML = '';
    project.signals.forEach((s) => {
      const n = project.cables.filter((c) => c.sig === s.id).length;
      const row = document.createElement('label'); row.className = 'row';
      row.innerHTML = `<input type="checkbox" ${ui.filters[s.id] === false ? '' : 'checked'}><span class="swatch" style="background:${s.color}"></span><span class="grow">${esc(s.name)}</span><span class="muted">${n}</span>`;
      $('input', row).onchange = (e) => { ui.filters[s.id] = e.target.checked; renderCanvas(); };
      box.appendChild(row);
    });
  }

  // ---------------------------------------------------------------- inspecteur
  function opt(list, val, labelFn, valFn) {
    return list.map((x) => { const v = valFn ? valFn(x) : x; return `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(labelFn ? labelFn(x) : x)}</option>`; }).join('');
  }
  const DIRS = [['in', 'Entrée'], ['out', 'Sortie'], ['io', 'Bidir.']];
  const SIDES = [['', 'Auto'], ['L', 'Gauche'], ['R', 'Droite']];

  function renderInspector() {
    const box = $('#inspector'); box.className = 'sidebar right inspector';
    const s = ui.selected;
    // inspecteur replié : il s'ouvre tout seul quand on sélectionne un câble, un faisceau ou un appareil,
    // et se replie de nouveau quand la sélection est vidée (s'il avait été ouvert automatiquement)
    if ($('#toggleRight')) {
      const hidden = $('.main').classList.contains('hide-right');
      const has = !!(s || ui.multi.size);
      const key = s ? s.type + ':' + s.id : ui.multi.size ? 'multi:' + [...ui.multi].join(',') : '';
      const changed = key !== lastInspected; lastInspected = key;
      // seulement quand la sélection change : si on replie l'inspecteur à la main, il reste replié
      if (has && hidden && changed) { setPanels(!$('.main').classList.contains('hide-left'), true, true); autoRight = true; }
      else if (!has && autoRight) { setPanels(!$('.main').classList.contains('hide-left'), false, true); autoRight = false; }
    }
    if (ui.multi.size) return inspectMulti(box);
    if (!s) { box.innerHTML = '<p class="muted">Sélectionnez un appareil ou un câble.</p>' + statsHtml(); return; }
    if (s.type === 'cable') return inspectCable(box, project.cables.find((c) => c.id === s.id));
    if (s.type === 'bundle') return inspectBundle(box, s.id);
    const d = devById(s.id); if (!d) { box.innerHTML = ''; return; }
    const racks = project.devices.filter((r) => isRack(r) && r.id !== d.id);
    const tpl = tplById(d.tpl);
    const tv = tpl && validationOf(tpl.id);
    const checkBox = !tpl || isRack(d) ? '' : tv ? `<div class="valbox ok">Modèle validé le ${esc(fmtDate(tv.date))} <button class="link" data-validate="${esc(tpl.id)}">revoir</button></div>`
      : needsCheck(tpl) ? `<div class="valbox warn">⚠︎ Ports de ce modèle non confirmés par la doc constructeur. <button data-validate="${esc(tpl.id)}">Vérifier et valider…</button></div>` : '';
    let h = `<h2>${esc(d.name)}</h2><div class="muted" style="margin-bottom:8px">${esc(d.maker)} · ${esc(d.model)}</div>${checkBox}
      <div class="field"><label>Nom / repère</label><input id="iName" value="${esc(d.name)}"></div>
      <div class="field"><label>Zone</label><select id="iRoom"><option value="">—</option>${opt(project.rooms, d.room, (r) => r.name, (r) => r.id)}</select></div>`;
    if (!isRack(d)) {
      const locked = d.lock && devById(d.parent);
      h += `<div class="field"><label>Dans la baie</label><select id="iParent" ${locked ? 'disabled' : ''}><option value="">—</option>${opt(racks, d.parent, (r) => r.name, (r) => r.id)}</select></div>`;
      if (d.parent) h += `<div class="row"><label class="chk"><input type="checkbox" id="iLock" ${d.lock ? 'checked' : ''}> Verrouillé dans la baie (ne peut pas en sortir)</label></div>`;
    }
    if (!isRack(d)) {
      h += `<div class="field"><label>Adresse IP</label><div class="row"><input id="iIp" class="grow" value="${esc(d.ip || '')}" placeholder="ex : 10.0.0.21"><button id="iOpen" title="Ouvrir la page de configuration">Config ↗</button></div></div>
        <div class="field"><label>Page de configuration (si différente de http://IP/)</label><input id="iCfg" value="${esc(d.configUrl || '')}" placeholder="ex : https://10.0.0.21:8443/"></div>`;
    }
    if (hasPatch(d)) {
      const x = dmxOf(d), bad = dmxConflicts().get(d.id), auto = autoUniverse(d);
      const modes = [...new Set(project.devices.filter((o) => o.tpl === d.tpl && o.dmx && o.dmx.mode).map((o) => o.dmx.mode))];
      h += `<h3>Patch DMX</h3>
        <div class="row dmx-row">
          <div class="field"><label>Univers</label><input id="iUniv" class="mono" value="${esc((d.dmx && d.dmx.univ) || '')}" placeholder="${esc(auto || '1')}" title="Vide = univers du câble DMX qui arrive (${esc(auto || 'aucun')})"></div>
          <div class="field"><label>Adresse</label><input id="iAddr" class="mono" type="number" min="1" max="512" value="${x.addr || ''}" placeholder="001"></div>
          <div class="field"><label>Canaux</label><input id="iCh" class="mono" type="number" min="1" max="512" value="${(d.dmx && d.dmx.ch) || ''}" placeholder="1"></div>
        </div>
        <div class="field"><label>Mode</label><input id="iMode" list="iModes" value="${esc(x.mode)}" placeholder="ex : Mode 2 — 16 canaux, Standard, Extended…"><datalist id="iModes">${modes.map((m) => `<option value="${esc(m)}">`).join('')}</datalist></div>
        <p class="muted" id="iPatchInfo" style="font-size:11px">${x.addr ? 'Occupe ' + (x.univ ? 'l\'univers ' + esc(x.univ) + (x.auto ? ' (déduit du câble)' : '') + ', ' : '') + 'canaux ' + pad3(x.addr) + ' à ' + pad3(x.end) + '.' : 'Renseignez l\'adresse de départ et le nombre de canaux du mode.'}</p>
        ${bad ? `<div class="valbox bad">⚠ Adresse ${esc(bad)}</div>` : ''}`;
    }
    h += `<div class="field"><label>Notes</label><textarea id="iNotes" rows="2">${esc(d.notes)}</textarea></div>`;
    const hubs = project.devices.filter((x) => x.id !== d.id && (x.cat === 'patch' || isRack(x)));
    if (d.cat === 'patch') {
      h += `<h3>Liaison fixe vers une baie</h3>
        <div class="row"><select id="iHub" class="grow"><option value="">Choisir la baie / le répartiteur…</option>${opt(hubs, null, (x) => x.name + (isRack(x) ? ' (baie)' : ''), (x) => x.id)}</select><button id="iLink" class="primary">Raccorder</button></div>
        <p class="muted" style="font-size:11px">Tous les ports du boîtier (côté gauche = arrière) sont reliés à la baie (côté droit = arrivées), quel que soit le réseau. Les ports manquants y sont créés au nom du boîtier, avec le connecteur de genre opposé (XLR5M ↔ XLR5F). Un câble déjà branché à l'arrière du boîtier est déplacé en face avant.</p>`;
    }
    if (tpl && tpl.notes) h += `<p class="muted" style="font-size:11px">ℹ︎ ${esc(tpl.notes)}</p>`;
    if (d.doc) h += `<p style="font-size:11px"><a href="${esc(d.doc)}" target="_blank" rel="noopener">Documentation constructeur ↗</a></p>`;
    if (isRack(d)) {
      const kids = project.devices.filter((k) => k.parent === d.id);
      h += `<h3>Contenu (${kids.length})</h3>` + (kids.length ? '<ul>' + kids.map((k) => `<li>${esc(k.name)} <span class="muted">${esc(k.model)}</span></li>`).join('') + '</ul>' : '<p class="muted">Glissez des appareils dans la baie.</p>');
    } else {
      h += `<h3>Ports (${d.ports.length})</h3>
        <div class="row" style="flex-wrap:wrap;margin-bottom:4px"><span class="muted" style="font-size:11px">Côté des ports :</span>
          <button data-allside="L" title="Tous les ports à gauche">⇤ Tous à gauche</button><button data-allside="R" title="Tous les ports à droite">Tous à droite ⇥</button><button data-allside="" title="Entrées à gauche, sorties à droite">Auto</button>
          <button id="iMirror" title="Inverser gauche et droite (y compris les ports traversants)">⇆ Retourner${d.mirror ? ' ✓' : ''}</button></div>
        <table class="port-table"><tr><th>Nom</th><th>Conn.</th><th>Signal</th><th>Sens</th><th title="Côté du périphérique où se trouve le port">Côté</th><th title="Traversant (brassage)">⇄</th><th></th></tr>` +
        d.ports.map((p) => `<tr data-pid="${p.id}"><td><input data-k="name" value="${esc(p.name)}"></td>
          <td><select data-k="conn">${opt(L.CONNECTORS, p.conn)}</select></td>
          <td><select data-k="sig">${opt(project.signals, p.sig, (x) => x.name, (x) => x.id)}</select></td>
          <td><select data-k="dir">${opt(DIRS, p.dir, (x) => x[1], (x) => x[0])}</select></td>
          <td>${p.pass ? '<span class="muted" title="Port traversant : des deux côtés">G+D</span>' : `<select data-k="side">${opt(SIDES, p.side || '', (x) => x[1], (x) => x[0])}</select>`}</td>
          <td><input type="checkbox" data-k="pass" ${p.pass ? 'checked' : ''}></td>
          <td><button class="danger" data-del="${p.id}" title="Supprimer le port">×</button></td></tr>`).join('') + '</table>' +
        `<div class="field" style="margin-top:6px"><label>Ajouter des ports (ex : <code>4 x DMX ; XLR5F ; dmx ; out</code>)</label><input id="iAddPorts" placeholder="quantité x nom ; connecteur ; signal ; sens"></div>`;
    }
    h += `<div class="row" style="flex-wrap:wrap;margin-top:8px">
      ${isRack(d) ? '' : '<button id="iDetail">Détail des ports</button><button id="iDup">Dupliquer</button><button id="iSaveTpl">→ Modèle</button>'}
      <button id="iDel" class="danger">Supprimer</button></div>`;
    box.innerHTML = h;

    $('#iName').oninput = (e) => { d.name = e.target.value; save(); renderCanvas(); };
    $('#iName').onchange = () => renderInspector();
    $('#iRoom').onchange = (e) => {
      d.room = e.target.value || null;
      if (isRack(d)) project.devices.forEach((k) => { if (k.parent === d.id) k.room = d.room; });
      commit({ keepSide: true });
    };
    $('#iNotes').oninput = (e) => { d.notes = e.target.value; save(); };
    if ($('#iAddr')) {
      const upd = (k) => (e) => { d.dmx = d.dmx || {}; d.dmx[k] = e.target.value.trim(); save(); renderCanvas(); };
      $('#iUniv').oninput = upd('univ'); $('#iAddr').oninput = upd('addr'); $('#iCh').oninput = upd('ch'); $('#iMode').oninput = upd('mode');
      ['#iUniv', '#iAddr', '#iCh', '#iMode'].forEach((id) => { $(id).onchange = () => renderInspector(); });
    }
    if ($('#iIp')) {
      $('#iIp').oninput = (e) => { d.ip = e.target.value.trim(); save(); renderCanvas(); };
      $('#iCfg').oninput = (e) => { d.configUrl = e.target.value.trim(); save(); };
      $('#iOpen').onclick = () => { if (d.ip || d.configUrl) window.open(configUrl(d), '_blank', 'noopener'); else notify('Renseignez d\'abord l\'adresse IP.'); };
    }
    if ($('#iLink')) {
      $('#iLink').onclick = () => {
        const hub = devById($('#iHub').value);
        if (!hub) { notify('Choisissez une baie.'); return; }
        const r = linkToHub(d, hub);
        commit();
        const parts = [];
        if (r.made) parts.push(`${r.made} liaison(s) créée(s)`);
        if (r.created) parts.push(`${r.created} port(s) ajouté(s) à la baie`);
        if (r.already) parts.push(`${r.already} déjà raccordé(s)`);
        if (r.blocked) parts.push(`${r.blocked} port(s) occupé(s) des deux côtés`);
        flash(parts.length ? parts.join(', ') + '.' : 'Aucun port à raccorder.');
      };
    }
    $('#iDel').onclick = () => confirmBox('Supprimer « ' + d.name + ' » et ses câbles ?', () => deleteDevice(d.id), 'Supprimer');
    if (isRack(d)) return;
    $('#iParent').onchange = (e) => {
      d.parent = e.target.value || null;
      const r = devById(d.parent);
      if (r) { d.x = r.x + 20; d.y = r.y + 40 + project.devices.filter((k) => k.parent === r.id && k !== d).length * 30; if (r.room) d.room = r.room; }
      commit();
    };
    if ($('#iLock')) $('#iLock').onchange = (e) => { d.lock = e.target.checked; commit(); };
    // côté de tous les ports d'un coup, ou périphérique retourné en miroir
    $$('[data-allside]', box).forEach((b) => {
      b.onclick = () => {
        const s = b.dataset.allside;
        let msg = '';
        d.ports.forEach((p) => { if (p.pass) return; if (s) p.side = s; else delete p.side; msg = reconcilePort(d, p) || msg; });
        commit(); if (msg) flash(msg);
      };
    });
    if ($('#iMirror')) $('#iMirror').onclick = () => { d.mirror = !d.mirror; commit(); };
    $$('.port-table [data-k]', box).forEach((inp) => {
      inp.onchange = () => {
        const p = portOf(d, inp.closest('tr').dataset.pid); const k = inp.dataset.k;
        p[k] = k === 'pass' ? inp.checked : inp.value;
        if (k === 'side' && !p.side) delete p.side;
        let msg = '';
        if (k === 'dir' || k === 'pass' || k === 'side') msg = reconcilePort(d, p);
        if (k === 'conn') msg = syncFixedConn(d, p);
        commit();
        if (msg) flash(msg);
      };
    });
    $$('[data-del]', box).forEach((b) => {
      b.onclick = () => {
        const pid = b.dataset.del; d.ports = d.ports.filter((p) => p.id !== pid);
        // les câbles de ce port restent visibles en bout libre (supprimables d'un clic sur ×)
        commit();
      };
    });
    $('#iAddPorts').onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      try { parseQuickPorts(e.target.value).forEach((p) => d.ports.push(Object.assign({ id: uid() }, p))); commit(); }
      catch (err) { notify(err.message); }
    };
    $('#iDetail').onclick = () => portDetailModal(d.id);
    $('#iDup').onclick = () => {
      const c = clone(d); c.id = uid(); c.x += 30; c.y += 30; c.name = d.name + ' (copie)'; c.ports.forEach((p) => { p.id = uid(); });
      if (c.dmx && dmxOf(d).addr) { c.dmx.addr = String(dmxOf(d).end + 1); if (!c.dmx.univ && dmxOf(d).univ) c.dmx.univ = dmxOf(d).univ; }   // patch à la suite, même univers
      project.devices.push(c); ui.selected = { type: 'device', id: c.id }; commit();
    };
    $('#iSaveTpl').onclick = () => templateModal({ maker: d.maker, model: d.model + ' (perso)', cat: d.cat, doc: d.doc, ports: d.ports });
  }

  // XLR5M ↔ XLR5F : sur une liaison fixe, les deux bouts sont de genre opposé
  function complementConn(conn) {
    const m = /^XLR(\d)([FM])$/.exec(conn);
    return m ? 'XLR' + m[1] + (m[2] === 'F' ? 'M' : 'F') : conn;
  }
  // Quand on change le connecteur d'un port relié en liaison fixe, l'autre bout suit automatiquement
  function syncFixedConn(dev, p) {
    let n = 0;
    project.cables.forEach((c) => {
      if (!c.infra) return;
      const mine = c.a.d === dev.id && c.a.p === p.id ? 'a' : c.b.d === dev.id && c.b.p === p.id ? 'b' : null;
      if (!mine) return;
      const o = c[mine === 'a' ? 'b' : 'a'];
      const op = portOf(devById(o.d), o.p);
      if (op && op.conn !== complementConn(p.conn)) { op.conn = complementConn(p.conn); n++; }
    });
    return n ? `Liaison fixe : l'autre bout passe en ${complementConn(p.conn)}.` : '';
  }

  // Après un changement de sens ou de côté d'un port : le câble suit le nouveau côté s'il reste cohérent,
  // sinon (sortie → sortie, entrée → entrée) il reste en bout libre depuis l'autre appareil.
  function reconcilePort(dev, p) {
    let loose = 0;
    project.cables.forEach((c) => {
      ['a', 'b'].forEach((k) => {
        const e = c[k];
        if (e.d !== dev.id || e.p !== p.id || p.pass) return;
        const o = c[k === 'a' ? 'b' : 'a'];
        const op = portOf(devById(o.d), o.p);
        const clash = op && !op.pass && op.dir === p.dir && p.dir !== 'io';
        if (clash) { e.off = true; loose++; return; }
        delete e.off;
        const ns = defaultSide(p);
        if (e.s === ns) return;
        if (!endUsed({ d: e.d, p: e.p, s: ns }, c.id)) e.s = ns; else { e.off = true; loose++; }
      });
    });
    return loose ? `${loose} câble(s) débranché(s) : ils restent visibles en bout libre (× pour supprimer).` : '';
  }

  // Relie TOUS les ports d'un boîtier (arrière = gauche) à la baie scéno (arrivées = droite).
  // Une baie (rack) cible : on utilise les panneaux de brassage qu'elle contient, ou on y crée un répartiteur verrouillé.
  function linkToHub(box, hub) {
    const res = { made: 0, created: 0, already: 0, blocked: 0 };
    if (hub.id === box.id) return res;
    let targets = isRack(hub) ? project.devices.filter((k) => k.parent === hub.id && k.cat === 'patch' && k.id !== box.id) : [hub];
    if (!targets.length) {
      const rep = instantiate(tplById('baie-sceno'), hub.x + 20, hub.y + 40);
      rep.name = 'Répartiteur ' + hub.name; rep.parent = hub.id; rep.room = hub.room; rep.lock = true;
      project.devices.push(rep); targets = [rep];
    }
    const cablesAt = (dev, p, side) => project.cables.filter((c) => ['a', 'b'].some((k) => c[k].d === dev.id && c[k].p === p.id && c[k].s === side));
    box.ports.forEach((p) => {
      // un port de boîtier mural est traversant : arrière (liaison) à gauche, face à droite
      if (!p.pass) {
        p.pass = true; p.dir = 'io';
        project.cables.forEach((c) => ['a', 'b'].forEach((k) => { if (c[k].d === box.id && c[k].p === p.id) c[k].s = 'R'; }));
      }
      const back = cablesAt(box, p, 'L');
      if (back.some((c) => c.infra)) { res.already++; return; }
      if (back.length) {
        // câble volant branché à l'arrière : on le passe en face avant si elle est libre
        if (cablesAt(box, p, 'R').length) { res.blocked++; return; }
        back.forEach((c) => ['a', 'b'].forEach((k) => { if (c[k].d === box.id && c[k].p === p.id) c[k].s = 'R'; }));
      }
      const want = complementConn(p.conn);
      let tdev = null, tp = null;
      for (const dv of targets) {
        tp = dv.ports.find((q) => q.sig === p.sig && q.pass && q.conn === want && !cablesAt(dv, q, 'R').length);
        if (tp) { tdev = dv; break; }
      }
      if (!tp) {
        tdev = targets[0];
        tp = { id: uid(), name: box.name + ' – ' + p.name, conn: want, sig: p.sig, dir: 'io', pass: true };
        tdev.ports.push(tp); res.created++;
      }
      project.cables.push({ id: uid(), a: { d: box.id, p: p.id, s: 'L' }, b: { d: tdev.id, p: tp.id, s: 'R' }, sig: p.sig, sub: null, label: '', length: '', infra: true });
      res.made++;
    });
    return res;
  }

  // Liaison (faisceau) : renommer, déplacer le tracé, retirer des câbles, dégrouper, supprimer
  function inspectBundle(box, key) {
    const cs = project.cables.filter((c) => groupKeyOf(c) === key);
    if (cs.length < 2) { ui.selected = null; renderInspector(); return; }
    const info = groupInfo(key);
    const devs = [...new Set(cs.flatMap((c) => [c.a.d, c.b.d]))].map(devById).filter(Boolean);
    box.innerHTML = `<h2>${key.startsWith('g:') ? 'Liaison regroupée' : key.startsWith('v:') ? 'Câbles regroupés (vue simplifiée)' : 'Liaison fixe'}</h2>
      <div class="field"><label>Nom de la liaison</label><input id="bName" value="${esc(info.name || '')}" placeholder="${esc(bundleAutoName(cs) || 'ex : Multipaire mur cour')}"></div>
      <p>${devs.map((x) => '<b>' + esc(x.name) + '</b>').join(' ↔ ')}</p>
      <p>${esc(bundleSummary(cs))}</p>
      <table class="port-table"><tr><th>De</th><th>Vers</th><th>Réseau</th><th></th></tr>${cs.map((c) => {
        const pa = portOf(devById(c.a.d), c.a.p), pb = portOf(devById(c.b.d), c.b.p), n = subnetOf(c);
        return `<tr data-cid="${c.id}" style="cursor:pointer"><td>${esc(pa.name)} <span class="muted">${esc(pa.conn)}</span></td><td>${esc(pb.name)} <span class="muted">${esc(pb.conn)}</span></td><td><span class="swatch" style="background:${cableColor(c)}"></span> ${esc(n ? n.name : sigById(c.sig).name)}</td>
          <td><button data-out="${c.id}" title="Retirer ce câble de la liaison">↗</button></td></tr>`;
      }).join('')}</table>
      <p class="muted" style="font-size:11px">Cliquez une ligne pour régler le câble. Glissez la poignée ○ du faisceau pour le déplacer (double-clic : tracé droit). Maj+clic sur d'autres câbles pour les ajouter.</p>
      <div class="row" style="flex-wrap:wrap"><button id="bReset">Tracé droit</button><button id="bUngroup">Dégrouper</button><button id="bDel" class="danger">Supprimer la liaison</button></div>`;
    $('#bName').oninput = (e) => { info.name = e.target.value; save(); renderCanvas(); };
    $$('[data-cid]', box).forEach((tr) => { tr.onclick = (e) => { if (!e.target.dataset.out) select({ type: 'cable', id: tr.dataset.cid }); }; });
    $$('[data-out]', box).forEach((b) => {
      b.onclick = () => { const c = cs.find((x) => x.id === b.dataset.out); c.group = null; c.ungrouped = true; commit(); };
    });
    $('#bReset').onclick = () => { delete info.via; commit({ keepSide: true }); };
    $('#bUngroup').onclick = () => { cs.forEach((c) => { c.group = null; c.ungrouped = true; }); ui.selected = null; commit(); flash('Liaison dégroupée : Maj+clic sur plusieurs câbles pour les regrouper.'); };
    $('#bDel').onclick = () => confirmBox(`Supprimer les ${cs.length} câbles de cette liaison ?`, () => {
      const ids = new Set(cs.map((c) => c.id)); project.cables = project.cables.filter((c) => !ids.has(c.id)); ui.selected = null; commit();
    }, 'Supprimer');
  }

  // Sélection multiple (Maj+clic) : regrouper en une liaison, ou supprimer
  function inspectMulti(box) {
    const cs = project.cables.filter((c) => ui.multi.has(c.id));
    box.innerHTML = `<h2>${cs.length} câble(s) sélectionné(s)</h2>
      <p>${esc(bundleSummary(cs))}</p>
      <div class="field"><label>Nom de la liaison</label><input id="mName" placeholder="ex : Multipaire mur cour"></div>
      <div class="row" style="flex-wrap:wrap"><button class="primary" id="mGroup" ${cs.length < 2 ? 'disabled' : ''}>Regrouper en une liaison</button><button id="mClear">Désélectionner</button><button id="mDel" class="danger">Supprimer</button></div>
      <p class="muted" style="font-size:11px">Maj+clic sur un câble ou un faisceau pour l'ajouter / le retirer de la sélection.</p>`;
    $('#mGroup').onclick = () => {
      const g = uid();
      cs.forEach((c) => { c.group = g; c.ungrouped = false; });
      groupInfo('g:' + g).name = $('#mName').value.trim();
      ui.multi.clear(); ui.selected = { type: 'bundle', id: 'g:' + g };
      if (!ui.bundle) { ui.bundle = true; $('#showBundles').checked = true; }
      commit();
    };
    $('#mClear').onclick = () => select(null);
    $('#mDel').onclick = () => confirmBox(`Supprimer ${cs.length} câble(s) ?`, () => {
      project.cables = project.cables.filter((c) => !ui.multi.has(c.id)); ui.multi.clear(); commit();
    }, 'Supprimer');
  }

  // Câble dont une extrémité n'est plus valide
  function inspectLoose(box, c) {
    const good = endValid(c.a) ? c.a : c.b, bad = good === c.a ? c.b : c.a;
    const gd = devById(good.d), gp = portOf(gd, good.p);
    const bd = devById(bad.d), bp = portOf(bd, bad.p);
    box.innerHTML = `<h2>Câble débranché</h2>
      <p>Toujours branché sur <b>${esc(gd.name)}</b> · ${esc(gp.name)}.</p>
      <p class="muted">Était relié à ${bd ? '<b>' + esc(bd.name) + '</b>' : 'un appareil supprimé'}${bp ? ' · ' + esc(bp.name) + ' (le sens du port a changé)' : ' (port supprimé)'}.</p>
      <div class="row" style="flex-wrap:wrap"><button class="primary" id="lReplug">Rebrancher ailleurs…</button><button id="lDel" class="danger">Supprimer le câble</button></div>
      <p class="muted" style="font-size:11px">« Rebrancher » garde le repère, l'univers / VLAN et la longueur : cliquez ensuite le nouveau port.</p>`;
    $('#lDel').onclick = () => deleteCable(c.id);
    $('#lReplug').onclick = () => {
      ui.carry = { sub: c.sub, label: c.label, length: c.length, infra: c.infra, adapter: c.adapter };
      project.cables = project.cables.filter((x) => x.id !== c.id);
      ui.selected = null; ui.pending = { d: good.d, p: good.p, s: good.s };
      commit(); flash('Cliquez le port où rebrancher ce câble (Échap pour annuler).');
    };
  }

  function inspectCable(box, c) {
    if (!c) { box.innerHTML = ''; return; }
    if (cableLoose(c)) return inspectLoose(box, c);
    const da = devById(c.a.d), db = devById(c.b.d), pa = portOf(da, c.a.p), pb = portOf(db, c.b.p);
    const sig = sigById(c.sig);
    const mismatch = pa.sig !== pb.sig;
    const issue = cableAdapterIssue(c);
    box.innerHTML = `<h2>Câble</h2>
      <p><b>${esc(da.name)}</b> · ${esc(pa.name)} <span class="muted">(${esc(pa.conn)})</span><br>→ <b>${esc(db.name)}</b> · ${esc(pb.name)} <span class="muted">(${esc(pb.conn)})</span></p>
      ${mismatch ? '<p style="color:#d32f2f">⚠︎ Types de signaux différents aux deux extrémités (' + esc(sigById(pa.sig).name) + ' / ' + esc(sigById(pb.sig).name) + ').</p>' : ''}
      ${issue && issue.kind === 'impossible' ? `<div class="valbox bad">⛔ <b>Connexion impossible</b> : ${esc(pa.conn)} ↔ ${esc(pb.conn)}. ${esc(issue.why)} Rebranchez ce câble sur un port compatible ou supprimez-le.</div>` : ''}
      ${issue && issue.kind !== 'impossible' && !c.adapter ? `<p style="color:#e65100">⚠︎ ${esc(pa.conn)} → ${esc(pb.conn)} : il faut un ${esc(issue.label.charAt(0).toLowerCase() + issue.label.slice(1))}.</p>` : ''}
      ${(issue && issue.kind !== 'impossible') || c.adapter ? `<div class="field"><label>Inverseur / adaptateur en place</label><div class="row"><input id="cAdapter" class="grow" value="${esc(c.adapter || '')}" placeholder="aucun">${issue && issue.kind !== 'impossible' && !c.adapter ? `<button id="cAdapterYes">Oui, mis</button>` : ''}</div></div>` : ''}
      <div class="field"><label>Type de réseau</label>
        <div class="row"><select id="cSig" class="grow">${opt(project.signals, c.sig, (x) => x.name, (x) => x.id)}</select><button id="cNewSig" title="Nouveau type de réseau">+</button></div>
        <div id="cSigForm" class="row" hidden><input type="color" id="cSigColor" value="${randomColor()}"><input id="cSigName" class="grow" placeholder="Nom (ex : Intercom)"><input id="cSigSub" style="width:80px" placeholder="Univers, Canal…"><button id="cSigOk" class="primary">OK</button></div></div>
      <div class="field"><label>${esc(sig.subLabel || 'Sous-réseau')}</label>
        <div class="row"><select id="cSub" class="grow"><option value="">— (couleur du réseau)</option>${opt(sig.subnets || [], c.sub, (x) => x.name, (x) => x.id)}</select><button id="cNewSub" title="Nouveau ${esc(sig.subLabel || 'sous-réseau')}">+</button></div>
        <div id="cSubForm" class="row" hidden><input type="color" id="cSubColor" value="${randomColor()}"><input id="cSubName" class="grow" value="${esc((sig.subLabel || 'Sous-réseau') + ' ' + ((sig.subnets || []).length + 1))}"><button id="cSubOk" class="primary">OK</button></div></div>
      <div class="row"><label class="chk"><input type="checkbox" id="cProp" checked> Propager en aval (même réseau)</label></div>
      <div class="row"><label class="chk"><input type="checkbox" id="cInfra" ${c.infra ? 'checked' : ''}> Liaison fixe (câblage d'installation, regroupé en faisceau)</label></div>
      <div class="field"><label>Repère câble</label><input id="cLabel" value="${esc(c.label)}" placeholder="${esc(autoLabel(c) || 'ex : DMX-R01')}" title="Vide = nom automatique départ – arrivée pour une liaison fixe"></div>
      <div class="field"><label>Longueur (m)</label><input id="cLen" value="${esc(c.length)}"></div>
      <div class="row" style="flex-wrap:wrap"><button id="cSwap">Inverser le sens</button>${c.via ? '<button id="cReset">Tracé droit</button>' : ''}<button id="cDel" class="danger">Supprimer</button></div>
      <p class="muted" style="font-size:11px">Glissez la poignée ○ pour déplacer le tracé. Maj+clic sur d'autres câbles pour les regrouper en une liaison.</p>`;
    if ($('#cAdapter')) $('#cAdapter').oninput = (e) => { c.adapter = e.target.value; save(); renderCanvas(); };
    if ($('#cAdapterYes')) $('#cAdapterYes').onclick = () => { c.adapter = issue.label; commit({ keepSide: true }); renderInspector(); };
    if ($('#cReset')) $('#cReset').onclick = () => { delete c.via; commit(); };
    $('#cSig').onchange = (e) => { c.sig = e.target.value; c.sub = null; commit(); };
    $('#cInfra').onchange = (e) => { c.infra = e.target.checked; commit({ keepSide: true }); };
    $('#cSub').onchange = (e) => { setSubnet(c, e.target.value || null, $('#cProp').checked); commit({ keepSide: true }); };
    // Création en ligne (sans fenêtre prompt(), bloquée dans certains navigateurs)
    const toggle = (formId, focusId) => { const f = $(formId); f.hidden = !f.hidden; if (!f.hidden) { $(focusId).focus(); $(focusId).select(); } };
    const onEnter = (inputs, btn) => inputs.forEach((id) => { $(id).onkeydown = (e) => { if (e.key === 'Enter') $(btn).click(); if (e.key === 'Escape') $(btn).closest('.row').hidden = true; }; });
    $('#cNewSub').onclick = () => toggle('#cSubForm', '#cSubName');
    $('#cSubOk').onclick = () => {
      const name = $('#cSubName').value.trim(); if (!name) return;
      const n = { id: uid(), name, color: $('#cSubColor').value }; sig.subnets = sig.subnets || []; sig.subnets.push(n);
      setSubnet(c, n.id, $('#cProp').checked); commit();
    };
    onEnter(['#cSubName'], '#cSubOk');
    $('#cNewSig').onclick = () => toggle('#cSigForm', '#cSigName');
    $('#cSigOk').onclick = () => {
      const name = $('#cSigName').value.trim(); if (!name) return;
      const s = { id: 'sig-' + uid(), name, color: $('#cSigColor').value, subLabel: $('#cSigSub').value.trim(), subnets: [] };
      project.signals.push(s); c.sig = s.id; c.sub = null; commit();
    };
    onEnter(['#cSigName', '#cSigSub'], '#cSigOk');
    $('#cLabel').oninput = (e) => { c.label = e.target.value; save(); renderCanvas(); };
    $('#cLen').oninput = (e) => { c.length = e.target.value; save(); };
    $('#cSwap').onclick = () => { const t = c.a; c.a = c.b; c.b = t; commit(); };
    $('#cDel').onclick = () => deleteCable(c.id);
  }

  // Attribue un sous-réseau à un câble et le propage dans toute la chaîne en aval
  // (ex : Univers 1 sur la sortie console → splitter → projecteurs).
  function setSubnet(cable, sub, propagate) {
    cable.sub = sub;
    if (!propagate) return;
    const seen = new Set([cable.id]); const queue = [cable];
    while (queue.length) {
      const c = queue.shift();
      const dev = devById(c.b.d); const port = portOf(dev, c.b.p);
      let next;
      if (port && port.pass) {
        // brassage : le signal ressort par l'autre côté du même port
        const other = c.b.s === 'L' ? 'R' : 'L';
        next = project.cables.filter((x) => (x.a.d === dev.id && x.a.p === port.id && x.a.s === other) || (x.b.d === dev.id && x.b.p === port.id && x.b.s === other));
        next.forEach((x) => { if (x.b.d === dev.id && x.b.p === port.id) { const t = x.a; x.a = x.b; x.b = t; } });
      } else {
        // appareil (splitter, projecteur thru…) : tous les câbles sortants du même type
        next = project.cables.filter((x) => x.a.d === c.b.d && x.sig === c.sig);
      }
      next.forEach((x) => { if (!seen.has(x.id)) { seen.add(x.id); x.sub = sub; queue.push(x); } });
    }
  }

  function randomColor() { return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); }

  function statsHtml() {
    if (!project.devices.length) return '';
    const issues = project.cables.map((c) => ({ c, is: cableAdapterIssue(c) })).filter((x) => x.is);
    const nBad = issues.filter((x) => x.is.kind === 'impossible').length, nWarn = issues.filter((x) => x.is.kind !== 'impossible' && !x.c.adapter).length;
    const nDmx = dmxConflicts().size;
    const dmxCheck = nDmx ? `<div class="valbox bad"><button data-nextissue="dmx">⚠ ${nDmx} projecteur(s) en conflit d'adresse DMX</button></div>` : '';
    const check = dmxCheck + (nBad || nWarn
      ? `<div class="valbox ${nBad ? 'bad' : 'warn'}">${nBad ? `<button data-nextissue="bad">⛔ ${nBad} connexion(s) impossible(s)</button>` : ''}${nWarn ? `<button data-nextissue="warn">⚠︎ ${nWarn} adaptateur(s) à confirmer</button>` : ''}</div>`
      : project.cables.length ? '<div class="valbox ok">✓ Toutes les connexions sont compatibles</div>' : '');
    return `<h3>Projet</h3><p>${project.devices.length} appareils · ${project.cables.length} câbles · ${project.rooms.length} zones</p>${check}
      <p class="muted" style="font-size:11px">Astuce : sélectionnez un câble pour lui attribuer un univers / VLAN ; la couleur se propage en aval.</p>`;
  }

  // ---------------------------------------------------------------- saisie rapide de ports
  // Format : "quantité x nom ; connecteur ; signal ; sens [; A] [; pass]"   (une ligne par groupe)
  function parseQuickPorts(textIn) {
    const out = [];
    textIn.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).forEach((line) => {
      const parts = line.split(';').map((x) => x.trim());
      const m = parts[0].match(/^(\d+)\s*[x×]\s*(.+)$/i);
      const count = m ? parseInt(m[1], 10) : 1;
      const name = m ? m[2] : parts[0];
      const conn = parts[1] || 'Autre';
      const sigIn = (parts[2] || 'eth').toLowerCase();
      const sig = (project.signals.find((s) => s.id === sigIn || s.name.toLowerCase().startsWith(sigIn)) || {}).id;
      if (!sig) throw new Error('Signal inconnu : « ' + parts[2] + ' » (ligne : ' + line + ')');
      const dirRaw = (parts[3] || 'io').toLowerCase();
      const dir = /^(in|e)/.test(dirRaw) ? 'in' : /^(out|s)/.test(dirRaw) ? 'out' : 'io';
      const flags = parts.slice(4).map((x) => x.toLowerCase());
      const gen = L.portGen(name, count, conn, sig, dir, { letters: flags.includes('a'), pass: flags.includes('pass') });
      out.push(...gen);
    });
    return out;
  }

  // ---------------------------------------------------------------- modales
  function openModal(html) { $('#modalBox').innerHTML = html; $('#modal').classList.remove('hidden'); }
  // Remplacent confirm()/alert(), bloqués dans certains navigateurs intégrés
  function confirmBox(msg, onYes, yesLabel) {
    openModal(`<p style="font-size:14px">${esc(msg)}</p><div class="modal-actions"><button id="cbNo">Annuler</button><button class="primary danger" id="cbYes">${esc(yesLabel || 'Confirmer')}</button></div>`);
    $('#cbNo').onclick = closeModal;
    $('#cbYes').onclick = () => { closeModal(); onYes(); };
  }
  function notify(msg) { if (!$('#modal').classList.contains('hidden')) { const p = document.createElement('p'); p.style.color = '#d32f2f'; p.textContent = '⚠︎ ' + msg; $('#modalBox').appendChild(p); } else flash(msg); }
  function closeModal() { $('#modal').classList.add('hidden'); }
  $('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') closeModal(); });

  function portDetailModal(devId) {
    const d = devById(devId); if (!d) return;
    const rows = d.ports.map((p) => {
      const cs = project.cables.filter((c) => (c.a.d === d.id && c.a.p === p.id) || (c.b.d === d.id && c.b.p === p.id));
      const links = cs.map((c) => {
        const o = c.a.d === d.id && c.a.p === p.id ? c.b : c.a; const od = devById(o.d), op = portOf(od, o.p); const n = subnetOf(c);
        return `${p.pass ? '<span class="muted">[' + (c.a.d === d.id && c.a.p === p.id ? c.a.s : c.b.s) + ']</span> ' : ''}→ <b>${esc(od.name)}</b> · ${esc(op.name)}${n ? ` <span class="swatch" style="background:${n.color}"></span> ${esc(n.name)}` : ''}${cableLabel(c) ? ' <span class="muted">(' + esc(cableLabel(c)) + ')</span>' : ''}`;
      }).join('<br>');
      const s = sigById(p.sig);
      return `<tr><td>${esc(p.name)}</td><td>${esc(p.conn)}</td><td><span class="swatch" style="background:${s.color}"></span> ${esc(s.name)}</td><td>${{ in: 'Entrée', out: 'Sortie', io: 'Bidir.' }[p.dir]}${p.pass ? ' ⇄' : ''}</td><td>${links || '<span class="muted">libre</span>'}</td></tr>`;
    }).join('');
    const used = d.ports.filter((p) => _conn.has(d.id + ':' + p.id)).length;
    openModal(`<h2>${esc(d.name)} <span class="muted" style="font-weight:400">— ${esc(d.maker)} ${esc(d.model)}</span></h2>
      <p>${d.ports.length} ports · ${used} utilisés · ${d.ports.length - used} libres ${d.doc ? ` · <a href="${esc(d.doc)}" target="_blank" rel="noopener">doc ↗</a>` : ''}</p>
      <table><tr><th>Port</th><th>Connecteur</th><th>Réseau</th><th>Sens</th><th>Connecté à</th></tr>${rows}</table>
      <div class="modal-actions"><button onclick="document.getElementById('modal').classList.add('hidden')">Fermer</button></div>`);
  }

  function networksModal() {
    const render = () => {
      const html = project.signals.map((s, i) => `<div class="net-block" data-i="${i}">
        <div class="row"><input type="color" data-f="color" value="${s.color}"><input class="grow" data-f="name" value="${esc(s.name)}">
          <label class="muted">Sous-réseaux :</label><input data-f="subLabel" value="${esc(s.subLabel || '')}" style="width:90px" placeholder="Univers, VLAN…"></div>
        <div class="subnets">${(s.subnets || []).map((n, j) => `<div class="row" data-j="${j}"><input type="color" data-sf="color" value="${n.color}"><input class="grow" data-sf="name" value="${esc(n.name)}"><span class="muted">${project.cables.filter((c) => c.sig === s.id && c.sub === n.id).length} câbles</span><button class="danger" data-sdel>×</button></div>`).join('')}
          <button data-sadd>+ ${esc(s.subLabel || 'Sous-réseau')}</button></div></div>`).join('');
      openModal(`<h2>Réseaux &amp; câbles</h2><p class="muted">Chaque type de réseau a sa couleur ; chaque sous-réseau (univers DMX, VLAN, ligne…) peut avoir la sienne. Les câbles prennent la couleur du sous-réseau qui leur est attribué.</p>${html}
        <div class="modal-actions"><button id="nCharte" title="Remet la couleur de chaque type de réseau selon la charte TRAME (les sous-réseaux ne changent pas)">Couleurs de la charte TRAME</button><button id="nAdd">+ Type de réseau</button><button class="primary" id="nClose">Fermer</button></div>`);
      $('#nCharte').onclick = () => { project.signals.forEach((sg) => { const d = L.SIGNALS.find((x) => x.id === sg.id); if (d) sg.color = d.color; }); save(); renderAll(); render(); };
      $$('.net-block').forEach((b) => {
        const s = project.signals[+b.dataset.i];
        $$('[data-f]', b).forEach((inp) => { inp.oninput = () => { s[inp.dataset.f] = inp.value; save(); renderCanvas(); renderFilters(); }; });
        $$('[data-j]', b).forEach((r) => {
          const n = s.subnets[+r.dataset.j];
          $$('[data-sf]', r).forEach((inp) => { inp.oninput = () => { n[inp.dataset.sf] = inp.value; save(); renderCanvas(); }; });
          $('[data-sdel]', r).onclick = () => { s.subnets = s.subnets.filter((x) => x !== n); project.cables.forEach((c) => { if (c.sub === n.id) c.sub = null; }); save(); renderCanvas(); render(); };
        });
        $('[data-sadd]', b).onclick = () => { s.subnets = s.subnets || []; s.subnets.push({ id: uid(), name: (s.subLabel || 'Sous-réseau') + ' ' + (s.subnets.length + 1), color: randomColor() }); save(); render(); };
      });
      $('#nAdd').onclick = () => { project.signals.push({ id: 'sig-' + uid(), name: 'Nouveau réseau', color: randomColor(), subLabel: '', subnets: [] }); save(); render(); renderFilters(); };
      $('#nClose').onclick = () => { closeModal(); renderAll(); };
    };
    render();
  }

  function templateModal(seed) {
    seed = seed || {};
    const quick = (seed.ports || []).map((p) => `${p.name} ; ${p.conn} ; ${p.sig} ; ${p.dir}${p.pass ? ' ; ; pass' : ''}`).join('\n');
    openModal(`<h2>Créer un appareil</h2>
      <div class="row"><div class="field grow"><label>Marque</label><input id="tMaker" value="${esc(seed.maker || '')}"></div>
        <div class="field grow"><label>Modèle</label><input id="tModel" value="${esc(seed.model || '')}"></div>
        <div class="field"><label>Catégorie</label><select id="tCat">${opt(L.CATEGORIES.filter((c) => c.id !== 'custom'), seed.cat || 'node', (c) => c.name, (c) => c.id)}</select></div></div>
      <div class="field"><label>Lien vers la documentation</label><input id="tDoc" value="${esc(seed.doc || '')}" placeholder="https://…"></div>
      ${seed.web ? `<p class="badge warn" style="display:block;padding:6px 8px;font-size:12px">Fiche générée par recherche web (confiance : ${esc(seed.confidence || '?')}). Relisez les ports avant d'enregistrer.</p>` : ''}
      ${seed.sources && seed.sources.length ? `<details><summary>Sources consultées (${seed.sources.length})</summary><ul style="font-size:11px">${seed.sources.slice(0, 12).map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`).join('')}</ul></details>` : ''}
      <div class="field"><label>Notes</label><textarea id="tNotes" rows="2">${esc(seed.notes || '')}</textarea></div>
      <div class="field"><label>Ports — une ligne par groupe : <code>quantité x nom ; connecteur ; signal ; sens [; A] [; pass]</code><br>
        signaux : ${project.signals.map((s) => '<code>' + esc(s.id) + '</code>').join(' ')} · sens : <code>in</code> <code>out</code> <code>io</code> · <code>A</code> = numérotation A,B,C · <code>pass</code> = port traversant (brassage)</label>
        <textarea id="tPorts" rows="12" placeholder="3 x Ethernet ; etherCON ; eth ; io&#10;6 x DMX ; XLR5F ; dmx ; out ; A&#10;DMX In ; XLR5M ; dmx ; in&#10;Alimentation ; powerCON TRUE1 ; power ; in">${esc(quick)}</textarea></div>
      <div id="tPreview" class="muted"></div>
      <details><summary>Ou coller un JSON d'appareil</summary><textarea id="tJson" rows="6" placeholder='{"maker":"…","model":"…","cat":"console","ports":[{"name":"DMX A","conn":"XLR5F","sig":"dmx","dir":"out"}]}'></textarea></details>
      <div class="modal-actions"><button id="tCancel">Annuler</button><button class="primary" id="tSave">Enregistrer dans la bibliothèque</button></div>`);
    const preview = () => { try { const p = parseQuickPorts($('#tPorts').value); $('#tPreview').textContent = p.length + ' ports : ' + p.slice(0, 12).map((x) => x.name).join(', ') + (p.length > 12 ? '…' : ''); } catch (e) { $('#tPreview').textContent = '⚠︎ ' + e.message; } };
    $('#tPorts').oninput = preview; preview();
    $('#tCancel').onclick = closeModal;
    $('#tSave').onclick = () => {
      let tpl;
      try {
        const js = $('#tJson').value.trim();
        if (js) {
          const o = JSON.parse(js);
          tpl = { maker: o.maker || 'Perso', model: o.model || 'Appareil', cat: o.cat || 'node', doc: o.doc || '', notes: o.notes || '', ports: (o.ports || []).map((p) => ({ name: p.name, conn: p.conn || 'Autre', sig: p.sig || 'eth', dir: p.dir || 'io', pass: !!p.pass })) };
        } else {
          tpl = { maker: $('#tMaker').value || 'Perso', model: $('#tModel').value || 'Appareil', cat: $('#tCat').value, doc: $('#tDoc').value, notes: $('#tNotes').value, ports: parseQuickPorts($('#tPorts').value) };
        }
      } catch (e) { notify(e.message); return; }
      tpl.id = 'custom-' + uid(); tpl.custom = true;
      if (seed.web) { tpl.web = true; tpl.sources = seed.sources || []; }
      project.customTemplates.push(tpl);
      closeModal(); commit();
    };
  }
  $('#btnNewTemplate').onclick = () => templateModal();

  // ---------------------------------------------------------------- import par recherche web (IA)
  const KEY_STORE = 'synoptique.anthropicKey';
  function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); } catch (e) { /* ignore */ } }

  function webSearchModal(prefill) {
    openModal(`<h2>Ajouter un appareil par recherche web</h2>
      <p class="muted">Tapez le nom de l'appareil : l'assistant cherche la documentation constructeur, lit la fiche technique et en tire la liste des ports. Vous relisez le résultat avant de l'ajouter à la bibliothèque.</p>
      <div class="field"><label>Appareil</label><input id="wQuery" value="${esc(prefill || '')}" placeholder="ex : grandMA3 compact XT, Luminex GigaCore 16Xt, Yamaha Rio3224-D2, Blackmagic ATEM 2 M/E…"></div>
      <div class="field"><label>Clé API Anthropic (enregistrée uniquement dans ce navigateur)</label>
        <div class="row"><input id="wKey" type="password" class="grow" value="${esc(getKey())}" placeholder="sk-ant-…" autocomplete="off"><button id="wForget" title="Effacer la clé enregistrée">Oublier</button></div></div>
      <div id="wLog" class="muted" style="font-size:12px;min-height:40px;white-space:pre-line"></div>
      <div class="modal-actions"><button id="wCancel">Fermer</button><button class="primary" id="wGo">Rechercher</button></div>`);
    const log = (m) => { $('#wLog').textContent += m + '\n'; };
    $('#wCancel').onclick = closeModal;
    $('#wForget').onclick = () => { setKey(''); $('#wKey').value = ''; };
    $('#wQuery').onkeydown = (e) => { if (e.key === 'Enter') $('#wGo').click(); };
    $('#wQuery').focus();
    $('#wGo').onclick = async () => {
      const q = $('#wQuery').value.trim(), key = $('#wKey').value.trim();
      if (!q) return;
      if (!key) { notify('Une clé API Anthropic est nécessaire pour la recherche web.'); return; }
      setKey(key);
      $('#wGo').disabled = true; $('#wLog').textContent = '';
      try {
        const res = await window.AIImport.searchDevice(q, key, { signals: project.signals, connectors: L.CONNECTORS, categories: L.CATEGORIES }, log);
        log('✓ ' + res.ports.length + ' ports trouvés.');
        templateModal(Object.assign({ web: true }, res));
      } catch (err) {
        log('⚠︎ ' + err.message);
        $('#wGo').disabled = false;
      }
    };
  }
  $('#btnWebSearch').onclick = () => webSearchModal($('#libSearch').value.trim());
  // Panneaux latéraux repliables (boutons sur les bords du synoptique, touches [ et ])
  const PANELS_KEY = 'synoptique.panels';
  let lastInspected = '';
  let autoRight = false;   // inspecteur ouvert automatiquement par une sélection (se referme à la désélection)
  function setPanels(left, right, auto) {
    if (!auto) autoRight = false;
    const m = $('.main');
    m.classList.toggle('hide-left', !left); m.classList.toggle('hide-right', !right);
    $('#toggleLeft').title = (left ? 'Replier' : 'Déplier') + ' la bibliothèque  [ [ ]';
    $('#toggleRight').title = (right ? 'Replier' : 'Déplier') + ' l\'inspecteur  [ ] ]';
    if (!auto) { try { localStorage.setItem(PANELS_KEY, JSON.stringify({ left, right })); } catch (e) { /* ignore */ } }
  }
  const panelsOpen = () => ({ left: !$('.main').classList.contains('hide-left'), right: !$('.main').classList.contains('hide-right') });
  $('#toggleLeft').onclick = () => { const p = panelsOpen(); setPanels(!p.left, p.right); };
  $('#toggleRight').onclick = () => { const p = panelsOpen(); setPanels(p.left, !p.right); };
  try { const p = JSON.parse(localStorage.getItem(PANELS_KEY) || 'null'); if (p) setPanels(p.left !== false, p.right !== false); } catch (e) { /* ignore */ }
  document.addEventListener('keydown', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (ev.key === '[') $('#toggleLeft').click();
    else if (ev.key === ']') $('#toggleRight').click();
  });
  // Menus déroulants de la barre du haut
  $$('.menu').forEach((m) => {
    $('.menu-btn', m).addEventListener('click', (ev) => { ev.stopPropagation(); const was = m.classList.contains('open'); $$('.menu.open').forEach((x) => x.classList.remove('open')); if (!was) m.classList.add('open'); });
    $$('.menu-panel > button', m).forEach((b) => b.addEventListener('click', () => m.classList.remove('open')));
  });
  document.addEventListener('click', (ev) => { if (!ev.target.closest('.menu')) $$('.menu.open').forEach((x) => x.classList.remove('open')); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') $$('.menu.open').forEach((x) => x.classList.remove('open')); });
  $('#btnNetworks').onclick = networksModal;

  // ---------------------------------------------------------------- vues tableau
  function endpointText(e) { const d = devById(e.d), p = portOf(d, e.p); return { dev: d ? d.name : '?', port: p ? p.name : '?', conn: p ? p.conn : '', room: d && roomById(d.room) ? roomById(d.room).name : '' }; }

  function cableRows() {
    return project.cables.map((c, i) => {
      const a = endpointText(c.a), b = endpointText(c.b), n = subnetOf(c);
      return { i: i + 1, c, a, b, sig: sigById(c.sig).name, sub: n ? n.name : '', color: cableColor(c) };
    }).sort((x, y) => x.sig.localeCompare(y.sig) || x.sub.localeCompare(y.sub));
  }

  function renderCablesTable() {
    const rows = cableRows();
    let lastSig = null;
    const body = rows.map((r) => {
      let g = '';
      if (r.sig !== lastSig) { lastSig = r.sig; g = `<tr class="group"><td colspan="10"><span class="swatch" style="background:${sigById(r.c.sig).color}"></span> ${esc(r.sig)}</td></tr>`; }
      return g + `<tr><td>${esc(cableLabel(r.c) || '#' + r.i)}</td><td>${r.c.infra ? 'Fixe' : 'Volant'}</td><td>${esc(r.a.room)}</td><td><b>${esc(r.a.dev)}</b></td><td>${esc(r.a.port)} <span class="muted">${esc(r.a.conn)}</span></td>
        <td>${esc(r.b.room)}</td><td><b>${esc(r.b.dev)}</b></td><td>${esc(r.b.port)} <span class="muted">${esc(r.b.conn)}</span></td>
        <td>${r.sub ? `<span class="swatch" style="background:${r.color}"></span> ${esc(r.sub)}` : ''}</td><td>${esc(r.c.length)}</td></tr>`;
    }).join('');
    $('#view-cables').innerHTML = `<div class="table-actions"><h2 style="margin:0">Liste des câbles</h2><span class="muted">${rows.length} câbles</span><div class="spacer"></div><button id="csvCables">Export CSV</button></div>
      <table><tr><th>Repère</th><th>Type</th><th>Zone</th><th>Origine</th><th>Port</th><th>Zone</th><th>Destination</th><th>Port</th><th>Sous-réseau</th><th>Long. (m)</th></tr>${body}</table>`;
    $('#csvCables').onclick = () => {
      const lines = [['Repère', 'Type', 'Réseau', 'Sous-réseau', 'Zone origine', 'Origine', 'Port origine', 'Connecteur origine', 'Zone dest.', 'Destination', 'Port dest.', 'Connecteur dest.', 'Longueur']]
        .concat(rows.map((r) => [cableLabel(r.c) || '#' + r.i, r.c.infra ? 'Fixe' : 'Volant', r.sig, r.sub, r.a.room, r.a.dev, r.a.port, r.a.conn, r.b.room, r.b.dev, r.b.port, r.b.conn, r.c.length]));
      download(project.name + ' - câbles.csv', '﻿' + lines.map((l) => l.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\n'), 'text/csv');
    };
  }

  function renderDevicesTable() {
    const groups = [{ id: null, name: 'Sans zone' }].concat(project.rooms);
    let body = '';
    groups.forEach((g) => {
      const ds = project.devices.filter((d) => (d.room || null) === g.id);
      if (!ds.length) return;
      body += `<tr class="group"><td colspan="8">${g.color ? `<span class="swatch" style="background:${g.color}"></span> ` : ''}${esc(g.name)} <span class="muted">(${ds.length})</span></td></tr>`;
      ds.forEach((d) => {
        const used = d.ports.filter((p) => _conn.has(d.id + ':' + p.id)).length;
        const rack = devById(d.parent);
        const ip = d.ip ? `<a href="${esc(configUrl(d))}" target="_blank" rel="noopener">${esc(d.ip)}</a>` : '';
        body += `<tr><td><b>${esc(d.name)}</b></td><td>${esc(d.maker)}</td><td>${esc(d.model)}</td><td>${ip}</td><td class="mono">${hasPatch(d) && dmxLabel(d) ? (_dmxBad.get(d.id) ? '⚠ ' : '') + esc(dmxLabel(d)) + (dmxOf(d).ch > 1 ? ' (' + dmxOf(d).ch + ' ch)' : '') : ''}</td><td>${rack ? esc(rack.name) : ''}</td><td>${isRack(d) ? '' : used + ' / ' + d.ports.length}</td><td>${esc(d.notes)}</td></tr>`;
      });
    });
    const counts = {};
    project.devices.forEach((d) => { const k = d.maker + ' ' + d.model; counts[k] = (counts[k] || 0) + 1; });
    const summary = Object.entries(counts).sort().map(([k, n]) => `<tr><td>${n}×</td><td>${esc(k)}</td></tr>`).join('');
    $('#view-devices').innerHTML = `<div class="table-actions"><h2 style="margin:0">Nomenclature</h2><span class="muted">${project.devices.length} éléments</span></div>
      <table><tr><th>Repère</th><th>Marque</th><th>Modèle</th><th>IP</th><th>Patch DMX</th><th>Baie</th><th>Ports utilisés</th><th>Notes</th></tr>${body}</table>
      <h3>Récapitulatif matériel</h3><table style="width:auto">${summary}</table>`;
  }

  // ---------------------------------------------------------------- fichiers
  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  // ---- Fichier en cours : Enregistrer (met à jour le fichier ouvert) / Enregistrer sous…
  // Chrome / Edge : accès direct au fichier (File System Access API). Safari / Firefox : téléchargement d'une copie.
  const FS_OK = typeof window.showSaveFilePicker === 'function';
  // Projets TRAME : extension .trame (contenu JSON). Les anciens .json restent ouvrables.
  const EXT = '.trame', TRAME_MIME = 'application/x-trame+json';
  const FILE_TYPES = [{ description: 'Projet TRAME (.trame)', accept: { [TRAME_MIME]: [EXT] } }];
  const OPEN_TYPES = [{ description: 'Projet TRAME (.trame, ancien .json)', accept: { [TRAME_MIME]: [EXT], 'application/json': ['.json'] } }];
  const isProjectFile = (name) => /\.(trame|json)$/i.test(name || '');
  let fileHandle = null, fileName = '', dirty = false, loading = false;
  try { fileName = localStorage.getItem('synoptique.fileName') || ''; } catch (e) { /* ignore */ }
  function markDirty() { if (loading) return; if (!dirty) { try { localStorage.setItem('synoptique.dirty', '1'); } catch (e) { /* ignore */ } } dirty = true; updateFileState(); }
  function setClean(name) {
    dirty = false; if (name != null) fileName = name;
    try { localStorage.setItem('synoptique.fileName', fileName); localStorage.setItem('synoptique.dirty', '0'); } catch (e) { /* ignore */ }
    updateFileState();
  }
  function updateFileState() {
    const el = $('#fileState'); if (!el) return;
    el.textContent = (fileName || 'non enregistré') + (dirty ? ' •' : '');
    el.classList.toggle('dirty', dirty);
    el.title = fileName ? (dirty ? 'Modifications non enregistrées dans ' : 'Enregistré dans ') + fileName : 'Projet jamais enregistré dans un fichier';
    document.title = (dirty ? '• ' : '') + (project.name || 'Projet') + ' — TRAME';
  }
  const projectJson = () => JSON.stringify(project, null, 2);
  const baseName = () => (fileName ? fileName.replace(/(\.synoptique)?(\.trame)?(\.json)?$/i, '') : (project.name || 'projet').replace(/[\\/:*?"<>|]+/g, '-'));
  const suggested = () => baseName() + EXT;
  // poignée du fichier gardée dans IndexedDB pour « Enregistrer » après un rechargement de la page
  function idb(mode, fn) {
    return new Promise((res) => {
      try {
        const rq = indexedDB.open('synoptique', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
        rq.onsuccess = () => { try { const tx = rq.result.transaction('kv', mode); const r = fn(tx.objectStore('kv')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => res(null); } catch (e) { res(null); } };
        rq.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  const rememberHandle = (h) => idb('readwrite', (st) => (h ? st.put(h, 'file') : st.delete('file')));
  if (FS_OK) idb('readonly', (st) => st.get('file')).then((h) => { if (h && !fileHandle) fileHandle = h; });
  async function writeTo(h) {
    if (h.queryPermission && (await h.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Accès au fichier refusé');
    }
    const w = await h.createWritable(); await w.write(projectJson()); await w.close();
  }
  async function saveFile() {
    if (!FS_OK || !fileHandle) return saveAs();
    try { await writeTo(fileHandle); setClean(fileHandle.name); flash('Enregistré dans ' + fileHandle.name); }
    catch (e) { if (e.name !== 'AbortError') { notify('Impossible d\'écrire dans ' + fileName + ' (' + e.message + '). Choisissez un emplacement.'); saveAs(); } }
  }
  async function saveAs() {
    if (FS_OK) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: suggested(), types: FILE_TYPES });
        await writeTo(h); fileHandle = h; rememberHandle(h); setClean(h.name); flash('Enregistré dans ' + h.name);
      } catch (e) { if (e.name !== 'AbortError') notify('Enregistrement impossible : ' + e.message); }
      return;
    }
    const name = suggested();
    // iPad / iPhone : la feuille de partage permet « Enregistrer dans Fichiers » (iCloud Drive…)
    const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    if (IOS && navigator.share && navigator.canShare) {
      for (const type of ['application/octet-stream', 'application/json', 'text/plain']) {
        const f = new File([projectJson()], name, { type });
        if (navigator.canShare({ files: [f] })) {
          try { await navigator.share({ files: [f], title: name }); setClean(name); flash('Projet partagé / enregistré : ' + name); }
          catch (e) { if (e.name !== 'AbortError') notify('Partage impossible : ' + e.message); }
          return;
        }
      }
    }
    download(name, projectJson(), 'application/octet-stream');   // octet-stream : le navigateur garde l'extension .trame
    setClean(name); flash('Copie téléchargée (' + name + ')');
  }
  function loadProjectText(t, h, name) {
    try {
      const p = JSON.parse(t); if (!p.devices) throw new Error('Fichier non reconnu');
      loading = true; project = normalize(p); ui.selected = null; commit(); loading = false;
      fileHandle = h || null; rememberHandle(fileHandle); setClean(name || '');
      setTimeout(zoomFit, 50);
    } catch (err) { loading = false; notify('Impossible d\'ouvrir : ' + err.message); }
  }
  async function openFile() {
    if (typeof window.showOpenFilePicker === 'function') {
      try { const [h] = await window.showOpenFilePicker({ types: OPEN_TYPES, excludeAcceptAllOption: false }); const f = await h.getFile(); loadProjectText(await f.text(), h, h.name); }
      catch (e) { if (e.name !== 'AbortError') notify('Ouverture impossible : ' + e.message); }
      return;
    }
    $('#fileInput').click();
  }
  // Déposer un fichier .trame sur la fenêtre l'ouvre
  document.addEventListener('dragover', (ev) => { if (ev.dataTransfer && [...ev.dataTransfer.types].includes('Files')) { ev.preventDefault(); document.body.classList.add('drop-file'); } });
  document.addEventListener('dragleave', (ev) => { if (!ev.relatedTarget) document.body.classList.remove('drop-file'); });
  document.addEventListener('drop', (ev) => {
    document.body.classList.remove('drop-file');
    const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (!f) return;
    ev.preventDefault(); ev.stopPropagation();
    if (!isProjectFile(f.name)) { notify('« ' + f.name + ' » n\'est pas un projet TRAME (.trame).'); return; }
    const go = async () => {
      // Chrome / Edge : on récupère la poignée pour que « Enregistrer » réécrive ce fichier
      let h = null;
      try { const it = ev.dataTransfer.items && ev.dataTransfer.items[0]; if (it && it.getAsFileSystemHandle) { const x = await it.getAsFileSystemHandle(); if (x && x.kind === 'file') h = x; } } catch (e) { /* ignore */ }
      loadProjectText(await f.text(), h, f.name);
    };
    if (dirty) confirmBox('Ouvrir « ' + f.name + ' » ? Des modifications du projet actuel ne sont pas enregistrées dans un fichier.', go, 'Ouvrir');
    else go();
  }, true);
  // Partager l'application : télécharge TRAME.html (fichier unique, à envoyer avec les .trame)
  function shareApp() {
    if (document.querySelector('link[rel="stylesheet"][href^="css/"]')) { notify('À faire depuis dist/TRAME.html (version assemblée).'); return; }
    download('TRAME.html', APP_HTML, 'text/html');
    flash('TRAME.html téléchargé : envoyez-le avec vos fichiers .trame');
  }
  $('#btnShareApp').onclick = shareApp;
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors GitHub Pages : pas de mode hors ligne */ });
  }
  // fichier .trame ouvert depuis le système (application installée sur ordinateur, Chrome / Edge)
  if (window.launchQueue) window.launchQueue.setConsumer(async (p) => { const h = p.files && p.files[0]; if (h) { const f = await h.getFile(); loadProjectText(await f.text(), h, h.name); } });
  $('#btnSave').onclick = saveFile;
  $('#btnExport').onclick = saveAs;
  $('#btnImport').onclick = openFile;
  $('#fileInput').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => loadProjectText(t, null, f.name));
    e.target.value = '';
  };
  $('#btnNew').onclick = () => confirmBox('Créer un projet vide ?' + (dirty ? ' Des modifications ne sont pas enregistrées dans le fichier.' : ''), () => {
    loading = true; project = emptyProject(); ui.selected = null; commit(); loading = false;
    fileHandle = null; rememberHandle(null); setClean('');
  }, 'Nouveau projet');
  // raccourcis : ⌘/Ctrl+S, ⌘/Ctrl+Maj+S, ⌘/Ctrl+O (actifs même dans un champ de saisie)
  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  $$('kbd[data-k]').forEach((k) => { k.textContent = (IS_MAC ? '⌘' : 'Ctrl+') + k.dataset.k.replace('⇧', IS_MAC ? '⇧' : 'Maj+'); });
  document.addEventListener('keydown', (ev) => {
    if (!(ev.metaKey || ev.ctrlKey)) return;
    const k = ev.key.toLowerCase();
    if (k === 's') { ev.preventDefault(); if (ev.shiftKey) saveAs(); else saveFile(); }
    else if (k === 'o') { ev.preventDefault(); openFile(); }
  });
  // Synoptique en SVG autonome, toujours en couleurs claires (impression, PDF, SVG)
  function standaloneSvg(fit) {
    const b = world.getBBox(); const P = 30;
    const css = `text{font-family:-apple-system,Segoe UI,Roboto,sans-serif}.dev-body{fill:#fff;stroke:#c9ced8}.dev-head{fill:#263042}.dev-title{fill:#fff;font-weight:600;font-size:12px}.dev-sub{fill:#fff;opacity:.7;font-size:10px}.dev-ip{fill:#8fd3ff;font-size:10px}.port-label{fill:#1d2330;font-size:10.5px}.port-conn{fill:#6b7280;font-size:9px}svg{--dev:#fff;--ink:#1d2330}.port-dot{stroke-width:2.4}.cable{fill:none;stroke-width:2.4}.cable.infra{stroke-dasharray:9 3}.cable.mismatch{stroke-dasharray:6 4}.cable-hit{display:none}.cable-label{font-size:10px;paint-order:stroke;stroke:#fff;stroke-width:3px}.bundle{fill:none;stroke-width:9;stroke-linecap:round;opacity:.7}.bundle-label{fill:#1d2330;font-weight:600;font-size:11px}.rack-body{fill:#f4f5f7;stroke:#6b7280;stroke-width:1.5}.rack-head{fill:#6b7280}.rack-resize{display:none}.room-frame{stroke-width:1.5;stroke-dasharray:6 4}.room-label{font-weight:700;font-size:14px}`;
    const inner = world.cloneNode(true); inner.removeAttribute('transform'); const tc = inner.querySelector('#tempCable'); if (tc) tc.remove();
    const vb = `${b.x - P} ${b.y - P} ${b.width + 2 * P} ${b.height + 2 * P}`;
    const size = fit ? 'width="100%" preserveAspectRatio="xMidYMid meet"' : `width="${b.width + 2 * P}" height="${b.height + 2 * P}"`;
    return `<svg xmlns="${SVGNS}" viewBox="${vb}" ${size}><style>${css}</style><rect x="${b.x - P}" y="${b.y - P}" width="${b.width + 2 * P}" height="${b.height + 2 * P}" fill="#fff"/>${inner.innerHTML}</svg>`;
  }
  $('#btnSvg').onclick = () => download(project.name + ' - TRAME.svg', standaloneSvg(false), 'image/svg+xml');

  // Export PDF : mise en page d'impression (synoptique + câbles + nomenclature), puis "Enregistrer en PDF" du navigateur
  $('#btnPdf').onclick = () => {
    const prevTab = ui.tab;
    ui.selected = null; ui.pending = null;
    if (prevTab !== 'canvas') { $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-canvas')); }
    renderCanvas();
    const svgHtml = standaloneSvg(true);
    renderCablesTable(); renderDevicesTable();
    const tableOf = (id) => $$('#' + id + ' table').map((t) => t.outerHTML).join('<h3>Récapitulatif matériel</h3>');
    const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const legend = project.signals.filter((s) => project.cables.some((c) => c.sig === s.id)).map((s) =>
      `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>` + (s.subnets || []).filter((n) => project.cables.some((c) => c.sub === n.id)).map((n) => `<span><i style="background:${n.color}"></i>${esc(n.name)}</span>`).join('')).join('');
    $('#printArea').innerHTML = `<section class="print-page"><header><h1>${esc(project.name)}</h1><span>TRAME · ${date}</span></header>
        <div class="print-legend">${legend}</div><div class="print-svg">${svgHtml}</div></section>
      <section class="print-page"><h2>Liste des câbles</h2>${tableOf('view-cables')}</section>
      <section class="print-page"><h2>Nomenclature</h2>${tableOf('view-devices')}</section>`;
    if (prevTab !== 'canvas') $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + prevTab));
    renderAll();
    window.print();
  };
  window.addEventListener('afterprint', () => { $('#printArea').innerHTML = ''; });

  function normalize(p) {
    const base = emptyProject();
    p = Object.assign(base, p);
    // compléter les types de réseaux par défaut absents
    L.SIGNALS.forEach((s) => { if (!p.signals.find((x) => x.id === s.id)) p.signals.push(clone(s)); });
    p.cables.forEach((c) => { const d = c.infra && p.devices.find((x) => x.id === c.a.d); if (d && c.label === d.name) c.label = ''; });
    return p;
  }

  // ---------------------------------------------------------------- barre du haut
  $('#projectName').oninput = (e) => { project.name = e.target.value; save(); };
  $$('#tabs button').forEach((b) => {
    b.onclick = () => {
      ui.tab = b.dataset.tab;
      $$('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
      $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + ui.tab));
      renderAll();
    };
  });
  $$('#viewModes button').forEach((b) => {
    b.onclick = () => { ui.mode = b.dataset.mode; $$('#viewModes button').forEach((x) => x.classList.toggle('active', x === b)); renderCanvas(); };
  });
  $('#showRooms').onchange = (e) => { ui.showRooms = e.target.checked; renderCanvas(); };
  $('#btnArrange').onclick = () => { $$('.menu.open').forEach((x) => x.classList.remove('open')); autoArrange(); };
  $('#btnUndoArrange').onclick = () => { $$('.menu.open').forEach((x) => x.classList.remove('open')); undoArrange(); };
  $('#tidyView').onchange = (e) => { ui.tidy = e.target.checked; renderCanvas(); };
  $('#avoidDevices').onchange = (e) => { ui.avoid = e.target.checked; renderCanvas(); };
  $('#showBundles').onchange = (e) => { ui.bundle = e.target.checked; if (ui.selected && ui.selected.type === 'bundle') select(null); else renderCanvas(); };

  // Thème : auto (système) / clair / sombre, mémorisé dans ce navigateur
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    $('#theme').value = t || 'auto';
  }
  try { applyTheme(localStorage.getItem('synoptique.theme') || 'dark'); } catch (e) { applyTheme('dark'); }
  $('#theme').onchange = (e) => { applyTheme(e.target.value); try { localStorage.setItem('synoptique.theme', e.target.value); } catch (err) { /* ignore */ } };

  let flashTimer;
  function flash(msg) { const h = $('#hint'); const old = h.dataset.old || h.textContent; h.dataset.old = old; h.textContent = msg; h.style.color = '#d32f2f'; clearTimeout(flashTimer); flashTimer = setTimeout(() => { h.textContent = old; h.style.color = ''; }, 2500); }

  function renderAll(opts) {
    $('#projectName').value = project.name;
    renderCanvas();
    if (!(opts && opts.keepSide)) { renderLibrary(); renderRooms(); renderInspector(); }
    renderFilters();
    if (ui.tab === 'cables') renderCablesTable();
    if (ui.tab === 'devices') renderDevicesTable();
  }

  // ---------------------------------------------------------------- projet de démonstration
  function demoProject() {
    project = emptyProject();
    project.name = 'Démo – Théâtre';
    const R = (name, color) => { const r = { id: uid(), name, color }; project.rooms.push(r); return r.id; };
    const regie = R('Régie', '#2f7df6'), baie = R('Local technique', '#8e24aa'), plateau = R('Plateau', '#e65100');
    const add = (tplId, x, y, room, name) => { const d = instantiate(tplById(tplId), x, y); d.room = room; if (name) d.name = name; project.devices.push(d); return d; };
    const P = (d, name) => d.ports.find((p) => p.name === name).id;
    const link = (da, pa, db, pb, sub, label, sa, sb) => {
      const pA = portOf(da, P(da, pa)), pB = portOf(db, P(db, pb));
      project.cables.push({ id: uid(), a: { d: da.id, p: pA.id, s: sa || defaultSide(pA) }, b: { d: db.id, p: pB.id, s: sb || defaultSide(pB) }, sig: pA.sig, sub: sub || null, label: label || '', length: '' });
    };
    const ma = add('ma3-light', 0, 0, regie, 'Console lumière');
    const rack = add('rack-19', 360, -40, baie, 'Baie LX'); rack.w = 300; rack.h = 520;
    const sw = add('gen-sw8', 390, 10, baie, 'Switch lumière'); sw.parent = rack.id;
    const node = add('gen-node4', 390, 230, baie, 'Node baie'); node.parent = rack.id;
    const split = add('gen-split6', 390, 360, baie, 'Splitter U1'); split.parent = rack.id;
    const bs = add('patch-scene', 760, 0, plateau, 'Boîte de scène Jardin');
    const f1 = add('gen-fixture', 1080, 0, plateau, 'Lyre 1');
    const f2 = add('gen-fixture', 1080, 120, plateau, 'Lyre 2');
    const f3 = add('gen-fixture', 1080, 300, plateau, 'Barre LED');
    const dmx = project.signals.find((s) => s.id === 'dmx').subnets, eth = project.signals.find((s) => s.id === 'eth').subnets;
    link(ma, 'Ethernet 1', sw, 'Port 1', eth[0].id, 'ETH-R01');
    link(sw, 'Port 2', node, 'Ethernet', eth[0].id, 'ETH-B02');
    link(node, 'DMX 1', split, 'DMX In', dmx[0].id);
    link(split, 'DMX Out 1', bs, 'DMX 1', dmx[0].id, 'DMX-J01', 'R', 'L'); project.cables[project.cables.length - 1].infra = true;
    link(bs, 'DMX 1', f1, 'DMX In', dmx[0].id, '', 'R', 'L');
    link(f1, 'DMX Thru', f2, 'DMX In', dmx[0].id);
    link(node, 'DMX 2', bs, 'DMX 2', dmx[1].id, 'DMX-J02', 'R', 'L'); project.cables[project.cables.length - 1].infra = true;
    link(bs, 'DMX 2', f3, 'DMX In', dmx[1].id, '', 'R', 'L');
    // adresses IP (cliquables vers la page de config)
    ma.ip = '10.0.0.1'; sw.ip = '10.0.0.250'; node.ip = '10.0.0.21';
    // boîtiers muraux raccordés à la baie scéno (liaisons fixes regroupées en faisceaux)
    const salle = R('Salle de répétition', '#2e7d32');
    const sceno = add('baie-sceno', 360, 560, baie, 'Baie scéno');
    const w1 = add('wall-2rj-1dmx-1int', 760, 520, salle, 'Boîtier mur cour');
    const w2 = add('wall-8rj-2dmx', 760, 680, salle, 'Boîtier mur fond');
    linkToHub(w1, sceno); linkToHub(w2, sceno);
    return project;
  }

  // ---------------------------------------------------------------- démarrage
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }
  project = saved ? normalize(saved) : demoProject();
  renderAll();
  try { dirty = localStorage.getItem('synoptique.dirty') === '1'; } catch (e) { dirty = false; }
  updateFileState();
  setTimeout(zoomFit, 30);
})();
