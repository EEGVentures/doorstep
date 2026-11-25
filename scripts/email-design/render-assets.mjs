// Renders the baked email artwork in assets.html into public/email-assets/ at 2x.
// Usage: node scripts/email-design/render-assets.mjs   (needs Playwright's Chromium and Python Pillow for the GIF)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // Playwright is installed globally, not a project dependency
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const here = import.meta.dirname;
const out = join(here, '..', '..', 'public', 'email-assets');
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 700, height: 1400 }, deviceScaleFactor: 2 });
await pg.goto('file://' + join(here, 'assets.html'));
await pg.evaluate(() => document.fonts.ready);
await pg.waitForTimeout(300);
for (const s of await pg.$$('section[data-out]')) {
  const name = await s.getAttribute('data-out');
  const frames = Number(await s.getAttribute('data-frames') || 0);
  if (!frames) { await s.screenshot({ path: join(out, name), ...(name.endsWith('.jpg') ? { type: 'jpeg', quality: 86 } : {}) }); console.log(name); continue; }
  const dir = mkdtempSync(join(tmpdir(), 'ds-gif-'));
  const files = [];
  for (let i = 0; i < frames; i++) {
    await pg.evaluate((t) => window.setFrame(t), i / frames);
    const f = join(dir, `f${String(i).padStart(2, '0')}.png`);
    await s.screenshot({ path: f }); files.push(f);
  }
  // First frame doubles as the still for clients that don't animate (Outlook on Windows).
  await pg.evaluate(() => window.setFrame(0));
  await s.screenshot({ path: join(out, name + '.jpg'), type: 'jpeg', quality: 86 });
  const py = `
import sys
from PIL import Image
fs=sys.argv[2:]; ims=[Image.open(f).convert('RGB') for f in fs]
pal=ims[0].quantize(colors=200, method=Image.MEDIANCUT)
q=[im.quantize(palette=pal, dither=Image.Dither.NONE) for im in ims]
q[0].save(sys.argv[1], save_all=True, append_images=q[1:], duration=70, loop=0, optimize=True, disposal=1)`;
  writeFileSync(join(dir, 'gif.py'), py);
  execFileSync('python3', ['-I', join(dir, 'gif.py'), join(out, name + '.gif'), ...files]);
  console.log(name + '.gif');
}
await b.close();
