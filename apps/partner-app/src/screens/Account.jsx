/* Schedule, earnings, payouts, reviews, documents, notifications and account. */
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import appApi from '@wag/api-client/app';
import { colors, type, radii, space, inr } from '@wag/theme';
import {
  Screen, AppBar, Body, Dock, Toast,
  Card, Button, Row, KV, Divider, Pill, StatusPill, Banner, Bars, Stars,
  Ring, PersonAvatar, RatingChip, T, Ico,
  Loading, ErrorState, EmptyState, useApi, useAuth
} from '@wag/ui-native';
import { ModeSwitch } from './Jobs.jsx';

export function ScheduleScreen({ navigation, mode, setMode }) {
  const { data, error, loading, reload } = useApi(() => appApi.partner.schedule(), []);

  const detailRoute = mode === 'walking' ? 'WalkJob' : 'Job';

  return (
    <Screen>
      <AppBar title="Schedule" />
      <ModeSwitch mode={mode} onChange={setMode} />

      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <Body contentStyle={{ paddingTop: 0 }} onRefresh={reload}>
          {data.days.length === 0 ? (
            <EmptyState icon="cal" title="Nothing scheduled"
              subtitle="Jobs you claim show up here, grouped by day." />
          ) : (
            data.days.map((day) => (
              <View key={day.date} style={{ marginBottom: space[5] }}>
                <T.Eyebrow style={{ marginBottom: space[3] }}>{day.date}</T.Eyebrow>
                {day.jobs.map((j) => (
                  <Card key={j.id} style={{ marginBottom: space[3] }}
                    onPress={() => navigation.navigate(detailRoute, { id: j.id })}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                      <View style={{ width: 54, alignItems: 'center' }}>
                        <Text style={{ ...type.h3 }}>{j.slot_label ?? '—'}</Text>
                      </View>
                      <Ring pet={{ art: j.pet_art }} size={44} />
                      <View style={{ flex: 1 }}>
                        <T.H3>{j.pet_name}</T.H3>
                        <T.Xs style={{ marginTop: 3 }}>{j.service_label}</T.Xs>
                      </View>
                      <StatusPill status={j.status} />
                    </View>
                  </Card>
                ))}
              </View>
            ))
          )}
        </Body>
      )}
    </Screen>
  );
}

