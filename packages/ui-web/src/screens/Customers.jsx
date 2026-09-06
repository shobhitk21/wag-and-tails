/* Customers — the Directory in staff, People in admin. Shared by both. */
import { useNavigate, useParams } from 'react-router-dom';
import api from '@wag/api-client';
import { useApi } from '../useApi.js';
import { Loading, ErrorBox } from '../WebShell.jsx';
import { Ico } from '../Icon.jsx';
import {
  WTable, WCard, KpiCard, StatusDot, WButton, CareNote, EmptyState, inr
} from '../primitives.jsx';

export function CustomersScreen({ renderPage }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.customers.list(), []);

  const body = loading ? (
    <Loading />
  ) : error ? (
    <ErrorBox error={error} onRetry={reload} />
  ) : (
    <WCard>
      <WTable cols={['ID', 'Name', 'Phone', 'Area', 'Pets', 'Bookings', 'Lifetime value', 'Since']}>
        {data.customers.map((c) => (
          <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)}>
            <td className="table__id">{c.id}</td>
            <td className="table__strong">{c.name}</td>
            <td>{c.phone ?? '—'}</td>
            <td>{c.area ?? '—'}</td>
            <td>{c.pets_count}</td>
            <td>{c.bookings_count}</td>
            <td className="t-num table__strong">{inr(c.lifetime_spend)}</td>
            <td>{c.since_label}</td>
          </tr>
        ))}
      </WTable>
    </WCard>
  );

  return renderPage({
    title: 'Customers',
    sub: data ? `${data.total} registered` : undefined,
    body
  });
}

export function CustomerScreen({ renderPage, canBook = true }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.customers.get(id), [id]);

  if (loading) return renderPage({ title: 'Customer', body: <Loading /> });
  if (error) return renderPage({ title: 'Customer', body: <ErrorBox error={error} onRetry={reload} /> });

  const c = data.customer;

  const body = (
    <>
      <div className="wgrid wgrid--4">
        <KpiCard label="Bookings" value={String(c.bookings_count)} />
        <KpiCard label="Lifetime value" value={inr(c.lifetime_spend)} />
        <KpiCard label="Pets" value={String(c.pets_count)} />
        <KpiCard label="Customer since" value={c.since_label ?? '—'} />
      </div>

      {/* Pets, and with them the care notes the partner will read. Staff open
          this before a call so they can repeat back what the owner wrote. */}
      <WCard title="Pets" className="mt4">
        {data.pets.length === 0 ? (
          <div className="t-sm dim">No pets on this account yet.</div>
        ) : (
          <div className="wgrid wgrid--2">
            {data.pets.map((p) => (
              <div key={p.id}>
                <div className="t-h3">{p.name}</div>
                <div className="t-xs dim mt1">
                  {[p.breed, p.weight].filter(Boolean).join(' · ') || 'No details recorded'}
                </div>
                {p.care_note && (
                  <div className="mt3">
                    <CareNote note={p.care_note} petName={p.name} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </WCard>

      <WCard title="Booking history" className="mt4">
        {data.bookings.length ? (
          <WTable cols={['Booking', 'Service', 'When', 'Partner', 'Total', 'Status']}>
            {data.bookings.map((b) => (
              <tr key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}>
                <td className="table__id">{b.id}</td>
                <td>{b.service_label}</td>
                <td>{b.scheduled_label}</td>
                <td>{b.partner_name}</td>
                <td className="t-num">{inr(b.total)}</td>
                <td><StatusDot status={b.status} /></td>
              </tr>
            ))}
          </WTable>
        ) : (
          <div className="t-sm dim">No bookings yet.</div>
        )}
      </WCard>

      {data.orders.length > 0 && (
        <WCard title="Store orders" className="mt4">
          <WTable cols={['Order', 'Placed', 'Items', 'Total', 'Status']}>
            {data.orders.map((o) => (
              <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                <td className="table__id">{o.id}</td>
                <td>{o.placed_label}</td>
                <td>{o.item_count}</td>
                <td className="t-num">{inr(o.total)}</td>
                <td><StatusDot status={o.status} /></td>
              </tr>
            ))}
          </WTable>
        </WCard>
      )}
    </>
  );

  return renderPage({
    title: c.name,
    sub: [c.phone, c.area].filter(Boolean).join(' · '),
    search: false,
    actions: (
      <>
        {canBook && (
          <WButton variant="primary" onClick={() => navigate('/bookings/new')}>
            <Ico name="plus" size={15} /> Book for them
          </WButton>
        )}
        <WButton onClick={() => navigate(-1)}>Back</WButton>
      </>
    ),
    body
  });
}
