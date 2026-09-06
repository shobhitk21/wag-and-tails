import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@wag/theme';
import {
  AuthProvider, useAuth, TabBar,
  SplashScreen, OnboardScreen, PhoneScreen, OtpScreen, RestoringScreen
} from '@wag/ui-native';
import { storeScreens } from '@wag/features-store';

import HomeScreen from './src/screens/Home.jsx';
import { PetsScreen, PetScreen, PetVaccinesScreen, VisitScreen, PetFormScreen } from './src/screens/Pets.jsx';
import { BookGroomScreen, BookWalkScreen } from './src/screens/Book.jsx';
import {
  MatchingScreen, BookingsScreen, BookingScreen, TrackScreen, WalkLiveScreen,
  RescheduleScreen, PayScreen, RateScreen
} from './src/screens/Bookings.jsx';
import {
  AccountScreen, WalletScreen, AddressesScreen, PaymentsScreen,
  OffersScreen, NotificationsScreen, HelpScreen
} from './src/screens/Account.jsx';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

const ONBOARD_SLIDES = [
  {
    title: 'Grooming at your door',
    body: 'A groomer brings everything — shampoo, dryer, clippers and towels. You just need a tap and a power point.'
  },
  {
    title: 'Walks you can watch',
    body: 'Follow the route live, then see how far they actually went.'
  },
  {
    title: 'Their notes travel with them',
    body: 'Write what your dog needs once. Every groomer and walker reads it before they start.'
  }
];

/* Five tabs — the store earned a first-class home once it was in scope. */
function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      {/* Home, Store, Bookings, Pets, Account — the prototype's exact order
          (js/screens-customer.js, C_TABS). */}
      <Tab.Screen name="HomeTab" component={HomeStack}
        options={{ title: 'Home', tabBarIconName: 'home' }} />
      <Tab.Screen name="StoreTab" component={StoreStack}
        options={{ title: 'Store', tabBarIconName: 'bag' }} />
      <Tab.Screen name="BookingsTab" component={BookingsStack}
        options={{ title: 'Bookings', tabBarIconName: 'cal' }} />
      <Tab.Screen name="PetsTab" component={PetsStack}
        options={{ title: 'Pets', tabBarIconName: 'paw' }} />
      <Tab.Screen name="AccountTab" component={AccountStack}
        options={{ title: 'Account', tabBarIconName: 'user' }} />
    </Tab.Navigator>
  );
}

const stackOptions = { headerShown: false, contentStyle: { backgroundColor: colors.canvas } };

/* Every tab carries the screens reachable from it, so a deep link into a
   booking keeps the right tab highlighted. */
function sharedScreens() {
  return (
    <>
      <Stack.Screen name="Pet" component={PetScreen} />
      <Stack.Screen name="PetVaccines" component={PetVaccinesScreen} />
      <Stack.Screen name="Visit" component={VisitScreen} />
      <Stack.Screen name="PetAdd" component={PetFormScreen} />
      <Stack.Screen name="PetEdit" component={PetFormScreen} />
      <Stack.Screen name="BookGroom" component={BookGroomScreen} />
      <Stack.Screen name="BookWalk" component={BookWalkScreen} />
      <Stack.Screen name="Matching" component={MatchingScreen} />
      <Stack.Screen name="Booking" component={BookingScreen} />
      <Stack.Screen name="Track" component={TrackScreen} />
      <Stack.Screen name="WalkLive" component={WalkLiveScreen} />
      <Stack.Screen name="Reschedule" component={RescheduleScreen} />
      <Stack.Screen name="Pay" component={PayScreen} />
      <Stack.Screen name="Rate" component={RateScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Home" component={HomeScreen} />
      {sharedScreens()}
    </Stack.Navigator>
  );
}

function PetsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Pets" component={PetsScreen} />
      {sharedScreens()}
    </Stack.Navigator>
  );
}

function BookingsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Bookings" component={BookingsScreen} />
      {sharedScreens()}
    </Stack.Navigator>
  );
}

/* The store screens are the shared ones — the partner app registers exactly
   these, only priced at trade. */
function StoreStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      {storeScreens.map((s) => (
        <Stack.Screen key={s.name} name={s.name} component={s.component} />
      ))}
    </Stack.Navigator>
  );
}

function AccountStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="Offers" component={OffersScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      {sharedScreens()}
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboard">
        {(props) => <OnboardScreen {...props} slides={ONBOARD_SLIDES} />}
      </Stack.Screen>
      <Stack.Screen name="Phone">
        {(props) => (
          <PhoneScreen {...props} role="customer"
            blurb="We’ll text you a code. No password to remember." />
        )}
      </Stack.Screen>
      <Stack.Screen name="Otp">
        {(props) => <OtpScreen {...props} role="customer" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function Root() {
  const { user, restoring } = useAuth();
  if (restoring) return <RestoringScreen />;
  return user ? <Tabs /> : <AuthStack />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider role="customer" baseUrl={API_URL}>
        <NavigationContainer
          theme={{
            dark: false,
            colors: {
              primary: colors.brand[700],
              background: colors.canvas,
              card: colors.surface,
              text: colors.ink[1],
              border: colors.line,
              notification: colors.accent[400]
            }
          }}
        >
          <StatusBar style="dark" />
          <Root />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
