import { useNavigate } from 'react-router-dom';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, KpiCard, StatusDot,
  Pill, WButton, Chart, Donut, Banner, ProductSvg, Ico, inr
} from '@wag/ui-web';

/* Admin dashboard.
   KPI tiles and the two charts read the reporting snapshot — the prototype's
   612 bookings and ₹8,42,300 have no rows behind them yet, and inventing
   aggregates from six seed bookings would be worse than saying so. Everything
   under "Needs your attention" and the tables below is counted live. */
export default function Dashboard({ renderPage }) {
  const navigate = useNavigate();
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.admin.dashboard(), []);

  if (loading) return renderPage({ title: 'Dashboard', body: <Loading /> });
  if (error) return renderPage({ title: 'Dashboard', body: <ErrorBox error={error} onRetry={reload} /> });

  const { kpis, revenue, channels, donutTotal, attention, topPackages, bestsellers, latest } = data;

  const attentionRows = [
    ['Partner approval pending', `${attention.pendingPartners} applicant${attention.pendingPartners === 1 ? '' : 's'}`, '/partners', 'accent'],
    ['Payouts to release', `${attention.payoutBatches} batches · ${attention.payoutTotalLabel}`, '/payouts', 'accent'],
    ['Documents expiring', `${attention.expiringDocs} verification${attention.expiringDocs === 1 ? '' : 's'}`, '/partners', 'danger']
  ].filter((r) => !/^0 /.test(r[1]));

  const body = (
    <>
      <div className="wgrid wgrid--4">
        {kpis.map((k) => (
          <KpiCard key={k.key} label={k.label} value={k.value} delta={k.delta} up={k.positive} />
        ))}
      </div>

      <div className="wgrid wgrid--split mt4">
        <WCard title="Revenue by month" right={<span className="t-xs dim">₹ thousands</span>}>
          <Chart data={revenue} />
        </WCard>
        <WCard title="Where bookings come from">
          <Donut items={channels} total={donutTotal} />
          <Banner tone="accent" icon="chat" className="mt4">
            Over a quarter of bookings still arrive on WhatsApp and are entered by staff.
          </Banner>
        </WCard>
      </div>

      <div className="wgrid wgrid--3 mt4">
        <WCard title="Needs your attention">
          <div className="col g3">
            {attentionRows.length === 0 ? (
              <div className="t-sm dim">Nothing waiting on you.</div>
            ) : (
              attentionRows.map(([title, sub, to, tone]) => (
                <button
                  key={title}
                  className="row g3"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => navigate(to)}
                >
                  <span className={`rowitem__ico rowitem__ico--${tone === 'danger' ? 'danger' : 'accent'}`}>
                    <Ico name="alert" size={17} />
                  </span>
                  <span className="grow">
                    <span className="t-sm" style={{ fontWeight: 600, display: 'block' }}>{title}</span>
                    <span className="t-xs dim">{sub}</span>
                  </span>
                  <span className="chev"><Ico name="chev" size={15} /></span>
                </button>
              ))
            )}
          </div>
        </WCard>

        <WCard title="Top packages">
          {topPackages.map((p, i) => (
            <div className="row g3" style={{ padding: '7px 0' }} key={p.name}>
              <span className="t-sm" style={{ width: 16, color: 'var(--ink-4)', fontWeight: 700 }}>{i + 1}</span>
              <span className="grow t-sm" style={{ fontWeight: 600 }}>{p.name}</span>
              <span className="t-sm t-num dim">{p.booked} booked</span>
            </div>
          ))}
        </WCard>

        <WCard title="Store bestsellers">
          {bestsellers.map((p) => (
            <div className="row g3" style={{ padding: '7px 0' }} key={p.id}>
              <span className="cartline__img" style={{ width: 34, height: 34 }}>
                <ProductSvg art={p.art} tone={p.tone} />
              </span>
              <span className="grow t-sm" style={{ fontWeight: 600 }}>{p.name}</span>
              <span className="t-sm t-num dim">{p.reviews}</span>
            </div>
          ))}
        </WCard>
      </div>

      <WCard
        title="Latest bookings"
        className="mt4"
        right={<WButton sm onClick={() => navigate('/bookings')}>View all</WButton>}
      >
        <WTable cols={['Booking', 'Customer', 'Service', 'When', 'Partner', 'Channel', 'Total', 'Status']}>
          {latest.map((b) => (
            <tr key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}>
              <td className="table__id">{b.id}</td>
              <td className="table__strong">{b.customer_name}</td>
              <td>{b.service_label}</td>
              <td>{b.scheduled_label}</td>
              <td>{b.partner_name}</td>
              <td><Pill tone={b.channel === 'WhatsApp' ? 'ok' : 'muted'}>{b.channel}</Pill></td>
              <td className="t-num table__strong">{inr(b.total)}</td>
              <td><StatusDot status={b.status} /></td>
            </tr>
          ))}
        </WTable>
      </WCard>
      <Toast message={toast} />
    </>
  );

  return renderPage({
    title: 'Dashboard',
    sub: 'All channels',
    actions: (
      <WButton onClick={() => setToast('Date range picker is not wired yet.')}>
        <Ico name="cal" size={15} /> This month
      </WButton>
    ),
    body
  });
}
