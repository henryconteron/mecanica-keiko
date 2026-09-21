import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + path.sep)) throw new Error('outside root');
    const content = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
try {
  for (const [width, height] of [[360,640], [390,844], [844,390], [1440,900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => {
      const url = route.request().url();
      if (url.includes('/rest/v1/productos_admin')) return route.fulfill({ json: [] });
      if (url.includes('/rest/v1/estado_taller')) return route.fulfill({ json: [{ estado: 'automatico' }] });
      return route.abort();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-open-product]').first().click();
    await page.locator('#dialog-main-media img').waitFor();
    const fit = await page.locator('#dialog-main-media img').evaluate(img => {
      const a = img.getBoundingClientRect(), b = img.parentElement.getBoundingClientRect();
      return { fits: a.left >= b.left && a.top >= b.top && a.right <= b.right + 1 && a.bottom <= b.bottom + 1, mode: getComputedStyle(img).objectFit };
    });
    assert.equal(fit.fits, true, `Image outside gallery at ${width}x${height}`);
    assert.equal(fit.mode, 'contain');
    assert(await page.locator('.dialog-primary-action a').isVisible());
    await page.locator('#dialog-close').click();
    await page.waitForFunction(() => document.body.style.position !== 'fixed');
    assert.equal(await page.evaluate(() => document.body.style.position), '');
    assert.deepEqual(errors, []);
    console.log(`Gallery and dialog passed: ${width}x${height}`);
    await page.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
