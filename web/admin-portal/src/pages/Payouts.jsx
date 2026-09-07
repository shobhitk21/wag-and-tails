import { useState } from 'react';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, KpiCard,
  StatusDot, WButton, EmptyState, useConfirm, inr
} from '@wag/ui-web';

/* Payouts. Gross comes from each partner's pending balance; the fee and net
   are derived from the commission rates in settings, so changing a rate there
   moves every figure on this screen. */
export default function Payouts({ renderPage }) {
  const [toast, setToast] = useToast();
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const { data, error, loading, reload } = useApi(() => api.admin.payouts(), []);

  if (loading) return renderPage({ title: 'Payouts', body: <Loading /> });
  if (error) return renderPage({ title: 'Payouts', body: <ErrorBox error={error} onRetry={reload} /> });

  async function release(kind, label, amount, count) {
    const ok = await confirm({
      title: kind === 'all' ? `Release all payouts — ${inr(amount)}?` : `Release the ${label}?`,
      body: `${inr(amount)} across ${count} partner${count === 1 ? '' : 's'} will be marked `
        + 'as paid and their pending balance cleared. This cannot be undone from here.',
      confirmLabel: 'Release',
      tone: 'danger'
    });
    if (!ok) return;

    setBusy(true);
    try {
      const { released } = await api.admin.releasePayouts(kind);
      setToast(released ? `${label} released to ${released} partner${released === 1 ? '' : 's'}.` : 'Nothing to release.');
      reload();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  const liveBatches = data.batches.filter((b) => b.rows.length > 0);

  const body = (
    <>
      <div className="wgrid wgrid--3">
        <KpiCard label="Ready to release" value={data.totalLabel} />
        {data.snapshot.map((m) => (
          <KpiCard key={m.key} label={m.label} value={m.value} />
        ))}
      </div>

      {liveBatches.length === 0 ? (
        <WCard className="mt4">
          <EmptyState icon="wallet" title="Nothing pending"
            sub="Every partner balance has been released." />
        </WCard>
      ) : (
        liveBatches.map((batch) => (
          <WCard
            key={batch.kind}
            className="mt4"
            title={`${batch.kind} · ${batch.schedule}`}
            right={
              <WButton
                variant="primary"
                sm
                disabled={busy}
                onClick={() => release(
                  batch.kind.replace(/s$/, ''),
                  `${batch.kind} batch`,
                  batch.rows.reduce((sum, r) => sum + r.gross, 0),
                  batch.rows.length
                )}
              >
                Release batch
              </WButton>
            }
          >
            <WTable
              cols={['Partner', batch.jobsLabel, 'Gross', `Fee (${batch.feeLabel})`, 'Net', 'Account', 'Status']}
            >
              {batch.rows.map((r) => (
                <tr key={r.id} className="is-static">
                  <td className="table__strong">{r.name}</td>
                  <td>{r.jobs}</td>
                  <td className="t-num">{inr(r.gross)}</td>
                  <td className="t-num" style={{ color: 'var(--danger-600)' }}>−{inr(r.fee)}</td>
                  <td className="t-num table__strong">{inr(r.net)}</td>
                  <td>{r.account ?? '—'}</td>
                  <td><StatusDot status={r.status} /></td>
                </tr>
              ))}
            </WTable>
          </WCard>
        ))
      )}
      <Toast message={toast} />
      {confirmDialog}
    </>
  );

  return renderPage({
    title: 'Payouts',
    sub: `${liveBatches.length} batch${liveBatches.length === 1 ? '' : 'es'} ready to release`,
    actions: data.total > 0 && (
      <WButton
        variant="primary"
        disabled={busy}
        onClick={() => release(
          'all',
          'All payouts',
          data.total,
          data.batches.reduce((n, b) => n + b.rows.length, 0)
        )}
      >
        Release all · {data.totalLabel}
      </WButton>
    ),
    body
  });
}
