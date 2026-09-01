// Headless verification: loads the app in Edge via puppeteer-core,
// generates the production pack PDF with the dev hook, saves it,
// renders every page to a PNG for visual inspection.
// Usage: start dev/serve.mjs first, then `node dev/verify.mjs`
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(dir, 'output');
fs.mkdirSync(outDir, { recursive: true });

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
];
const exe = candidates.find(p => fs.existsSync(p));
if (!exe) { console.error('No Edge/Chrome executable found'); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox', '--window-size=1400,900']
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  page.on('pageerror', e => console.log('[page error]', e.message));
  const roofParam = process.env.APEX ? '&apex=1' : '';
  const stressParam = process.env.STRESS ? '&stress=1' : '';
  await page.goto(`http://localhost:8123/index.html?dev=1${roofParam}${stressParam}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.waitForFunction(() => window.__devBuildPDF && window.__devReady && window.__lastQuote, { timeout: 45000 });

  if (process.env.RED) await page.evaluate(() => { window.__devRedLabels = true; });
  const checks = await page.evaluate(() => window.__devCheckCuts());
  console.log('--- CUTTING LIST QA ---');
  checks.lines.filter(l => l.startsWith('FAIL')).forEach(l => console.log(l));
  console.log(checks.lines[checks.lines.length - 1]);
  const result = await page.evaluate(() => window.__devBuildPDF());
  const pdfBuf = Buffer.from(result.pdfBase64, 'base64');
  fs.writeFileSync(path.join(outDir, 'out.pdf'), pdfBuf);
  console.log('PDF pages:', result.pages, '| size:', (pdfBuf.length / 1024 / 1024).toFixed(2), 'MB');
  console.log('Quote: materials', Math.round(result.quote.materials),
    '| labour', Math.round(result.quote.labour),
    '| margin', Math.round(result.quote.margin),
    '| TOTAL', Math.round(result.quote.total),
    '| perSqm', Math.round(result.quote.perSqm));
  console.log('Timber: stud', result.quote.studLm.toFixed(1), 'lm | joist', result.quote.joistLm.toFixed(1), 'lm');
  console.log('3D shot sizes (bytes):', Object.entries(result.quote ? {} : {}).length, '(see below)');

  const p2 = await browser.newPage();
  await p2.goto('http://localhost:8123/dev/pdf-viewer.html?f=/dev/output/out.pdf', { waitUntil: 'networkidle2', timeout: 90000 });
  await p2.waitForFunction(() => window.__done, { timeout: 60000 });
  const n = await p2.evaluate(() => window.__pages.length);
  for (let i = 0; i < n; i++) {
    const dataUrl = await p2.evaluate(idx => window.__pages[idx].toDataURL('image/jpeg', 0.85), i);
    fs.writeFileSync(path.join(outDir, `page-${String(i + 1).padStart(2, '0')}.jpg`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  console.log('Rendered', n, 'pages to', outDir);
} finally {
  await browser.close();
}
