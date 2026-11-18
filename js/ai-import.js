/* Import d'appareil par recherche web, via l'API Claude (outils serveur web_search + web_fetch).
 * Appel direct depuis le navigateur avec la clé API de l'utilisateur (stockée localement).
 * Pas de SDK : l'appli est un fichier HTML statique sans gestionnaire de paquets.
 */
(function () {
  'use strict';
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL = 'claude-opus-5-5';
  const MAX_CONTINUATIONS = 4; // relances sur stop_reason "pause_turn"

  function systemPrompt(signals, connectors, categories) {
    return [
      'Tu es un régisseur technique expert du spectacle vivant (lumière, son, vidéo, réseau).',
      'On te donne le nom d\'un appareil. Cherche sa documentation technique sur le web (site du constructeur en priorité : fiche technique, manuel, page "rear panel" / "connectors" / "technical data"),',
      'puis décris TOUS ses connecteurs physiques (face arrière et avant) : réseau, DMX, audio, vidéo, timecode, MIDI, USB, alimentation.',
      '',
      'Règles :',
      '- Un port par connecteur physique, nommé comme sur l\'appareil (ex : "DMX A", "Ethernet 1", "SDI In 3").',
      '- conn : choisir dans cette liste exacte : ' + connectors.join(', ') + '. Sinon "Autre".',
      '- sig : identifiant du type de réseau parmi : ' + signals.map((s) => s.id + ' (' + s.name + ')').join(', ') + '.',
      '- dir : "in", "out" ou "io" (bidirectionnel, ex. Ethernet). Un port DMX configurable entrée/sortie : "io".',
      '- pass : true uniquement pour un panneau/boîte de brassage (port traversant). Sinon false.',
      '- cat : parmi ' + categories.map((c) => c.id).join(', ') + '.',
      '- Si une information n\'est pas confirmée par une source, ne l\'invente pas : signale le doute dans "notes".',
      '- Les notes sont en français, courtes (variantes de modèle, options, ports via carte d\'extension…).',
      '',
      'Termine ta réponse par UN SEUL bloc ```json contenant exactement cet objet :',
      '{"maker": string, "model": string, "cat": string, "doc": "URL de la meilleure source", "notes": string,',
      ' "confidence": "haute" | "moyenne" | "faible",',
      ' "ports": [{"name": string, "conn": string, "sig": string, "dir": "in"|"out"|"io", "pass": boolean}],',
      ' "sources": [string]}'
    ].join('\n');
  }

  async function callApi(apiKey, body) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data.error && data.error.message) || res.statusText;
      if (res.status === 401) throw new Error('Clé API refusée (401). Vérifiez la clé.');
      if (res.status === 429) throw new Error('Limite de requêtes atteinte (429). Réessayez dans un moment.');
      if (res.status >= 500) throw new Error('Service momentanément indisponible (' + res.status + '). Réessayez.');
      throw new Error('Erreur API ' + res.status + ' : ' + msg);
    }
    return data;
  }

  function extractJson(textAll) {
    const blocks = [...textAll.matchAll(/```json\s*([\s\S]*?)```/g)];
    const raw = blocks.length ? blocks[blocks.length - 1][1] : (textAll.match(/\{[\s\S]*\}/) || [])[0];
    if (!raw) throw new Error('Aucune fiche JSON dans la réponse.');
    return JSON.parse(raw);
  }

  // Valide et normalise le résultat pour qu'il colle au modèle de données de l'appli
  function sanitize(o, signals, connectors, categories) {
    const sigIds = new Set(signals.map((s) => s.id));
    const cats = new Set(categories.map((c) => c.id));
    const ports = (Array.isArray(o.ports) ? o.ports : []).filter((p) => p && p.name).map((p) => ({
      name: String(p.name).slice(0, 60),
      conn: connectors.includes(p.conn) ? p.conn : 'Autre',
      sig: sigIds.has(p.sig) ? p.sig : 'ctrl',
      dir: ['in', 'out', 'io'].includes(p.dir) ? p.dir : 'io',
      pass: p.pass === true
    }));
    if (!ports.length) throw new Error('La recherche n\'a trouvé aucun port exploitable.');
    return {
      maker: String(o.maker || 'Inconnu'), model: String(o.model || 'Appareil'),
      cat: cats.has(o.cat) && o.cat !== 'custom' ? o.cat : 'node',
      doc: typeof o.doc === 'string' ? o.doc : '',
      notes: String(o.notes || ''), confidence: String(o.confidence || ''),
      sources: Array.isArray(o.sources) ? o.sources.filter((u) => typeof u === 'string') : [],
      ports
    };
  }

  /**
   * Recherche un appareil sur le web et renvoie une fiche { maker, model, cat, doc, notes, confidence, sources, ports }.
   * onProgress(message) est appelé au fil de l'eau.
   */
  async function searchDevice(query, apiKey, ctx, onProgress) {
    const progress = onProgress || function () {};
    const body = {
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      fallbacks: 'default',
      system: systemPrompt(ctx.signals, ctx.connectors, ctx.categories),
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6 }
      ],
      messages: [{ role: 'user', content: 'Appareil à documenter : ' + query }]
    };
    const found = new Set();
    let text = '';
    progress('Recherche de la documentation…');
    for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
      const res = await callApi(apiKey, body);
      (res.content || []).forEach((b) => {
        if (b.type === 'text') text += b.text;
        if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach((r) => r.url && found.add(r.url));
        if (b.type === 'server_tool_use' && b.input) progress((b.name === 'web_fetch' ? 'Lecture : ' + (b.input.url || '') : 'Recherche : ' + (b.input.query || '')));
      });
      if (res.stop_reason === 'refusal') throw new Error('La requête a été refusée par le modèle.');
      if (res.stop_reason === 'pause_turn') {
        // le serveur a mis le tour en pause : on relance avec la réponse partielle
        body.messages = body.messages.concat([{ role: 'assistant', content: res.content }]);
        progress('Analyse des documents…');
        continue;
      }
      if (res.stop_reason === 'max_tokens') throw new Error('Réponse tronquée (max_tokens). Précisez le modèle exact.');
      break;
    }
    progress('Traduction des ports…');
    const tpl = sanitize(extractJson(text), ctx.signals, ctx.connectors, ctx.categories);
    found.forEach((u) => { if (!tpl.sources.includes(u)) tpl.sources.push(u); });
    return tpl;
  }

  window.AIImport = { searchDevice };
})();
