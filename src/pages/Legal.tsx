import { useParams } from 'react-router-dom';
// Placeholder until the solicitor-approved terms, privacy and refund policies are ready.
const TITLES: Record<string, string> = { terms: 'Terms of use', privacy: 'Privacy policy', refunds: 'Refunds and cancellations' };
export default function Legal() {
  const { doc = '' } = useParams();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">{TITLES[doc] ?? 'Not found'}</h1>
      <p className="text-muted">This page is being finalised and will be published before launch. Questions: <a className="link" href="mailto:support@doorstep.live">support@doorstep.live</a></p>
    </div>
  );
}
