/* Account, addresses, payment methods, wallet, offers, notifications, help. */
import { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import appApi from '@wag/api-client/app';
import { colors, type, radii, space, inr } from '@wag/theme';
import {
  Screen, AppBar, Body, Dock, Toast,
  Card, Button, Row, KV, Divider, Pill, Field, Banner, PersonAvatar,
  T, Ico, Loading, ErrorState, EmptyState, useApi, useAuth
} from '@wag/ui-native';

export function AccountScreen({ navigation }) {
  const { user, signOut } = useAuth();

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need your number and a new code to get back in.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut }
    ]);
  const { data, error, loading, reload } = useApi(() => appApi.customer.account(), []);

  if (loading) return <Screen><AppBar title="Account" /><Loading /></Screen>;
  if (error) return <Screen><AppBar title="Account" /><ErrorState error={error} onRetry={reload} /></Screen>;

  const me = data.me;

  return (
    <Screen>
      <AppBar title="Account" />
      <Body>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <PersonAvatar name={me.name} size={62} />
            <View style={{ flex: 1 }}>
              <T.H2>{me.name}</T.H2>
              <T.Xs style={{ marginTop: 3 }}>{me.phone}</T.Xs>
              {me.email ? <T.Xs style={{ marginTop: 2 }}>{me.email}</T.Xs> : null}
            </View>
          </View>
          <Divider style={{ marginVertical: space[4] }} />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <T.H2>{data.stats.bookings}</T.H2>
              <T.Xs>bookings</T.Xs>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <T.H2>{inr(data.stats.spent)}</T.H2>
              <T.Xs>spent</T.Xs>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <T.H2>{me.since_label ?? '—'}</T.H2>
              <T.Xs>since</T.Xs>
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: space[4], paddingVertical: 4 }}>
          <Row icon="wallet" iconTone="brand" title="Wallet"
            subtitle={`${inr(me.wallet_balance)} available`}
            onPress={() => navigation.navigate('Wallet')} />
          <Divider />
          <Row icon="pin" title="Addresses"
            subtitle={`${data.addresses.length} saved`}
            onPress={() => navigation.navigate('Addresses')} />
          <Divider />
          <Row icon="card" title="Payment methods"
            subtitle={data.payments.find((p) => p.is_default)?.label ?? 'None set'}
            onPress={() => navigation.navigate('Payments')} />
          <Divider />
          <Row icon="gift" iconTone="accent" title="Offers"
            onPress={() => navigation.navigate('Offers')} />
          <Divider />
          <Row icon="bag" title="Store orders"
            onPress={() => navigation.navigate('StoreTab', { screen: 'Orders' })} />
        </Card>

        <Card style={{ marginTop: space[4], paddingVertical: 4 }}>
          <Row icon="bell" title="Notifications"
            onPress={() => navigation.navigate('Notifications')} />
          <Divider />
          <Row icon="help" title="Help and support"
            onPress={() => navigation.navigate('Help')} />
        </Card>

        <Button title="Sign out" variant="secondary" onPress={confirmSignOut}
          style={{ marginTop: space[5] }} />
        <T.Xs style={{ textAlign: 'center', marginTop: space[4] }}>
          Wag &amp; Tails · EST. 2022
        </T.Xs>
      </Body>
    </Screen>
  );
}

export function WalletScreen({ navigation }) {
  const { data, loading } = useApi(() => appApi.customer.account(), []);
  if (loading) return <Screen><AppBar title="Wallet" onBack={navigation.goBack} /><Loading /></Screen>;

  return (
    <Screen>
      <AppBar title="Wallet" onBack={navigation.goBack} />
      <Body>
        <Card style={{ backgroundColor: colors.brand[700], borderColor: colors.brand[700] }}>
          <Text style={{ ...type.xs, color: 'rgba(255,255,255,.7)' }}>Available balance</Text>
          <Text style={{ ...type.hero, color: colors.white, marginTop: 6 }}>
            {inr(data.me.wallet_balance)}
          </Text>
          <Text style={{ ...type.xs, color: 'rgba(255,255,255,.7)', marginTop: 10 }}>
            Applied automatically at checkout when you choose to use it.
          </Text>
        </Card>
        <Banner tone="info" icon="info" style={{ marginTop: space[4] }}>
          Topping up is not wired in this build. The balance comes from refunds
          and referral credit.
        </Banner>
      </Body>
    </Screen>
  );
}

