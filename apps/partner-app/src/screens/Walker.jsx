/* The walker's job: accept → head to pickup → walk → drag to end → summary.

   Ending a walk is a drag, not a tap. That is deliberate: it is irreversible
   and happens with a phone in one hand and a lead in the other, so it should
   not be possible to fire it by accident. */
import { useRef, useState } from 'react';
import { View, Text, Pressable, Animated, PanResponder } from 'react-native';
import appApi from '@wag/api-client/app';
import { colors, type, radii, space, inr } from '@wag/theme';
import {
  Screen, AppBar, Body, Dock, Toast,
  Card, Button, KV, Divider, Pill, StatusPill, Banner, CareNote,
  Ring, MapView, T, Ico,
  Loading, ErrorState, EmptyState, useApi, usePolling
} from '@wag/ui-native';

/* ---------- incoming request ---------- */
export function WalkJobScreen({ route, navigation }) {
  const { id } = route.params;
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const { data, error, loading, reload } = useApi(() => appApi.jobs.get(id), [id]);

  if (loading) return <Screen><AppBar title="Walk" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Walk" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  const { job, walk } = data;
  const mine = job.partner_id != null;

  async function accept() {
    setBusy(true);
    try {
      await appApi.walks.accept(id);
      navigation.replace('WalkPickup', { id });
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 2600);
      setBusy(false);
    }
  }

  /* An unclaimed request gets the full-screen treatment — it is a decision
     with a countdown, not a list item. */
  if (!mine) {
    return (
      <Screen onBrand edges={['top', 'bottom']}>
        <View style={{ flex: 1, padding: space[6], justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', gap: space[4], marginTop: space[6] }}>
            <Ring pet={{ art: job.pet_art }} size={120} state="searching" />
            <Text style={{ ...type.hero, color: colors.white, fontSize: 28, textAlign: 'center' }}>
              {job.walk_mins} minute walk
            </Text>
            <Text style={{ ...type.body, color: 'rgba(255,255,255,.75)', textAlign: 'center' }}>
              {job.pet_name}{job.pet_breed ? ` · ${job.pet_breed}` : ''} · {job.scheduled_label}
            </Text>
            <View style={{ alignItems: 'center', marginTop: space[3] }}>
              <Text style={{ ...type.hero, color: colors.accent[400] }}>{inr(job.payout)}</Text>
              <Text style={{ ...type.xs, color: 'rgba(255,255,255,.6)' }}>your payout</Text>
            </View>
          </View>

          <View style={{ gap: space[4] }}>
            {job.line1 ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Ico name="pin" size={17} color="rgba(255,255,255,.6)" />
                <Text style={{ ...type.sm, color: 'rgba(255,255,255,.8)', flex: 1 }}>
                  {[job.line1, job.line2].filter(Boolean).join(', ')}
                </Text>
              </View>
            ) : null}

            {/* On-brand variant, so the note reads against the dark ground. */}
            {job.care_note ? (
              <CareNote note={job.care_note} petName={job.pet_name} variant="onbrand" />
            ) : null}

            <Button title={busy ? 'Accepting…' : 'Accept walk'} onPress={accept} loading={busy}
              style={{ backgroundColor: colors.white }} />
            <Button title="Not now" variant="ghost" onPress={() => navigation.goBack()} />
          </View>
        </View>
        <Toast message={toast} />
      </Screen>
    );
  }

  /* Already mine — go where the walk actually is. */
  const target = walk?.state === 'walking' ? 'WalkLive'
    : walk?.state === 'done' ? 'WalkSummary'
      : 'WalkPickup';

  return (
    <Screen>
      <AppBar title={`${job.pet_name}’s walk`} onBack={navigation.goBack} />
      <Body>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Ring pet={{ art: job.pet_art }} size={54} />
            <View style={{ flex: 1 }}>
              <T.H2>{job.pet_name}</T.H2>
              <T.Xs style={{ marginTop: 3 }}>{job.scheduled_label}</T.Xs>
            </View>
            <StatusPill status={job.status} />
          </View>
        </Card>
        {job.care_note ? (
          <CareNote note={job.care_note} petName={job.pet_name} variant="loud"
            style={{ marginTop: space[4] }} />
        ) : null}
      </Body>
      <Dock>
        <Button title="Continue" onPress={() => navigation.replace(target, { id })} />
      </Dock>
    </Screen>
  );
}

