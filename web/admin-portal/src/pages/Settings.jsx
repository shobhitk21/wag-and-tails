import { useEffect, useState } from 'react';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, Field, StatusDot,
  Banner, WButton, Ico, useConfirm, downloadCsv
} from '@wag/ui-web';

const GROUP_TITLES = { business: 'Business', commission: 'Commission', policy: 'Policy' };

/* Settings actually write. The commission rates in particular are read back by
   the payouts and packages screens, so changing one here moves every derived
   payout figure in the console. */
export default function Settings({ renderPage }) {
  const [toast, setToast] = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const { data, error, loading, reload } = useApi(() => api.admin.settings(), []);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);

  /* Four files rather than one archive: a zip would need a bundler here and
     the point of the button is to get the rows out, not to package them. */
  async function exportAll() {
    setBusy(true);
    try {
      for (const dataset of ['bookings', 'orders', 'customers', 'partners']) {
        await downloadCsv(dataset);
      }
      setToast('Four CSVs downloaded: bookings, orders, customers, partners.');
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  /* Reads the current state from the settings themselves, so the button
     says what it will actually do rather than assuming bookings are live. */
  const paused = (data?.groups?.policy ?? [])
    .find((row) => row.key === 'bookings_paused')?.value === 'true';

  async function togglePause() {
    const ok = await confirm({
      title: paused ? 'Start taking bookings again?' : 'Pause all new bookings?',
      body: paused
        ? 'Customers will be able to book in the app again straight away.'
        : 'Customers will not be able to book anything new until this is switched back on. '
          + 'Bookings already in the diary are unaffected.',
      confirmLabel: paused ? 'Resume bookings' : 'Pause bookings',
      tone: paused ? 'primary' : 'danger'
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.admin.pauseBookings(!paused);
      setToast(paused ? 'Bookings are open again.' : 'New bookings are paused.');
      reload();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!data) return;
    const next = {};
    for (const rows of Object.values(data.groups)) {
      for (const r of rows) next[r.key] = r.value ?? '';
    }
    setValues(next);
  }, [data]);

  if (loading) return renderPage({ title: 'Settings', body: <Loading /> });
  if (error) return renderPage({ title: 'Settings', body: <ErrorBox error={error} onRetry={reload} /> });

  const dirty = Object.entries(values).some(([k, v]) => {
    const row = Object.values(data.groups).flat().find((r) => r.key === k);
    return row && (row.value ?? '') !== v;
  });

  async function save() {
    setBusy(true);
    try {
      const { updated } = await api.admin.updateSettings(values);
      setToast(`${updated} setting${updated === 1 ? '' : 's'} saved.`);
      reload();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <>
      <div className="wgrid wgrid--split">
        <div>
          {Object.entries(data.groups).map(([group, rows]) => (
            <WCard key={group} title={GROUP_TITLES[group] ?? group} className={group === 'business' ? '' : 'mt4'}>
              <div className="wgrid wgrid--2">
                {rows.map((r) => (
                  <Field
                    key={r.key}
                    label={r.label}
                    value={values[r.key] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))}
                  />
                ))}
              </div>
              {group === 'commission' && (
                <Banner tone="info" icon="info" className="mt4">
                  These rates drive the partner payout column on Packages and every
                  fee and net figure on Payouts.
                </Banner>
              )}
            </WCard>
          ))}

          <WCard title="Integrations" className="mt4">
            <div className="rows">
              {data.integrations.map((i) => (
                <div className="rowitem" key={i.id}>
                  <span className="rowitem__ico"><Ico name={i.icon} size={19} /></span>
                  <span className="grow">
                    <span className="rowitem__t" style={{ display: 'block' }}>{i.name}</span>
                    <span className="rowitem__s" style={{ display: 'block' }}>{i.detail}</span>
                  </span>
                  <StatusDot status={i.status} />
                </div>
              ))}
            </div>
            {/* The Build Book records this as a deliberate limit, so the console
                says it plainly rather than showing a dead WhatsApp connector. */}
            <Banner tone="warn" icon="alert" className="mt4">
              There is no WhatsApp integration. Staff read the message wherever it
              arrived, record the channel, and copy the confirmation to send by hand.
            </Banner>
          </WCard>
        </div>

        <WCard title="Danger zone">
          <div className="col g2">
            <WButton style={{ justifyContent: 'flex-start' }} disabled={busy} onClick={exportAll}>
              <Ico name="doc" size={15} /> Export all data
            </WButton>
            <WButton variant={paused ? 'primary' : 'danger'} style={{ justifyContent: 'flex-start' }}
              disabled={busy} onClick={togglePause}>
              <Ico name="alert" size={15} /> {paused ? 'Resume all bookings' : 'Pause all bookings'}
            </WButton>
          </div>
        </WCard>
      </div>
      <Toast message={toast} />
      {confirmDialog}
    </>
  );

  return renderPage({
    title: 'Settings',
    search: false,
    actions: (
      <WButton variant="primary" disabled={!dirty || busy} onClick={save}>
        {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
      </WButton>
    ),
    body
  });
}
