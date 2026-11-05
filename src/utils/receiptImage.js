// Draws the receipt rows (see receipt.js) on a canvas = the "Save as picture" file, and the picture inside the PDF.
// Written so it also runs against a fake canvas context in the tests (only fillText / fillRect / measureText / lines are used).
import { dataUrlToBytes, pdfFromJpeg } from './receipt.js';

const FONT = 'system-ui, "Segoe UI", Tahoma, Arial, sans-serif';
const INK = '#1a1a1a';
const SOFT = '#666666';
const LINE = '#dddddd';
const PAD = 36;

const isHex = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

// words that fit in `maxW` per line (a very long word is cut by letters)
export function wrapText(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const tryLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(tryLine).width <= maxW) {
        line = tryLine;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      let rest = word;
      while (ctx.measureText(rest).width > maxW && rest.length > 1) {
        let n = rest.length - 1;
        while (n > 1 && ctx.measureText(rest.slice(0, n)).width > maxW) n -= 1;
        lines.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}

// Lays the rows out (and paints them when `draw` is true). Returns the total height in CSS pixels.
export function paintReceipt(ctx, rows, { width = 720, rtl = false, accent = '#b08d57', draw = true } = {}) {
  const inner = width - PAD * 2;
  const startX = rtl ? width - PAD : PAD; // where text begins (the reading side)
  const endX = rtl ? PAD : width - PAD; // the opposite side (amounts)
  const startAlign = rtl ? 'right' : 'left';
  const endAlign = rtl ? 'left' : 'right';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textBaseline = 'alphabetic';
  const text = (s, x, y, { size = 16, bold = false, color = INK, align = startAlign } = {}) => {
    if (!draw) return;
    ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  const measure = (s, size, bold) => {
    ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
    return ctx.measureText(s).width;
  };
  const wrap = (s, size, bold, maxW) => {
    ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
    return wrapText(ctx, s, maxW);
  };

  if (draw) {
    ctx.fillStyle = isHex(accent) ? accent : '#b08d57';
    ctx.fillRect(0, 0, width, 10);
  }
  let y = 10 + 40;

  for (const r of rows) {
    if (r.kind === 'title') {
      for (const l of wrap(r.text, 28, true, inner)) {
        text(l, width / 2, y, { size: 28, bold: true, align: 'center' });
        y += 34;
      }
    } else if (r.kind === 'subtitle') {
      text(r.text, width / 2, y - 6, { size: 18, color: SOFT, align: 'center' });
      y += 14;
    } else if (r.kind === 'rule') {
      y += 6;
      if (draw) {
        ctx.fillStyle = LINE;
        ctx.fillRect(PAD, y, inner, 1);
      }
      y += 24;
    } else if (r.kind === 'pair' || r.kind === 'total') {
      if (r.kind === 'total') y += 8; // a little air above the total
      const size = r.kind === 'total' ? 22 : 16;
      const bold = r.kind === 'total' || r.strong === true;
      const labelW = Math.min(measure(r.label, size, false), inner * 0.45);
      const valueLines = wrap(r.value, size, bold, inner - labelW - 16);
      text(r.label, startX, y, { size, color: r.kind === 'total' ? INK : SOFT, bold: r.kind === 'total' });
      valueLines.forEach((l, i) => text(l, endX, y + i * (size + 6), { size, bold, align: endAlign }));
      y += valueLines.length * (size + 6) + 6;
    } else if (r.kind === 'item') {
      const amountW = measure(r.amount, 16, true);
      const nameLines = wrap(r.name, 17, true, inner - amountW - 20);
      nameLines.forEach((l, i) => text(l, startX, y + i * 23, { size: 17, bold: true }));
      text(r.amount, endX, y, { size: 16, bold: true, align: endAlign });
      y += nameLines.length * 23;
      for (const d of r.details) {
        for (const l of wrap(d, 14, false, inner - 12)) {
          text(l, startX, y, { size: 14, color: SOFT });
          y += 20;
        }
      }
      if (r.tag) {
        text(r.tag, startX, y, { size: 14, bold: true, color: isHex(accent) ? accent : '#b08d57' });
        y += 20;
      }
      y += 12;
    } else if (r.kind === 'note') {
      for (const l of wrap(r.text, 14, false, inner)) {
        text(l, startX, y, { size: 14, color: SOFT });
        y += 21;
      }
    } else if (r.kind === 'gap') {
      y += 16;
    }
  }
  return y + 24;
}

// ----- browser only -----
// Returns { canvas, width, height } (height in pixels of the finished picture, drawn at 2x for sharpness).
export function receiptCanvas(rows, { rtl = false, accent } = {}) {
  const width = 720;
  const scale = 2;
  const measuring = document.createElement('canvas').getContext('2d');
  const height = Math.ceil(paintReceipt(measuring, rows, { width, rtl, accent, draw: false }));
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  paintReceipt(ctx, rows, { width, rtl, accent, draw: true });
  return { canvas, width: canvas.width, height: canvas.height };
}

export function receiptPngBlob(rows, opts) {
  const { canvas } = receiptCanvas(rows, opts);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no picture'))), 'image/png');
  });
}

export function receiptPdfBlob(rows, opts) {
  const { canvas, width, height } = receiptCanvas(rows, opts);
  const bytes = pdfFromJpeg(dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92)), width, height);
  return new Blob([bytes], { type: 'application/pdf' });
}

// hand a file to the customer (the browser's normal download)
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
