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
      /* The sidebar reads the name from the session, so it is updated here as
         well as refetched — otherwise the header would keep the old name until
         the next sign-in. */
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

          {/* Email is the login identifier and your role is somebody else's
              decision, so neither is editable here — changing them from your
              own profile page would be a way to lock yourself out or to
              promote yourself. Both are shown so the page is still a complete
              picture of the account. */}
          <div className="wgrid wgrid--2 mt3">
            <div>
              <div className="formlabel">Work email</div>
              <div className="field"><input className="field__input" value={a.email} readOnly /></div>
              <div className="t-2xs dim mt1">Ask an admin to change this — it is your sign-in.</div>
            </div>
            <div>
              <div className="formlabel">Role</div>
              <div className="field"><input className="field__input" value={roleLabel(a.role)} readOnly /></div>
              <div className="t-2xs dim mt1">Set by a super admin.</div>
            </div>
          </div>

          <WButton variant="primary" className="mt4" disabled={busy || !dirty} onClick={save}>
            {busy ? 'Saving…' : 'Save changes'}
          </WButton>
        </WCard>

        <WCard title="This shift">
          <Kv k="Shift">{a.shift ?? '—'}</Kv>
          <Kv k="Bookings created">{data.shiftStats.bookingsCreated}</Kv>
          <Kv k="Messages handled">{data.shiftStats.messagesHandled}</Kv>
        </WCard>
      </div>
      <Toast message={toast} />
    </>
  );

  return renderPage({ title: 'Your profile', search: false, body });
}
