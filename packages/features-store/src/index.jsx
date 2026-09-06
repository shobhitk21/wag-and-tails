/* The Indian Pet Company store — the eight screens both apps reach.

   One catalogue, two price ladders: the customer app shows retail against MRP,
   the partner app shows trade against retail. Which ladder applies is decided
   by the API from who is signed in, so these screens simply render `now` and
   `was` and never do the pricing themselves.

   The allergy check is the customer-only part: the API cross-references a
   product's ingredients against every pet on the account, which is why chicken
   kibble is flagged for a dog that reacts to chicken. */
import { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import appApi from '@wag/api-client/app';
import { colors, type, radii, space, inr } from '@wag/theme';
import {
  Screen, AppBar, Body, Dock, Toast,
  Card, Button, Chip, Row, KV, Divider, Price, Pill, Banner, Ico,
  T, Loading, ErrorState, EmptyState, RatingChip, Timeline,
  ProductArt, useApi
} from '@wag/ui-native';

/* ---------- store home ---------- */
export function StoreHomeScreen({ navigation }) {
  const [category, setCategory] = useState(null);
  const { data, error, loading, reload } = useApi(
    () => appApi.store.catalogue(category), [category]
  );
  const cart = useApi(() => appApi.store.cart(), []);

  if (loading) return <Screen><AppBar title="Store" /><Loading /></Screen>;
  if (error) return <Screen><AppBar title="Store" /><ErrorState error={error} onRetry={reload} /></Screen>;

  return (
    <Screen>
      <AppBar
        title="The Indian Pet Company"
        subtitle={data.pricing === 'trade' ? 'Partner trade pricing' : 'Everything for your dog'}
        right={
          <Pressable onPress={() => navigation.navigate('Cart')} hitSlop={10}>
            <View>
              <Ico name="bag" size={22} color={colors.ink[1]} />
              {cart.data?.count ? (
                <View style={{
                  position: 'absolute', top: -6, right: -8, minWidth: 17, height: 17,
                  borderRadius: 9, backgroundColor: colors.accent[400],
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  <Text style={{ ...type.xxs, color: colors.white, fontSize: 10 }}>
                    {cart.data.count}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        }
      />

      <Body>
        {data.pricing === 'trade' ? (
          <Banner tone="accent" icon="spark" style={{ marginBottom: space[4] }}>
            You are seeing trade pricing. Restock at the rate partners pay, not retail.
          </Banner>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space[4] }}>
          <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
          {data.categories.map((c) => (
            <Chip key={c.id} label={c.name} selected={category === c.id}
              onPress={() => setCategory(c.id)} />
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
          {data.products.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => navigation.navigate('Product', { id: p.id })}
              style={({ pressed }) => ({ width: '48%', opacity: pressed ? 0.9 : 1 })}
            >
              <Card style={{ padding: 12, gap: 8 }}>
                <View style={{ alignItems: 'center' }}>
                  <ProductArt art={p.art} tone={p.tone} size={110} />
                </View>
                {p.tag ? <Pill tone="accent">{p.tag}</Pill> : null}
                <T.Sm numberOfLines={2} style={{ fontFamily: type.h3.fontFamily, minHeight: 34 }}>
                  {p.name}
                </T.Sm>
                <Price now={p.now} was={p.was} size={15} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <RatingChip value={p.rating} size={11} />
                  <T.Xs>({p.reviews})</T.Xs>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      </Body>
    </Screen>
  );
}

/* ---------- product ---------- */
export function ProductScreen({ route, navigation }) {
  const { id } = route.params;
  const [size, setSize] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useApi(() => appApi.store.product(id), [id]);

  const add = useCallback(async () => {
    setBusy(true);
    try {
      await appApi.store.addToCart({
        productId: id,
        sizeIndex: size ?? data.product.default_size,
        qty: 1
      });
      setToast('Added to cart.');
      setTimeout(() => setToast(null), 2400);
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 2400);
    } finally {
      setBusy(false);
    }
  }, [id, size, data]);

  if (loading) return <Screen><AppBar title="Product" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Product" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  const p = data.product;
  const chosen = size ?? p.default_size;

  return (
    <Screen>
      <AppBar title={p.name} onBack={navigation.goBack} />
      <Body>
        <View style={{ alignItems: 'center', marginBottom: space[4] }}>
          <ProductArt art={p.art} tone={p.tone} size={200} />
        </View>

        <T.H1>{p.name}</T.H1>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <RatingChip value={p.rating} />
          <T.Xs>{p.reviews} reviews</T.Xs>
          <Pill tone={p.stock === 'In stock' ? 'ok' : 'warn'}>{p.stock}</Pill>
        </View>

        <Price now={p.now} was={p.was} size={26} style={{ marginTop: space[3] }} />
        {p.pricing === 'trade' ? (
          <T.Xs style={{ marginTop: 4 }}>Trade price · retail is {inr(p.price)}</T.Xs>
        ) : null}

        {/* The allergy check is the reason the store knows about the pets. */}
        {data.allergyWarnings.map((w) => (
          <Banner key={w.pet} tone="danger" icon="alert" style={{ marginTop: space[4] }}>
            {w.pet} reacts to {w.allergies.toLowerCase()}. Check the ingredients before ordering this.
          </Banner>
        ))}

        {p.sizes.length > 1 ? (
          <View style={{ marginTop: space[5] }}>
            <T.Eyebrow style={{ marginBottom: 8 }}>Size</T.Eyebrow>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {p.sizes.map((s, i) => (
                <Chip key={s} label={s} selected={chosen === i} onPress={() => setSize(i)} />
              ))}
            </View>
          </View>
        ) : null}

        <Card style={{ marginTop: space[5], gap: 10 }}>
          <T.Body>{p.description}</T.Body>
          {p.bullets.map((b) => (
            <View key={b} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Ico name="check" size={16} color={colors.ok[600]} />
              <T.Sm style={{ flex: 1 }}>{b}</T.Sm>
            </View>
          ))}
        </Card>

        {p.ingredients ? (
          <Card style={{ marginTop: space[4] }}>
            <T.Eyebrow style={{ marginBottom: 6 }}>Ingredients</T.Eyebrow>
            <T.Sm>{p.ingredients}</T.Sm>
          </Card>
        ) : null}
      </Body>

      <Dock>
        <Button title={busy ? 'Adding…' : `Add to cart · ${inr(p.now)}`} onPress={add} loading={busy} />
      </Dock>
      <Toast message={toast} />
    </Screen>
  );
}

/* ---------- cart ---------- */
export function CartScreen({ navigation }) {
  const { data, error, loading, reload, setData } = useApi(() => appApi.store.cart(), []);
  const [busy, setBusy] = useState(false);

  async function setQty(itemId, qty) {
    setBusy(true);
    try {
      setData(await appApi.store.setQty(itemId, qty));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Screen><AppBar title="Cart" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Cart" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  if (!data.items.length) {
    return (
      <Screen>
        <AppBar title="Cart" onBack={navigation.goBack} />
        <EmptyState
          icon="bag"
          title="Your cart is empty"
          subtitle="Everything from shampoo to harnesses, at one place."
          action="Browse the store"
          onAction={() => navigation.navigate('StoreHome')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="Cart" subtitle={`${data.count} item${data.count === 1 ? '' : 's'}`}
        onBack={navigation.goBack} />
      <Body>
        {data.items.map((l) => (
          <Card key={l.id} style={{ marginBottom: space[3], flexDirection: 'row', gap: space[3] }}>
            <ProductArt art={l.art} tone={l.tone} size={64} />
            <View style={{ flex: 1, gap: 6 }}>
              <T.Sm style={{ fontFamily: type.h3.fontFamily }} numberOfLines={2}>{l.name}</T.Sm>
              <T.Xs>{l.size_label}</T.Xs>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Price now={l.unit} was={l.was} size={15} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable onPress={() => setQty(l.id, l.qty - 1)} disabled={busy} hitSlop={8}>
                    <Ico name="minus" size={18} color={colors.ink[2]} />
                  </Pressable>
                  <Text style={{ ...type.sm, fontFamily: type.h3.fontFamily, minWidth: 16, textAlign: 'center' }}>
                    {l.qty}
                  </Text>
                  <Pressable onPress={() => setQty(l.id, l.qty + 1)} disabled={busy} hitSlop={8}>
                    <Ico name="plus" size={18} color={colors.ink[2]} />
                  </Pressable>
                </View>
              </View>
            </View>
          </Card>
        ))}

        <Card style={{ marginTop: space[2] }}>
          <KV k="Subtotal" v={inr(data.total)} />
          {data.savings > 0 ? (
            <KV k="You save" v={<Text style={{ color: colors.ok[600] }}>−{inr(data.savings)}</Text>} />
          ) : null}
          <KV k="Delivery" v="Free" />
          <Divider style={{ marginVertical: 8 }} />
          <KV k="Total" v={inr(data.total)} />
        </Card>
      </Body>

      <Dock>
        <Button title={`Checkout · ${inr(data.total)}`}
          onPress={() => navigation.navigate('Checkout')} />
      </Dock>
    </Screen>
  );
}

/* ---------- checkout ---------- */
export function CheckoutScreen({ navigation }) {
  const { data, loading } = useApi(() => appApi.store.cart(), []);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  async function placeOrder() {
    setBusy(true);
    try {
      const { order } = await appApi.store.checkout('');
      navigation.replace('OrderPlaced', { id: order.id });
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 2400);
      setBusy(false);
    }
  }

  if (loading) return <Screen><AppBar title="Checkout" onBack={navigation.goBack} /><Loading /></Screen>;

  return (
    <Screen>
      <AppBar title="Checkout" onBack={navigation.goBack} />
      <Body>
        <Card>
          <T.Eyebrow style={{ marginBottom: 10 }}>Order</T.Eyebrow>
          {data.items.map((l) => (
            <KV key={l.id} k={`${l.name} × ${l.qty}`} v={inr(l.lineTotal)} />
          ))}
          <Divider style={{ marginVertical: 8 }} />
          <KV k="Total" v={inr(data.total)} />
        </Card>

        <Banner tone="info" icon="info" style={{ marginTop: space[4] }}>
          Payment on delivery. Card and UPI checkout are not wired in this build.
        </Banner>
      </Body>

      <Dock>
        <Button title={busy ? 'Placing…' : `Place order · ${inr(data.total)}`}
          onPress={placeOrder} loading={busy} />
      </Dock>
      <Toast message={toast} />
    </Screen>
  );
}

/* ---------- order placed ---------- */
export function OrderPlacedScreen({ route, navigation }) {
  const { id } = route.params;
  return (
    <Screen>
      <Body contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: space[3] }}>
          <View style={{
            width: 86, height: 86, borderRadius: 43, backgroundColor: colors.ok[50],
            alignItems: 'center', justifyContent: 'center'
          }}>
            <Ico name="check" size={38} color={colors.ok[600]} />
          </View>
          <T.H1>Order placed</T.H1>
          <T.Sm style={{ textAlign: 'center' }}>
            {id} is confirmed. We’ll pack it today and let you know when it ships.
          </T.Sm>
        </View>
      </Body>
      <Dock>
        <Button title="Track this order" onPress={() => navigation.replace('Order', { id })} />
        <Button title="Back to the store" variant="ghost" style={{ marginTop: 8 }}
          onPress={() => navigation.navigate('StoreHome')} />
      </Dock>
    </Screen>
  );
}

/* ---------- orders ---------- */
export function OrdersScreen({ navigation }) {
  const { data, error, loading, reload } = useApi(() => appApi.store.orders(), []);

  if (loading) return <Screen><AppBar title="Your orders" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Your orders" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="Your orders" onBack={navigation.goBack} />
      <Body>
        {data.orders.length === 0 ? (
          <EmptyState icon="bag" title="No orders yet"
            subtitle="Anything you buy from the store shows up here." />
        ) : (
          data.orders.map((o) => (
            <Card key={o.id} style={{ marginBottom: space[3] }}
              onPress={() => navigation.navigate('Order', { id: o.id })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T.H3>{o.id}</T.H3>
                <Pill tone={o.status === 'Delivered' ? 'ok' : 'accent'}>{o.status}</Pill>
              </View>
              <T.Xs style={{ marginTop: 4 }}>
                {o.placed_label} · {o.item_count} item{o.item_count === 1 ? '' : 's'}
              </T.Xs>
              <T.Sm style={{ marginTop: 8, fontFamily: type.h3.fontFamily }}>{inr(o.total)}</T.Sm>
            </Card>
          ))
        )}
      </Body>
    </Screen>
  );
}

/* ---------- order detail ---------- */
export function OrderScreen({ route, navigation }) {
  const { id } = route.params;
  const { data, error, loading, reload } = useApi(() => appApi.store.order(id), [id]);

  if (loading) return <Screen><AppBar title="Order" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Order" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title={`Order ${data.order.id}`} subtitle={data.order.placed_label}
        onBack={navigation.goBack} />
      <Body>
        <Card>
          <Timeline steps={data.steps.map((s) => ({
            title: s.title, detail: s.detail, state: s.done ? 'done' : 'todo'
          }))} />
        </Card>

        <Card style={{ marginTop: space[4] }}>
          <T.Eyebrow style={{ marginBottom: 10 }}>Items</T.Eyebrow>
          {data.items.map((i, idx) => (
            <View key={idx} style={{ flexDirection: 'row', gap: space[3], paddingVertical: 8 }}>
              <ProductArt art={i.art} tone={i.tone} size={48} />
              <View style={{ flex: 1 }}>
                <T.Sm style={{ fontFamily: type.h3.fontFamily }}>{i.name}</T.Sm>
                <T.Xs style={{ marginTop: 2 }}>{i.size_label} · Qty {i.qty}</T.Xs>
              </View>
              <T.Sm style={{ fontFamily: type.h3.fontFamily }}>{inr(i.unit_price * i.qty)}</T.Sm>
            </View>
          ))}
          <Divider style={{ marginVertical: 10 }} />
          <KV k="Total" v={inr(data.order.total)} />
        </Card>
      </Body>
    </Screen>
  );
}

/* One place to register the store stack in either app's navigator. */
export const storeScreens = [
  { name: 'StoreHome', component: StoreHomeScreen },
  { name: 'Product', component: ProductScreen },
  { name: 'Cart', component: CartScreen },
  { name: 'Checkout', component: CheckoutScreen },
  { name: 'OrderPlaced', component: OrderPlacedScreen },
  { name: 'Orders', component: OrdersScreen },
  { name: 'Order', component: OrderScreen }
];
