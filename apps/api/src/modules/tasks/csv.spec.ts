import { detectDelimiter, parseCsv, stringifyCsv } from './csv';

describe('csv', () => {
  it('parses quotes, escaped quotes, embedded newlines and CRLF', () => {
    const rows = parseCsv('a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'line1\nline2'],
    ]);
  });

  it('handles a BOM, a missing trailing newline and blank lines', () => {
    expect(parseCsv('﻿a,b\n\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('detects the semicolon delimiter Excel writes in many locales', () => {
    expect(detectDelimiter('tên;loại;hạn\n')).toBe(';');
    expect(parseCsv('tên;loại\nViệc A;Hoạt động')).toEqual([
      ['tên', 'loại'],
      ['Việc A', 'Hoạt động'],
    ]);
  });

  it('round-trips awkward values through stringify → parse', () => {
    const rows = [
      ['title', 'note'],
      ['Có "dấu" nháy, và phẩy', 'nhiều\ndòng'],
      ['', 'x'],
    ];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });

  it('neutralizes spreadsheet formulas on export', () => {
    const csv = stringifyCsv([
      ['=HYPERLINK("http://evil")', '+1', '-2', '@x', 'ok'],
    ]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+1");
    expect(csv).toContain("'-2");
    expect(csv).toContain("'@x");
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });

  it('starts with a BOM so Excel reads UTF-8', () => {
    expect(stringifyCsv([['a']]).charCodeAt(0)).toBe(0xfeff);
  });
});
