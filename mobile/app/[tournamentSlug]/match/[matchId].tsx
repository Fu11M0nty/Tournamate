import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { slotFallbackLabel } from '../../../lib/slotFallback';
import { supabase } from '../../../lib/supabase';
import type {
  Division,
  ElementSlot,
  Match,
  Team,
  Tournament,
  UmpireRole,
} from '../../../lib/types';

interface LoadedMatch extends Match {
  home_team?: Team | null;
  away_team?: Team | null;
  home_slot?: ElementSlot | null;
  away_slot?: ElementSlot | null;
  age_group?: Division | null;
  umpire_assignments?: UmpireAssignmentWithUmpire[];
}

interface UmpireAssignmentWithUmpire {
  id: string;
  match_id: string;
  umpire_id: string;
  role: UmpireRole;
  umpire?: {
    id: string;
    name: string;
    qualification_level: string | null;
    primary_club?: { id: string; name: string } | null;
  } | null;
}

export default function MatchDetailScreen() {
  const { tournamentSlug, matchId } = useLocalSearchParams<{
    tournamentSlug: string;
    matchId: string;
  }>();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [match, setMatch] = useState<LoadedMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);

    const tournamentReq = supabase
      .from('tournaments')
      .select('id, name, slug')
      .eq('slug', tournamentSlug)
      .maybeSingle();

    const matchReq = supabase
      .from('matches')
      .select(
        `*,
         home_team:home_team_id(*),
         away_team:away_team_id(*),
         home_slot:home_slot_id(*),
         away_slot:away_slot_id(*),
         age_group:age_group_id(id, name, slug, day),
         umpire_assignments(*, umpire:umpire_id(id, name, qualification_level, primary_club:primary_club_id(id, name)))`,
      )
      .eq('id', matchId)
      .is('deleted_at', null)
      .maybeSingle();

    const [tRes, mRes] = await Promise.all([tournamentReq, matchReq]);

    if (tRes.error) setError(tRes.error.message);
    else setTournament(tRes.data as Tournament | null);

    if (mRes.error) {
      setError(mRes.error.message);
      setMatch(null);
    } else {
      setMatch(mRes.data as LoadedMatch | null);
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, [matchId]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Match' }} />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : !match ? (
        <View style={styles.centered}>
          <Text>{error ?? 'Match not found.'}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          <ScoreCard match={match} tournament={tournament} />
          <MetaSection match={match} />
          <OfficialsSection assignments={match.umpire_assignments ?? []} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ScoreCard({ match, tournament }: { match: LoadedMatch; tournament: Tournament | null }) {
  const homeName = sideName(match.home_team, match.home_slot);
  const awayName = sideName(match.away_team, match.away_slot);
  const showScores =
    match.status === 'completed' && match.home_score !== null && match.away_score !== null;

  return (
    <View style={styles.scoreCard}>
      {tournament ? <Text style={styles.eyebrow}>{tournament.name}</Text> : null}
      {match.age_group ? (
        <Text style={styles.eyebrow}>
          {match.age_group.name} · {capitalise(match.age_group.day)}
        </Text>
      ) : null}
      <View style={styles.scoreRow}>
        <View style={styles.teamCol}>
          <Text style={styles.teamLabel} numberOfLines={2}>
            {homeName}
          </Text>
        </View>
        {showScores ? (
          <Text style={styles.scoreText}>
            {match.home_score} – {match.away_score}
          </Text>
        ) : (
          <Text style={styles.vsText}>v</Text>
        )}
        <View style={styles.teamCol}>
          <Text style={[styles.teamLabel, styles.teamLabelRight]} numberOfLines={2}>
            {awayName}
          </Text>
        </View>
      </View>
      {showScores ? null : (
        <Text style={styles.statusBadge}>Scheduled</Text>
      )}
    </View>
  );
}

function sideName(team: Team | null | undefined, slot: ElementSlot | null | undefined): string {
  if (team) return team.name;
  if (slot) return slotFallbackLabel(slot);
  return 'TBD';
}

function MetaSection({ match }: { match: LoadedMatch }) {
  return (
    <View style={styles.section}>
      <Row label="Kick-off" value={formatKickoff(match.kickoff_time)} />
      {match.court ? <Row label="Court" value={match.court} /> : null}
      <Row label="Duration" value={`${match.duration_minutes} min`} />
      {match.round_number !== null && match.round_number !== undefined ? (
        <Row label="Round" value={String(match.round_number)} />
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function OfficialsSection({ assignments }: { assignments: UmpireAssignmentWithUmpire[] }) {
  if (assignments.length === 0) return null;
  const sorted = assignments
    .slice()
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Officials</Text>
      {sorted.map((a) => (
        <View key={a.id} style={styles.officialRow}>
          <Text style={styles.officialName}>{a.umpire?.name ?? 'TBD'}</Text>
          <Text style={styles.officialRole}>{roleLabel(a.role)}</Text>
          {a.umpire?.primary_club ? (
            <Text style={styles.officialClub}>{a.umpire.primary_club.name}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function roleOrder(role: UmpireRole): number {
  const order: UmpireRole[] = ['head', 'assistant', 'scorer', 'assessor'];
  return order.indexOf(role);
}

function roleLabel(role: UmpireRole): string {
  switch (role) {
    case 'head':
      return 'Head umpire';
    case 'assistant':
      return 'Assistant';
    case 'scorer':
      return 'Scorer';
    case 'assessor':
      return 'Assessor';
  }
}

function formatKickoff(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#b91c1c', paddingHorizontal: 16, paddingTop: 8 },

  scoreCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  eyebrow: { color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  teamCol: { flex: 1 },
  teamLabel: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  teamLabelRight: { textAlign: 'right' },
  scoreText: { fontSize: 32, fontWeight: '700', color: '#0f172a', paddingHorizontal: 14 },
  vsText: { fontSize: 22, color: '#94a3b8', paddingHorizontal: 14 },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },

  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 10 },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  metaLabel: { color: '#64748b' },
  metaValue: { color: '#0f172a', fontWeight: '500' },

  officialRow: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  officialName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  officialRole: { marginTop: 2, color: '#475569', fontSize: 13 },
  officialClub: { marginTop: 2, color: '#64748b', fontSize: 12 },
});
