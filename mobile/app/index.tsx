import { Link, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { venueLabel, type Tournament } from '../lib/types';

export default function TournamentListScreen() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    setError(null);
    const { data, error } = await supabase
      .from('tournaments')
      .select(
        'id, slug, name, status, start_date, end_date, venue_name, venue_city, description, is_public, display_order',
      )
      .eq('is_public', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('start_date', { ascending: false });

    if (error) {
      setError(error.message);
      setTournaments([]);
    } else {
      setTournaments((data ?? []) as Tournament[]);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tournaments;
    return tournaments.filter((t) => {
      if (t.name.toLowerCase().includes(q)) return true;
      const v = venueLabel(t);
      return v ? v.toLowerCase().includes(q) : false;
    });
  }, [tournaments, query]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Tournaments' }} />
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search tournaments or venues"
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn't load tournaments</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No tournaments match your search.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Link href={`/${item.slug}` as const} asChild>
              <Pressable style={styles.card}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {venueLabel(item) ? (
                  <Text style={styles.cardMeta}>{venueLabel(item)}</Text>
                ) : null}
                <Text style={styles.cardMeta}>
                  {formatDateRange(item.start_date, item.end_date)}
                  {item.status ? `  ·  ${item.status}` : ''}
                </Text>
              </Pressable>
            </Link>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return '';
  const s = new Date(start);
  const startStr = s.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (!end || end === start) return startStr;
  const e = new Date(end);
  const endStr = e.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  search: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  cardMeta: { marginTop: 4, fontSize: 13, color: '#475569' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#64748b' },
  errorTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  errorBody: { color: '#475569', textAlign: 'center', marginBottom: 16 },
  retry: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#ffffff', fontWeight: '600' },
});
