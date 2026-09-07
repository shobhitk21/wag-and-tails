import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, StatusDot,
  WButton, FilterChip, ProductSvg, Ico, inr, useFormDialog
} from '@wag/ui-web';

export default function Products({ renderPage }) {
  const navigate = useNavigate();
  const [openForm, formDialog] = useFormDialog();
  const [cat, setCat] = useState(null);
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.catalogue.products(cat), [cat]);

  /* Trade price is left optional: if it is blank the API derives it from the
     retail price at the standard partner rate, so a new product is sellable on
     both price ladders straight away rather than being invisible to partners
     until someone remembers to set it. */
  async function addProduct() {
    const made = await openForm({
      title: 'New product',
      body: 'Leave trade price blank to use the standard partner rate.',
      submitLabel: 'Add product',
      fields: [
        { name: 'name', label: 'Name', placeholder: 'Oatmeal & Neem Shampoo', wide: true },
        {
          name: 'categoryId', label: 'Category', type: 'select', wide: true,
          placeholder: 'Pick a category',
          options: (data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))
        },
        { name: 'mrp', label: 'MRP (₹)', placeholder: '700', inputMode: 'numeric' },
        { name: 'price', label: 'Price (₹)', placeholder: '599', inputMode: 'numeric' },
        { name: 'trade', label: 'Trade price (₹)', placeholder: 'Optional', inputMode: 'numeric' },
        {
          name: 'stock', label: 'Stock', type: 'select', value: 'In stock',
          options: [
            { value: 'In stock', label: 'In stock' },
            { value: 'Low stock', label: 'Low stock' },
            { value: 'Out of stock', label: 'Out of stock' }
          ]
        },
        { name: 'description', label: 'Description', type: 'textarea', wide: true },
        { name: 'ingredients', label: 'Ingredients', type: 'textarea', wide: true }
      ],
      /* Blank optional numbers must not be sent as "": the API would read that
         as a value and reject it, rather than falling back to its default. */
      submit: (v) => api.catalogue.createProduct(
        Object.fromEntries(Object.entries(v).filter(([, value]) => value !== ''))
      )
    });
    if (!made) return;
    setToast(`${made.product.name} added.`);
    reload();
  }

  const body = loading ? (
    <Loading />
  ) : error ? (
    <ErrorBox error={error} onRetry={reload} />
  ) : (
    <>
      <div className="toolbar">
        <FilterChip on={!cat} onClick={() => setCat(null)}>All</FilterChip>
        {data.categories.map((c) => (
          <FilterChip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>
            {c.name}
          </FilterChip>
        ))}
      </div>
      <WCard>
        <WTable cols={['', 'Product', 'Category', 'MRP', 'Retail', 'Trade', 'Margin', 'Stock', '']}>
          {data.products.map((p) => (
            <tr key={p.id} onClick={() => navigate(`/products/${p.id}`)}>
              <td style={{ width: 52 }}>
                <span className="cartline__img" style={{ width: 40, height: 40 }}>
                  <ProductSvg art={p.art} tone={p.tone} />
                </span>
              </td>
              <td className="table__strong">
                {p.name}
                <div className="t-2xs dim">{p.sizes.join(' · ')}</div>
              </td>
              <td>{p.category_name}</td>
              <td className="t-num">{inr(p.mrp)}</td>
              <td className="t-num table__strong">{inr(p.price)}</td>
              <td className="t-num">{inr(p.trade)}</td>
              <td className="t-num" style={{ color: 'var(--ok-600)', fontWeight: 600 }}>{p.margin}%</td>
              <td><StatusDot status={p.stock === 'In stock' ? 'Active' : 'Pending'} /></td>
              <td style={{ textAlign: 'right' }}>
                <span className="wbtn wbtn--ghost wbtn--sm">Edit</span>
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
    title: 'Products',
    sub: data ? `${data.total} listed · The Indian Pet Company` : undefined,
    actions: (
      <WButton variant="primary" onClick={addProduct}>
        <Ico name="plus" size={16} /> Add product
      </WButton>
    ),
    body
  });
}
