/** Minimal RFC 4180 CSV reading/writing — quotes, embedded newlines, BOM, and comma/semicolon delimiters. */

/** Excel in many locales (Vietnamese included) saves with ";" — pick whichever appears more in the header line. */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
  const count = (c: string) =>
    (firstLine.match(new RegExp(`\\${c}`, 'g')) ?? []).length;
  const candidates: [',' | ';' | '\t', number][] = [
    [',', count(',')],
    [';', count(';')],
    ['\t', count('\t')],
  ];
  return candidates.sort((a, b) => b[1] - a[1])[0]![0];
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // Last field/row when the file has no trailing newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines carry no data.
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * A value starting with = + - @ is read as a formula by spreadsheets; prefixing a
 * quote keeps exported user text from executing when someone opens the file (CSV injection).
 */
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeField(value: string): string {
  const v = neutralize(value);
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function stringifyCsv(
  rows: (string | number | null | undefined)[][],
): string {
  // BOM so Excel opens the file as UTF-8 (Vietnamese diacritics survive).
  return (
    '﻿' +
    rows
      .map((r) =>
        r
          .map((c) =>
            escapeField(c === null || c === undefined ? '' : String(c)),
          )
          .join(','),
      )
      .join('\r\n') +
    '\r\n'
  );
}
