import { useNavigate } from 'react-router-dom';
import api from '@wag/api-client';
import {
  useApi, Loading, ErrorBox, WCard, WTable, KpiCard, StatusDot, Pill,
  WButton, Avatar, partnerArt, Ico
} from '@wag/ui-web';

/* Staff dashboard. Every number here is counted from the bookings table, so
   the screen tells the truth about the day rather than showing a snapshot. */
export default function Dashboard({ renderPage }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.staff.dashboard(), []);

  if (loading) return renderPage({ title: 'Dashboard', body: <Loading /> });
  if (error) return renderPage({ title: 'Dashboard', body: <ErrorBox error={error} onRetry={reload} /> });

  const { kpis, unassigned, today, staffEntered, onShift, greeting, shift } = data;

  const body = (
    <>
      <div className="wgrid wgrid--4">
        <KpiCard label="Today’s bookings" value={String(kpis.today)} />
        <KpiCard label="Unassigned" value={String(kpis.unassigned)} />
        <KpiCard label="Entered by staff" value={String(kpis.staffEntered)} />
        <KpiCard label="Store orders today" value={String(kpis.ordersToday)} />
      </div>

      {unassigned.length > 0 && (
        <WCard
          className="mt4"
          style={{ borderColor: 'var(--danger-600)' }}
          title={
            <div className="row g2">
              <span style={{ color: 'var(--danger-600)' }}><Ico name="alert" size={19} /></span>
              <div className="wcard__t">Needs a partner assigned</div>
            </div>
          }
          right={<WButton sm onClick={() => navigate('/bookings')}>View all</WButton>}
        >
          <WTable cols={['Booking', 'Customer', 'Service', 'When', '']}>
            {unassigned.map((b) => (
              <tr key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}>
                <td className="table__id">{b.id}</td>
                <td className="table__strong">{b.customer_name}</td>
                <td>{b.service_label}</td>
                <td>{b.scheduled_label}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="wbtn wbtn--accent wbtn--sm">Assign</span>
                </td>
              </tr>
            ))}
          </WTable>
        </WCard>
      )}

      <div className="wgrid wgrid--split mt4">
        <WCard
          title="Today’s schedule"
          right={<WButton sm onClick={() => navigate('/bookings')}>All bookings</WButton>}
        >
          {today.length === 0 ? (
            <div className="t-sm dim">Nothing booked for today.</div>
          ) : (
            <WTable cols={['Booking', 'Customer', 'Service', 'Partner', 'Status']}>
              {today.map((b) => (
                <tr key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}>
                  <td className="table__id">{b.id}</td>
                  <td className="table__strong">
                    {b.customer_name}
                    <div className="t-2xs dim">{b.scheduled_label}</div>
                  </td>
                  <td>
                    {b.service_label}
                    <div className="t-2xs dim">{b.pet_name}</div>
                  </td>
                  <td>{b.partner_name}</td>
                  <td><StatusDot status={b.status} /></td>
                </tr>
              ))}
            </WTable>
          )}
        </WCard>

        <WCard title="Quick actions">
          <div className="col g2">
            <WButton variant="primary" style={{ justifyContent: 'flex-start' }}
              onClick={() => navigate('/bookings/new')}>
              <Ico name="plus" size={15} /> Take a new booking
            </WButton>
            <WButton style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/customers')}>
              <Ico name="search" size={15} /> Look up a customer
            </WButton>
            <WButton style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/partners')}>
              <Ico name="brief" size={15} /> Check partner availability
            </WButton>
          </div>

          <div className="divider mt4 mb3" />
          <div className="wcard__t mb3" style={{ fontSize: 13 }}>Entered by staff</div>
          <div className="col g3">
            {staffEntered.length === 0 ? (
              <div className="t-sm dim">Nothing entered by hand yet.</div>
            ) : (
              staffEntered.map((b) => (
                <button
                  key={b.id}
                  className="row g3"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => navigate(`/bookings/${b.id}`)}
                >
                  <span className="rowitem__ico rowitem__ico--accent"><Ico name="cal" size={17} /></span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="between g2">
                      <span className="t-sm" style={{ fontWeight: 600 }}>{b.customer_name}</span>
                      <Pill>{b.channel}</Pill>
                    </span>
                    <span className="t-xs dim truncate" style={{ display: 'block', marginTop: 2 }}>
                      {b.service_label} · {b.scheduled_label}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </WCard>
      </div>

      <WCard title="Partners on shift" className="mt4">
        <div className="wgrid wgrid--4">
          {onShift.map((p) => (
            <div className="row g3" style={{ alignItems: 'center' }} key={p.id}>
              <Avatar name={p.name} art={partnerArt(p.kind)} size={38} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="t-sm" style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="t-2xs dim">{p.kind} · {p.area}</div>
              </div>
            </div>
          ))}
        </div>
      </WCard>
    </>
  );

  return renderPage({
    title: greeting ? `Good morning, ${greeting}` : 'Dashboard',
    sub: shift ? `Your shift: ${shift}` : undefined,
    actions: (
      <WButton variant="primary" onClick={() => navigate('/bookings/new')}>
        <Ico name="plus" size={16} /> New booking
      </WButton>
    ),
    body
  });
}
