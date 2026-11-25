// Doorstep holding page: entrance motion and the first-access sign-up.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')));

  // Reveal sections once as they scroll in.
  const reveals = document.querySelectorAll('.reveal');
  reveals.forEach((el, i) => el.style.setProperty('--r', String(i % 4)));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.setAttribute('data-in', '');
        io.unobserve(e.target);
        setTimeout(() => e.target.setAttribute('data-done', ''), 900);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.setAttribute('data-done', ''));
  }

  // Sign-up form.
  const form = document.getElementById('signup');
  const done = document.getElementById('done');
  const email = document.getElementById('email');
  const msg = document.getElementById('form-msg');
  const button = form.querySelector('button[type=submit]');
  const label = button.querySelector('.btn-label');
  const consentText = document.getElementById('marketing-text').textContent.trim();
  const openedAt = Date.now();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const say = (text) => { msg.textContent = text; };

  email.addEventListener('input', () => { if (email.getAttribute('aria-invalid')) { email.removeAttribute('aria-invalid'); say(''); } });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const value = email.value.trim();
    if (!EMAIL_RE.test(value) || value.length > 254) {
      email.setAttribute('aria-invalid', 'true');
      say('Please enter a full email address, like name@example.com.');
      email.focus();
      return;
    }
    say('');
    button.disabled = true;
    label.textContent = 'Signing you up…';

    const marketing = form.elements.marketing.checked;
    const payload = {
      email: value,
      marketing,
      consent_text: marketing ? consentText : null,
      website: form.elements.website.value,
      elapsed_ms: Date.now() - openedAt,
      source: new URLSearchParams(location.search).get('ref') || null,
    };

    try {
      let ok;
      if (window.DS_PREVIEW) {
        await new Promise((r) => setTimeout(r, 500));
        ok = true;
      } else {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        ok = res.ok;
        if (res.status === 429) {
          say('That’s a lot of sign-ups from one place. Please try again in an hour.');
          return;
        }
        if (res.status === 400) {
          email.setAttribute('aria-invalid', 'true');
          say('Please check your email address and try again.');
          return;
        }
      }
      if (!ok) throw new Error('signup failed');
      form.hidden = true;
      done.hidden = false;
      done.classList.add('is-in');
      done.focus({ preventScroll: true });
    } catch {
      say('Something went wrong on our side. Please try again in a minute.');
    } finally {
      button.disabled = false;
      label.textContent = 'Get first access';
    }
  });
})();

// Promoter / venue enquiry form.
(() => {
  const form = document.getElementById('pform');
  if (!form) return;
  const done = document.getElementById('pf-done');
  const msg = document.getElementById('pf-msg');
  const button = form.querySelector('button[type=submit]');
  const label = button.querySelector('.pf-btn-label');
  const openedAt = Date.now();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const say = (t) => { msg.textContent = t; };

  form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = form.elements;
    const checks = [
      [f.name, f.name.value.trim() !== '', 'Please add your name.'],
      [f.email, EMAIL_RE.test(f.email.value.trim()), 'Please enter a full email address.'],
      [f.message, f.message.value.trim() !== '', 'Please tell us a little about what you’d like to talk about.'],
    ];
    const bad = checks.find(([, ok]) => !ok);
    if (bad) { bad[0].setAttribute('aria-invalid', 'true'); say(bad[2]); bad[0].focus(); return; }
    say('');
    button.disabled = true;
    label.textContent = 'Sending…';
    const payload = {
      role: f.role.value, name: f.name.value, email: f.email.value, company: f.company.value, message: f.message.value,
      website: f.website.value, elapsed_ms: Date.now() - openedAt,
    };
    try {
      let ok = true;
      if (window.DS_PREVIEW) {
        await new Promise((r) => setTimeout(r, 500));
      } else {
        const res = await fetch('/api/partner', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.status === 429) { say('We’ve had a few messages from you already. Please email partners@doorsteptickets.com instead.'); return; }
        if (res.status === 400) { say('Please check your name, email and message, then try again.'); return; }
        ok = res.ok;
      }
      if (!ok) throw new Error('failed');
      form.hidden = true;
      done.hidden = false;
      done.focus({ preventScroll: true });
    } catch {
      say('That didn’t send. Please try again, or email partners@doorsteptickets.com.');
    } finally {
      button.disabled = false;
      label.textContent = 'Send to our partners team';
    }
  });
})();
