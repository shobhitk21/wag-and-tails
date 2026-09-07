import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, KpiCard, useConfirm,
  StatusDot, WButton, Avatar, partnerArt, Ico, inr, useFormDialog
} from '@wag/ui-web';

export default function Partner({ renderPage }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [toast, setToast] = useToast();
  const [openForm, formDialog] = useFormDialog();
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const { data, error, loading, reload } = useApi(() => api.partners.get(id), [id]);

  async function act(fn, message) {
    setBusy(true);
    try {
      await fn();
      setToast(message);
      reload();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return renderPage({ title: 'Partner', body: <Loading /> });
  if (error) return renderPage({ title: 'Partner', body: <ErrorBox error={error} onRetry={reload} /> });

  const p = data.partner;

  /* The area list is fetched when the dialog opens rather than with the page:
     it is only needed for this one action, and typing an area free-hand would
     let a partner sit in an area that does not exist — invisible to the
     coverage counts and to every customer searching there. */
  async function changeArea() {
    let options = [];
    try {
      const { areas } = await api.admin.areas();
      options = areas.map((a) => ({
        value: a.name,
        label: a.status === 'Live' ? a.name : `${a.name} · ${a.status.toLowerCase()}`
      }));
    } catch (err) {
      setToast(err.message);
      return;
    }

    const saved = await openForm({
      title: `Change ${p.name}’s area`,
      body: 'They will start seeing open jobs in the new area, and stop seeing them in the old one.',
      submitLabel: 'Move partner',
      fields: [
        {
          name: 'area', label: 'Service area', type: 'select', wide: true,
          value: p.area ?? '', options
        }
      ],
      submit: (v) => api.partners.update(p.id, v)
    });
    if (!saved) return;
    setToast(`${p.name} now covers ${saved.partner.area}.`);
    reload();
  }

  const body = (
    <>
      <div className="row g4 mb4">
        <Avatar name={p.name} art={partnerArt(p.kind)} size={64} />
        <div className="grow">
          <div className="t-h1">{p.name}</div>
          <div className="t-sm dim mt1">{p.phone ?? 'No phone on file'}</div>
        </div>
      </div>

      <div className="wgrid wgrid--4">
        <KpiCard label="Jobs completed" value={String(p.jobs)} />
        <KpiCard label="Rating" value={Number(p.rating) ? String(p.rating) : '—'} />
        <KpiCard label="Pending payout" value={p.pending_payout ? inr(p.pending_payout) : '—'} />
        <KpiCard label="Status" value={p.status} />
      </div>

      <div className="wgrid wgrid--split mt4">
        <div>
          <WCard title="Documents">
            <WTable cols={['Document', 'Detail', 'Status']}>
              {data.documents.map((d) => (
                <tr key={d.name} className="is-static">
                  <td className="table__strong">{d.name}</td>
                  <td>{d.detail}</td>
                  <td><StatusDot status={d.verified ? 'Verified' : 'Renewal due'} /></td>
                </tr>
              ))}
            </WTable>
          </WCard>

          <WCard title="Recent bookings" className="mt4">
            {data.bookings.length === 0 ? (
              <div className="t-sm dim">No bookings assigned yet.</div>
            ) : (
              <WTable cols={['Booking', 'Customer', 'Service', 'When', 'Total', 'Status']}>
                {data.bookings.map((b) => (
                  <tr key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}>
                    <td className="table__id">{b.id}</td>
                    <td className="table__strong">{b.customer_name}</td>
                    <td>{b.service_label}</td>
                    <td>{b.scheduled_label}</td>
                    <td className="t-num">{inr(b.total)}</td>
                    <td><StatusDot status={b.status} /></td>
                  </tr>
                ))}
              </WTable>
            )}
          </WCard>
        </div>

        <WCard title="Actions">
          <div className="col g2">
            <WButton style={{ justifyContent: 'flex-start' }} onClick={() => setToast(`Calling ${p.name}…`)}>
              <Ico name="phone" size={15} /> Call partner
            </WButton>
            <WButton style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/payouts')}>
              <Ico name="wallet" size={15} /> View payouts
            </WButton>
            <WButton style={{ justifyContent: 'flex-start' }} disabled={busy}
              onClick={changeArea}>
              <Ico name="pin" size={15} /> Change service area
            </WButton>
            {p.status === 'Suspended' ? (
              <WButton variant="primary" style={{ justifyContent: 'flex-start' }} disabled={busy}
                onClick={() => act(() => api.partners.setStatus(p.id, 'Active'), `${p.name} reinstated.`)}>
                <Ico name="check" size={15} /> Reinstate partner
              </WButton>
            ) : (
              <WButton variant="danger" style={{ justifyContent: 'flex-start' }} disabled={busy}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Suspend ${p.name}?`,
                    body: 'They stop seeing open jobs and cannot claim new work. '
                      + `${p.pending_payout ? `Their pending ${inr(p.pending_payout)} is unaffected. ` : ''}`
                      + 'You can reinstate them from this screen.',
                    confirmLabel: 'Suspend',
                    tone: 'danger'
                  });
                  if (ok) act(() => api.partners.setStatus(p.id, 'Suspended'), `${p.name} suspended.`);
                }}>
                <Ico name="close" size={15} /> Suspend partner
              </WButton>
            )}
          </div>
        </WCard>
      </div>
      <Toast message={toast} />
      {formDialog}
      {confirmDialog}
    </>
  );

  return renderPage({
    title: p.name,
    sub: `${p.kind} · ${p.area} · ${p.id}`,
    search: false,
    actions: (
      <>
        <WButton onClick={() => navigate(-1)}>Back</WButton>
        {p.status === 'Pending' && (
          <WButton variant="primary" disabled={busy}
            onClick={() => act(() => api.partners.approve(p.id), `${p.name} approved.`)}>
            Approve partner
          </WButton>
        )}
      </>
    ),
    body
  });
}
