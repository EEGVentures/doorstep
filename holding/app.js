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
