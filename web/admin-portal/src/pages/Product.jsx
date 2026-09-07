import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, Kv, Field, TextArea,
  StatusDot, Banner, WButton, ProductSvg, Ico, inr
} from '@wag/ui-web';

/* Product detail. Editing here writes to the catalogue the customer app and the
   partner app both read — retail on one side, trade on the other. */
export default function Product({ renderPage }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.catalogue.product(id), [id]);

  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const p = data.product;
    setForm({
      name: p.name,
      description: p.description ?? '',
      ingredients: p.ingredients ?? '',
      mrp: String(p.mrp),
      price: String(p.price),
      trade: String(p.trade)
    });
  }, [data]);

  if (loading || !form) return renderPage({ title: 'Product', body: <Loading /> });
  if (error) return renderPage({ title: 'Product', body: <ErrorBox error={error} onRetry={reload} /> });

  const p = data.product;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  /* Margin recalculates as you type, so the effect of a price change is
     visible before it is saved. */
  const liveMargin = Math.round((1 - Number(form.trade) / Math.max(Number(form.price), 1)) * 100);

  async function save() {
    setBusy(true);
    try {
      await api.catalogue.updateProduct(id, {
        name: form.name,
        description: form.description,
        ingredients: form.ingredients,
        mrp: Number(form.mrp),
        price: Number(form.price),
        trade: Number(form.trade)
      });
      setToast('Product saved.');
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
          <WCard title="Details">
            <div className="wgrid wgrid--2">
              <Field label="Name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
              <Field label="Category" value={p.category_name ?? ''} readOnly />
            </div>
            <div className="mt3">
              <TextArea label="Description" value={form.description}
                onChange={(e) => set({ description: e.target.value })} />
            </div>
            <div className="mt3">
              <Field label="Ingredients" value={form.ingredients}
                onChange={(e) => set({ ingredients: e.target.value })} />
            </div>
          </WCard>

          <WCard title="Pricing" className="mt4">
            <div className="wgrid wgrid--3">
              <Field label="MRP" inputMode="numeric" value={form.mrp}
                onChange={(e) => set({ mrp: e.target.value.replace(/\D/g, '') })} />
              <Field label="Retail price" inputMode="numeric" value={form.price}
                onChange={(e) => set({ price: e.target.value.replace(/\D/g, '') })} />
              <Field label="Partner trade price" inputMode="numeric" value={form.trade}
                onChange={(e) => set({ trade: e.target.value.replace(/\D/g, '') })} />
            </div>
            <Banner tone="info" icon="info" className="mt4">
              Trade price is what groomers and walkers pay in the partner app. Currently{' '}
              {liveMargin}% below retail.
            </Banner>
          </WCard>

          <WCard title="Variants" className="mt4">
            <WTable cols={['Size', 'SKU', 'Status']}>
              {p.sizes.map((s, i) => (
                <tr key={s} className="is-static">
                  <td className="table__strong">{s}</td>
                  <td className="t-num">IPC-{p.id.toUpperCase()}-{i + 1}</td>
                  <td><StatusDot status="Active" /></td>
                </tr>
              ))}
            </WTable>
            <div className="t-2xs dim mt2">
              Per-variant stock is not tracked yet — the product carries one stock state.
            </div>
          </WCard>
        </div>

        <div>
          <WCard title="Image">
            <div className="gallery"><ProductSvg art={p.art} tone={p.tone} /></div>
            <WButton className="mt3" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setToast('Product art is drawn in code, not uploaded — photo upload needs file storage this build does not have.')}>
              <Ico name="cam" size={15} /> Upload images
            </WButton>
          </WCard>

          <WCard title="Performance" className="mt4">
            <Kv k="Units sold (30d)">{data.performance.units}</Kv>
            <Kv k="Revenue (30d)">{inr(data.performance.revenue)}</Kv>
            <Kv k="Rating">{p.rating} ({p.reviews})</Kv>
            <Kv k="Stock">{p.stock}</Kv>
            <div className="t-2xs dim mt2">
              Units and revenue are counted from real order lines.
            </div>
          </WCard>
        </div>
      </div>
      <Toast message={toast} />
    </>
  );

  return renderPage({
    title: p.name,
    sub: `Product ${p.id}`,
    search: false,
    actions: (
      <>
        <WButton onClick={() => navigate(-1)}>Back</WButton>
        <WButton variant="primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </WButton>
      </>
    ),
    body
  });
}
