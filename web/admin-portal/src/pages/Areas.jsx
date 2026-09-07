import { useState } from 'react';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, StatusDot,
  FilterChip, WButton, Ico, useFormDialog
} from '@wag/ui-web';

/* Service areas. Groomer and walker counts are computed from the partners
   assigned to each area, so a suspended partner drops the coverage figure
   immediately rather than leaving a stale number on the screen. */
export default function Areas({ renderPage }) {
  const [openForm, formDialog] = useFormDialog();
  const [toast, setToast] = useToast();
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useApi(() => api.admin.areas(), []);

  /* A new area opens Pending, not Live. Coverage on this screen is counted
     from the partners who list the area, so an area switched on before anyone
     works there would take bookings nobody can be assigned to. */
  async function addArea() {
    const made = await openForm({
      title: 'Open a service area',
      body: 'It starts pending. Switch it live once you have groomers or walkers covering it.',
      submitLabel: 'Add area',
      fields: [
        { name: 'name', label: 'Area', placeholder: 'Bandra West', wide: true },
        {
          name: 'status', label: 'Status', type: 'select', wide: true,
          value: 'Pending',
          options: [
            { value: 'Pending', label: 'Pending — not taking bookings yet' },
            { value: 'Live', label: 'Live — open for bookings' },
            { value: 'Paused', label: 'Paused' }
          ]
        }
      ],
      submit: (v) => api.admin.createArea(v)
    });
    if (!made) return;
    setToast(`${made.area.name} added as ${made.area.status.toLowerCase()}.`);
    reload();
  }

  async function editArea(area) {
    const saved = await openForm({
      title: `Edit ${area.name}`,
      body: 'Renaming an area moves every partner in it across too.',
      submitLabel: 'Save area',
      fields: [
        { name: 'name', label: 'Area', value: area.name, wide: true },
        {
          name: 'status', label: 'Status', type: 'select', wide: true,
          value: area.status,
          options: [
            { value: 'Live', label: 'Live — open for bookings' },
            { value: 'Pending', label: 'Pending — not taking bookings yet' },
            { value: 'Paused', label: 'Paused' }
          ]
        }
      ],
      submit: (v) => api.admin.updateArea(area.name, v)
    });
    if (!saved) return;
    setToast(`${saved.area.name} saved.`);
    reload();
  }

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
          <WTable cols={['Area', 'Groomers', 'Walkers', 'Status', '']}>
            {data.areas.map((a) => (
              <tr key={a.name} className="is-static">
                <td className="table__strong">{a.name}</td>
                <td>{a.groomers || <span style={{ color: 'var(--danger-600)' }}>0</span>}</td>
                <td>{a.walkers || <span style={{ color: 'var(--danger-600)' }}>0</span>}</td>
                <td><StatusDot status={a.status} /></td>
                <td style={{ textAlign: 'right' }}>
                  <WButton sm variant="ghost" disabled={busy} onClick={() => editArea(a)}>
                    Edit
                  </WButton>
                </td>
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
      {formDialog}
    </>
  );

  return renderPage({
    title: 'Service areas',
    sub: 'Where Wag & Tails operates',
    actions: (
      <WButton variant="primary" onClick={addArea}>
        <Ico name="plus" size={16} /> Add area
      </WButton>
    ),
    body
  });
}
