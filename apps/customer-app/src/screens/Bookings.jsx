/* Matching, tracking, the bookings list, detail, live walk, payment and rating. */
import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import appApi from '@wag/api-client/app';
import { colors, type, radii, space, inr } from '@wag/theme';
import {
  Screen, AppBar, Body, Dock, Sheet, Toast,
  Card, Button, Chip, Row, KV, Divider, Pill, StatusPill, Banner, CareNote,
  Ring, MapView, PhotoTile, Timeline, Stars, T, Ico,
  Loading, ErrorState, EmptyState, useApi, usePolling
} from '@wag/ui-native';

/* ---------- finding a partner ----------
   The prototype showed a ~2s spinner; the API picks a real active partner in
   the right discipline, preferring one in the customer's own area. */
export function MatchingScreen({ route, navigation }) {
  const { id, kind } = route.params;
  const [partner, setPartner] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      appApi.bookings
        .match(id)
        .then((r) => { if (live) setPartner(r.partner); })
        .catch((err) => { if (live) setError(err); });
    }, 1600);
    return () => { live = false; clearTimeout(t); };
  }, [id]);

  return (
    <Screen onBrand edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[5] }}>
        <Ring
          pet={{}}
          size={120}
          state={partner ? 'done' : 'searching'}
          progress={partner ? 1 : 0}
        />
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ ...type.hero, color: colors.white, fontSize: 26, textAlign: 'center' }}>
            {error
              ? 'No one available yet'
              : partner
                ? `${partner.name} is on it`
                : `Finding a ${kind === 'walk' ? 'walker' : 'groomer'} near you`}
          </Text>
          <Text style={{ ...type.body, color: 'rgba(255,255,255,.72)', textAlign: 'center' }}>
            {error
              ? error.message
              : partner
                ? `${partner.area} · rated ${partner.rating}`
                : 'This usually takes a couple of seconds.'}
          </Text>
        </View>
      </View>

      <View style={{ padding: space[5] }}>
        {partner ? (
          <Button title="See the booking" style={{ backgroundColor: colors.white }}
            onPress={() => navigation.replace('Booking', { id })} />
        ) : error ? (
          <Button title="View it anyway" style={{ backgroundColor: colors.white }}
            onPress={() => navigation.replace('Booking', { id })} />
        ) : null}
      </View>
    </Screen>
  );
}

