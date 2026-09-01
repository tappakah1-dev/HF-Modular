// Probe: checks 3D snapshot sizes + dumps PDF text content per page
// so layout/content can be verified without viewing images.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];
const exe = candidates.find(p => fs.existsSync(p));
const browser = await puppeteer.launch({
  executablePath: exe, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox', '--window-size=1400,900']
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('http://localhost:8123/index.html?dev=1', { waitUntil: 'networkidle2', timeout: 90000 });
  await page.waitForFunction(() => window.__devBuildPDF && window.__devReady && window.__lastQuote, { timeout: 45000 });
  if (process.env.RED) await page.evaluate(() => { window.__devRedLabels = true; });
  const shots = await page.evaluate(() => {
    const s = capture3DSnapshots();
    return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { bytes: v.data.length, w: v.w, h: v.h }]));
  });
  console.log('3D shots:', JSON.stringify(shots));

  const p2 = await browser.newPage();
  await p2.goto('http://localhost:8123/dev/pdf-viewer.html?f=/dev/output/out.pdf', { waitUntil: 'networkidle2', timeout: 90000 });
  await p2.waitForFunction(() => window.__done, { timeout: 60000 });
  const dump = await p2.evaluate(async () => {
    const pdf = await pdfjsLib.getDocument('/dev/output/out.pdf').promise;
    const out = [];
    const rotated = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const lines = tc.items.map(it => it.str).join(' | ');
      out.push(`=== PAGE ${i} ===\n${lines}\n`);
      tc.items.forEach(it => {
        if (Math.abs(it.transform[1]) > 0.5) {
          const e = it.transform[4], f = it.transform[5];
          const mm = v => (v / 72 * 25.4).toFixed(1);
          rotated.push(`p${i} [${it.str}] anchor:(${mm(e)},${mm(f)}) w:${mm(it.width)}`);
        }
      });
    }
    out.push('=== ROTATED ANCHORS ===\n' + rotated.join('\n'));
    return out.join('\n');
  });
  // measure the unique red label pixels around each anchor (DEV: labels are red)
  const ink = await p2.evaluate(async () => {
    const pdf = await pdfjsLib.getDocument('/dev/output/out.pdf').promise;
    const results = [];
    const S = 1.7; // render scale
    const isRed = (d, i) => d[i] > 150 && d[i + 1] < 110 && d[i + 2] < 110;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const canvas = window.__pages[i - 1];
      const ctx = canvas.getContext('2d');
      for (const it of tc.items) {
        if (Math.abs(it.transform[1]) <= 0.5) continue;
        const e = it.transform[4], f = it.transform[5];
        const cx = e * S, cy = f * S;
        const w = 220, h = 300; // generous window
        const x0 = Math.max(0, Math.floor(cx - w / 2)), y0 = Math.max(0, Math.floor(cy - h / 2));
        const cw = Math.min(w, canvas.width - x0), ch = Math.min(h, canvas.height - y0);
        const data = ctx.getImageData(x0, y0, cw, ch).data;
        let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, n = 0;
        for (let py = 0; py < ch; py++) {
          for (let px = 0; px < cw; px++) {
            const idx = (py * cw + px) * 4;
            if (isRed(data, idx)) {
              if (px < minX) minX = px; if (px > maxX) maxX = px;
              if (py < minY) minY = py; if (py > maxY) maxY = py;
              n++;
            }
          }
        }
        const mm = v => (v / S / 72 * 25.4).toFixed(1);
        if (n > 5) {
          results.push(`p${i} [${it.str}] RED bbox x:${mm(x0 + minX)}-${mm(x0 + maxX)} y:${mm(y0 + minY)}-${mm(y0 + maxY)} center:(${mm(x0 + (minX + maxX) / 2)},${mm(y0 + (minY + maxY) / 2)}) size:(${mm(maxX - minX)}x${mm(maxY - minY)})`);
        } else {
          results.push(`p${i} [${it.str}] NO RED FOUND near anchor (${n} px)`);
        }
      }
    }
    return results.join('\n');
  });
  console.log(ink);
  fs.appendFileSync(path.join(dir, 'output', 'text-dump.txt'), '\n=== RED MEASUREMENT ===\n' + ink);

  // pixel sanity on page 9 (front wall elevation): wood fills, blue glass, red dims
  const solid = await p2.evaluate(() => {
    const canvas = window.__pages[9]; // page 9
    const ctx = canvas.getContext('2d');
    const S = 1.7;
    const px = mm => Math.round(mm / 25.4 * 72 * S);
    const at = (mx, my) => {
      const d = ctx.getImageData(px(mx), px(my), 1, 1).data;
      return `rgb(${d[0]},${d[1]},${d[2]})`;
    };
    // stud at 600mm (x 90.8mm, mid-height) -> expect wood cream
    const stud = at(90.8, 90);
    // gap between studs (900mm) -> expect white
    const gap = at(102.5, 90);
    // sole plate band -> wood
    const sole = at(120, 150.6);
    // top plate band -> wood
    const top = at(120, 52.7);
    // bifold glass (x 155mm, y 100mm — above the label box) -> expect light blue
    const glass = at(155, 100);
    // king stud at door edge (x 108.3mm) high up (y 58mm) -> wood (full height)
    const king = at(108.3, 58);
    // doubled king stud at 1015mm: face1 (x 106.2) wood, unit edge frame (x 108.3) dark,
    // glass inside the unit (x 111) light blue — opening must sit BETWEEN the kings
    const kingFace1 = at(106.2, 90);
    const unitFrame = at(108.3, 90);
    const glassInner = at(111, 90);
    // cripple stud over door (x 114.1mm = 1200mm stud, y 58mm) -> wood
    const cripple = at(114.1, 58);
    // double top plate: ply1 (y 52.2), gap (y 53.6), ply2 (y 54.8)
    const topPly1 = at(120, 52.2);
    const topGap = at(120, 53.6);
    const topPly2 = at(120, 54.8);
    // red dim presence: top chain band y 21.8..23.2 AND stud chain y 174..179
    let red = 0;
    for (let x = px(60); x <= px(240); x += 2) {
      for (let y = px(21.8); y <= px(23.2); y += 1) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        if (d[0] > 150 && d[1] < 100 && d[2] < 100) red++;
      }
      for (let y = px(174); y <= px(179); y += 1) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        if (d[0] > 150 && d[1] < 100 && d[2] < 100) red++;
      }
    }
    // page 12 (right wall elevation, mono): sill cripple under window at 2400mm
    const c12 = window.__pages[12].getContext('2d');
    const at12 = (mx, my) => {
      const d = c12.getImageData(px(mx), px(my), 1, 1).data;
      return `rgb(${d[0]},${d[1]},${d[2]})`;
    };
    const sillCripple = at12(180.3, 120);   // cripple at 2400mm, mid of under-sill zone
    const sillGap = at12(191.9, 120);       // 2700mm between cripples -> white
    // apex checks: gable triangle fill on p9 (inside apex zone) + eave band on p11
    const c9 = window.__pages[9].getContext('2d');
    const at9 = (mx, my) => {
      const d = c9.getImageData(px(mx), px(my), 1, 1).data;
      return `rgb(${d[0]},${d[1]},${d[2]})`;
    };
    const gableFill = at9(155, 60);        // inside gable triangle (apex run only)
    const c11 = window.__pages[12].getContext('2d');
    const at11 = (mx, my) => {
      const d = c11.getImageData(px(mx), px(my), 1, 1).data;
      return `rgb(${d[0]},${d[1]},${d[2]})`;
    };
    const eaveBand = at11(155, 60);        // inside roof band (apex run only)
    return `page9 -> stud:${stud} gap:${gap} sole:${sole} top:${top} glass:${glass} kingFullHt:${king} cripple:${cripple} redDimPx:${red}\npage9 detail -> kingFace1:${kingFace1} unitFrame:${unitFrame} glassInner:${glassInner} topPly1:${topPly1} topGap:${topGap} topPly2:${topPly2}\npage12 -> sillCripple:${sillCripple} sillGap:${sillGap}\npage9 gableFill:${gableFill} page11 eaveBand:${eaveBand}`;
  });
  console.log(solid);
  fs.writeFileSync(path.join(dir, 'output', 'text-dump.txt'), dump);
  console.log(dump.slice(0, 6000));
} finally {
  await browser.close();
}
