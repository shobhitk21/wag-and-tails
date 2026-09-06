import { useState } from 'react';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, StatusDot,
  WButton, Ico
} from '@wag/ui-web';

export default function Coupons({ renderPage }) {
  const [toast, setToast] = useToast();
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useApi(() => api.catalogue.coupons(), []);

  async function toggle(c) {
    setBusy(true);
    try {
      await api.catalogue.toggleCoupon(c.id);
      setToast(`${c.code} ${c.active ? 'paused' : 'activated'}.`);
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
      <WCard>
        <WTable cols={['Code', 'Offer', 'Applies to', 'Expires', 'Redeemed', 'Status', '']}>
          {data.coupons.map((c) => (
            <tr key={c.id} className="is-static">
              <td className="table__id">{c.code}</td>
              <td className="table__strong">
                {c.title}
                <div className="t-2xs dim">{c.subtitle}</div>
              </td>
              <td>{c.applies_to}</td>
              <td>{c.expires_on}</td>
              <td className="t-num">{c.redeemed}</td>
              <td><StatusDot status={c.active ? 'Active' : 'Pending'} /></td>
              <td style={{ textAlign: 'right' }}>
                <WButton sm disabled={busy} onClick={() => toggle(c)}>
                  {c.active ? 'Pause' : 'Activate'}
                </WButton>
              </td>
            </tr>
          ))}
        </WTable>
      </WCard>
      <Toast message={toast} />
    </>
  );

  return renderPage({
    title: 'Offers & coupons',
    sub: data ? `${data.active} active` : undefined,
    actions: (
      <WButton variant="primary" onClick={() => setToast('Creating coupons is not wired yet.')}>
        <Ico name="plus" size={16} /> New coupon
      </WButton>
    ),
    body
  });
}
