import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MatchDetailScreen() {
  const { tournamentSlug, matchId } = useLocalSearchParams<{
    tournamentSlug: string;
    matchId: string;
  }>();
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Match' }} />
      <View style={styles.body}>
        <Text style={styles.title}>Match Detail</Text>
        <Text style={styles.meta}>Tournament: {tournamentSlug}</Text>
        <Text style={styles.meta}>Match ID: {matchId}</Text>
        <Text style={styles.placeholder}>Court · kickoff · score · official — coming next.</Text>
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
