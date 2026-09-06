import { useEffect, useState } from 'react';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, Field, StatusDot,
  Banner, WButton, Ico
} from '@wag/ui-web';

const GROUP_TITLES = { business: 'Business', commission: 'Commission', policy: 'Policy' };

/* Settings actually write. The commission rates in particular are read back by
   the payouts and packages screens, so changing one here moves every derived
   payout figure in the console. */
export default function Settings({ renderPage }) {
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.admin.settings(), []);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);

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
            <WButton style={{ justifyContent: 'flex-start' }} onClick={() => setToast('Export is not wired yet.')}>
              <Ico name="doc" size={15} /> Export all data
            </WButton>
            <WButton variant="danger" style={{ justifyContent: 'flex-start' }}
              onClick={() => setToast('Pausing all bookings is not wired yet.')}>
              <Ico name="alert" size={15} /> Pause all bookings
            </WButton>
          </div>
        </WCard>
      </div>
      <Toast message={toast} />
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
