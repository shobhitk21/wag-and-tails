import { useEffect, useState } from 'react';
import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, Kv, Field, WButton,
  Avatar, useAuth, roleArt, roleLabel
} from '@wag/ui-web';

export default function Profile({ renderPage }) {
  const { user, updateUser } = useAuth();
  const [toast, setToast] = useToast();
  const [form, setForm] = useState({ name: '', shift: '' });
  const [busy, setBusy] = useState(false);

  /* Read from the API rather than from the session: the session holds what was
     true at sign-in, and this screen is where it gets changed. */
  const { data, error, loading, reload } = useApi(() => api.staff.profile(), [user?.code]);

  useEffect(() => {
    if (!data) return;
    setForm({ name: data.account.name, shift: data.account.shift ?? '' });
  }, [data]);

  if (loading) return renderPage({ title: 'Your profile', body: <Loading /> });
  if (error) return renderPage({ title: 'Your profile', body: <ErrorBox error={error} onRetry={reload} /> });

  const a = data.account;
  const dirty = form.name !== a.name || form.shift !== (a.shift ?? '');

  async function save() {
    setBusy(true);
    try {
      const { account } = await api.staff.updateProfile(form);
      updateUser({ name: account.name });
      setToast('Profile saved.');
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
        <WCard>
          <div className="row g4">
            <Avatar name={a.name} art={roleArt(a.role)} size={76} />
            <div className="grow">
              <div className="t-h1">{a.name}</div>
              <div className="t-sm dim mt1">{roleLabel(a.role)} · {a.email}</div>
            </div>
          </div>
          <div className="divider mt4 mb4" />
          <div className="wgrid wgrid--2">
            <Field
              label="Full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Field
              label="Shift"
              value={form.shift}
              placeholder="9 am – 6 pm"
              onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}
            />
          </div>

          {/* Not editable here even as a super admin: your email is your
              sign-in, and a role you can change from your own profile is not a
              role the API can rely on. Both live under Staff, where changing
              them is somebody's deliberate decision about an account. */}
          <div className="wgrid wgrid--2 mt3">
            <div>
              <div className="formlabel">Work email</div>
              <div className="field"><input className="field__input" value={a.email} readOnly /></div>
              <div className="t-2xs dim mt1">Your sign-in. Changed under Staff.</div>
            </div>
            <div>
              <div className="formlabel">Role</div>
              <div className="field"><input className="field__input" value={roleLabel(a.role)} readOnly /></div>
              <div className="t-2xs dim mt1">Nobody can change their own role.</div>
            </div>
          </div>

          <WButton variant="primary" className="mt4" disabled={busy || !dirty} onClick={save}>
            {busy ? 'Saving…' : 'Save changes'}
          </WButton>
        </WCard>

        <WCard title="Access">
          <Kv k="Role">{roleLabel(a.role)}</Kv>
          <Kv k="Console">Admin</Kv>
          <Kv k="Account">{a.code}</Kv>
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
