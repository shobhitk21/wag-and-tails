import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, Kv, Banner, WButton,
  FilterChip, Field, TextArea, Price, Avatar, partnerArt, RatingChip, Ico, inr
} from '@wag/ui-web';

const CHANNELS = ['WhatsApp', 'Phone call', 'Instagram', 'Walk-in', 'Referral'];

/* The next five days, labelled the way nextDays() labelled them. */
function nextDays(n = 5) {
  const today = new Date();
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      key: `d${i}`,
      short: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${d.getDate()} ${MON[d.getMonth()]}`,
      long: i === 0 ? 'Today' : `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`
    };
  });
}

/* Create a booking on the customer's behalf.
   There is no WhatsApp integration: staff read the message wherever it arrived,
   record which channel that was, enter the booking here, then copy the
   generated confirmation and send it themselves. Recording the channel is what
   feeds the admin console's reporting. */
export default function NewBooking({ renderPage }) {
  const navigate = useNavigate();
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.catalogue.services(), []);
  const partners = useApi(() => api.partners.list(), []);

  const days = useMemo(() => nextDays(5), []);

  const [d, setD] = useState({
    channel: 'WhatsApp',
    customerName: '', phone: '', address: '',
    petName: '', breed: '', weight: '', careNote: '',
    serviceKind: 'groom', packageId: null, walkId: null,
    dateLabel: '', slot: '', partnerName: 'Unassigned'
  });
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState(null);

  const set = (patch) => setD((prev) => ({ ...prev, ...patch }));

  if (loading) return renderPage({ title: 'New booking', body: <Loading /> });
  if (error) return renderPage({ title: 'New booking', body: <ErrorBox error={error} onRetry={reload} /> });

  const pkg = data.packages.find((p) => p.id === d.packageId) ?? null;
  const walk = data.walks.find((w) => w.id === d.walkId) ?? null;
  const total = d.serviceKind === 'groom' ? pkg?.price ?? 0 : walk?.price ?? 0;

  const eligible = (partners.data?.partners ?? []).filter(
    (p) => p.status === 'Active' && (d.serviceKind === 'groom' ? p.kind === 'Groomer' : p.kind === 'Walker')
  );

  const ready = Boolean(d.customerName && d.petName && d.slot && d.dateLabel && (d.packageId || d.walkId));

  async function create() {
    setBusy(true);
    setFieldErrors(null);
    try {
      const { booking } = await api.bookings.create(d);
      navigate(`/bookings/${booking.id}`);
    } catch (err) {
      setFieldErrors(err.details ?? null);
      setToast(err.message);
      setBusy(false);
    }
  }

  const body = (
    <>
      <div className="wgrid wgrid--split">
        <div>
          <WCard title="1 · Where did this come from?">
            <div className="row g2 wrap">
              {CHANNELS.map((c) => (
                <FilterChip key={c} on={d.channel === c} onClick={() => set({ channel: c })}>
                  {c}
                </FilterChip>
              ))}
            </div>
            <Banner tone="info" icon="info" className="mt4">
              Read the customer’s message in WhatsApp as usual, then enter the details here.
              Recording the channel is what feeds the admin console’s reporting.
            </Banner>
          </WCard>

          <WCard title="2 · Customer" className="mt4">
            <div className="wgrid wgrid--2">
              <Field label="Name" value={d.customerName} placeholder="Full name"
                onChange={(e) => set({ customerName: e.target.value })} />
              <Field label="Phone" value={d.phone} placeholder="+91"
                onChange={(e) => set({ phone: e.target.value })} />
            </div>
            <div className="mt3">
              <Field label="Address" value={d.address} placeholder="Flat, building, area, pincode"
                onChange={(e) => set({ address: e.target.value })} />
            </div>
            <div className="t-2xs dim mt2">
              An existing customer is matched on phone, then name — no duplicate account is created.
            </div>
          </WCard>

          <WCard title="3 · Pet" className="mt4">
            <div className="wgrid wgrid--3">
              <Field label="Name" value={d.petName} onChange={(e) => set({ petName: e.target.value })} />
              <Field label="Breed" value={d.breed} onChange={(e) => set({ breed: e.target.value })} />
              <Field label="Weight" value={d.weight} placeholder="kg"
                onChange={(e) => set({ weight: e.target.value })} />
            </div>
            <div className="mt3">
              <TextArea
                label="Care notes — read out to the partner before they start"
                value={d.careNote}
                placeholder="Anything the customer mentioned on the call or chat"
                onChange={(e) => set({ careNote: e.target.value })}
              />
            </div>
            <div className="t-2xs dim mt2">
              This is saved on the pet’s profile, so the groomer or walker sees the same
              sentence on their job sheet in the app.
            </div>
          </WCard>

          <WCard title="4 · Service" className="mt4">
            <div className="row g2 mb3">
              <FilterChip on={d.serviceKind === 'groom'}
                onClick={() => set({ serviceKind: 'groom', walkId: null, partnerName: 'Unassigned' })}>
                Grooming
              </FilterChip>
              <FilterChip on={d.serviceKind === 'walk'}
                onClick={() => set({ serviceKind: 'walk', packageId: null, partnerName: 'Unassigned' })}>
                Dog walking
              </FilterChip>
            </div>

            {d.serviceKind === 'groom' ? (
              <div className="wgrid wgrid--2">
                {data.packages.map((p) => (
                  <button
                    key={p.id}
                    className={`tile row g3${d.packageId === p.id ? ' tile--sel' : ''}`}
                    style={{ marginTop: 0 }}
                    onClick={() => set({ packageId: p.id })}
                  >
                    <span className="grow">
                      <span className="t-h3" style={{ display: 'block' }}>{p.name}</span>
                      <span className="t-xs dim" style={{ display: 'block', marginTop: 2 }}>
                        {p.inclusions.length} services · {p.mins} min
                      </span>
                    </span>
                    <Price now={p.price} mrp={p.mrp} size="price--xs" />
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="wgrid wgrid--3">
                  {data.walks.map((w) => (
                    <button
                      key={w.id}
                      className={`tile${d.walkId === w.id ? ' tile--sel' : ''}`}
                      style={{ marginTop: 0 }}
                      onClick={() => set({ walkId: w.id })}
                    >
                      <div className="t-h3">{w.mins} minutes</div>
                      <div className="t-xs dim mt1">{w.note}</div>
                      <div className="mt2"><Price now={w.price} size="price--xs" /></div>
                    </button>
                  ))}
                </div>
                {data.walks.some((w) => w.provisional) && (
                  <Banner tone="warn" icon="alert" className="mt3">
                    Walk pricing is provisional pending a route and payout study.
                  </Banner>
                )}
              </>
            )}
          </WCard>

          <WCard title="5 · Slot" className="mt4">
            <div className="row g2 wrap mb3">
              {days.map((x) => (
                <FilterChip key={x.key} on={d.dateLabel === x.short}
                  onClick={() => set({ dateLabel: x.short })}>
                  {x.short}
                </FilterChip>
              ))}
            </div>
            <div className="row g2 wrap">
              {data.slots.filter((s) => s.enabled).map((s) => (
                <FilterChip key={s.label} on={d.slot === s.label} onClick={() => set({ slot: s.label })}>
                  {s.label}
                </FilterChip>
              ))}
            </div>
          </WCard>

          <WCard
            title="6 · Assign a partner"
            right={<span className="t-xs dim">Or leave unassigned and let partners claim it</span>}
            className="mt4"
          >
            {eligible.map((p) => (
              <button
                key={p.id}
                className={`tile row g3${d.partnerName === p.name ? ' tile--sel' : ''}`}
                onClick={() => set({ partnerName: p.name })}
              >
                <Avatar name={p.name} art={partnerArt(p.kind)} size={40} />
                <span className="grow">
                  <span className="t-h3" style={{ display: 'block' }}>{p.name}</span>
                  <span className="t-xs dim" style={{ display: 'block', marginTop: 2 }}>
                    {p.area} · {p.jobs} jobs
                  </span>
                </span>
                <RatingChip value={p.rating} />
              </button>
            ))}
            <button
              className={`tile row g3${d.partnerName === 'Unassigned' ? ' tile--sel' : ''}`}
              onClick={() => set({ partnerName: 'Unassigned' })}
            >
              <span className="rowitem__ico"><Ico name="brief" size={18} /></span>
              <span className="grow">
                <span className="t-h3" style={{ display: 'block' }}>Leave unassigned</span>
                <span className="t-xs dim" style={{ display: 'block', marginTop: 2 }}>
                  Publish to the partner app as an open job
                </span>
              </span>
            </button>
          </WCard>
        </div>

        <div>
          <WCard title="Summary" style={{ position: 'sticky', top: 0 }}>
            <Kv k="Channel">{d.channel || '—'}</Kv>
            <Kv k="Customer">{d.customerName || '—'}</Kv>
            <Kv k="Pet">{d.petName ? `${d.petName}${d.breed ? ` · ${d.breed}` : ''}` : '—'}</Kv>
            <Kv k="Service">
              {d.serviceKind === 'groom' ? pkg?.name ?? '—' : walk ? `${walk.mins} min walk` : '—'}
            </Kv>
            <Kv k="When">{d.slot && d.dateLabel ? `${d.dateLabel}, ${d.slot}` : '—'}</Kv>
            <Kv k="Partner">{d.partnerName}</Kv>
            <div className="divider mt2 mb2" />
            <Kv k="Total"><span className="t-h3">{inr(total)}</span></Kv>

            <div className="t-xs dim mt3">
              The customer pays after the service. Once saved you’ll get a confirmation
              message to copy and send them yourself.
            </div>

            {fieldErrors && (
              <div className="errbox mt3">
                {Object.entries(fieldErrors).map(([k, v]) => (
                  <div key={k}>{Array.isArray(v) ? v[0] : String(v)}</div>
                ))}
              </div>
            )}

            <WButton
              variant="primary"
              className="mt4"
              style={{ width: '100%', justifyContent: 'center', opacity: ready && !busy ? 1 : 0.5 }}
              disabled={!ready || busy}
              onClick={create}
            >
              {busy ? 'Creating…' : 'Create booking'}
            </WButton>
            <WButton
              className="mt3"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => navigate(-1)}
            >
              Cancel
            </WButton>
          </WCard>
        </div>
      </div>
      <Toast message={toast} />
    </>
  );

  return renderPage({
    title: 'New booking',
    sub: 'Entered by staff on the customer’s behalf',
    search: false,
    body
  });
}
