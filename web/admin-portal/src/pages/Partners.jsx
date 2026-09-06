import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, StatusDot, Pill,
  RatingChip, WButton, Avatar, Ico, inr
} from '@wag/ui-web';

/* Partners, with the approval queue on top — the one piece of partner work
   only an admin can do. */
export default function Partners({ renderPage }) {
  const navigate = useNavigate();
  const [toast, setToast] = useToast();
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useApi(() => api.partners.list(), []);

  async function approve(p) {
    setBusy(true);
    try {
      await api.partners.approve(p.id);
      setToast(`${p.name} approved.`);
      reload();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return renderPage({ title: 'Partners', body: <Loading /> });
  if (error) return renderPage({ title: 'Partners', body: <ErrorBox error={error} onRetry={reload} /> });

  const pending = data.partners.filter((p) => p.status === 'Pending');

  const body = (
    <>
      {pending.length > 0 && (
        <WCard
          className="mb4"
          style={{ borderColor: 'var(--warn-600)' }}
          title={
            <div className="row g2">
              <span style={{ color: 'var(--warn-600)' }}><Ico name="alert" size={19} /></span>
              <div className="wcard__t">Applications awaiting approval</div>
            </div>
          }
        >
          {pending.map((p) => (
            <div className="tile row g3" key={p.id}>
              <Avatar name={p.name} art={['#6E5B4B', '#3D2E22']} size={44} />
              <span className="grow">
                <span className="t-h3" style={{ display: 'block' }}>{p.name}</span>
                <span className="t-xs dim" style={{ display: 'block', marginTop: 2 }}>
                  {p.kind} · {p.area} · documents {p.docs_status.toLowerCase()}
                </span>
              </span>
              <WButton sm onClick={() => navigate(`/partners/${p.id}`)}>Review</WButton>
              <WButton variant="primary" sm disabled={busy} onClick={() => approve(p)}>Approve</WButton>
            </div>
          ))}
        </WCard>
      )}

      <WCard>
        <WTable cols={['ID', 'Name', 'Type', 'Area', 'Rating', 'Jobs', 'Documents', 'Pending payout', 'Status']}>
          {data.partners.map((p) => (
            <tr key={p.id} onClick={() => navigate(`/partners/${p.id}`)}>
              <td className="table__id">{p.id}</td>
              <td className="table__strong">{p.name}</td>
              <td><Pill tone={p.kind === 'Groomer' ? 'accent' : 'ok'}>{p.kind}</Pill></td>
              <td>{p.area}</td>
              <td><RatingChip value={p.rating} /></td>
              <td>{p.jobs}</td>
              <td><StatusDot status={p.docs_status} /></td>
              <td className="t-num table__strong">{p.pending_payout ? inr(p.pending_payout) : '—'}</td>
              <td><StatusDot status={p.status} /></td>
            </tr>
          ))}
        </WTable>
      </WCard>
      <Toast message={toast} />
    </>
  );

  return renderPage({ title: 'Partners', sub: `${data.total} registered`, body });
}
