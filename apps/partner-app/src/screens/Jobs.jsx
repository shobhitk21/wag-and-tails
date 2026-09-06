/* The partner's job feed — matches js/screens-groomer.js: sgJobs() / gJobCard().

   One app, two roles. The Grooming / Walking switch at the top of this screen
   drives the whole app: the feed, the schedule and the earnings all follow it.
   A groomer sees grooms to claim; a walker sees walk requests.

   Going offline is real, session-local state here exactly as it is in the
   prototype (S.g.online / S.w.online reset on reload there too) — while off,
   the open-jobs list is hidden rather than merely greyed out. */
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import appApi from '@wag/api-client/app';
import { colors, type, radii, space, inr } from '@wag/theme';
import {
  Screen, Body, Toast,
  Card, Button, Pill, StatusPill, CareNote, Ring, PersonAvatar, T, Ico,
  Loading, ErrorState, EmptyState, useApi, useAuth, useToast
} from '@wag/ui-native';

export function ModeSwitch({ mode, onChange, groomingBadge, walkingBadge }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: space[5], marginBottom: space[4] }}>
      {[
        ['grooming', 'Grooming', 'scissors', groomingBadge],
        ['walking', 'Walking', 'route', walkingBadge]
      ].map(([key, label, icon, badge]) => {
        const on = mode === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
              paddingVertical: 12, borderRadius: radii.btn,
              backgroundColor: on ? colors.brand[700] : colors.sunken
            }}
          >
            <Ico name={icon} size={16} color={on ? colors.white : colors.ink[3]} />
            <Text style={{
              ...type.sm, fontFamily: type.h3.fontFamily,
              color: on ? colors.white : colors.ink[3]
            }}>
              {label}
            </Text>
            {badge > 0 ? (
              <View style={{
                minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 5,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: on ? 'rgba(255,255,255,.22)' : colors.brand[200]
              }}>
                <Text style={{ ...type.xxs, fontSize: 11, color: on ? colors.white : colors.brand[800] }}>
                  {badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* Cosmetic only — matching the prototype's own fake OPEN_JOBS.km and .expires
   seed fields, which were never computed from anything real either. Stable per
   job id so a screen doesn't re-roll them on every render. */
function hashOf(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
const pseudoKm = (id) => (0.8 + (hashOf(id) % 38) / 10).toFixed(1);
const pseudoExpires = (id) => 30 + (hashOf(id) % 60);

function CountdownBar({ seconds }) {
  const [left, setLeft] = useState(seconds);
  const pct = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(pct, { toValue: 0, duration: seconds * 1000, useNativeDriver: false }).start();
    const id = setInterval(() => setLeft((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ marginTop: space[3] }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.brand[100], overflow: 'hidden' }}>
        <Animated.View style={{
          height: '100%', backgroundColor: colors.accent[400],
          width: pct.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
        }} />
      </View>
      <T.Xs style={{ marginTop: 6 }}>Claimable for ~{left}s</T.Xs>
    </View>
  );
}

function JobCard({ job, onClaim, onDetails, busy }) {
  const km = pseudoKm(job.id);
  const expires = useRef(pseudoExpires(job.id)).current;

  return (
    <Card style={{ marginBottom: space[3] }}>
      <Pressable onPress={onDetails}>
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <Ring pet={{ art: job.pet_art }} size={50} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T.H3 numberOfLines={1} style={{ flex: 1 }}>{job.service_label}</T.H3>
              <Text style={{ ...type.h3, color: colors.accent[600] }}>{inr(job.payout)}</Text>
            </View>
            <T.Xs style={{ marginTop: 3 }} numberOfLines={1}>
              {job.pet_name} · {job.pet_breed}
              {job.pet_size ? ` · ${job.pet_size}` : ''}{job.pet_weight ? `, ${job.pet_weight}` : ''}
            </T.Xs>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <Pill icon="clock">{job.scheduled_label}</Pill>
              <Pill icon="pin">{km} km</Pill>
              <Pill>{job.package_mins ?? job.walk_mins} min</Pill>
              {job.addon_count > 0 ? <Pill tone="accent">+{job.addon_count} add-on</Pill> : null}
            </View>
          </View>
        </View>

        {job.care_note ? (
          <CareNote note={job.care_note} variant="loud" style={{ marginTop: space[3] }} />
        ) : null}
      </Pressable>

      <CountdownBar seconds={expires} />

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: space[3] }}>
        <Button title="Details" variant="secondary" full={false} onPress={onDetails}
          style={{ paddingHorizontal: space[4] }} />
        <Button title={busy ? 'Claiming…' : 'Claim job'} full={false} onPress={onClaim} loading={busy}
          style={{ paddingHorizontal: space[4] }} />
      </View>
    </Card>
  );
}

export function JobsScreen({ navigation, mode, setMode }) {
  const { user } = useAuth();
  const [toast, setToast] = useToast();
  const [busy, setBusy] = useState(null);
  const [online, setOnline] = useState(true);
  const { data, error, loading, reload } = useApi(() => appApi.jobs.feed(mode), [mode]);
  const home = useApi(() => appApi.partner.home(), []);

  async function claim(job) {
    setBusy(job.id);
    try {
      await appApi.jobs.claim(job.id);
      setToast(`${job.pet_name}’s ${job.service_label.toLowerCase()} is yours.`);
      reload();
      home.reload();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(null);
    }
  }

  function toggleOnline() {
    setOnline((v) => {
      setToast(!v ? 'You are online.' : 'You are offline.');
      return !v;
    });
  }

  const detailRoute = mode === 'walking' ? 'WalkJob' : 'Job';
  const roleWord = mode === 'walking' ? 'walking' : 'grooming';

  const body = loading || home.loading ? (
    <Loading />
  ) : error ? (
    <ErrorState error={error} onRetry={reload} />
  ) : (
    <Body contentStyle={{ paddingTop: 0 }} onRefresh={reload}>
      {/* Online / offline. */}
      <Pressable onPress={toggleOnline}>
        <View style={{
          backgroundColor: colors.brand[700], borderRadius: radii.lg, padding: space[4],
          flexDirection: 'row', alignItems: 'center', gap: space[3]
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...type.h3, color: colors.white }}>{online ? 'Online' : 'Offline'}</Text>
            <Text style={{ ...type.xs, color: 'rgba(255,255,255,.72)', marginTop: 3 }}>
              {online
                ? `Taking ${roleWord} jobs in ${user?.area ?? 'your area'}`
                : 'You will not see new jobs'}
            </Text>
          </View>
          <View style={{
            width: 46, height: 27, borderRadius: 14, padding: 2,
            backgroundColor: online ? colors.ok[600] : 'rgba(255,255,255,.25)',
            justifyContent: 'center', alignItems: online ? 'flex-end' : 'flex-start'
          }}>
            <View style={{ width: 23, height: 23, borderRadius: 12, backgroundColor: colors.white }} />
          </View>
        </View>
      </Pressable>

      {/* Stat tiles. */}
      <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[4] }}>
        {[
          [inr(home.data?.todayEarned ?? 0), 'Today'],
          [String(home.data?.jobsLeft ?? 0), 'Jobs left'],
          [String(user?.rating ?? '—'), 'Rating']
        ].map(([value, label]) => (
          <Card key={label} style={{ flex: 1, alignItems: 'center', paddingVertical: space[4] }}>
            <T.H2>{value}</T.H2>
            <T.Xs style={{ marginTop: 3 }}>{label}</T.Xs>
          </Card>
        ))}
      </View>

      {/* Open jobs. */}
      <T.H3 style={{ marginTop: space[5], marginBottom: 2 }}>Open jobs</T.H3>
      <T.Xs style={{ marginBottom: space[3] }}>
        {online ? `${data.open.length} near you right now` : 'Paused while you are offline'}
      </T.Xs>

      {!online ? (
        <EmptyState icon="brief" title="You are offline" subtitle="Go online to see jobs near you." />
      ) : data.open.length === 0 ? (
        <EmptyState
          icon="brief"
          title="No open jobs right now"
          subtitle="New jobs appear here the moment a customer books."
        />
      ) : (
        data.open.map((j) => (
          <JobCard
            key={j.id}
            job={j}
            busy={busy === j.id}
            onClaim={() => claim(j)}
            onDetails={() => navigation.navigate(detailRoute, { id: j.id })}
          />
        ))
      )}

      {/* Today's schedule — a condensed look; the Schedule tab has the full day. */}
      {data.assigned.length > 0 ? (
        <>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            marginTop: space[6], marginBottom: space[3]
          }}>
            <View>
              <T.H3>Today’s schedule</T.H3>
              <T.Xs style={{ marginTop: 2 }}>{data.assigned.length} assigned</T.Xs>
            </View>
            <Pressable onPress={() => navigation.getParent()?.navigate('ScheduleTab')}>
              <Text style={{ ...type.sm, fontFamily: type.h3.fontFamily, color: colors.accent[600] }}>
                Full day
              </Text>
            </Pressable>
          </View>
          {data.assigned.map((j) => (
            <Card key={j.id} style={{ marginBottom: space[3] }}
              onPress={() => navigation.navigate(detailRoute, { id: j.id })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <Ring pet={{ art: j.pet_art }} size={48}
                  state={['On the way', 'In progress', 'Walking now'].includes(j.status) ? 'active' : 'idle'} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T.H3 numberOfLines={1} style={{ flex: 1 }}>{j.service_label}</T.H3>
                    <StatusPill status={j.status} />
                  </View>
                  <T.Xs style={{ marginTop: 3 }} numberOfLines={1}>
                    {j.pet_name} · {j.pet_breed} · {j.scheduled_label}
                  </T.Xs>
                  <T.Xs style={{ marginTop: 2 }} numberOfLines={1}>
                    {j.customer_name} · {pseudoKm(j.id)} km
                  </T.Xs>
                </View>
                <Text style={{ ...type.h3 }}>{inr(j.payout)}</Text>
              </View>
            </Card>
          ))}
        </>
      ) : (
        <EmptyState icon="cal" title="Nothing scheduled today"
          subtitle="Claim an open job to fill your day." style={{ marginTop: space[5] }} />
      )}
    </Body>
  );

  return (
    <Screen>
      <View style={{
        paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[2],
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <View>
          <T.Eyebrow>Partner</T.Eyebrow>
          <T.Hero style={{ fontSize: 28, marginTop: 2 }}>Jobs</T.Hero>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={10}>
            <View style={{
              width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sunken,
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Ico name="bell" size={19} color={colors.ink[2]} />
              {home.data?.unreadCount > 0 ? (
                <View style={{
                  position: 'absolute', top: 7, right: 8, width: 8, height: 8,
                  borderRadius: 4, backgroundColor: colors.accent[400],
                  borderWidth: 1.5, borderColor: colors.sunken
                }} />
              ) : null}
            </View>
          </Pressable>
          <Pressable onPress={() => navigation.getParent()?.navigate('AccountTab')}>
            <PersonAvatar name={user?.name} size={40}
              from={user?.kind === 'Walker' ? '#1F7A4D' : '#F07B2C'}
              to={user?.kind === 'Walker' ? '#0E4229' : '#A8480C'} />
          </Pressable>
        </View>
      </View>

      <ModeSwitch
        mode={mode}
        onChange={setMode}
        groomingBadge={mode === 'grooming' ? data?.open?.length ?? 0 : undefined}
        walkingBadge={mode === 'walking' ? data?.open?.length ?? 0 : undefined}
      />

      {body}
      <Toast message={toast} />
    </Screen>
  );
}
