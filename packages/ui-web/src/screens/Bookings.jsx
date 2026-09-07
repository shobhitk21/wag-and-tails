/* Bookings list and detail. Shared by both consoles — in the prototype these
   were stfBookings()/stfBooking() with the admin console re-exporting them. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@wag/api-client';
import { useApi, useToast } from '../useApi.js';
import { Loading, ErrorBox, Toast } from '../WebShell.jsx';
import { useConfirm } from '../ConfirmDialog.jsx';
import { useFormDialog } from '../FormDialog.jsx';
import { Avatar, partnerArt } from '../Brand.jsx';
import { Ico } from '../Icon.jsx';
import {
  WTable, WCard, StatusDot, Pill, Kv, Banner, WButton, FilterChip, CareNote, inr
} from '../primitives.jsx';

const FILTERS = [
  ['all', 'All'],
  ['today', 'Today'],
  ['unassigned', 'Needs partner'],
  ['whatsapp', 'From WhatsApp']
];

/* `canCreate` is the staff portal only — taking a booking on a customer's
   behalf is staff work, and the admin console's sidebar has no route for it. */
export function BookingsScreen({ renderPage, canCreate = false }) {
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.bookings.list(filter), [filter]);

  const body = loading ? (
    <Loading />
  ) : error ? (
    <ErrorBox error={error} onRetry={reload} />
  ) : (
    <>
      <div className="toolbar">
        {FILTERS.map(([key, label]) => (
          <FilterChip key={key} on={filter === key} onClick={() => setFilter(key)}>
            {label}
          </FilterChip>
        ))}
      </div>
      <WCard>
        {data.bookings.length === 0 ? (
          <div className="t-sm dim">No bookings match this filter.</div>
        ) : (
          <WTable cols={['Booking', 'Customer', 'Pet', 'Service', 'When', 'Partner', 'Channel', 'Total', 'Status']}>
            {data.bookings.map((b) => (
              <tr key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}>
                <td className="table__id">{b.id}</td>
                <td className="table__strong">{b.customer_name}</td>
                <td>{b.pet_name}</td>
                <td>{b.service_label}</td>
                <td>{b.scheduled_label}</td>
                <td>
                  {b.partner_name === 'Unassigned' ? (
                    <span style={{ color: 'var(--danger-600)', fontWeight: 600 }}>Unassigned</span>
                  ) : (
                    b.partner_name
                  )}
                </td>
                <td><Pill tone={b.channel === 'WhatsApp' ? 'ok' : 'muted'}>{b.channel}</Pill></td>
                <td className="t-num table__strong">{inr(b.total)}</td>
                <td><StatusDot status={b.status} /></td>
              </tr>
            ))}
          </WTable>
        )}
      </WCard>
    </>
  );

  return renderPage({
    title: 'Bookings',
    sub: data ? `${data.total} total` : undefined,
    actions: canCreate ? (
      <WButton variant="primary" onClick={() => navigate('/bookings/new')}>
        <Ico name="plus" size={16} /> New booking
      </WButton>
    ) : undefined,
    body
  });
}

