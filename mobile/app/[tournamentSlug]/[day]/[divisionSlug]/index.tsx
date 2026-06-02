import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DivisionDetailScreen() {
  const { tournamentSlug, day, divisionSlug } = useLocalSearchParams<{
    tournamentSlug: string;
    day: string;
    divisionSlug: string;
  }>();
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: divisionSlug ?? 'Division' }} />
      <View style={styles.body}>
        <Text style={styles.title}>Division Detail</Text>
        <Text style={styles.meta}>Tournament: {tournamentSlug}</Text>
        <Text style={styles.meta}>Day: {day}</Text>
        <Text style={styles.meta}>Division: {divisionSlug}</Text>
        <Text style={styles.placeholder}>Full standings · fixtures · results — coming next.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  meta: { marginTop: 6, color: '#475569' },
  placeholder: { marginTop: 24, color: '#94a3b8', fontStyle: 'italic' },
});
