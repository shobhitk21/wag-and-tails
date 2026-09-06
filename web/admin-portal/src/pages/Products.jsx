import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, StatusDot,
  WButton, FilterChip, ProductSvg, Ico, inr
} from '@wag/ui-web';

export default function Products({ renderPage }) {
  const navigate = useNavigate();
  const [cat, setCat] = useState(null);
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.catalogue.products(cat), [cat]);

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
    </>
  );

  return renderPage({
    title: 'Products',
    sub: data ? `${data.total} listed · The Indian Pet Company` : undefined,
    actions: (
      <WButton variant="primary" onClick={() => setToast('Adding products is not wired yet.')}>
        <Ico name="plus" size={16} /> Add product
      </WButton>
    ),
    body
  });
}
