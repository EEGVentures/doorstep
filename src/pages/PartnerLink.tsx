// Partner show links (/go/CODE), e.g. from Blue Light Card or Tickets for Good.
// Nathan, 4 Nov 2026: these must never show the membership paywall. The visitor signs up
// (so we capture them, with consent), books and pays. Membership is offered later, never here.
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, visitorId } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Loader, Notice } from '@/components/ui';
import { AuthForm } from '@/components/AuthForm';
import { EventHeader, toView } from './EventPage';
import { TicketPicker } from '@/components/TicketPicker';

type LinkData = { code: string; valid: boolean; partnerName: string | null; maxPerOrder: number; event: any };

export default function PartnerLink() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const { session, ready } = useAuth();
  const q = useQuery({ queryKey: ['partner-link', code], queryFn: () => api<LinkData>(`affiliate?code=${encodeURIComponent(code)}`) });

  useEffect(() => {
    // Count the visit for partner reporting (deduplicated server-side).
    api('affiliate', { body: {
      code, visitorId: visitorId(), referrer: document.referrer || undefined,
      utm_source: params.get('utm_source') ?? undefined, utm_medium: params.get('utm_medium') ?? undefined, utm_campaign: params.get('utm_campaign') ?? undefined,
    } }).catch(() => {});
  }, [code, params]);

  if (q.isPending) return <Loader label="Loading your offer" />;
  if (q.isError || !q.data) return <Notice tone="error">This link isn’t valid. Please check it with the organisation that sent it.</Notice>;
  const { event: ev, valid, partnerName, maxPerOrder } = q.data;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-4">
        {partnerName && <p className="inline-block rounded-full bg-wash px-3 py-1 text-sm font-medium">Offer for {partnerName}</p>}
        <EventHeader ev={ev} />
      </div>
      <aside className="card h-fit space-y-4 p-6 lg:sticky lg:top-24">
        {params.get('cancelled') && <Notice>Payment cancelled. Your tickets have been released.</Notice>}
        {!valid ? <Notice>This offer has ended. Tickets through this link are no longer available.</Notice>
          : !ready ? <Loader mode="inline" />
          : session ? <TicketPicker types={toView(ev.ticket_types)} affiliateCode={q.data.code} maxPerOrder={maxPerOrder} ctaLabel="Book tickets" />
          : (
            <>
              <h2 className="text-xl font-semibold">Book your tickets</h2>
              <p className="text-sm text-muted">Create a free account so we can send your tickets. It takes a minute.</p>
              <AuthForm source="affiliate_checkout" cta="Continue to tickets" onDone={() => q.refetch()} />
            </>
          )}
      </aside>
    </div>
  );
}
