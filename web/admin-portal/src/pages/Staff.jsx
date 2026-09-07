import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, WTable, StatusDot,
  WButton, Avatar, roleArt, roleLabel, Ico, useFormDialog, useConfirm
} from '@wag/ui-web';

const ROLES = [
  { value: 'bookings_staff', label: 'Bookings staff' },
  { value: 'support', label: 'Support' },
  { value: 'super_admin', label: 'Super admin' }
];

export default function Staff({ renderPage }) {
  const [toast, setToast] = useToast();
  const [openForm, formDialog] = useFormDialog();
  const [confirm, confirmDialog] = useConfirm();
  const { data, error, loading, reload } = useApi(() => api.admin.staff(), []);

  /* An invite creates the account switched off and with no password, so it
     cannot be signed into until someone sets one. An invite that produced a
     working login with a known default would be a back door. */
  async function invite() {
    const made = await openForm({
      title: 'Invite a colleague',
      body: 'They are added inactive. Set them a password and switch them on when they are ready.',
      submitLabel: 'Send invite',
      fields: [
        { name: 'name', label: 'Name', placeholder: 'Priya Nair', wide: true },
        { name: 'email', label: 'Work email', placeholder: 'priya@wagandtails.in', type: 'email', wide: true },
        { name: 'role', label: 'Role', type: 'select', value: 'bookings_staff', options: ROLES },
        { name: 'shift', label: 'Shift', placeholder: '9 am – 6 pm' }
      ],
      submit: (v) => api.admin.inviteStaff(v)
    });
    if (!made) return;
    setToast(made.note);
    reload();
  }

  async function manage(member) {
    const saved = await openForm({
      title: `Manage ${member.name}`,
      body: 'Switching someone off ends every session they have open straight away.',
      submitLabel: 'Save changes',
      fields: [
        { name: 'name', label: 'Name', value: member.name, wide: true },
        { name: 'role', label: 'Role', type: 'select', value: member.role, options: ROLES },
        { name: 'shift', label: 'Shift', value: member.shift ?? '' },
        {
          name: 'active', label: 'Access', type: 'checkbox',
          checkboxLabel: 'Can sign in', value: member.active, wide: true
        }
      ],
      submit: async (v) => {
        /* Revoking access is the one change here that logs somebody out
           mid-shift, so it gets its own confirmation rather than being one
           unchecked box away. */
        if (member.active && !v.active) {
          const ok = await confirm({
            title: `Switch off ${member.name}?`,
            body: 'They are signed out everywhere immediately and cannot sign back in.',
            confirmLabel: 'Switch off',
            tone: 'danger'
          });
          if (!ok) throw new Error('Left unchanged.');
        }
        return api.admin.updateStaff(member.code, v);
      }
    });
    if (!saved) return;
    setToast(`${saved.member.name} updated.`);
    reload();
  }

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
                <WButton sm onClick={() => manage(s)}>
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
      {formDialog}
      {confirmDialog}
    </>
  );

  return renderPage({
    title: 'Staff',
    sub: data ? `${data.staff.length} accounts` : undefined,
    actions: (
      <WButton variant="primary" onClick={invite}>
        <Ico name="plus" size={16} /> Invite staff
      </WButton>
    ),
    body
  });
}
