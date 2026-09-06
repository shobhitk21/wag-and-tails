import { useState } from 'react';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, StatusDot,
  FilterChip, WButton, Ico
} from '@wag/ui-web';

/* Service areas. Groomer and walker counts are computed from the partners
   assigned to each area, so a suspended partner drops the coverage figure
   immediately rather than leaving a stale number on the screen. */
export default function Areas({ renderPage }) {
  const [toast, setToast] = useToast();
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useApi(() => api.admin.areas(), []);

  async function toggleSlot(s) {
    setBusy(true);
    try {
      await api.admin.toggleSlot(s.id);
      setToast(`${s.label} ${s.enabled ? 'closed' : 'opened'}.`);
      reload();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  const body = loading ? (
    <Loading />
  ) : error ? (
    <ErrorBox error={error} onRetry={reload} />
  ) : (
    <>
      <div className="wgrid wgrid--split">
        <WCard title="Coverage">
          <WTable cols={['Area', 'Groomers', 'Walkers', 'Status']}>
            {data.areas.map((a) => (
              <tr key={a.name} className="is-static">
                <td className="table__strong">{a.name}</td>
                <td>{a.groomers || <span style={{ color: 'var(--danger-600)' }}>0</span>}</td>
                <td>{a.walkers || <span style={{ color: 'var(--danger-600)' }}>0</span>}</td>
                <td><StatusDot status={a.status} /></td>
              </tr>
            ))}
          </WTable>
        </WCard>

        <WCard title="Booking slots">
          <div className="t-sm dim mb3">Slots offered to customers, per day. Click to open or close one.</div>
          <div className="row g2 wrap">
            {data.slots.map((s) => (
              <FilterChip key={s.id} on={s.enabled} disabled={busy} onClick={() => toggleSlot(s)}>
                {s.label}
              </FilterChip>
            ))}
          </div>
          <div className="divider mt4 mb4" />
          {data.policy.map((p) => (
            <div className="between mt3" key={p.key}>
              <span className="t-sm">{p.label}</span>
              <span className="t-sm" style={{ fontWeight: 600 }}>{p.value}</span>
            </div>
          ))}
        </WCard>
      </div>
      <Toast message={toast} />
    </>
  );

  return renderPage({
    title: 'Service areas',
    sub: 'Where Wag & Tails operates',
    actions: (
      <WButton variant="primary" onClick={() => setToast('Adding areas is not wired yet.')}>
        <Ico name="plus" size={16} /> Add area
      </WButton>
    ),
    body
  });
}
