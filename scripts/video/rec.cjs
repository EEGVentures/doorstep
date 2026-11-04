const { chromium } = require('playwright');
const base = 'http://localhost:4196/';
(async () => {
  const b = await chromium.launch({ headless: false, args: ['--force-device-scale-factor=2', '--window-position=0,0', '--hide-scrollbars', '--disable-infobars', '--noerrdialogs'] });
  const W = 390, H = 790, S = 2;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: S, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('ds_demo_role', 'member'); localStorage.setItem('ds_demo_checkout', '1'); localStorage.setItem('ds_city', 'Cardiff'); localStorage.setItem('ds_pass_help', ''); } catch {}
    if (location.pathname.endsWith('index.html') && !location.hash.includes('wallet')) try { localStorage.removeItem('ds_demo_bought'); } catch {}
    const css = '#root > div.bg-ink:first-child{display:none!important} ::-webkit-scrollbar{display:none}'
      + '.ds-touch{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(26,16,48,.22);border:2px solid rgba(255,255,255,.85);pointer-events:none;z-index:99999;box-shadow:0 2px 10px rgba(0,0,0,.2);animation:dsT 520ms cubic-bezier(.23,1,.32,1) forwards}'
      + '@keyframes dsT{0%{transform:scale(.5);opacity:0}25%{transform:scale(1);opacity:1}100%{transform:scale(1.25);opacity:0}}';
    const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };
    document.head ? add() : document.addEventListener('DOMContentLoaded', add);
    window.__touch = (x, y) => { const d = document.createElement('div'); d.className = 'ds-touch'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.documentElement.appendChild(d); setTimeout(() => d.remove(), 600); };
  });
  const p = await ctx.newPage();
  let t0 = Date.now(); const mark = (l) => console.log(l, Date.now() - t0);
  const wait = (ms) => p.waitForTimeout(ms);
  const scroll = (y, ms) => p.evaluate(([y, ms]) => new Promise((r) => { const s = scrollY, t0 = performance.now();
    const f = (n) => { const k = Math.min(1, (n - t0) / ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; scrollTo(0, s + (y - s) * e); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }), [y, ms]);
  const tap = async (loc) => { await loc.scrollIntoViewIfNeeded(); const bb = await loc.boundingBox(); const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
    await p.evaluate(([x, y]) => window.__touch(x, y), [x, y]); await wait(140); await p.touchscreen.tap(x, y); };
  await p.goto('about:blank'); await wait(800);
  const rec = require('child_process').spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-video_size', '780x1580', '-i', ':99+0,174', '-c:v', 'libx264', '-crf', '12', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', process.env.OUT], { stdio: 'inherit' });
  await wait(700); t0 = Date.now(); console.log('t0');
  await p.goto(base + 'index.html'); mark('loaded');
  await wait(1700);
  await scroll(1100, 2600); await wait(350); mark('scrolled');
  await scroll(0, 1300); await wait(300);
  await tap(p.locator('a.tile-big').first()); mark('tapped lead');
  await wait(1400);
  await scroll(300, 1100); await wait(400);
  await tap(p.getByRole('button', { name: /Get tickets/ })); await wait(850);
  await tap(p.getByRole('button', { name: 'One more' })); await wait(650);
  await tap(p.locator('.sheet').getByRole('button', { name: /Book/ })); mark('book');
  await p.waitForURL(/checkout/); mark('checkout'); await wait(1500);
  await tap(p.locator('#pay')); await p.waitForURL(/wallet/, { timeout: 8000 }); mark('wallet');
  await wait(300);
  await p.waitForSelector('text=Crowd Pleasers Live', { timeout: 8000 }); mark('pass');
  await wait(400);
  const y = await p.evaluate(() => { const el = [...document.querySelectorAll('li')].find((l) => l.textContent.includes('Crowd Pleasers')); return el ? el.getBoundingClientRect().top + scrollY - 70 : 0; });
  await scroll(y, 1200); await wait(2200); mark('end');
  await wait(300); rec.kill('SIGINT'); await new Promise((r) => rec.on('exit', r));
  await ctx.close(); await b.close();
})();
