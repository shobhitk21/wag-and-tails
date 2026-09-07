import { useState } from 'react';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, StatusDot,
  WButton, Ico, useFormDialog
} from '@wag/ui-web';

export default function Coupons({ renderPage }) {
  const [toast, setToast] = useToast();
  const [busy, setBusy] = useState(false);
  const [openForm, formDialog] = useFormDialog();
  const { data, error, loading, reload } = useApi(() => api.catalogue.coupons(), []);

  /* A new coupon is created switched off. Switching it on is the separate,
     deliberate step the toggle in the table already does — so a typo in a
     discount code is never live for the seconds between saving and reading. */
  async function create() {
    const made = await openForm({
      title: 'New coupon',
      body: 'It is saved switched off. Turn it on in the table when you are happy with it.',
      submitLabel: 'Create coupon',
      fields: [
        { name: 'code', label: 'Code', placeholder: 'FIRST20', hint: 'Letters and numbers' },
        { name: 'title', label: 'What it gives', placeholder: '20% off your first groom' },
        { name: 'subtitle', label: 'Small print', placeholder: 'Up to ₹400 off', wide: true },
        { name: 'appliesTo', label: 'Applies to', placeholder: 'All services' },
        { name: 'expiresOn', label: 'Expires', placeholder: '31 Dec 2026' }
      ],
      submit: (v) => api.catalogue.createCoupon(v)
    });
    if (!made) return;
    setToast(`${made.coupon.code} created — switch it on when you are ready.`);
    reload();
  }

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
      {formDialog}
    </>
  );

  return renderPage({
    title: 'Offers & coupons',
    sub: data ? `${data.active} active` : undefined,
    actions: (
      <WButton variant="primary" onClick={create}>
        <Ico name="plus" size={16} /> New coupon
      </WButton>
    ),
    body
  });
}
