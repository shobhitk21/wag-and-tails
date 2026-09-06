import { useState } from 'react';
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

import { JobsScreen } from './src/screens/Jobs.jsx';
import { JobScreen, JobDoneScreen } from './src/screens/Groomer.jsx';
import {
  WalkJobScreen, WalkPickupScreen, WalkLiveScreen, WalkSummaryScreen, WalkRequestsScreen
} from './src/screens/Walker.jsx';
import {
  ScheduleScreen, EarningsScreen, PayoutScreen, ReviewsScreen,
  DocumentsScreen, NotificationsScreen, PartnerAccountScreen
} from './src/screens/Account.jsx';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

const ONBOARD_SLIDES = [
  {
    title: 'One app, both roles',
    body: 'Groom and walk from the same place. The switch at the top of Jobs changes everything below it.'
  },
  {
    title: 'Every job has notes',
    body: 'The owner writes what their dog needs. You read it before you start — no surprises.'
  },
  {
    title: 'Paid on a schedule',
    body: 'Grooms settle weekly, walks nightly. Track every payout in the app.'
  }
];

const stackOptions = { headerShown: false, contentStyle: { backgroundColor: colors.canvas } };

/* The groomer / walker switch lives above the navigator, because it drives the
   Jobs feed and the Schedule together — one choice, two screens. */
function Tabs() {
  const [mode, setMode] = useState(null);
  const { user } = useAuth();
  const current = mode ?? (user?.kind === 'Walker' ? 'walking' : 'grooming');

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {/* Jobs, Schedule, Store, Earnings, Account — the prototype's exact
          order (js/screens-partner.js, P_TABS). */}
      <Tab.Screen name="JobsTab" options={{ title: 'Jobs', tabBarIconName: 'brief' }}>
        {() => <JobsStack mode={current} setMode={setMode} />}
      </Tab.Screen>
      <Tab.Screen name="ScheduleTab" options={{ title: 'Schedule', tabBarIconName: 'cal' }}>
        {() => <ScheduleStack mode={current} setMode={setMode} />}
      </Tab.Screen>
      <Tab.Screen name="StoreTab" component={StoreStack}
        options={{ title: 'Store', tabBarIconName: 'bag' }} />
      <Tab.Screen name="EarningsTab" component={EarningsStack}
        options={{ title: 'Earnings', tabBarIconName: 'wallet' }} />
      <Tab.Screen name="AccountTab" component={AccountStack}
        options={{ title: 'Account', tabBarIconName: 'user' }} />
    </Tab.Navigator>
  );
}

/* Both job kinds are reachable from every tab, so a groomer who flips the
   switch mid-session lands somewhere real. */
function jobScreens() {
  return (
    <>
      <Stack.Screen name="Job" component={JobScreen} />
      <Stack.Screen name="JobDone" component={JobDoneScreen} />
      <Stack.Screen name="WalkJob" component={WalkJobScreen} />
      <Stack.Screen name="WalkPickup" component={WalkPickupScreen} />
      <Stack.Screen name="WalkLive" component={WalkLiveScreen} />
      <Stack.Screen name="WalkSummary" component={WalkSummaryScreen} />
      <Stack.Screen name="WalkRequests" component={WalkRequestsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </>
  );
}

function JobsStack({ mode, setMode }) {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="JobsHome">
        {(props) => <JobsScreen {...props} mode={mode} setMode={setMode} />}
      </Stack.Screen>
      {jobScreens()}
    </Stack.Navigator>
  );
}

function ScheduleStack({ mode, setMode }) {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="ScheduleHome">
        {(props) => <ScheduleScreen {...props} mode={mode} setMode={setMode} />}
      </Stack.Screen>
      {jobScreens()}
    </Stack.Navigator>
  );
}

function EarningsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Earnings" component={EarningsScreen} />
      <Stack.Screen name="Payout" component={PayoutScreen} />
      {jobScreens()}
    </Stack.Navigator>
  );
}

/* The same store screens the customer app registers — the API prices them at
   trade because a partner is signed in. */
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
      <Stack.Screen name="PartnerAccount" component={PartnerAccountScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="Payout" component={PayoutScreen} />
      {jobScreens()}
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
          <PhoneScreen {...props} role="partner"
            blurb="Use the number your account is registered against." />
        )}
      </Stack.Screen>
      <Stack.Screen name="Otp">
        {(props) => <OtpScreen {...props} role="partner" />}
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
      <AuthProvider role="partner" baseUrl={API_URL}>
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
