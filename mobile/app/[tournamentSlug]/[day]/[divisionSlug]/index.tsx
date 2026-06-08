import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BracketView from '../../../../components/BracketView';
import { slotFallbackLabel } from '../../../../lib/slotFallback';
import { calculateStandings } from '../../../../lib/standings';
import { supabase } from '../../../../lib/supabase';
import type {
  Division,
  ElementSlot,
  Match,
  Phase,
  PhaseElement,
  Pool,
  Team,
  Tournament,
} from '../../../../lib/types';

export default function DivisionDetailScreen() {
  const { tournamentSlug, day, divisionSlug } = useLocalSearchParams<{
    tournamentSlug: string;
    day: string;
    divisionSlug: string;
  }>();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [division, setDivision] = useState<Division | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [elementSlots, setElementSlots] = useState<ElementSlot[]>([]);
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function load() {
    setError(null);
    setNotFound(false);

    const { data: tData, error: tErr } = await supabase
      .from('tournaments')
      .select('*')
      .eq('slug', tournamentSlug)
      .maybeSingle();
    if (tErr) {
      setError(tErr.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!tData) {
      setNotFound(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setTournament(tData as Tournament);

    const { data: dData, error: dErr } = await supabase
      .from('age_groups')
      .select(
        `*,
         scoring_system:scoring_systems(*),
         phases (
           *,
           scoring_system:scoring_systems(*),
           pools (
             *,
             pool_teams(*)
           )
         )`,
      )
      .eq('tournament_id', tData.id)
      .eq('day', day)
      .eq('slug', divisionSlug)
      .maybeSingle();

    if (dErr) {
      setError(dErr.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!dData) {
      setNotFound(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const div = dData as Division;
    setDivision(div);

    const initialPhaseId =
      (div.phases ?? []).slice().sort((a, b) => a.display_order - b.display_order)[0]?.id ?? null;
    setActivePhaseId((prev) => prev ?? initialPhaseId);

    const phaseIds = (div.phases ?? []).map((p) => p.id);

    const [teamsRes, matchesRes, elementsRes] = await Promise.all([
      supabase
        .from('teams')
        .select('*')
        .eq('age_group_id', div.id)
        .is('deleted_at', null)
        .order('name', { ascending: true }),
      supabase
        .from('matches')
        .select('*')
        .eq('age_group_id', div.id)
        .is('deleted_at', null)
        .order('kickoff_time', { ascending: true }),
      phaseIds.length
        ? supabase
            .from('phase_elements')
            .select('*')
            .in('phase_id', phaseIds)
            .order('display_order', { ascending: true })
        : Promise.resolve({ data: [] as PhaseElement[], error: null }),
    ]);

    if (teamsRes.error) setError(teamsRes.error.message);
    else setTeams((teamsRes.data ?? []) as Team[]);

    if (matchesRes.error) setError(matchesRes.error.message);
    else setMatches((matchesRes.data ?? []) as Match[]);

    if (elementsRes.error) setError(elementsRes.error.message);

    const elementIds = (elementsRes.data ?? []).map((e: PhaseElement) => e.id);
    if (elementIds.length === 0) {
      setElementSlots([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { data: slotData, error: slotErr } = await supabase
      .from('element_slots')
      .select('*')
      .in('phase_element_id', elementIds)
      .order('display_order', { ascending: true });
    if (slotErr) setError(slotErr.message);
    else setElementSlots((slotData ?? []) as ElementSlot[]);

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, [tournamentSlug, day, divisionSlug]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: division?.name ?? divisionSlug ?? 'Division' }} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : notFound ? (
        <View style={styles.centered}>
          <Text>Division not found.</Text>
        </View>
      ) : !tournament || !division ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error ?? 'Could not load.'}</Text>
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
          <DivisionHeader division={division} tournament={tournament} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PhaseTabs
            phases={division.phases ?? []}
            activePhaseId={activePhaseId}
            onChange={setActivePhaseId}
          />
          <PhaseBody
            tournamentSlug={tournamentSlug}
            division={division}
            phase={(division.phases ?? []).find((p) => p.id === activePhaseId) ?? null}
            teams={teams}
            matches={matches}
            elementSlots={elementSlots}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DivisionHeader({
  division,
  tournament,
}: {
  division: Division;
  tournament: Tournament;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{tournament.name}</Text>
      <Text style={styles.headerTitle}>{division.name}</Text>
      <Text style={styles.headerMeta}>
        {capitalise(division.day)}
        {division.skill_level ? `  ·  ${division.skill_level}` : ''}
        {division.gender ? `  ·  ${division.gender}` : ''}
      </Text>
    </View>
  );
}

function PhaseTabs({
  phases,
  activePhaseId,
  onChange,
}: {
  phases: Phase[];
  activePhaseId: string | null;
  onChange: (id: string) => void;
}) {
  const sorted = phases.slice().sort((a, b) => a.display_order - b.display_order);
  if (sorted.length <= 1) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.phaseTabs}
    >
      {sorted.map((p) => {
        const active = p.id === activePhaseId;
        return (
          <Pressable
            key={p.id}
            onPress={() => onChange(p.id)}
            style={[styles.phaseChip, active && styles.phaseChipActive]}
          >
            <Text style={[styles.phaseChipText, active && styles.phaseChipTextActive]}>
              {p.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PhaseBody({
  tournamentSlug,
  division,
  phase,
  teams,
  matches,
  elementSlots,
}: {
  tournamentSlug: string;
  division: Division;
  phase: Phase | null;
  teams: Team[];
  matches: Match[];
  elementSlots: ElementSlot[];
}) {
  if (!phase) {
    return (
      <View style={styles.section}>
        <Text style={styles.muted}>No phase configured yet.</Text>
      </View>
    );
  }

  const phaseMatches = matches.filter((m) => m.phase_id === phase.id || m.phase_id === null);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const slotsById = useMemo(
    () => new Map(elementSlots.map((s) => [s.id, s])),
    [elementSlots],
  );

  return (
    <View>
      {phase.phase_type === 'knockout' ? (
        <BracketView
          tournamentSlug={tournamentSlug}
          phases={division.phases ?? []}
          matches={matches}
          teams={teams}
          slots={elementSlots}
          currentPhaseId={phase.id}
        />
      ) : (
        <StandingsSection
          phase={phase}
          division={division}
          teams={teams}
          matches={phaseMatches}
        />
      )}

      <FixturesAndResults
        tournamentSlug={tournamentSlug}
        phase={phase}
        matches={phaseMatches}
        teamsById={teamsById}
        slotsById={slotsById}
      />
    </View>
  );
}

function StandingsSection({
  phase,
  division,
  teams,
  matches,
}: {
  phase: Phase;
  division: Division;
  teams: Team[];
  matches: Match[];
}) {
  if (phase.standings_mode !== 'visible') return null;
  const scoring = phase.scoring_system ?? division.scoring_system;
  const pools = (phase.pools ?? []).slice().sort((a, b) => a.display_order - b.display_order);
  const showPerPool = pools.length > 1;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Standings</Text>
      {showPerPool ? (
        pools.map((pool) => (
          <PoolTable
            key={pool.id}
            pool={pool}
            teams={teamsForPool(pool, teams)}
            matches={matches.filter((m) => m.pool_id === pool.id)}
            scoring={scoring}
          />
        ))
      ) : (
        <FullStandingsTable teams={teams} matches={matches} scoring={scoring} />
      )}
    </View>
  );
}

function teamsForPool(pool: Pool, divisionTeams: Team[]): Team[] {
  const teamIds = new Set((pool.pool_teams ?? []).map((pt) => pt.team_id));
  if (teamIds.size === 0) return divisionTeams;
  return divisionTeams.filter((t) => teamIds.has(t.id));
}

function PoolTable({
  pool,
  teams,
  matches,
  scoring,
}: {
  pool: Pool;
  teams: Team[];
  matches: Match[];
  scoring: Division['scoring_system'] | undefined;
}) {
  return (
    <View style={styles.poolBlock}>
      <Text style={styles.poolHeader}>{pool.name}</Text>
      <FullStandingsTable teams={teams} matches={matches} scoring={scoring} />
    </View>
  );
}

function FullStandingsTable({
  teams,
  matches,
  scoring,
}: {
  teams: Team[];
  matches: Match[];
  scoring: Division['scoring_system'] | undefined;
}) {
  const rows = calculateStandings(teams, matches, scoring);
  if (rows.length === 0) return <Text style={styles.muted}>No teams yet.</Text>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.cellPos, styles.tableHeader]}>#</Text>
          <Text style={[styles.cellTeam, styles.tableHeader]}>Team</Text>
          <Text style={[styles.cellNum, styles.tableHeader]}>P</Text>
          <Text style={[styles.cellNum, styles.tableHeader]}>W</Text>
          <Text style={[styles.cellNum, styles.tableHeader]}>D</Text>
          <Text style={[styles.cellNum, styles.tableHeader]}>L</Text>
          <Text style={[styles.cellNum, styles.tableHeader]}>GF</Text>
          <Text style={[styles.cellNum, styles.tableHeader]}>GA</Text>
          <Text style={[styles.cellNum, styles.tableHeader]}>GD</Text>
          <Text style={[styles.cellNum, styles.tableHeader, styles.bold]}>Pts</Text>
        </View>
        {rows.map((r, i) => (
          <View
            key={r.team.id}
            style={[styles.tableRow, i % 2 === 0 ? styles.zebra : null]}
          >
            <Text style={styles.cellPos}>{r.position}</Text>
            <Text style={styles.cellTeam} numberOfLines={1}>
              {r.team.name}
            </Text>
            <Text style={styles.cellNum}>{r.played}</Text>
            <Text style={styles.cellNum}>{r.won}</Text>
            <Text style={styles.cellNum}>{r.drawn}</Text>
            <Text style={styles.cellNum}>{r.lost}</Text>
            <Text style={styles.cellNum}>{r.goals_for}</Text>
            <Text style={styles.cellNum}>{r.goals_against}</Text>
            <Text style={styles.cellNum}>{signed(r.goal_difference)}</Text>
            <Text style={[styles.cellNum, styles.bold]}>{r.points}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function FixturesAndResults({
  tournamentSlug,
  phase,
  matches,
  teamsById,
  slotsById,
}: {
  tournamentSlug: string;
  phase: Phase;
  matches: Match[];
  teamsById: Map<string, Team>;
  slotsById: Map<string, ElementSlot>;
}) {
  const [filter, setFilter] = useState<'upcoming' | 'played' | 'all'>('all');
  const filtered = useMemo(() => {
    if (filter === 'all') return matches;
    if (filter === 'played') return matches.filter((m) => m.status === 'completed');
    return matches.filter((m) => m.status !== 'completed');
  }, [matches, filter]);

  // For knockouts, we've already shown the fixtures above, so default to scored only.
  const showFilter = phase.phase_type !== 'knockout';
  const visible = phase.phase_type === 'knockout'
    ? matches.filter((m) => m.status === 'completed')
    : filtered;

  if (phase.phase_type === 'knockout' && visible.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {phase.phase_type === 'knockout' ? 'Results' : 'Fixtures & results'}
      </Text>
      {showFilter ? (
        <View style={styles.subFilter}>
          {(['upcoming', 'played', 'all'] as const).map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.subFilterBtn, active && styles.subFilterBtnActive]}
              >
                <Text
                  style={[styles.subFilterLabel, active && styles.subFilterLabelActive]}
                >
                  {f === 'upcoming' ? 'Upcoming' : f === 'played' ? 'Played' : 'All'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {visible.length === 0 ? (
        <Text style={styles.muted}>No matches to show.</Text>
      ) : (
        visible.map((m) => (
          <Link
            key={m.id}
            href={{
              pathname: '/[tournamentSlug]/match/[matchId]',
              params: { tournamentSlug, matchId: m.id },
            }}
            asChild
          >
            <Pressable style={styles.matchCard}>
              <Text style={styles.matchMeta}>
                {formatKickoff(m.kickoff_time)}
                {m.court ? `  ·  ${m.court}` : ''}
              </Text>
              <View style={styles.matchRow}>
                <Text style={styles.matchTeam} numberOfLines={1}>
                  {resolveSide(m.home_team_id, m.home_slot_id, teamsById, slotsById)}
                </Text>
                <Text style={styles.matchScore}>{matchScoreLabel(m)}</Text>
                <Text style={[styles.matchTeam, styles.matchTeamRight]} numberOfLines={1}>
                  {resolveSide(m.away_team_id, m.away_slot_id, teamsById, slotsById)}
                </Text>
              </View>
            </Pressable>
          </Link>
        ))
      )}
    </View>
  );
}

function resolveSide(
  teamId: string | null,
  slotId: string | null,
  teamsById: Map<string, Team>,
  slotsById: Map<string, ElementSlot>,
): string {
  if (teamId) {
    const t = teamsById.get(teamId);
    if (t) return t.name;
  }
  if (slotId) {
    return slotFallbackLabel(slotsById.get(slotId));
  }
  return 'TBD';
}

function matchScoreLabel(m: Match): string {
  if (m.status === 'completed' && m.home_score !== null && m.away_score !== null) {
    return `${m.home_score} – ${m.away_score}`;
  }
  return 'v';
}

function formatKickoff(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#b91c1c', paddingHorizontal: 16, paddingTop: 8 },

  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  eyebrow: { color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  headerMeta: { marginTop: 4, color: '#475569', fontSize: 13 },

  phaseTabs: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  phaseChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  phaseChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  phaseChipText: { color: '#0f172a', fontWeight: '500' },
  phaseChipTextActive: { color: '#ffffff' },

  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  helperText: { color: '#64748b', fontSize: 13, marginBottom: 12 },

  poolBlock: { marginBottom: 18 },
  poolHeader: { color: '#475569', fontWeight: '600', marginBottom: 6 },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableHeaderRow: {
    backgroundColor: '#f1f5f9',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableHeader: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  zebra: { backgroundColor: '#ffffff' },
  cellPos: { width: 26, color: '#0f172a' },
  cellTeam: { width: 140, color: '#0f172a', fontWeight: '500' },
  cellNum: { width: 36, textAlign: 'right', color: '#0f172a' },
  bold: { fontWeight: '700' },

  roundBlock: { marginBottom: 16 },
  roundHeader: { color: '#475569', fontWeight: '600', marginBottom: 6 },

  subFilter: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  subFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subFilterBtnActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  subFilterLabel: { color: '#0f172a', fontWeight: '500' },
  subFilterLabelActive: { color: '#ffffff' },

  matchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  matchMeta: { color: '#64748b', fontSize: 12, marginBottom: 6 },
  matchRow: { flexDirection: 'row', alignItems: 'center' },
  matchTeam: { flex: 1, color: '#0f172a', fontWeight: '500' },
  matchTeamRight: { textAlign: 'right' },
  matchScore: { color: '#0f172a', fontWeight: '700', paddingHorizontal: 12 },

  muted: { color: '#64748b' },
});