export function EarningsScreen({ navigation }) {
  const { data, error, loading, reload } = useApi(() => appApi.partner.earnings(), []);

  if (loading) return <Screen><AppBar title="Earnings" /><Loading /></Screen>;
  if (error) return <Screen><AppBar title="Earnings" /><ErrorState error={error} onRetry={reload} /></Screen>;

  return (
    <Screen>
      <AppBar title="Earnings" />
      <Body onRefresh={reload}>
        <Card style={{ backgroundColor: colors.brand[700], borderColor: colors.brand[700] }}>
          <Text style={{ ...type.xs, color: 'rgba(255,255,255,.7)' }}>Pending payout</Text>
          <Text style={{ ...type.hero, color: colors.white, marginTop: 6 }}>
            {inr(data.pending)}
          </Text>
          <Text style={{ ...type.xs, color: 'rgba(255,255,255,.7)', marginTop: 8 }}>
            {data.schedule} · platform fee {data.fee}
          </Text>

          <View style={{ marginTop: space[5] }}>
            <Bars data={data.week} onDark height={120} />
          </View>
        </Card>

        <Button title="Payout details" variant="secondary" style={{ marginTop: space[4] }}
          onPress={() => navigation.navigate('Payout')} />

        <T.Eyebrow style={{ marginTop: space[6], marginBottom: space[3] }}>Recent jobs</T.Eyebrow>
        {data.entries.length === 0 ? (
          <EmptyState icon="wallet" title="Nothing yet"
            subtitle="Completed jobs and their payouts appear here." />
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {data.entries.map((e, i) => (
              <View key={e.id}>
                <Row
                  icon="check"
                  iconTone="ok"
                  title={e.label}
                  subtitle={e.earned_on}
                  value={inr(e.amount)}
                  chevron={false}
                />
                {i < data.entries.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        )}
      </Body>
    </Screen>
  );
}

export function PayoutScreen({ navigation }) {
  const { data, loading } = useApi(() => appApi.partner.earnings(), []);
  const { user } = useAuth();
  if (loading) return <Screen><AppBar title="Payouts" onBack={navigation.goBack} /><Loading /></Screen>;

  const fee = parseFloat(data.fee) / 100;
  const gross = data.pending;
  const feeAmount = Math.round(gross * fee);

  return (
    <Screen>
      <AppBar title="Payouts" onBack={navigation.goBack} />
      <Body>
        <Card>
          <KV k="Gross" v={inr(gross)} />
          <KV k={`Platform fee (${data.fee})`}
            v={<Text style={{ color: colors.danger[600] }}>−{inr(feeAmount)}</Text>} />
          <Divider style={{ marginVertical: 8 }} />
          <KV k="You receive" v={inr(gross - feeAmount)} />
        </Card>

        <Card style={{ marginTop: space[4] }}>
          <T.Eyebrow style={{ marginBottom: 8 }}>Schedule</T.Eyebrow>
          <KV k="Batch" v={data.schedule} />
          <KV k="Account" v={user?.kind === 'Walker' ? 'UPI' : 'HDFC ••3391'} />
        </Card>

        <Banner tone="info" icon="info" style={{ marginTop: space[4] }}>
          Batches are released by the admin console. Changing your payout account
          is not wired in this build.
        </Banner>
      </Body>
    </Screen>
  );
}

export function ReviewsScreen({ navigation }) {
  const { data, loading, error, reload } = useApi(() => appApi.partner.reviews(), []);
  if (loading) return <Screen><AppBar title="Reviews" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Reviews" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="Reviews" onBack={navigation.goBack} />
      <Body>
        <Card>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <T.Hero>{data.rating}</T.Hero>
              <Stars value={Math.round(data.rating)} size={14} />
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <T.Hero>{data.jobs}</T.Hero>
              <T.Xs>jobs done</T.Xs>
            </View>
          </View>
        </Card>

        {data.reviews.length === 0 ? (
          <EmptyState icon="star" title="No reviews yet" />
        ) : (
          data.reviews.map((r, i) => (
            <Card key={i} style={{ marginTop: space[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <PersonAvatar name={r.author} size={38}
                  from={colors.brand[300]} to={colors.brand[600]} />
                <View style={{ flex: 1 }}>
                  <T.H3>{r.author}</T.H3>
                  <T.Xs style={{ marginTop: 2 }}>
                    {r.pet_name ? `${r.pet_name} · ` : ''}{r.when_label}
                  </T.Xs>
                </View>
                <Stars value={r.rating} size={13} />
              </View>
              <T.Body style={{ marginTop: space[3] }}>{r.body}</T.Body>
            </Card>
          ))
        )}
      </Body>
    </Screen>
  );
}

export function DocumentsScreen({ navigation }) {
  const { data, loading } = useApi(() => appApi.partner.documents(), []);
  if (loading) return <Screen><AppBar title="Documents" onBack={navigation.goBack} /><Loading /></Screen>;

  return (
    <Screen>
      <AppBar title="Documents" onBack={navigation.goBack} />
      <Body>
        {data.documents.map((d) => (
          <Card key={d.name} style={{ marginBottom: space[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View style={{
                width: 40, height: 40, borderRadius: radii.md,
                backgroundColor: d.verified ? colors.ok[50] : colors.warn[50],
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Ico name="doc" size={19} color={d.verified ? colors.ok[600] : colors.warn[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <T.H3>{d.name}</T.H3>
                <T.Xs style={{ marginTop: 3 }}>{d.detail}</T.Xs>
              </View>
              <Pill tone={d.verified ? 'ok' : 'warn'}>
                {d.verified ? 'Verified' : 'Renewal due'}
              </Pill>
            </View>
          </Card>
        ))}
        <Banner tone="info" icon="info">
          Uploading documents is not wired in this build. The admin console verifies them.
        </Banner>
      </Body>
    </Screen>
  );
}

export function NotificationsScreen({ navigation }) {
  const { data, loading } = useApi(() => appApi.partner.notifications(), []);
  if (loading) return <Screen><AppBar title="Notifications" onBack={navigation.goBack} /><Loading /></Screen>;

  const iconFor = { job: 'route', payout: 'wallet' };

  return (
    <Screen>
      <AppBar title="Notifications" onBack={navigation.goBack} />
      <Body>
        {data.notifications.length === 0 ? (
          <EmptyState icon="bell" title="Nothing new" />
        ) : (
          data.notifications.map((n) => (
            <Card key={n.id} style={{ marginBottom: space[3] }}>
              <View style={{ flexDirection: 'row', gap: space[3] }}>
                <View style={{
                  width: 38, height: 38, borderRadius: radii.md,
                  backgroundColor: n.unread ? colors.accent[50] : colors.sunken,
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  <Ico name={iconFor[n.kind] ?? 'bell'} size={19}
                    color={n.unread ? colors.accent[600] : colors.ink[3]} />
                </View>
                <View style={{ flex: 1 }}>
                  <T.H3>{n.title}</T.H3>
                  <T.Xs style={{ marginTop: 4 }}>{n.body}</T.Xs>
                  <T.Xs style={{ marginTop: 6, color: colors.ink[4] }}>{n.when_label}</T.Xs>
                </View>
              </View>
            </Card>
          ))
        )}
      </Body>
    </Screen>
  );
}

export function PartnerAccountScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { data, loading } = useApi(() => appApi.partner.home(), []);

  if (loading) return <Screen><AppBar title="Account" /><Loading /></Screen>;
  const me = data.me;

  return (
    <Screen>
      <AppBar title="Account" />
      <Body>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <PersonAvatar
              name={me.name}
              size={62}
              from={me.kind === 'Walker' ? '#1F7A4D' : '#F07B2C'}
              to={me.kind === 'Walker' ? '#0E4229' : '#A8480C'}
            />
            <View style={{ flex: 1 }}>
              <T.H2>{me.name}</T.H2>
              <T.Xs style={{ marginTop: 3 }}>{me.kind} · {me.area}</T.Xs>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, alignItems: 'center' }}>
                <RatingChip value={me.rating} />
                <T.Xs>{me.jobs} jobs</T.Xs>
              </View>
            </View>
          </View>
          <Divider style={{ marginVertical: space[4] }} />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <T.H2>{data.today.jobs}</T.H2>
              <T.Xs>jobs today</T.Xs>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <T.H2>{inr(me.pending_payout)}</T.H2>
              <T.Xs>pending</T.Xs>
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: space[4], paddingVertical: 4 }}>
          <Row icon="star" iconTone="accent" title="Reviews"
            onPress={() => navigation.navigate('Reviews')} />
          <Divider />
          <Row icon="doc" title="Documents"
            onPress={() => navigation.navigate('Documents')} />
          <Divider />
          <Row icon="wallet" title="Payouts"
            onPress={() => navigation.navigate('Payout')} />
          <Divider />
          <Row icon="bag" title="Your store orders"
            onPress={() => navigation.navigate('StoreTab', { screen: 'Orders' })} />
          <Divider />
          <Row icon="bell" title="Notifications"
            onPress={() => navigation.navigate('Notifications')} />
        </Card>

        <Button title="Sign out" variant="secondary" onPress={signOut} style={{ marginTop: space[5] }} />
        <T.Xs style={{ textAlign: 'center', marginTop: space[4] }}>
          Wag &amp; Tails Partner · EST. 2022
        </T.Xs>
      </Body>
    </Screen>
  );
}
