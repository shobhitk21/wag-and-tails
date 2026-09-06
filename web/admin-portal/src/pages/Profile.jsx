import {
  useToast, Toast, WCard, Kv, Field, WButton, Avatar, useAuth, roleArt, roleLabel
} from '@wag/ui-web';

export default function Profile({ renderPage }) {
  const { user } = useAuth();
  const [toast, setToast] = useToast();

  const body = (
    <>
      <div className="wgrid wgrid--split">
        <WCard>
          <div className="row g4">
            <Avatar name={user.name} art={roleArt(user.role)} size={76} />
            <div className="grow">
              <div className="t-h1">{user.name}</div>
              <div className="t-sm dim mt1">{roleLabel(user.role)} · {user.email}</div>
            </div>
          </div>
          <div className="divider mt4 mb4" />
          <div className="wgrid wgrid--2">
            <Field label="Full name" defaultValue={user.name} />
            <Field label="Email" defaultValue={user.email} />
          </div>
          <WButton variant="primary" className="mt4"
            onClick={() => setToast('Editing your profile is not wired yet.')}>
            Save changes
          </WButton>
        </WCard>

        <WCard title="Access">
          <Kv k="Role">{roleLabel(user.role)}</Kv>
          <Kv k="Console">Admin</Kv>
          <Kv k="Account">{user.code}</Kv>
          <div className="t-2xs dim mt3">
            Super admin can edit the catalogue, release payouts and approve partners.
            The API enforces this, not only the sidebar.
          </div>
        </WCard>
      </div>
      <Toast message={toast} />
    </>
  );

  return renderPage({ title: 'Your profile', search: false, body });
}
