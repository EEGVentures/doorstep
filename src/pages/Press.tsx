// Media and press: public page next to the legal pages. Boilerplate, logos to download, press contact.
const ASSETS = [
  { file: 'doorstep-lockup-c-light.png', name: 'Logo', note: 'For light backgrounds', dark: false },
  { file: 'doorstep-lockup-c-reverse.png', name: 'Logo, reversed', note: 'For dark backgrounds', dark: true },
  { file: 'doorstep-emblem-v4-gradient.png', name: 'Emblem', note: 'Colour', dark: false },
  { file: 'doorstep-emblem-v4-white.png', name: 'Emblem, white', note: 'For dark backgrounds', dark: true },
  { file: 'doorstep-wordmark-c-ink.png', name: 'Wordmark', note: 'Ink', dark: false },
  { file: 'doorstep-icon-v4-512.png', name: 'App icon', note: '512 × 512', dark: false },
];

export default function Press() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <section className="space-y-3">
        <p className="eyebrow">Media and press</p>
        <h1 className="text-4xl font-bold">Press and media</h1>
        <p className="max-w-2xl text-muted">Writing about Doorstep? Everything you need is here. For interviews, images or anything else, get in touch.</p>
      </section>

      <section className="card grid gap-6 p-6 sm:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">Press contact</h2>
          <p className="mt-2"><a className="link" href="mailto:press@doorsteptickets.com">press@doorsteptickets.com</a></p>
          <p className="mt-1 text-sm text-muted">We aim to reply within one working day.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Partnerships</h2>
          <p className="mt-2"><a className="link" href="mailto:partners@doorsteptickets.com">partners@doorsteptickets.com</a></p>
          <p className="mt-1 text-sm text-muted">Venues, promoters and member organisations.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">About Doorstep</h2>
        <div className="card space-y-3 p-6">
          <p>Doorstep helps people find good nights out at venues near them. It’s free to browse, and anyone with a free account can book gigs, comedy, theatre and more. Tickets arrive in their Doorstep wallet ahead of the night.</p>
          <p>Doorstep works with venues and promoters to bring local audiences into their events, and with member organisations to offer their communities a route to live events close to home.</p>
          <p className="font-display font-semibold">Good nights out, on your Doorstep.</p>
          <button className="btn-secondary text-sm" onClick={(e) => {
            const text = (e.currentTarget.parentElement?.innerText ?? '').replace(/Copy text$/, '').trim();
            navigator.clipboard?.writeText(text);
            e.currentTarget.textContent = 'Copied';
          }}>Copy text</button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold">Logos</h2>
          <a className="btn-primary" href="/press/doorstep-logo-pack.zip" download>
            <span><img src="/brand/doorstep-emblem-v4-gradient.png" alt="" className="h-5 w-5" />Download logo pack<span className="arrow" aria-hidden="true">↓</span></span>
          </a>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ASSETS.map((a) => (
            <li key={a.file} className="card overflow-hidden">
              <div className={`flex h-36 items-center justify-center p-6 ${a.dark ? 'bg-ink' : 'bg-canvas'}`}>
                <img src={`/brand/${a.file}`} alt={a.name} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex items-center justify-between p-4">
                <div><p className="font-medium">{a.name}</p><p className="text-sm text-muted">{a.note} · PNG</p></div>
                <a className="link text-sm" href={`/brand/${a.file}`} download>Download</a>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">Please don’t recolour, stretch, outline or retype the logo, or add effects to it. Use the reversed logo on dark backgrounds.</p>
      </section>
    </div>
  );
}
