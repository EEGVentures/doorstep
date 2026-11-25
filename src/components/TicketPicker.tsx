import { useState } from 'react';
import { api, ApiError, visitorId } from '@/lib/api';
import { pounds2 } from '@/lib/format';
import { Notice, PrimaryButton, Quantity } from './ui';

export type TicketTypeView = { id: string; name: string; price_pence: number; fee_pence: number; face_value_pence: number | null; max_per_order: number; available: boolean };

/** Choose tickets and go to Stripe. The server re-prices everything; the numbers here are for display only. */
export function TicketPicker({ types, affiliateCode, maxPerOrder, ctaLabel = 'Book now' }: {
  types: TicketTypeView[]; affiliateCode?: string; maxPerOrder?: number; ctaLabel?: string;
}) {
  const firstAvailable = types.find((t) => t.available);
  const [typeId, setTypeId] = useState(firstAvailable?.id ?? '');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = types.find((x) => x.id === typeId);
  const max = Math.min(t?.max_per_order ?? 6, maxPerOrder ?? 20);

  async function go() {
    if (!t) return;
    setBusy(true); setError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const { url } = await api<{ url: string }>('checkout', {
        body: { ticketTypeId: t.id, quantity: qty, affiliateCode, visitorId: affiliateCode ? visitorId() : undefined, marketingChannel: params.get('utm_source') ?? undefined },
      });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  if (!firstAvailable) return <Notice>Sold out. Check back, as returned tickets go back on sale.</Notice>;

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="label">Tickets</legend>
        {types.map((x) => (
          <label key={x.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 ${x.id === typeId ? 'border-ink bg-white' : 'border-line bg-white/60'} ${!x.available ? 'opacity-50' : ''}`}>
            <span className="flex items-center gap-3">
              <input type="radio" name="tt" className="accent-ink" value={x.id} checked={x.id === typeId} disabled={!x.available} onChange={() => { setTypeId(x.id); setQty(1); }} />
              <span><span className="font-medium">{x.name}</span>{!x.available && <span className="ml-2 text-sm text-muted">Sold out</span>}</span>
            </span>
            <span className="text-right">
              <span className="font-semibold">{pounds2(x.price_pence + x.fee_pence)}</span>
              {x.face_value_pence && x.face_value_pence > x.price_pence && <span className="ml-2 text-sm text-muted line-through">{pounds2(x.face_value_pence)}</span>}
              {x.fee_pence > 0 && <span className="block text-xs text-muted">incl. {pounds2(x.fee_pence)} booking fee</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center justify-between">
        <Quantity value={qty} max={max} onChange={setQty} />
        {t && <p className="text-lg font-semibold">Total {pounds2((t.price_pence + t.fee_pence) * qty)}</p>}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <PrimaryButton onClick={go} disabled={busy || !t}>{busy ? 'Holding your tickets' : ctaLabel}</PrimaryButton>
      <p className="text-xs text-muted">We hold your tickets for 30 minutes while you pay. Your door passes appear in your wallet as soon as you pay.</p>
    </div>
  );
}