/* ---------- heading to pickup ---------- */
export function WalkPickupScreen({ route, navigation }) {
  const { id } = route.params;
  const [busy, setBusy] = useState(false);
  const job = useApi(() => appApi.jobs.get(id), [id]);

  if (job.loading) return <Screen><AppBar title="Pickup" onBack={navigation.goBack} /><Loading /></Screen>;
  const j = job.data.job;

  async function start() {
    setBusy(true);
    try {
      await appApi.walks.setState(id, 'walking');
      navigation.replace('WalkLive', { id });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Head to pickup" subtitle={j.pet_name} onBack={navigation.goBack} />
      <Body>
        <MapView pet={{ art: j.pet_art }} progress={0} height={240} chip="Pickup" />

        <Card style={{ marginTop: space[4] }}>
          <T.Eyebrow style={{ marginBottom: 8 }}>Collect from</T.Eyebrow>
          <T.H3>{j.customer_name}</T.H3>
          {j.line1 ? (
            <T.Xs style={{ marginTop: 4 }}>{[j.line1, j.line2].filter(Boolean).join(', ')}</T.Xs>
          ) : null}
          {j.landmark ? <T.Xs style={{ marginTop: 2 }}>{j.landmark}</T.Xs> : null}
        </Card>

        {j.care_note ? (
          <CareNote note={j.care_note} petName={j.pet_name} variant="loud"
            style={{ marginTop: space[4] }} />
        ) : null}
      </Body>

      <Dock>
        <Button title={busy ? 'Starting…' : 'Start the walk'} onPress={start} loading={busy} />
        <Button title="Navigate" variant="secondary" style={{ marginTop: 8 }} onPress={() => {}} />
      </Dock>
    </Screen>
  );
}

/* ---------- the drag-to-end control ----------
   Deliberately not tap-activated. */
function SlideToEnd({ onComplete, label = 'Slide to end walk', disabled }) {
  const x = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const knob = 56;
  const travel = Math.max(width - knob - 8, 1);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderMove: (_e, g) => {
        const next = Math.max(0, Math.min(g.dx, travel));
        x.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx >= travel * 0.85) {
          Animated.timing(x, { toValue: travel, duration: 120, useNativeDriver: false })
            .start(() => onComplete());
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      }
    })
  ).current;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        height: 64, borderRadius: radii.btn, backgroundColor: colors.brand[700],
        justifyContent: 'center', overflow: 'hidden', opacity: disabled ? 0.5 : 1
      }}
    >
      <Text style={{
        ...type.sm, fontFamily: type.h3.fontFamily, color: 'rgba(255,255,255,.75)',
        textAlign: 'center'
      }}>
        {label}
      </Text>
      <Animated.View
        {...pan.panHandlers}
        style={{
          position: 'absolute', left: 4, width: knob, height: knob, borderRadius: radii.md,
          backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
          transform: [{ translateX: x }]
        }}
      >
        <Ico name="chev" size={22} color={colors.brand[700]} />
      </Animated.View>
    </View>
  );
}

/* ---------- live walk ----------
   The same walk row the customer's live screen reads. */
