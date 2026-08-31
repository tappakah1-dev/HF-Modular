// Quick structural analysis of the reference image: color palette,
// layout bands, where dark/colored ink concentrates — to infer the
// drawing style without being able to view it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Decode JPEG via PowerShell-free approach: use Edge headless through puppeteer to render to canvas and sample.
import puppeteer from 'puppeteer-core';
const dir = path.dirname(fileURLToPath(import.meta.url));
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const b64 = fs.readFileSync(path.join(dir, 'output', 'reference.jpg')).toString('base64');
  await page.setContent(`<html><body><canvas id="c"></canvas><script>
    const img = new Image();
    img.onload = () => {
      const c = document.getElementById('c');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      window.__data = ctx.getImageData(0, 0, img.width, img.height).data;
      window.__w = img.width; window.__h = img.height; window.__done = true;
    };
    img.src = 'data:image/jpeg;base64,${b64}';
  </script></body></html>`);
  await page.waitForFunction(() => window.__done, { timeout: 30000 });
  const report = await page.evaluate(() => {
    const d = window.__data, W = window.__w, H = window.__h;
    const hist = new Map();
    for (let i = 0; i < d.length; i += 4 * 7) { // sample every 7th px
      const r = d[i] >> 4, g = d[i + 1] >> 4, b = d[i + 2] >> 4; // quantize to 16 levels
      const key = `${r},${g},${b}`;
      hist.set(key, (hist.get(key) || 0) + 1);
    }
    const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const named = top.map(([k, n]) => {
      const [r, g, b] = k.split(',').map(v => (v * 16 + 8));
      return `rgb(${r},${g},${b}) ${(n / (W * H / 7) * 100).toFixed(1)}%`;
    });
    // vertical bands: fraction of non-background ink per row band (10 bands)
    const bands = [];
    const isBg = (r8, g8, b8) => r8 > 235 && g8 > 235 && b8 > 235;
    const isDark = (r8, g8, b8) => r8 < 90 && g8 < 90 && b8 < 90;
    let totalBg = 0, totalDark = 0, totalCol = 0;
    for (let band = 0; band < 10; band++) {
      let bg = 0, dark = 0, col = 0, n = 0;
      for (let y = Math.floor(band * H / 10); y < Math.floor((band + 1) * H / 10); y += 3) {
        for (let x = 0; x < W; x += 3) {
          const i = (y * W + x) * 4;
          if (isBg(d[i], d[i + 1], d[i + 2])) bg++; else if (isDark(d[i], d[i + 1], d[i + 2])) dark++; else col++;
          n++;
        }
      }
      totalBg += bg; totalDark += dark; totalCol += col;
      bands.push(`y${Math.floor(band * H / 10)}-${Math.floor((band + 1) * H / 10)}: bg ${(bg / n * 100).toFixed(0)}% dark ${(dark / n * 100).toFixed(0)}% colored ${(col / n * 100).toFixed(0)}%`);
    }
    return `size ${W}x${H}\nTOTAL: bg ${(totalBg / (W * H / 9) * 100).toFixed(0)}% dark ${(totalDark / (W * H / 9) * 100).toFixed(0)}% colored ${(totalCol / (W * H / 9) * 100).toFixed(0)}%\ncolors:\n${named.join('\n')}\n${bands.join('\n')}`;
  });
  console.log(report);
} finally {
  await browser.close();
}
