// Parser für die Stadt-Zürich-Seite "Badi aktuell" (stzh-datatable-Elemente).
// Läuft ohne Abhängigkeiten in Node.js.

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function parseBadiHtml(html) {
  const freibaeder = [], hallenbaeder = [];
  // Achtung: Die Attributwerte enthalten unkodierte ">"-Zeichen, darum kein
  // einfaches [^>]* – wir lesen jedes Attribut bis zum nächsten echten ".
  function attr(name, from) {
    const key = ' ' + name + '="';
    const a = html.indexOf(key, from);
    if (a < 0) return null;
    const b = html.indexOf('"', a + key.length);
    if (b < 0) return null;
    return { value: html.slice(a + key.length, b), end: b };
  }
  let pos = 0;
  while (true) {
    const start = html.indexOf('<stzh-datatable', pos);
    if (start < 0) break;
    const rowsAttr = attr('rows', start);
    if (!rowsAttr) break;
    const colsAttr = attr('columns', start);
    pos = rowsAttr.end;
    let rows, cols;
    try {
      rows = JSON.parse(decodeEntities(rowsAttr.value));
      cols = colsAttr ? JSON.parse(decodeEntities(colsAttr.value)).map(c => c.text || '') : [];
    } catch (e) { continue; }
    const isHall = cols.includes('Auslastung') && !cols.includes('Wasser');
    for (const row of rows) {
      const c = row.map(x => stripTags(x.value));
      const name = c[0];
      if (!name || name === '-') continue;
      if (isHall) {
        const uid = (row[1] && row[1].id) || null;
        hallenbaeder.push({ name, uid });
      } else {
        const temp = parseFloat((c[1] || '').replace(',', '.'));
        const uid = (row[4] && row[4].id) || null;
        freibaeder.push({
          name,
          temp: isNaN(temp) ? null : temp,
          offen: c[2] === 'offen',
          status: c[2] || '',
          hinweis: c[3] || '',
          uid,
        });
      }
    }
  }
  if (!freibaeder.length && !hallenbaeder.length) throw new Error('Keine stzh-datatable-Daten gefunden');
  return { freibaeder, hallenbaeder };
}

if (typeof module !== 'undefined') module.exports = { parseBadiHtml };
