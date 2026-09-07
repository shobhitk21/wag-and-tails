import { useState } from 'react';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, KpiCard,
  WButton, Chart, Donut, Banner, RatingChip, Pill, Ico, inr, downloadCsv
} from '@wag/ui-web';

const TABS = ['Revenue', 'Bookings', 'Partners', 'Store'];

/* Reports. The Revenue tab is the reporting snapshot; Bookings, Partners and
   Store aggregate the real tables, so those three grow as the business runs. */
/* Each tab exports the rows behind it. The Revenue tab's chart is the
   reporting snapshot rather than rows, so it exports the bookings those
   figures summarise — there is nothing else underneath it to hand over. */
const TAB_EXPORT = ['bookings', 'bookings', 'partners', 'orders'];

export default function Reports({ renderPage }) {
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.admin.reports(), []);

  if (loading) return renderPage({ title: 'Reports', body: <Loading /> });
  if (error) return renderPage({ title: 'Reports', body: <ErrorBox error={error} onRetry={reload} /> });

  async function exportTab() {
    setBusy(true);
    try {
      const filename = await downloadCsv(TAB_EXPORT[tab]);
      setToast(`${filename} downloaded.`);
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  const { kpis, revenue, lines, channels, donutTotal, byStatus, byChannel, byPartner, byProduct } = data;

  const panels = [
    /* Revenue */
    <>
      <div className="wgrid wgrid--4">
        {kpis.map((k) => (
          <KpiCard key={k.key} label={k.label} value={k.value} delta={k.delta} up={k.positive} />
        ))}
      </div>
      <WCard title="Monthly revenue" className="mt4" right={<span className="t-xs dim">₹ thousands</span>}>
        <Chart data={revenue} />
      </WCard>
      <div className="wgrid wgrid--2 mt4">
        <WCard title="Revenue by line">
          <WTable cols={['Line', 'Revenue', 'Share', 'Growth']}>
            {lines.map((r) => (
              <tr key={r.line} className="is-static">
                <td className="table__strong">{r.line}</td>
                <td className="t-num">{r.revenue}</td>
                <td>{r.share}</td>
                <td style={{ color: 'var(--ok-600)', fontWeight: 600 }}>{r.growth}</td>
              </tr>
            ))}
          </WTable>
        </WCard>
        <WCard title="Bookings by channel">
          <Donut items={channels} total={donutTotal} />
        </WCard>
      </div>
      <Banner tone="info" icon="info" className="mt4">
        These headline figures are a reporting snapshot carried over from the prototype.
        The Bookings, Partners and Store tabs aggregate live rows.
      </Banner>
    </>,

    /* Bookings */
    <>
      <div className="wgrid wgrid--2">
        <WCard title="By status">
          <WTable cols={['Status', 'Bookings', 'Revenue']}>
            {byStatus.map((r) => (
              <tr key={r.status} className="is-static">
                <td className="table__strong">{r.status}</td>
                <td className="t-num">{r.n}</td>
                <td className="t-num">{inr(r.revenue)}</td>
              </tr>
            ))}
          </WTable>
        </WCard>
        <WCard title="By channel">
          <WTable cols={['Channel', 'Bookings', 'Revenue']}>
            {byChannel.map((r) => (
              <tr key={r.channel} className="is-static">
                <td className="table__strong">
                  <Pill tone={r.channel === 'WhatsApp' ? 'ok' : 'muted'}>{r.channel}</Pill>
                </td>
                <td className="t-num">{r.n}</td>
                <td className="t-num">{inr(r.revenue)}</td>
              </tr>
            ))}
          </WTable>
        </WCard>
      </div>
    </>,

    /* Partners */
    <WCard title="Partner performance">
      <WTable cols={['Partner', 'Type', 'Rating', 'Bookings', 'Revenue']}>
        {byPartner.map((r) => (
          <tr key={r.name} className="is-static">
            <td className="table__strong">{r.name}</td>
            <td><Pill tone={r.kind === 'Groomer' ? 'accent' : 'ok'}>{r.kind}</Pill></td>
            <td><RatingChip value={r.rating} /></td>
            <td className="t-num">{r.bookings}</td>
            <td className="t-num table__strong">{inr(r.revenue)}</td>
          </tr>
        ))}
      </WTable>
    </WCard>,

    /* Store */
    <WCard title="Top products by revenue">
      {byProduct.length === 0 ? (
        <div className="t-sm dim">No store orders in the period.</div>
      ) : (
        <WTable cols={['Product', 'Units', 'Revenue']}>
          {byProduct.map((r) => (
            <tr key={r.name} className="is-static">
              <td className="table__strong">{r.name}</td>
              <td className="t-num">{r.units}</td>
              <td className="t-num table__strong">{inr(r.revenue)}</td>
            </tr>
          ))}
        </WTable>
      )}
    </WCard>
  ];

  const body = (
    <>
      <div className="tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`tabs__t${tab === i ? ' is-on' : ''}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>
      {panels[tab]}
      <Toast message={toast} />
    </>
  );

  return renderPage({
    title: 'Reports',
    sub: 'March – August 2026',
    actions: (
      <WButton disabled={busy} onClick={exportTab}>
        <Ico name="doc" size={15} /> Export CSV
      </WButton>
    ),
    body
  });
}
