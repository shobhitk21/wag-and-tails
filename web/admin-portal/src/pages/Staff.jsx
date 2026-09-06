import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, StatusDot,
  WButton, Avatar, roleArt, roleLabel, Ico
} from '@wag/ui-web';

export default function Staff({ renderPage }) {
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.admin.staff(), []);

  const body = loading ? (
    <Loading />
  ) : error ? (
    <ErrorBox error={error} onRetry={reload} />
  ) : (
    <>
      <WCard>
        <WTable cols={['Name', 'Role', 'Shift', 'Handled today', 'Bookings created', 'Status', '']}>
          {data.staff.map((s) => (
            <tr key={s.code} className="is-static">
              <td className="table__strong">
                <div className="row g2">
                  <Avatar name={s.name} art={[s.art_from, s.art_to]} size={30} />
                  <span>{s.name}</span>
                </div>
              </td>
              <td>{roleLabel(s.role)}</td>
              <td>{s.shift}</td>
              <td className="t-num">{s.handled_today}</td>
              <td className="t-num">{s.bookings_created}</td>
              <td><StatusDot status={s.active ? 'Active' : 'Pending'} /></td>
              <td style={{ textAlign: 'right' }}>
                <WButton sm onClick={() => setToast('Managing staff accounts is not wired yet.')}>
                  Manage
                </WButton>
              </td>
            </tr>
          ))}
        </WTable>
      </WCard>

      {/* These are the same rows the API enforces on every guarded route, not
          a separate document that can drift out of date. */}
      <WCard title="Permissions" className="mt4">
        <WTable cols={['Capability', 'Bookings staff', 'Support', 'Super admin']}>
          {data.permissions.map((r) => (
            <tr key={r.capability} className="is-static">
              <td className="table__strong">{r.capability}</td>
              {[r.bookings_staff, r.support, r.super_admin].map((v, i) => (
                <td key={i}>
                  {v ? (
                    <span style={{ color: 'var(--ok-600)' }}><Ico name="check" size={17} /></span>
                  ) : (
                    <span style={{ color: 'var(--ink-4)' }}><Ico name="close" size={15} /></span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </WTable>
      </WCard>
      <Toast message={toast} />
    </>
  );

  return renderPage({
    title: 'Staff',
    sub: data ? `${data.staff.length} accounts` : undefined,
    actions: (
      <WButton variant="primary" onClick={() => setToast('Inviting staff is not wired yet.')}>
        <Ico name="plus" size={16} /> Invite staff
      </WButton>
    ),
    body
  });
}
