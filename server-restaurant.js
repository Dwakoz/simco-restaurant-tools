const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 3001;
const CONFIG_FILE = path.join(__dirname, 'simco-config.json');
const DATA_FILE = path.join(__dirname, 'simco-data.json');

// ── CONFIGURATION (cookies de session + IDs entreprise) ─────────────────────
// Ces informations sont privées : elles vivent dans simco-config.json (non
// versionné, voir .gitignore). Un fichier d'exemple est fourni :
// simco-config.example.json
let CONFIG = { COMPANY_IDS: {}, SESSION_COOKIES: {} };

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.log('  ⚠️  Fichier simco-config.json introuvable !');
    console.log('  ➜ Copie simco-config.example.json vers simco-config.json');
    console.log('     et renseigne tes identifiants (voir README).');
    return;
  }
  try {
    CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    console.log('  ✅ Configuration chargée depuis simco-config.json');
  } catch (e) {
    console.log('  ❌ Erreur de lecture de simco-config.json :', e.message);
  }
}
loadConfig();

// Accès dynamique : reflète toujours le contenu courant de CONFIG, même
// après un rechargement via /api/config (POST).
function getCompanyIds() { return CONFIG.COMPANY_IDS || {}; }
function getSessionCookies() { return CONFIG.SESSION_COOKIES || {}; }

// Cache encyclopédie : kind_id -> nom produit
let kindCache = {};

// Mapping kind_id -> nom dashboard (identifiés manuellement)
const KIND_FALLBACK = {
  117: "LAIT",
  119: "CAFE MOULU",
  121: "PAIN",
  123: "TARTE AUX POMMES",
  124: "JUS D'ORANGE",
  125: "JUS DE POMME",
  126: "BIERE DE GINGEMBRE",
  134: "BEURRE",
  122: "FROMAGE",
  129: "BURGER",
  130: "LASAGNES",
  131: "BOULETTES DE VIANDE",
  132: "COCKTAIL",
  142: "SALADE",
  143: "SAMOUSA",
};

function simcoGet(urlPath, realm, callback) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json',
    'Referer': 'https://www.simcompanies.com/',
  };
  const cookies = getSessionCookies();
  if (realm && cookies[realm]) headers['Cookie'] = cookies[realm];
  else if (realm === true && cookies.R1) headers['Cookie'] = cookies.R1;

  const opts = { hostname: 'www.simcompanies.com', path: urlPath, method: 'GET', headers };
  const req = https.request(opts, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try { callback(null, JSON.parse(data)); }
      catch(e) { callback(new Error('Parse error: ' + data.slice(0, 100))); }
    });
  });
  req.on('error', callback);
  req.end();
}

