type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/** Excel on Windows reads a BOM-less CSV as ANSI and garbles non-ASCII text such as the en dash. */
export const withBom = (content: string, mime: string): string =>
  mime.startsWith('text/csv') ? '﻿' + content : content;

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([withBom(content, mime)], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