/* ---------- bookings list ---------- */
export function BookingsScreen({ navigation }) {
  const [tab, setTab] = useState('upcoming');
  const { data, error, loading, reload } = useApi(() => appApi.bookings.list(), []);

  if (loading) return <Screen><AppBar title="Bookings" /><Loading /></Screen>;
  if (error) return <Screen><AppBar title="Bookings" /><ErrorState error={error} onRetry={reload} /></Screen>;

  const rows = tab === 'upcoming' ? data.upcoming : data.past;

  return (
    <Screen>
      <AppBar title="Bookings" />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: space[5], paddingBottom: space[3] }}>
        <Chip label={`Upcoming (${data.upcoming.length})`} selected={tab === 'upcoming'}
          onPress={() => setTab('upcoming')} />
        <Chip label={`Past (${data.past.length})`} selected={tab === 'past'}
          onPress={() => setTab('past')} />
      </View>

      <Body contentStyle={{ paddingTop: space[2] }} onRefresh={reload}>
        {rows.length === 0 ? (
          <EmptyState
            icon="cal"
            title={tab === 'upcoming' ? 'Nothing booked' : 'No history yet'}
            subtitle={tab === 'upcoming' ? 'Book a groom or a walk from the home screen.' : undefined}
          />
        ) : (
          rows.map((b) => (
            <Card key={b.id} style={{ marginBottom: space[3] }}
              onPress={() => navigation.navigate('Booking', { id: b.id })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <Ring pet={{ art: b.pet_art }} size={48}
                  state={['On the way', 'In progress', 'Walking now'].includes(b.status) ? 'active' : 'idle'} />
                <View style={{ flex: 1 }}>
                  <T.H3>{b.service_label}</T.H3>
                  <T.Xs style={{ marginTop: 3 }}>{b.pet_name} · {b.scheduled_label}</T.Xs>
                  {b.partner_name !== 'Unassigned' ? (
                    <T.Xs style={{ marginTop: 2 }}>{b.partner_name}</T.Xs>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <StatusPill status={b.status} />
                  <Text style={{ ...type.sm, fontFamily: type.h3.fontFamily }}>{inr(b.total)}</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </Body>
    </Screen>
  );
}

/* ---------- booking detail ---------- */
export function BookingScreen({ route, navigation }) {
  const { id } = route.params;
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const { data, error, loading, reload } = useApi(() => appApi.bookings.get(id), [id]);
  const help = useApi(() => appApi.customer.help(), []);

  if (loading) return <Screen><AppBar title="Booking" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Booking" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  const b = data.booking;
  const live = ['On the way', 'In progress', 'Walking now'].includes(b.status);
  const closed = ['Completed', 'Cancelled'].includes(b.status);

  async function cancel() {
    setBusy(true);
    try {
      await appApi.bookings.cancel(id, reason);
      setCancelling(false);
      reload();
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 2400);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppBar title={b.service_label} subtitle={b.id} onBack={navigation.goBack} />
      <Body onRefresh={reload}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Ring pet={{ art: b.pet_art }} size={54} state={live ? 'active' : 'idle'} />
            <View style={{ flex: 1 }}>
              <T.H2>{b.pet_name}</T.H2>
              <T.Xs style={{ marginTop: 3 }}>{b.scheduled_label}</T.Xs>
            </View>
            <StatusPill status={b.status} />
          </View>

          {live ? (
            <Button
              title={b.service_kind === 'walk' ? 'Watch the walk' : 'Track this booking'}
              onPress={() => navigation.navigate(b.service_kind === 'walk' ? 'WalkLive' : 'Track', { id })}
              style={{ marginTop: space[4] }}
            />
          ) : null}
        </Card>

        {b.care_note ? (
          <CareNote note={b.care_note} petName={b.pet_name} style={{ marginTop: space[4] }} />
        ) : null}

        {data.steps.length > 0 ? (
          <Card style={{ marginTop: space[4] }}>
            <T.Eyebrow style={{ marginBottom: space[3] }}>Progress</T.Eyebrow>
            <Timeline steps={data.steps} />
          </Card>
        ) : null}

        {data.photos.length > 0 ? (
          <Card style={{ marginTop: space[4] }}>
            <T.Eyebrow style={{ marginBottom: space[3] }}>Before and after</T.Eyebrow>
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              {data.photos.map((p, i) => (
                <View key={i} style={{ flex: 1, gap: 6 }}>
                  <T.Xs style={{ textTransform: 'capitalize' }}>{p.phase}</T.Xs>
                  <PhotoTile seed={p.seed} size={999} radius={radii.md} />
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Card style={{ marginTop: space[4] }}>
          <T.Eyebrow style={{ marginBottom: 8 }}>Bill</T.Eyebrow>
          <KV k={b.service_label} v={inr(b.total - data.addons.reduce((s, a) => s + a.price, 0) + b.discount)} />
          {data.addons.map((a) => <KV key={a.id} k={a.name} v={inr(a.price)} />)}
          {b.discount > 0 ? (
            <KV k={`Coupon ${b.coupon_code}`}
              v={<Text style={{ color: colors.ok[600] }}>−{inr(b.discount)}</Text>} />
          ) : null}
          <Divider style={{ marginVertical: 8 }} />
          <KV k="Total" v={inr(b.total)} />
          <KV k="Payment" v={b.paid ? 'Paid' : 'After the service'} />
        </Card>

        {data.address ? (
          <Card style={{ marginTop: space[4] }}>
            <T.Eyebrow style={{ marginBottom: 8 }}>Where</T.Eyebrow>
            <T.Sm>{data.address.line1}</T.Sm>
            <T.Xs style={{ marginTop: 2 }}>{data.address.line2}</T.Xs>
            {data.address.landmark ? (
              <T.Xs style={{ marginTop: 2 }}>{data.address.landmark}</T.Xs>
            ) : null}
          </Card>
        ) : null}

        {b.status === 'Cancelled' && b.cancel_reason ? (
          <Banner tone="warn" icon="alert" style={{ marginTop: space[4] }}>
            Cancelled — {b.cancel_reason}
          </Banner>
        ) : null}
      </Body>

      {!closed ? (
        <Dock>
          <Button title="Reschedule" variant="secondary"
            onPress={() => navigation.navigate('Reschedule', { id })} />
          <Button title="Cancel booking" variant="danger" style={{ marginTop: 8 }}
            onPress={() => setCancelling(true)} />
        </Dock>
      ) : b.status === 'Completed' && !b.paid ? (
        <Dock>
          <Button title={`Pay ${inr(b.total)}`} onPress={() => navigation.navigate('Pay', { id })} />
        </Dock>
      ) : b.status === 'Completed' && !b.rating ? (
        <Dock>
          <Button title="Rate this visit" onPress={() => navigation.navigate('Rate', { id })} />
        </Dock>
      ) : null}

      <Sheet
        visible={cancelling}
        title="Why are you cancelling?"
        onClose={() => setCancelling(false)}
        footer={
          <Button title={busy ? 'Cancelling…' : 'Cancel booking'} variant="danger"
            onPress={cancel} loading={busy} disabled={!reason} />
        }
      >
        <View style={{ gap: 8 }}>
          {(help.data?.cancelReasons ?? []).map((r) => (
            <Pressable key={r} onPress={() => setReason(r)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
                paddingHorizontal: 14, borderRadius: radii.md, borderWidth: 1,
                borderColor: reason === r ? colors.brand[700] : colors.line2
              }}>
              <View style={{
                width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                borderColor: reason === r ? colors.brand[700] : colors.line2,
                backgroundColor: reason === r ? colors.brand[700] : 'transparent'
              }} />
              <T.Sm style={{ flex: 1 }}>{r}</T.Sm>
            </Pressable>
          ))}
        </View>
        <Banner tone="info" icon="info" style={{ marginTop: space[4] }}>
          Free up to 4 hours before the slot. After that a ₹200 fee applies.
        </Banner>
      </Sheet>

      <Toast message={toast} />
    </Screen>
  );
}

/* ---------- tracking a groom ---------- */
export function TrackScreen({ route, navigation }) {
  const { id } = route.params;
  const live = usePolling(() => appApi.bookings.get(id), 4000, true);

  if (!live) return <Screen><AppBar title="Tracking" onBack={navigation.goBack} /><Loading /></Screen>;

  const b = live.booking;
  const doneSteps = live.steps.filter((s) => s.state === 'done').length;
  const progress = live.steps.length ? doneSteps / live.steps.length : 0;

  return (
    <Screen>
      <AppBar title={b.service_label} subtitle={b.pet_name} onBack={navigation.goBack} />
      <Body>
        <MapView pet={{ art: b.pet_art }} progress={progress} height={240} chip={b.eta ?? b.status} />

        <Card style={{ marginTop: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <StatusPill status={b.status} />
              <T.H2 style={{ marginTop: 8 }}>{b.partner_name}</T.H2>
              <T.Xs style={{ marginTop: 3 }}>{b.eta ?? b.scheduled_label}</T.Xs>
            </View>
            <Pressable
              onPress={() => {}}
              style={{
                width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand[50],
                alignItems: 'center', justifyContent: 'center'
              }}>
              <Ico name="phone" size={20} color={colors.brand[700]} />
            </Pressable>
          </View>
        </Card>

        {b.care_note ? (
          <CareNote note={b.care_note} petName={b.pet_name} style={{ marginTop: space[4] }} />
        ) : null}

        <Card style={{ marginTop: space[4] }}>
          <Timeline steps={live.steps} />
        </Card>
      </Body>
    </Screen>
  );
}

/* ---------- live walk ----------
   The same walk row the walker's screen reads, so ending the walk in the
   partner app updates this screen on its next poll. */
export function WalkLiveScreen({ route, navigation }) {
  const { id } = route.params;
  const live = usePolling(() => appApi.walks.get(id), 2000, true);
  const booking = useApi(() => appApi.bookings.get(id), [id]);

  if (!live || booking.loading) {
    return <Screen><AppBar title="Live walk" onBack={navigation.goBack} /><Loading /></Screen>;
  }

  const w = live.walk;
  const b = booking.data.booking;
  const mins = Math.floor(w.elapsed_secs / 60);
  const secs = String(w.elapsed_secs % 60).padStart(2, '0');

  if (w.state === 'done') {
    return (
      <Screen>
        <AppBar title="Walk complete" onBack={navigation.goBack} />
        <Body>
          <MapView pet={{ art: b.pet_art }} progress={1} height={220} />
          <Card style={{ marginTop: space[4] }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <T.H1>{Math.round(w.elapsed_secs / 60)}</T.H1>
                <T.Xs>minutes</T.Xs>
              </View>
              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <T.H1>{w.distance_km}</T.H1>
                <T.Xs>km</T.Xs>
              </View>
            </View>
          </Card>
        </Body>
        <Dock>
          {!b.paid ? (
            <Button title={`Pay ${inr(b.total)}`} onPress={() => navigation.replace('Pay', { id })} />
          ) : (
            <Button title="Rate this walk" onPress={() => navigation.replace('Rate', { id })} />
          )}
        </Dock>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title={`${b.pet_name}’s walk`} subtitle={b.partner_name} onBack={navigation.goBack} />
      <Body>
        <MapView
          pet={{ art: b.pet_art }}
          progress={w.progress}
          height={280}
          chip={w.state === 'walking' ? 'Walking now' : 'Heading to pickup'}
        />

        <Card style={{ marginTop: space[4] }}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <T.H1>{mins}:{secs}</T.H1>
              <T.Xs>elapsed</T.Xs>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <T.H1>{w.distance_km}</T.H1>
              <T.Xs>km so far</T.Xs>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <T.H1>{w.planned_mins}</T.H1>
              <T.Xs>planned</T.Xs>
            </View>
          </View>
        </Card>

        {b.care_note ? (
          <CareNote note={b.care_note} petName={b.pet_name} style={{ marginTop: space[4] }} />
        ) : null}
      </Body>
    </Screen>
  );
}

/* ---------- reschedule ---------- */
export function RescheduleScreen({ route, navigation }) {
  const { id } = route.params;
  const home = useApi(() => appApi.customer.home(), []);
  const [dateLabel, setDateLabel] = useState('Today');
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const days = ['Today', 'Tomorrow'];

  async function save() {
    setBusy(true);
    try {
      await appApi.bookings.reschedule(id, dateLabel, slot);
      navigation.goBack();
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 2400);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Reschedule" onBack={navigation.goBack} />
      <Body>
        <T.Eyebrow style={{ marginBottom: 10 }}>Day</T.Eyebrow>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {days.map((d) => (
            <Chip key={d} label={d} selected={dateLabel === d} onPress={() => setDateLabel(d)} />
          ))}
        </View>

        <T.Eyebrow style={{ marginTop: space[5], marginBottom: 10 }}>Slot</T.Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(home.data?.slots ?? []).filter((s) => s.enabled).map((s) => (
            <Chip key={s.label} label={s.label} selected={slot === s.label}
              onPress={() => setSlot(s.label)} />
          ))}
        </View>
      </Body>
      <Dock>
        <Button title={busy ? 'Saving…' : 'Confirm new time'} onPress={save}
          loading={busy} disabled={!slot} />
      </Dock>
      <Toast message={toast} />
    </Screen>
  );
}

/* ---------- payment ---------- */
export function PayScreen({ route, navigation }) {
  const { id } = route.params;
  const booking = useApi(() => appApi.bookings.get(id), [id]);
  const account = useApi(() => appApi.customer.account(), []);
  const [method, setMethod] = useState(null);
  const [useWallet, setUseWallet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  if (booking.loading || account.loading) {
    return <Screen><AppBar title="Payment" onBack={navigation.goBack} /><Loading /></Screen>;
  }

  const b = booking.data.booking;
  const wallet = account.data.me.wallet_balance ?? 0;
  const chosen = method ?? account.data.payments.find((p) => p.is_default)?.code;
  const walletApplied = useWallet ? Math.min(wallet, b.total) : 0;

  async function pay() {
    setBusy(true);
    try {
      await appApi.bookings.pay(id, chosen, useWallet);
      navigation.replace('Rate', { id });
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 2400);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Payment" subtitle={b.service_label} onBack={navigation.goBack} />
      <Body>
        <Card>
          <KV k="Service" v={b.service_label} />
          <KV k="Pet" v={b.pet_name} />
          {walletApplied > 0 ? (
            <KV k="Wallet" v={<Text style={{ color: colors.ok[600] }}>−{inr(walletApplied)}</Text>} />
          ) : null}
          <Divider style={{ marginVertical: 8 }} />
          <KV k="To pay" v={inr(b.total - walletApplied)} />
        </Card>

        {wallet > 0 ? (
          <Card style={{ marginTop: space[4] }} onPress={() => setUseWallet(!useWallet)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Ico name="wallet" size={22} color={colors.brand[700]} />
              <View style={{ flex: 1 }}>
                <T.H3>Use wallet balance</T.H3>
                <T.Xs style={{ marginTop: 3 }}>{inr(wallet)} available</T.Xs>
              </View>
              <View style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                borderColor: useWallet ? colors.brand[700] : colors.line2,
                backgroundColor: useWallet ? colors.brand[700] : 'transparent',
                alignItems: 'center', justifyContent: 'center'
              }}>
                {useWallet ? <Ico name="check" size={14} color={colors.white} /> : null}
              </View>
            </View>
          </Card>
        ) : null}

        <T.Eyebrow style={{ marginTop: space[5], marginBottom: space[3] }}>Pay with</T.Eyebrow>
        {account.data.payments.map((p) => (
          <Card key={p.id} style={{ marginBottom: space[3] }} onPress={() => setMethod(p.code)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Ico name="card" size={20} color={colors.ink[2]} />
              <View style={{ flex: 1 }}>
                <T.H3>{p.label}</T.H3>
                <T.Xs style={{ marginTop: 3 }}>{p.subtitle}</T.Xs>
              </View>
              {chosen === p.code ? <Ico name="check" size={20} color={colors.brand[700]} /> : null}
            </View>
          </Card>
        ))}

        <Banner tone="info" icon="info" style={{ marginTop: space[3] }}>
          No payment gateway is wired in this build — confirming records the payment
          and moves the partner’s balance.
        </Banner>
      </Body>

      <Dock>
        <Button title={busy ? 'Paying…' : `Pay ${inr(b.total - walletApplied)}`}
          onPress={pay} loading={busy} disabled={!chosen} />
      </Dock>
      <Toast message={toast} />
    </Screen>
  );
}

/* ---------- rate and tip ---------- */
export function RateScreen({ route, navigation }) {
  const { id } = route.params;
  const booking = useApi(() => appApi.bookings.get(id), [id]);
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  if (booking.loading) {
    return <Screen><AppBar title="Rate" onBack={navigation.goBack} /><Loading /></Screen>;
  }
  const b = booking.data.booking;

  async function submit() {
    setBusy(true);
    try {
      await appApi.bookings.rate(id, { rating, tip, comment });
      navigation.navigate('BookingsTab');
    } catch {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppBar title="How did it go?" onBack={navigation.goBack} />
      <Body>
        <View style={{ alignItems: 'center', gap: space[4], marginBottom: space[6] }}>
          <Ring pet={{ art: b.pet_art }} size={96} state="done" progress={1} />
          <T.H2>{b.partner_name}</T.H2>
          <Stars value={rating} size={34} onChange={setRating} />
        </View>

        <T.Eyebrow style={{ marginBottom: space[3] }}>Add a tip</T.Eyebrow>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[0, 50, 100, 200].map((t) => (
            <Chip key={t} label={t === 0 ? 'No tip' : inr(t)} selected={tip === t}
              onPress={() => setTip(t)} />
          ))}
        </View>

        <View style={{ marginTop: space[5] }}>
          <T.Eyebrow style={{ marginBottom: 8 }}>Anything to add?</T.Eyebrow>
          <Card>
            <T.Sm style={{ color: comment ? colors.ink[1] : colors.ink[4] }}>
              {comment || 'Optional — your words go on their profile.'}
            </T.Sm>
          </Card>
        </View>
      </Body>

      <Dock>
        <Button title={busy ? 'Sending…' : 'Submit'} onPress={submit}
          loading={busy} disabled={!rating} />
        <Button title="Skip" variant="ghost" style={{ marginTop: 6 }}
          onPress={() => navigation.navigate('BookingsTab')} />
      </Dock>
    </Screen>
  );
}
