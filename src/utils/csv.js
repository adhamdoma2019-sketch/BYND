// Making spreadsheet (CSV) files that open correctly in Excel, Arabic included.

// Text that starts like a formula could run something when opened in Excel, so it is
// marked as plain text. Numbers and ordinary phone numbers (+20 10...) are left alone.
const looksLikeFormula = (s) => /^[=@\t\r]/.test(s) || /^[+-](?![\d\s.()-]*$)/.test(s);

export function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let s = String(value);
  if (looksLikeFormula(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

// columns: [{ header, value: (row) => ... }]
// A byte-order mark at the start makes Excel read the Arabic letters correctly.
export function toCsv(columns, rows) {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(',')),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

export function downloadFile(filename, content, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
