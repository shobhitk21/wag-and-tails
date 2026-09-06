import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, StatusDot,
  Pill, Banner, WButton, Ico, inr
} from '@wag/ui-web';

/* Grooming packages, add-ons and walk pricing.
   Package names, inclusion counts, MRPs and prices are the client's own figures,
   reproduced verbatim. Partner payout is derived from the commission rate in
   Settings rather than stored, so the two can never disagree. */
export default function Packages({ renderPage }) {
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.catalogue.packages(), []);

  if (loading) return renderPage({ title: 'Grooming packages', body: <Loading /> });
  if (error) return renderPage({ title: 'Grooming packages', body: <ErrorBox error={error} onRetry={reload} /> });

  const body = (
    <>
      <WCard>
        <WTable cols={['Package', 'Services', 'Duration', 'MRP', 'Price', `Partner payout (−${data.fees.groomer_fee})`, 'Status']}>
          {data.packages.map((p) => (
            <tr key={p.id} className="is-static">
              <td className="table__strong">
                {p.name} {p.popular && <Pill tone="accent">Popular</Pill>}
                <div className="t-2xs dim">{p.blurb}</div>
              </td>
              <td>{p.inclusion_count}</td>
              <td>{p.mins} min</td>
              <td className="t-num">{inr(p.mrp)}</td>
              <td className="t-num table__strong">{inr(p.price)}</td>
              <td className="t-num">{inr(p.partner_payout)}</td>
              <td><StatusDot status={p.active ? 'Active' : 'Pending'} /></td>
            </tr>
          ))}
        </WTable>
      </WCard>

      <div className="wgrid wgrid--2 mt4">
        <WCard title="Add-ons">
          <WTable cols={['Add-on', 'Price', 'Attach rate']}>
            {data.addons.map((a) => (
              <tr key={a.id} className="is-static">
                <td className="table__strong">
                  {a.name}
                  <div className="t-2xs dim">{a.note}</div>
                </td>
                <td className="t-num">{inr(a.price)}</td>
                <td className="t-num">{a.attach_rate}%</td>
              </tr>
            ))}
          </WTable>
        </WCard>

        <WCard title="Walk pricing" right={<Pill tone="warn">Provisional</Pill>}>
          <WTable cols={['Duration', 'Price', `Partner payout (−${data.fees.walker_fee})`]}>
            {data.walks.map((w) => (
              <tr key={w.id} className="is-static">
                <td className="table__strong">
                  {w.mins} minutes
                  <div className="t-2xs dim">{w.km}</div>
                </td>
                <td className="t-num">{inr(w.price)}</td>
                <td className="t-num">{inr(w.partner_payout)}</td>
              </tr>
            ))}
          </WTable>
          <Banner tone="warn" icon="alert" className="mt3">
            Walk prices are placeholders pending a route and payout study. They are
            labelled provisional in both apps.
          </Banner>
        </WCard>
      </div>
      <Toast message={toast} />
    </>
  );

  return renderPage({
    title: 'Grooming packages',
    sub: 'What customers can book',
    actions: (
      <WButton variant="primary" onClick={() => setToast('Adding packages is not wired yet.')}>
        <Ico name="plus" size={16} /> Add package
      </WButton>
    ),
    body
  });
}