// Charge l'encyclopédie pour avoir kind_id -> nom
function loadEncyclopedia(callback) {
  if (Object.keys(kindCache).length > 0) return callback(null);
  console.log('  Chargement encyclopédie SimCompanies...');

  // Essai avec l'endpoint v2 qui retourne kind comme index
  simcoGet('/api/v2/encyclopedia/resources/', null, (err, data) => {
    if (!err && Array.isArray(data) && data.length > 0) {
      data.forEach(r => {
        // Dans v2 : r[0] = kind_id, r.db_letter, etc. — on essaie toutes les clés
        const key = r.dbLetter ?? r.db_letter ?? r.kind ?? r.id ?? r[0];
        const name = r.name ?? r.label ?? r[1];
        if (key !== undefined && name) kindCache[key] = name;
      });
      console.log('  ✅ Encyclopédie v2 chargée:', Object.keys(kindCache).length, 'ressources');
      Object.entries(kindCache).slice(0, 8).forEach(([k,v]) => console.log('   kind', k, '->', v));
      return callback(null);
    }

    // Essai v3
    simcoGet('/api/v3/0/encyclopedia/resources/', null, (err2, data2) => {
      if (!err2 && Array.isArray(data2) && data2.length > 0) {
        data2.forEach(r => {
          const key = r.dbLetter ?? r.db_letter ?? r.kind ?? r.id;
          const name = r.name ?? r.label;
          if (key !== undefined && name) kindCache[key] = name;
        });
        console.log('  ✅ Encyclopédie v3 chargée:', Object.keys(kindCache).length, 'ressources');
        Object.entries(kindCache).slice(0, 8).forEach(([k,v]) => console.log('   kind', k, '->', v));
        return callback(null);
      }

      // Dernier essai v4 en
      simcoGet('/api/v4/en/0/encyclopedia/resources/', null, (err3, data3) => {
        if (!err3 && Array.isArray(data3) && data3.length > 0) {
          data3.forEach(r => {
            const key = r.dbLetter ?? r.db_letter ?? r.kind ?? r.id;
            const name = r.name ?? r.label;
            if (key !== undefined && name) kindCache[key] = name;
          });
          console.log('  ✅ Encyclopédie v4/en chargée:', Object.keys(kindCache).length, 'ressources');
          Object.entries(kindCache).slice(0, 8).forEach(([k,v]) => console.log('   kind', k, '->', v));
          return callback(null);
        }
        console.log('  ⚠️  Toutes les encyclopédies ont échoué, mapping manuel utilisé');
        callback(null);
      });
    });
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── SAVE ──────────────────────────────────────────────────────────────────
  if (url.pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        // Backup de l'ancien fichier avant d'écraser
        if (fs.existsSync(DATA_FILE)) {
          fs.copyFileSync(DATA_FILE, DATA_FILE + '.backup');
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf8');
        console.log('  💾 Données sauvegardées dans simco-data.json');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── LOAD ──────────────────────────────────────────────────────────────────
  if (url.pathname === '/api/load' && req.method === 'GET') {
    if (!fs.existsSync(DATA_FILE)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ empty: true }));
      return;
    }
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      console.log('  📂 Données chargées depuis simco-data.json');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(raw);
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── CONFIG : LOAD ─────────────────────────────────────────────────────────
  if (url.pathname === '/api/config' && req.method === 'GET') {
    if (!fs.existsSync(CONFIG_FILE)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ empty: true, COMPANY_IDS: {}, SESSION_COOKIES: {} }));
      return;
    }
    try {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(raw);
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── CONFIG : SAVE ─────────────────────────────────────────────────────────
  if (url.pathname === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.COMPANY_IDS || !parsed.SESSION_COOKIES) {
          throw new Error('Format invalide : COMPANY_IDS et SESSION_COOKIES requis');
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(parsed, null, 2), 'utf8');
        loadConfig(); // recharge la config en mémoire (met aussi à jour COMPANY_IDS/SESSION_COOKIES)
        console.log('  ⚙️  Configuration sauvegardée dans simco-config.json');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── TEST RETAIL INFO ─────────────────────────────────────────────────────
  if (url.pathname.startsWith('/api/test-retail/')) {
    const realm = url.pathname.split('/')[3]; // R1 ou R2
    const realmNum = realm === 'R1' ? '1' : '2';
    simcoGet(`/api/v4/${realmNum}/resources-retail-info/`, realm, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      console.log('\n--- Test resources-retail-info', realm, '---');
      const items = Array.isArray(data) ? data : Object.entries(data).slice(0, 5);
      items.slice(0, 3).forEach(i => console.log(JSON.stringify(i)));
      console.log('--- Total:', Array.isArray(data) ? data.length : Object.keys(data).length, '---\n');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(data));
    });
    return;
  }

  // ── TEST RESTAURANT RUNS ─────────────────────────────────────────────────
  if (url.pathname.startsWith('/api/test-restaurant/')) {
    const parts = url.pathname.split('/'); // /api/test-restaurant/R1/47145202
    const realm = parts[3];
    const buildingId = parts[4];
    simcoGet(`/api/v2/companies/buildings/${buildingId}/restaurant-runs/`, realm, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      console.log('\n--- Test restaurant-runs building', buildingId, '---');
      const items = Array.isArray(data) ? data : [data];
      items.slice(0, 2).forEach(i => console.log(JSON.stringify(i)));
      console.log('--- Total:', items.length, '---\n');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(data));
    });
    return;
  }

  if (url.pathname.startsWith('/api/warehouse/')) {
    const realm = url.pathname.split('/')[3];
    const companyId = getCompanyIds()[realm];
    if (!companyId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Realm inconnu: ' + realm }));
      return;
    }

    // 1. Charger l'encyclopédie si pas encore fait
    loadEncyclopedia((err) => {
      if (err) console.log('  ⚠️  Encyclopédie non chargée:', err.message);

      // 2. Récupérer l'entrepôt
      simcoGet(`/api/v3/resources/${companyId}/`, realm, (err2, items) => {
        if (err2) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err2.message }));
          return;
        }

        if (!Array.isArray(items)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Réponse inattendue', raw: items }));
          return;
        }

        // 3. Enrichir avec le nom depuis le cache encyclopédie ou le fallback
        const enriched = items.map(item => ({
          ...item,
          name: kindCache[item.kind] || KIND_FALLBACK[item.kind] || ('kind_' + item.kind),
          quantity: item.amount || item.quantity || 0
        }));

        console.log('\n--- Entrepôt', realm, '(' + enriched.length + ' items) ---');
        enriched.forEach(i => console.log('  kind:', i.kind, '| nom:', i.name, '| qté:', i.quantity));
        console.log('---\n');

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(enriched));
      });
    });
    return;
  }

  // ── CASH (money) via auth-data ───────────────────────────────────────────
  if (url.pathname.startsWith('/api/cash/')) {
    const realm = url.pathname.split('/')[3]; // R1 ou R2
    if (!getSessionCookies()[realm]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Realm inconnu: ' + realm }));
      return;
    }
    simcoGet('/api/v3/companies/auth-data/', realm, (err, authData) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      const money = authData?.authCompany?.money;
      if (money === undefined) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Champ money introuvable' }));
        return;
      }
      console.log('  💵 Cash', realm, ':', money);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ money }));
    });
    return;
  }

  // Fichiers statiques
  let filePath = url.pathname === '/' ? '/simco-restaurant.html' : url.pathname;
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Fichier non trouvé'); return; }
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ==========================================');
  console.log('   SimCO - Restaurant Dashboard');
  console.log('  ==========================================');
  console.log('  http://localhost:' + PORT + '/simco-restaurant.html');
  console.log('  Ne ferme pas cette fenetre ! (Ctrl+C pour arreter)');
  console.log('');
});
