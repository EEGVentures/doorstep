import { demoPrices, demoRole, setDemoPrices, setDemoRole } from '../demo';

function Toggle<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: [T, string][]; onPick: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-white/10 p-0.5" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} onClick={() => v !== value && onPick(v)} aria-pressed={v === value}
          className={`press rounded-full px-2.5 py-1 font-medium ${v === value ? 'bg-white text-ink' : 'text-white/75'}`}>{text}</button>
      ))}
    </div>
  );
}

/** Preview build only: says this is sample data, lets you switch between a guest and a signed-in customer, and which price-visibility option to show guests. */
export function DemoBar() {
  return (
    <div className="flex justify-center bg-ink px-3 py-1.5">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
        <span className="font-medium text-white/85">Preview with sample events. View as</span>
        <Toggle label="View as" value={demoRole()} options={[['guest', 'Guest'], ['member', 'Signed in']]} onPick={setDemoRole} />
        <span className="font-medium text-white/85">Guests see prices</span>
        <Toggle label="Guests see prices" value={demoPrices()} options={[['signed_in', 'After sign-in'], ['everyone', 'Always']]} onPick={setDemoPrices} />
      </div>
    </div>
  );
}
