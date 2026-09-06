import api from '@wag/api-client';
import {
  useApi, useToast, Loading, ErrorBox, Toast, WCard, Kv, Field, WButton,
  Avatar, useAuth, roleArt, roleLabel
} from '@wag/ui-web';

export default function Profile({ renderPage }) {
  const { user } = useAuth();
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => api.staff.profile(), [user?.code]);

  if (loading) return renderPage({ title: 'Your profile', body: <Loading /> });
  if (error) return renderPage({ title: 'Your profile', body: <ErrorBox error={error} onRetry={reload} /> });

  const a = data.account;

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
            <Field label="Full name" defaultValue={a.name} />
            <Field label="Email" defaultValue={a.email} />
          </div>
          <WButton variant="primary" className="mt4" onClick={() => setToast('Editing your profile is not wired yet.')}>
            Save changes
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
