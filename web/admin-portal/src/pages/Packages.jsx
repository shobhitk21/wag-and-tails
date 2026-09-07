import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, StatusDot,
  Pill, Banner, WButton, Ico, inr, useFormDialog
} from '@wag/ui-web';

/* Grooming packages, add-ons and walk pricing.
   Package names, inclusion counts, MRPs and prices are the client's own figures,
   reproduced verbatim. Partner payout is derived from the commission rate in
   Settings rather than stored, so the two can never disagree. */
export default function Packages({ renderPage }) {
  const [toast, setToast] = useToast();
  const [openForm, formDialog] = useFormDialog();
  const { data, error, loading, reload } = useApi(() => api.catalogue.packages(), []);

  /* Inclusions are typed one per line rather than added one at a time: the
     list is what becomes the partner's checklist on the job sheet, and it is
     easier to get right when you can see the whole thing at once. */
  async function addPackage() {
    const made = await openForm({
      title: 'New grooming package',
      body: 'The inclusion list becomes the checklist the groomer works through on the job.',
      submitLabel: 'Create package',
      fields: [
        { name: 'name', label: 'Name', placeholder: 'Premium groom', wide: true },
        { name: 'blurb', label: 'One-line description', placeholder: 'Everything in Classic, plus styling', wide: true },
        { name: 'mrp', label: 'MRP (₹)', placeholder: '1800', inputMode: 'numeric' },
        { name: 'price', label: 'Price (₹)', placeholder: '1499', inputMode: 'numeric' },
        { name: 'mins', label: 'Takes (minutes)', placeholder: '90', inputMode: 'numeric' },
        { name: 'popular', label: 'Badge', type: 'checkbox', checkboxLabel: 'Mark as popular' },
        {
          name: 'inclusions', label: 'What is included', type: 'textarea', wide: true,
          placeholder: 'Bath and blow dry\nNail trim\nEar clean',
          hint: 'One per line'
        }
      ],
      submit: (v) => api.catalogue.createPackage({
        ...v,
        inclusions: (v.inclusions ?? '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      })
    });
    if (!made) return;
    setToast(`${made.package.name} created.`);
    reload();
  }

  async function editPackage(pkg) {
    const saved = await openForm({
      title: `Edit ${pkg.name}`,
      submitLabel: 'Save package',
      fields: [
        { name: 'name', label: 'Name', value: pkg.name, wide: true },
        { name: 'blurb', label: 'One-line description', value: pkg.blurb ?? '', wide: true },
        { name: 'mrp', label: 'MRP (₹)', value: String(pkg.mrp), inputMode: 'numeric' },
        { name: 'price', label: 'Price (₹)', value: String(pkg.price), inputMode: 'numeric' },
        { name: 'mins', label: 'Takes (minutes)', value: String(pkg.mins), inputMode: 'numeric' },
        { name: 'popular', label: 'Badge', type: 'checkbox', checkboxLabel: 'Mark as popular', value: pkg.popular },
        { name: 'active', label: 'Availability', type: 'checkbox', checkboxLabel: 'Offered to customers', value: pkg.active }
      ],
      submit: (v) => api.catalogue.updatePackage(pkg.id, v)
    });
    if (!saved) return;
    setToast(`${saved.package.name} saved.`);
    reload();
  }

  if (loading) return renderPage({ title: 'Grooming packages', body: <Loading /> });
  if (error) return renderPage({ title: 'Grooming packages', body: <ErrorBox error={error} onRetry={reload} /> });

  const body = (
    <>
      <WCard>
        <WTable cols={['Package', 'Services', 'Duration', 'MRP', 'Price', `Partner payout (−${data.fees.groomer_fee})`, 'Status', '']}>
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
              <td style={{ textAlign: 'right' }}>
                <WButton sm variant="ghost" onClick={() => editPackage(p)}>Edit</WButton>
              </td>
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
      {formDialog}
    </>
  );

  return renderPage({
    title: 'Grooming packages',
    sub: 'What customers can book',
    actions: (
      <WButton variant="primary" onClick={addPackage}>
        <Ico name="plus" size={16} /> Add package
      </WButton>
    ),
    body
  });
}
