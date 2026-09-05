// PURPOSE: Small dependency-free CSV parser used by the lead import UI and server.
// SECURITY: Parsing is deterministic and does not execute spreadsheet formulas or HTML.

export type CsvTable = {
  headers: string[];
  rows: string[][];
};

export function parseCsv(text: string): CsvTable {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const nonEmpty = records.filter((record) => record.some((value) => String(value || '').trim() !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((value, index) => String(value || '').trim() || `Column ${index + 1}`);
  const rows = nonEmpty.slice(1).map((record) => headers.map((_, index) => String(record[index] ?? '').trim()));
  return { headers, rows };
}

export function valueForHeader(headers: string[], row: string[], header: string) {
  const wanted = String(header || '').trim();
  if (!wanted) return '';
  const index = headers.indexOf(wanted);
  return index >= 0 ? String(row[index] ?? '').trim() : '';
}

function canonicalHeader(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function guessCsvHeader(headers: string[], aliases: string[]) {
  const candidates = aliases.map(canonicalHeader);
  const exact = headers.find((header) => candidates.includes(canonicalHeader(header)));
  if (exact) return exact;
  const fuzzy = headers.find((header) => {
    const canonical = canonicalHeader(header);
    return candidates.some((alias) => canonical.includes(alias) || alias.includes(canonical));
  });
  return fuzzy || '';
}
