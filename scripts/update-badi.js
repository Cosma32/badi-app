// Holt "Badi aktuell" von stadt-zuerich.ch und schreibt data/badi.json.
// Läuft in GitHub Actions (Node 20+, kein npm install nötig).

const fs = require('fs');
const path = require('path');
const { parseBadiHtml } = require('./parse.js');

const URL = 'https://www.stadt-zuerich.ch/de/stadtleben/sport-und-erholung/sport-und-badeanlagen/sommerbaeder/badi-aktuell.html';
const OUT = path.join(__dirname, '..', 'data', 'badi.json');

async function fetchHtml(attempt = 1) {
  try {
    const res = await fetch(URL, {
      headers: { 'User-Agent': 'badi-app/1.0 (+https://github.com/cosma32/badi-app)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    if (html.length < 5000) throw new Error('Antwort zu kurz (' + html.length + ' Zeichen)');
    return html;
  } catch (err) {
    if (attempt >= 3) throw err;
    console.warn('Versuch ' + attempt + ' fehlgeschlagen: ' + err.message + ' – neuer Versuch…');
    await new Promise(r => setTimeout(r, 3000 * attempt));
    return fetchHtml(attempt + 1);
  }
}

(async () => {
  const html = await fetchHtml();
  const data = parseBadiHtml(html);

  const out = {
    stand: new Date().toISOString(),
    quelle: URL,
    freibaeder: data.freibaeder,
    hallenbaeder: data.hallenbaeder,
  };

  // Plausibilitätscheck: lieber die alte Datei behalten als Müll schreiben.
  if (out.freibaeder.length < 10) {
    throw new Error('Nur ' + out.freibaeder.length + ' Freibäder gefunden – Seite vermutlich geändert. Abbruch.');
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log('OK – ' + out.freibaeder.length + ' Freibäder, ' + out.hallenbaeder.length + ' Hallenbäder → data/badi.json');
})().catch(err => {
  console.error('FEHLER: ' + err.message);
  process.exit(1);
});
