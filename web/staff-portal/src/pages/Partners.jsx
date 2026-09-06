import api from '@wag/api-client';
import {
  useApi, Loading, ErrorBox, WCard, WTable, StatusDot, Pill, RatingChip, inr
} from '@wag/ui-web';

/* Read-only for staff: they check who is available and where, but approving
   and suspending partners is admin work. */
export default function Partners({ renderPage }) {
  const { data, error, loading, reload } = useApi(() => api.partners.list(), []);

  const body = loading ? (
    <Loading />
  ) : error ? (
    <ErrorBox error={error} onRetry={reload} />
  ) : (
    <WCard>
      <WTable cols={['ID', 'Name', 'Type', 'Area', 'Rating', 'Jobs', 'Documents', 'Status']}>
        {data.partners.map((p) => (
          <tr key={p.id} className="is-static">
            <td className="table__id">{p.id}</td>
            <td className="table__strong">{p.name}</td>
            <td><Pill tone={p.kind === 'Groomer' ? 'accent' : 'ok'}>{p.kind}</Pill></td>
            <td>{p.area}</td>
            <td><RatingChip value={p.rating} /></td>
            <td>{p.jobs}</td>
            <td><StatusDot status={p.docs_status} /></td>
            <td><StatusDot status={p.status} /></td>
          </tr>
        ))}
      </WTable>
    </WCard>
  );

  return renderPage({
    title: 'Partners',
    sub: data ? `${data.total} registered` : undefined,
    body
  });
}
