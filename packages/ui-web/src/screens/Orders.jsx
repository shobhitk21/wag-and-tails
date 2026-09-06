/* Store orders — The Indian Pet Company. Shared by both consoles. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@wag/api-client';
import { useApi, useToast } from '../useApi.js';
import { Loading, ErrorBox, Toast } from '../WebShell.jsx';
import { ProductSvg } from '../Brand.jsx';
import { Ico } from '../Icon.jsx';
import { WTable, WCard, StatusDot, Pill, Kv, WButton, inr } from '../primitives.jsx';

const channelTone = (c) => (c === 'WhatsApp' ? 'ok' : c === 'Partner' ? 'accent' : 'muted');

export function OrdersScreen({ renderPage }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.orders.list(), []);

  const body = loading ? (
    <Loading />
  ) : error ? (
    <ErrorBox error={error} onRetry={reload} />
  ) : (
    <WCard>
      <WTable cols={['Order', 'Customer', 'Placed', 'Items', 'Channel', 'Total', 'Status']}>
        {data.orders.map((o) => (
          <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
            <td className="table__id">{o.id}</td>
            <td className="table__strong">{o.customer_name}</td>
            <td>{o.placed_label}</td>
            <td>{o.item_count}</td>
            <td><Pill tone={channelTone(o.channel)}>{o.channel}</Pill></td>
            <td className="t-num table__strong">{inr(o.total)}</td>
            <td><StatusDot status={o.status} /></td>
          </tr>
        ))}
      </WTable>
    </WCard>
  );

  return renderPage({ title: 'Store orders', sub: 'The Indian Pet Company', body });
}

export function OrderScreen({ renderPage }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.orders.get(id), [id]);
  const [busy, setBusy] = useState(false);

  async function setStatus(status) {
    setBusy(true);
    try {
      await api.orders.setStatus(id, status);
      setToast(`Marked ${status.toLowerCase()}.`);
      reload();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return renderPage({ title: 'Order', body: <Loading /> });
  if (error) return renderPage({ title: 'Order', body: <ErrorBox error={error} onRetry={reload} /> });

  const o = data.order;
  const lineTotal = data.items.reduce((s, i) => s + i.qty * i.unit_price, 0);

  const body = (
    <>
      <div className="wgrid wgrid--split">
        <WCard title="Items" right={<StatusDot status={o.status} />}>
          {data.items.map((i) => (
            <div className="cartline" key={i.id}>
              <span className="cartline__img"><ProductSvg art={i.art} tone={i.tone} /></span>
              <div className="grow">
                <div className="t-sm" style={{ fontWeight: 600 }}>{i.name}</div>
                <div className="t-xs dim mt1">{i.size_label} · Qty {i.qty}</div>
              </div>
              <div className="t-sm" style={{ fontWeight: 600 }}>{inr(i.qty * i.unit_price)}</div>
            </div>
          ))}
          <div className="divider mt3 mb3" />
          <Kv k="Line items">{inr(lineTotal)}</Kv>
          <Kv k="Order total"><span className="t-h3">{inr(o.total)}</span></Kv>
        </WCard>

        <div>
          <WCard title="Fulfilment">
            <div className="col g2">
              <WButton variant="primary" style={{ justifyContent: 'flex-start' }}
                disabled={busy || o.status === 'Packed'} onClick={() => setStatus('Packed')}>
                <Ico name="bag" size={15} /> Mark packed
              </WButton>
              <WButton style={{ justifyContent: 'flex-start' }}
                disabled={busy || o.status === 'Out for delivery'} onClick={() => setStatus('Out for delivery')}>
                <Ico name="route" size={15} /> Out for delivery
              </WButton>
              <WButton style={{ justifyContent: 'flex-start' }}
                disabled={busy || o.status === 'Delivered'} onClick={() => setStatus('Delivered')}>
                <Ico name="check" size={15} /> Mark delivered
              </WButton>
              <WButton style={{ justifyContent: 'flex-start' }}
                onClick={() => setToast(`Calling ${o.customer_name}…`)}>
                <Ico name="phone" size={15} /> Call customer
              </WButton>
            </div>
          </WCard>

          <WCard title="Customer" className="mt4">
            <Kv k="Name">{o.customer_name}</Kv>
            <Kv k="Channel">{o.channel}</Kv>
            <Kv k="Placed">{o.placed_label}</Kv>
          </WCard>
        </div>
      </div>
      <Toast message={toast} />
    </>
  );

  return renderPage({
    title: `Order ${o.id}`,
    sub: `${o.customer_name} · ${o.placed_label}`,
    search: false,
    actions: <WButton onClick={() => navigate(-1)}>Back</WButton>,
    body
  });
}