export function WalkLiveScreen({ route, navigation }) {
  const { id } = route.params;
  const [ending, setEnding] = useState(false);
  const [toast, setToast] = useState(null);
  const job = useApi(() => appApi.jobs.get(id), [id]);
  const live = usePolling(() => appApi.walks.get(id), 2000, true);

  if (job.loading || !live) {
    return <Screen><AppBar title="Walking" onBack={navigation.goBack} /><Loading /></Screen>;
  }

  const j = job.data.job;
  const w = live.walk;
  const mins = Math.floor(w.elapsed_secs / 60);
  const secs = String(w.elapsed_secs % 60).padStart(2, '0');

  async function end() {
    setEnding(true);
    try {
      await appApi.walks.end(id);
      navigation.replace('WalkSummary', { id });
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 2600);
      setEnding(false);
    }
  }

  return (
    <Screen>
      <AppBar title={`${j.pet_name}’s walk`} onBack={navigation.goBack} />
      <Body>
        <MapView pet={{ art: j.pet_art }} progress={w.progress} height={280}
          chip={`${w.distance_km} km`} />

        <Card style={{ marginTop: space[4] }}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <T.Hero style={{ fontSize: 28 }}>{mins}:{secs}</T.Hero>
              <T.Xs>elapsed</T.Xs>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <T.Hero style={{ fontSize: 28 }}>{w.distance_km}</T.Hero>
              <T.Xs>km</T.Xs>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <T.Hero style={{ fontSize: 28 }}>{w.planned_mins}</T.Hero>
              <T.Xs>planned</T.Xs>
            </View>
          </View>
        </Card>

        {w.complete ? (
          <Banner tone="ok" icon="check" style={{ marginTop: space[4] }}>
            The planned {w.planned_mins} minutes are up. End whenever you’re back.
          </Banner>
        ) : null}

        {j.care_note ? (
          <CareNote note={j.care_note} petName={j.pet_name} variant="loud"
            style={{ marginTop: space[4] }} />
        ) : null}
      </Body>

      <Dock>
        <SlideToEnd onComplete={end} disabled={ending}
          label={ending ? 'Ending…' : 'Slide to end walk'} />
      </Dock>
      <Toast message={toast} />
    </Screen>
  );
}

/* ---------- summary ---------- */
export function WalkSummaryScreen({ route, navigation }) {
  const { id } = route.params;
  const job = useApi(() => appApi.jobs.get(id), [id]);
  const walk = useApi(() => appApi.walks.get(id), [id]);

  if (job.loading || walk.loading) return <Screen><Loading /></Screen>;
  const j = job.data.job;
  const w = walk.data.walk;

  return (
    <Screen>
      <AppBar title="Walk complete" onBack={() => navigation.navigate('JobsHome')} />
      <Body>
        <MapView pet={{ art: j.pet_art }} progress={1} height={220} />

        <View style={{ alignItems: 'center', gap: 6, marginTop: space[5] }}>
          <T.Hero>{inr(w.payout)}</T.Hero>
          <T.Xs>added to your next payout</T.Xs>
        </View>

        <Card style={{ marginTop: space[5] }}>
          <KV k="Pet" v={j.pet_name} />
          <KV k="Duration" v={`${Math.round(w.elapsed_secs / 60)} minutes`} />
          <KV k="Distance" v={`${w.distance_km} km`} />
          <KV k="Customer" v={j.customer_name} />
          <Divider style={{ marginVertical: 8 }} />
          <KV k="Payout" v={inr(w.payout)} />
        </Card>

        <Banner tone="info" icon="info" style={{ marginTop: space[4] }}>
          The owner can see the route and the distance now, and will be asked to rate the walk.
        </Banner>
      </Body>
      <Dock>
        <Button title="Back to jobs" onPress={() => navigation.navigate('JobsHome')} />
      </Dock>
    </Screen>
  );
}

/* ---------- open walk requests ---------- */
export function WalkRequestsScreen({ navigation }) {
  const { data, loading, error, reload } = useApi(() => appApi.walks.requests(), []);

  if (loading) return <Screen><AppBar title="Requests" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Requests" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="Walk requests" onBack={navigation.goBack} />
      <Body onRefresh={reload}>
        {data.requests.length === 0 ? (
          <EmptyState icon="route" title="No requests right now"
            subtitle="New walk requests in your area appear here." />
        ) : (
          data.requests.map((r) => (
            <Card key={r.booking_id} style={{ marginBottom: space[3] }}
              onPress={() => navigation.navigate('WalkJob', { id: r.booking_id })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <Ring pet={{ art: r.pet_art }} size={52} />
                <View style={{ flex: 1 }}>
                  <T.H3>{r.planned_mins} minute walk</T.H3>
                  <T.Xs style={{ marginTop: 3 }}>{r.pet_name} · {r.customer_name}</T.Xs>
                </View>
                <Text style={{ ...type.h3 }}>{inr(r.payout)}</Text>
              </View>
            </Card>
          ))
        )}
      </Body>
    </Screen>
  );
}