export function BookingScreen({ renderPage, canCancel = true }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.bookings.get(id), [id]);
  const partners = useApi(() => api.partners.list(), []);
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const [openForm, formDialog] = useFormDialog();

  /* Slots come from the API rather than being listed here, because which
     ones are open is an operations decision made on the Service areas screen
     — offering a closed slot would book a job nobody is rostered for. */
  async function reschedule(booking) {
    let slots = [];
    try {
      const { slots: rows } = await api.admin.areas();
      slots = rows.filter((row) => row.enabled).map((row) => ({ value: row.label, label: row.label }));
    } catch {
      /* Bookings staff cannot read the admin screens. They can still move a
         booking within the slots this one could have been booked into. */
      slots = booking.slot_label ? [{ value: booking.slot_label, label: booking.slot_label }] : [];
    }
    if (!slots.length) {
      setToast('No booking slots are open at the moment.');
      return;
    }

    const moved = await openForm({
      title: `Reschedule ${booking.id}`,
      body: `Currently ${booking.scheduled_label}. The customer and the partner both see the change.`,
      submitLabel: 'Move booking',
      fields: [
        {
          name: 'dateLabel', label: 'Date', wide: true,
          value: booking.date_label ?? 'Tomorrow',
          placeholder: 'Tomorrow', hint: 'As the customer should read it — “Tomorrow”, “Sat 14 Mar”'
        },
        {
          name: 'slot', label: 'Slot', type: 'select', wide: true,
          value: booking.slot_label ?? slots[0].value, options: slots
        }
      ],
      submit: (v) => api.bookings.reschedule(booking.id, v.dateLabel, v.slot)
    });
    if (!moved) return;
    setToast(`Moved to ${moved.booking.scheduled_label}.`);
    reload();
  }

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

  function copyConfirmation() {
    navigator.clipboard
      ?.writeText(data.confirmation)
      .then(() => setToast('Message copied. Send it on ' + data.booking.channel + '.'))
      .catch(() => setToast('Could not copy — select the text and copy it by hand.'));
  }

  if (loading) return renderPage({ title: 'Booking', body: <Loading /> });
  if (error) return renderPage({ title: 'Booking', body: <ErrorBox error={error} onRetry={reload} /> });

  const b = data.booking;
  const assignable = (partners.data?.partners ?? []).filter(
    (p) => p.status === 'Active' && (b.service_kind === 'groom' ? p.kind === 'Groomer' : p.kind === 'Walker')
  );

  const body = (
    <>
      <div className="wgrid wgrid--split">
        <div>
          <WCard title="Details" right={<StatusDot status={b.status} />}>
            <Kv k="Customer">{b.customer_name}</Kv>
            <Kv k="Pet">{b.pet_name}{b.pet_breed ? ` · ${b.pet_breed}` : ''}</Kv>
            <Kv k="Service">{b.service_label}</Kv>
            <Kv k="When">{b.scheduled_label}</Kv>
            <Kv k="Channel">{b.channel}</Kv>
            <Kv k="Total">{inr(b.total)}</Kv>
            {b.address && <Kv k="Address">{b.address}</Kv>}
          </WCard>

          {/* The through-line. The partner sees this same sentence on their
              job sheet, because it is the same pets row. */}
          {b.care_note && (
            <div className="mt4">
              <CareNote note={b.care_note} petName={b.pet_name} />
            </div>
          )}

          <WCard title="Partner" className="mt4">
            {b.partner_name === 'Unassigned' ? (
              <>
                <Banner tone="warn" icon="alert" className="mb4">
                  No partner assigned. Assign one now or leave it as an open job for
                  partners to claim in the app.
                </Banner>
                {assignable.slice(0, 4).map((p) => (
                  <div className="tile row g3" key={p.id}>
                    <Avatar name={p.name} art={partnerArt(p.kind)} size={40} />
                    <span className="grow">
                      <span className="t-h3" style={{ display: 'block' }}>{p.name}</span>
                      <span className="t-xs dim" style={{ display: 'block', marginTop: 2 }}>
                        {p.kind} · {p.area}
                      </span>
                    </span>
                    <WButton
                      variant="primary"
                      sm
                      disabled={busy}
                      onClick={() => act(() => api.bookings.assign(b.id, p.id), `${p.name} assigned.`)}
                    >
                      Assign
                    </WButton>
                  </div>
                ))}
              </>
            ) : (
              <div className="row g3">
                <Avatar name={b.partner_name} art={partnerArt(b.service_kind === 'walk' ? 'Walker' : 'Groomer')} size={44} />
                <div className="grow">
                  <div className="t-h3">{b.partner_name}</div>
                  <div className="t-xs dim mt1">
                    Assigned · sees the care notes in the partner app
                  </div>
                </div>
                <WButton
                  sm
                  disabled={busy}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Take this job off ${b.partner_name}?`,
                      body: 'It goes back to the open pool for any partner to claim, '
                        + 'and they lose it immediately.',
                      confirmLabel: 'Reassign',
                      tone: 'danger'
                    });
                    if (ok) act(() => api.bookings.unassign(b.id), 'Published as an open job.');
                  }}
                >
                  Reassign
                </WButton>
              </div>
            )}
          </WCard>
        </div>

        <div>
          {/* No WhatsApp integration exists — staff copy this and send it
              themselves, which is the honest workflow the Build Book records. */}
          {data.confirmation && (
            <WCard title="Confirmation message" right={<Pill>Send manually</Pill>}>
              <div className="t-xs dim mb3">Copy this and send it to the customer on {b.channel}.</div>
              <div className="msgbox">{data.confirmation}</div>
              <WButton
                variant="primary"
                className="mt3"
                style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                onClick={copyConfirmation}
              >
                <Ico name="doc" size={15} /> Copy message
              </WButton>
            </WCard>
          )}

          <WCard title="Actions" className={data.confirmation ? 'mt4' : ''}>
            <div className="col g2">
              <WButton style={{ justifyContent: 'flex-start' }} disabled={busy}
                onClick={() => reschedule(b)}>
                <Ico name="cal" size={15} /> Reschedule
              </WButton>
              <WButton style={{ justifyContent: 'flex-start' }} onClick={() => setToast(`Calling ${b.customer_name}…`)}>
                <Ico name="phone" size={15} /> Call customer
              </WButton>
              {canCancel && b.status !== 'Cancelled' && (
                <WButton
                  variant="danger"
                  style={{ justifyContent: 'flex-start' }}
                  disabled={busy}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Cancel booking ${b.id}?`,
                      body: `${b.service_label} for ${b.pet_name}, ${b.scheduled_label}. `
                        + 'This cannot be undone — the customer keeps the record but the '
                        + 'slot is released.',
                      confirmLabel: 'Cancel booking',
                      cancelLabel: 'Keep it',
                      tone: 'danger'
                    });
                    if (ok) act(() => api.bookings.cancel(b.id), 'Booking cancelled.');
                  }}
                >
                  <Ico name="close" size={15} /> Cancel booking
                </WButton>
              )}
            </div>
          </WCard>

          <WCard title="Activity" className="mt4">
            <div className="ordertrack">
              {data.activity.map((a, i) => (
                <div
                  key={i}
                  className={`timeline__item${a.state === 'done' ? ' is-done' : ' is-now'}`}
                  style={{ paddingBottom: 14 }}
                >
                  <span className="timeline__dot" />
                  <div className="t-sm" style={{ fontWeight: 600 }}>{a.title}</div>
                  <div className="t-xs dim mt1">{a.detail}</div>
                </div>
              ))}
            </div>
          </WCard>
        </div>
      </div>
      <Toast message={toast} />
      {confirmDialog}
      {formDialog}
    </>
  );

  return renderPage({
    title: `Booking ${b.id}`,
    sub: `${b.service_label} · ${b.scheduled_label}`,
    search: false,
    actions: <WButton onClick={() => navigate(-1)}>Back</WButton>,
    body
  });
}