export function AddressesScreen({ navigation }) {
  const { data, loading, reload } = useApi(() => appApi.customer.account(), []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: '', line1: '', line2: '', landmark: '' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  if (loading) return <Screen><AppBar title="Addresses" onBack={navigation.goBack} /><Loading /></Screen>;

  async function save() {
    setBusy(true);
    try {
      await appApi.customer.addAddress(form);
      setAdding(false);
      setForm({ label: '', line1: '', line2: '', landmark: '' });
      reload();
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 2400);
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(id) {
    await appApi.customer.setDefaultAddress(id);
    reload();
  }

  return (
    <Screen>
      <AppBar title="Addresses" onBack={navigation.goBack} />
      <Body>
        {adding ? (
          <Card>
            <Field label="Label" value={form.label} placeholder="Home"
              onChangeText={(v) => setForm({ ...form, label: v })} />
            <Field label="Flat and building" value={form.line1} placeholder="Flat 402, Palm Grove"
              onChangeText={(v) => setForm({ ...form, line1: v })} style={{ marginTop: space[4] }} />
            <Field label="Area and pincode" value={form.line2} placeholder="Andheri West, Mumbai 400053"
              onChangeText={(v) => setForm({ ...form, line2: v })} style={{ marginTop: space[4] }} />
            <Field label="Landmark" value={form.landmark} placeholder="Opposite the market"
              onChangeText={(v) => setForm({ ...form, landmark: v })} style={{ marginTop: space[4] }} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: space[4] }}>
              <Button title="Cancel" variant="secondary" onPress={() => setAdding(false)}
                style={{ flex: 1 }} />
              <Button title={busy ? 'Saving…' : 'Save'} onPress={save} loading={busy}
                disabled={!form.label || !form.line1} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}

        {data.addresses.map((a) => (
          <Card key={a.id} style={{ marginTop: space[3] }} onPress={() => makeDefault(a.id)}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
              <Ico name="pin" size={20} color={colors.ink[3]} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T.H3>{a.label}</T.H3>
                  {a.is_default ? <Pill tone="ok">Default</Pill> : null}
                </View>
                <T.Xs style={{ marginTop: 4 }}>{a.line1}</T.Xs>
                {a.line2 ? <T.Xs style={{ marginTop: 2 }}>{a.line2}</T.Xs> : null}
                {a.landmark ? <T.Xs style={{ marginTop: 2 }}>{a.landmark}</T.Xs> : null}
              </View>
            </View>
          </Card>
        ))}
      </Body>

      {!adding ? (
        <Dock>
          <Button title="Add an address" onPress={() => setAdding(true)} />
        </Dock>
      ) : null}
      <Toast message={toast} />
    </Screen>
  );
}

export function PaymentsScreen({ navigation }) {
  const { data, loading, reload } = useApi(() => appApi.customer.account(), []);
  if (loading) return <Screen><AppBar title="Payment" onBack={navigation.goBack} /><Loading /></Screen>;

  return (
    <Screen>
      <AppBar title="Payment methods" onBack={navigation.goBack} />
      <Body>
        {data.payments.map((p) => (
          <Card key={p.id} style={{ marginBottom: space[3] }}
            onPress={async () => { await appApi.customer.setDefaultPayment(p.id); reload(); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Ico name="card" size={20} color={colors.ink[2]} />
              <View style={{ flex: 1 }}>
                <T.H3>{p.label}</T.H3>
                <T.Xs style={{ marginTop: 3 }}>{p.subtitle}</T.Xs>
              </View>
              {p.is_default ? <Pill tone="ok">Default</Pill> : null}
            </View>
          </Card>
        ))}
        <Banner tone="info" icon="info">
          Adding a card is not wired in this build.
        </Banner>
      </Body>
    </Screen>
  );
}

export function OffersScreen({ navigation }) {
  const { data, loading } = useApi(() => appApi.customer.offers(), []);
  if (loading) return <Screen><AppBar title="Offers" onBack={navigation.goBack} /><Loading /></Screen>;

  return (
    <Screen>
      <AppBar title="Offers" onBack={navigation.goBack} />
      <Body>
        {data.offers.map((o) => (
          <Card key={o.code} style={{ marginBottom: space[3], opacity: o.active ? 1 : 0.55 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Ico name="gift" size={22} color={colors.accent[600]} />
              <View style={{ flex: 1 }}>
                <T.H3>{o.title}</T.H3>
                <T.Xs style={{ marginTop: 3 }}>{o.subtitle}</T.Xs>
                <T.Xs style={{ marginTop: 2 }}>
                  {o.applies_to} · expires {o.expires_on}
                </T.Xs>
              </View>
              <Pill tone={o.active ? 'accent' : 'muted'}>{o.code}</Pill>
            </View>
          </Card>
        ))}
      </Body>
    </Screen>
  );
}

export function NotificationsScreen({ navigation }) {
  const { data, loading } = useApi(() => appApi.customer.notifications(), []);
  if (loading) return <Screen><AppBar title="Notifications" onBack={navigation.goBack} /><Loading /></Screen>;

  const iconFor = { booking: 'cal', health: 'syringe', offer: 'gift' };

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

export function HelpScreen({ navigation }) {
  const { data, loading } = useApi(() => appApi.customer.help(), []);
  const [open, setOpen] = useState(null);

  if (loading) return <Screen><AppBar title="Help" onBack={navigation.goBack} /><Loading /></Screen>;

  return (
    <Screen>
      <AppBar title="Help" subtitle={data.supportHours ? `Support ${data.supportHours}` : undefined}
        onBack={navigation.goBack} />
      <Body>
        {data.faqs.map((f, i) => (
          <Card key={i} style={{ marginBottom: space[3] }} onPress={() => setOpen(open === i ? null : i)}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
              <T.H3 style={{ flex: 1 }}>{f.question}</T.H3>
              <Ico name={open === i ? 'chevD' : 'chev'} size={16} color={colors.ink[4]} />
            </View>
            {open === i ? <T.Body style={{ marginTop: space[3] }}>{f.answer}</T.Body> : null}
          </Card>
        ))}

        <Card style={{ marginTop: space[3] }}>
          <T.H3>Still stuck?</T.H3>
          <T.Xs style={{ marginTop: 4 }}>
            Call us on the support line. Live chat is not wired in this build.
          </T.Xs>
          <Button title="Call support" variant="secondary" style={{ marginTop: space[3] }} onPress={() => {}} />
        </Card>
      </Body>
    </Screen>
  );
}
