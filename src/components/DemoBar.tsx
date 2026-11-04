import { demoRole, setDemoRole } from '../demo';

/** Preview build only: says this is sample data and lets you switch between a guest and a member. */
export function DemoBar() {
  const role = demoRole();
  return (
    <div className="flex justify-center bg-ink px-3 py-1.5">
      <div className="flex items-center gap-3 text-xs">
        <span className="font-medium text-white/85">Preview with sample events. View as</span>
        <div className="flex rounded-full bg-white/10 p-0.5" role="group" aria-label="View as">
          {(['guest', 'member'] as const).map((r) => (
            <button key={r} onClick={() => r !== role && setDemoRole(r)} aria-pressed={r === role}
              className={`press rounded-full px-2.5 py-1 font-medium ${r === role ? 'bg-white text-ink' : 'text-white/75'}`}>{r === 'guest' ? 'Guest' : 'Member'}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
