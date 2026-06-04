import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#f8fafc' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Tournamate' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan QR' }} />
        <Stack.Screen name="[tournamentSlug]/index" options={{ title: 'Tournament' }} />
        <Stack.Screen
          name="[tournamentSlug]/[day]/[divisionSlug]/index"
          options={{ title: 'Division' }}
        />
        <Stack.Screen
          name="[tournamentSlug]/match/[matchId]"
          options={{ title: 'Match' }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
