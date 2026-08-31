// Measures jsPDF rotated-text placement: generates calib.pdf, renders it,
// finds red glyph boxes and reports their position relative to the
// requested anchor (marked with a black crosshair).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));
const browser = await puppeteer.launch({
  executablePath: exe, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox']
});
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:8123/dev/calib.html', { waitUntil: 'networkidle2', timeout: 60000 });
  const b64 = await page.evaluate(() => window.__calib());
  fs.writeFileSync(path.join(dir, 'output', 'calib.pdf'), Buffer.from(b64, 'base64'));

  const p2 = await browser.newPage();
  await p2.goto('http://localhost:8123/dev/pdf-viewer.html?f=/dev/output/calib.pdf', { waitUntil: 'networkidle2', timeout: 60000 });
  await p2.waitForFunction(() => window.__done, { timeout: 60000 });
  const out = await p2.evaluate(() => {
    const canvas = window.__pages[0];
    const ctx = canvas.getContext('2d');
    const S = 1.7;
    const mm = v => (v / S / 72 * 25.4).toFixed(1);
    const cases = [
      [40, 80], [40, 120], [100, 80], [100, 120], [160, 100], [220, 60], [220, 150], [260, 100]
    ];
    const lines = [];
    cases.forEach(([x, y]) => {
      const cx = Math.round(x / 25.4 * 72 * S), cy = Math.round(y / 25.4 * 72 * S);
      const w = 46, h = 70; // window mm -> px
      const wpx = Math.round(w / 25.4 * 72 * S), hpx = Math.round(h / 25.4 * 72 * S);
      const x0 = Math.max(0, cx - Math.floor(wpx / 2)), y0 = Math.max(0, cy - Math.floor(hpx / 2));
      const cw = Math.min(wpx, canvas.width - x0), ch = Math.min(hpx, canvas.height - y0);
      const data = ctx.getImageData(x0, y0, cw, ch).data;
      let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, n = 0;
      for (let py = 0; py < ch; py++) for (let px = 0; px < cw; px++) {
        const idx = (py * cw + px) * 4;
        if (data[idx] > 150 && data[idx + 1] < 110 && data[idx + 2] < 110) {
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
          n++;
        }
      }
      if (n > 5) {
        const bx0 = mm(x0 + minX), by0 = mm(y0 + minY), bx1 = mm(x0 + maxX), by1 = mm(y0 + maxY);
        const centerX = (x0 + minX + x0 + maxX) / 2, centerY = (y0 + minY + y0 + maxY) / 2;
        lines.push(`req(${x},${y}) glyph x:${bx0}-${bx1} y:${by0}-${by1} size:(${mm(maxX - minX)}x${mm(maxY - minY)}) centerOffset:(${mm(centerX - cx)},${mm(centerY - cy)})`);
      } else {
        lines.push(`req(${x},${y}) NO RED (${n}px)`);
      }
    });
    return lines.join('\n');
  });
  console.log(out);
} finally {
  await browser.close();
}
