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
import { calculateStandings } from '../../lib/standings';
import { supabase } from '../../lib/supabase';
import { venueLabel, type Division, type Match, type Team, type Tournament } from '../../lib/types';

type TabKey = 'info' | 'teams' | 'standings' | 'schedule';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'info', label: 'Info' },
  { key: 'teams', label: 'Teams' },
  { key: 'standings', label: 'Standings' },
  { key: 'schedule', label: 'Schedule' },
];

export default function TournamentHubScreen() {
  const { tournamentSlug } = useLocalSearchParams<{ tournamentSlug: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tab, setTab] = useState<TabKey>('info');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);

    const { data: tData, error: tErr } = await supabase
      .from('tournaments')
      .select(
        'id, slug, name, status, start_date, end_date, venue_name, venue_city, description, is_public, display_order',
      )
      .eq('slug', tournamentSlug)
      .maybeSingle();

    if (tErr) {
      setError(tErr.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!tData) {
      setTournament(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setTournament(tData as Tournament);

    const { data: dData, error: dErr } = await supabase
      .from('age_groups')
      .select('id, tournament_id, name, slug, day, display_order, gender, skill_level')
      .eq('tournament_id', tData.id)
      .order('day', { ascending: true })
      .order('display_order', { ascending: true });

    if (dErr) {
      setError(dErr.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const divs = (dData ?? []) as Division[];
    setDivisions(divs);

    const divIds = divs.map((d) => d.id);
    if (divIds.length === 0) {
      setTeams([]);
      setMatches([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [teamsRes, matchesRes] = await Promise.all([
      supabase
        .from('teams')
        .select('id, age_group_id, name, short_name, color, logo_url')
        .in('age_group_id', divIds)
        .is('deleted_at', null),
      supabase
        .from('matches')
        .select(
          'id, age_group_id, home_team_id, away_team_id, home_score, away_score, court, kickoff_time, status, home_no_show, away_no_show, home_late_minutes, away_late_minutes',
        )
        .in('age_group_id', divIds)
        .order('kickoff_time', { ascending: true }),
    ]);

    if (teamsRes.error) setError(teamsRes.error.message);
    else setTeams((teamsRes.data ?? []) as Team[]);

    if (matchesRes.error) setError(matchesRes.error.message);
    else setMatches((matchesRes.data ?? []) as Match[]);

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, [tournamentSlug]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: tournament?.name ?? 'Tournament' }} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : !tournament ? (
        <View style={styles.centered}>
          <Text>Tournament "{tournamentSlug}" not found.</Text>
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
          <Header tournament={tournament} />
          <TabBar value={tab} onChange={setTab} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {tab === 'info' && (
            <InfoTab
              tournament={tournament}
              divisions={divisions}
              teams={teams}
              matches={matches}
            />
          )}
          {tab === 'teams' && <TeamsTab divisions={divisions} teams={teams} />}
          {tab === 'standings' && (
            <StandingsTab
              tournamentSlug={tournament.slug}
              divisions={divisions}
              teams={teams}
              matches={matches}
            />
          )}
          {tab === 'schedule' && (
            <ScheduleTab
              tournamentSlug={tournament.slug}
              divisions={divisions}
              teams={teams}
              matches={matches}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Header({ tournament }: { tournament: Tournament }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{tournament.name}</Text>
      <Text style={styles.headerMeta}>
        {formatDateRange(tournament.start_date, tournament.end_date)}
        {tournament.status ? `  ·  ${tournament.status}` : ''}
      </Text>
      {venueLabel(tournament) ? (
        <Text style={styles.headerMeta}>{venueLabel(tournament)}</Text>
      ) : null}
    </View>
  );
}

function TabBar({ value, onChange }: { value: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[styles.tabButton, active && styles.tabButtonActive]}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InfoTab({
  tournament,
  divisions,
  teams,
  matches,
}: {
  tournament: Tournament;
  divisions: Division[];
  teams: Team[];
  matches: Match[];
}) {
  const completed = matches.filter((m) => m.status === 'completed').length;
  const total = matches.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return (
    <View style={styles.tabContent}>
      {tournament.description ? (
        <Text style={styles.description}>{tournament.description}</Text>
      ) : null}
      <View style={styles.statRow}>
        <Stat label="Divisions" value={String(divisions.length)} />
        <Stat label="Teams" value={String(teams.length)} />
        <Stat label="Matches" value={String(total)} />
      </View>
      <View style={styles.progressBlock}>
        <Text style={styles.progressLabel}>
          {completed} of {total} matches played ({pct}%)
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TeamsTab({ divisions, teams }: { divisions: Division[]; teams: Team[] }) {
  const grouped = useMemo(() => {
    const byDiv = new Map<string, Team[]>();
    for (const t of teams) {
      const list = byDiv.get(t.age_group_id) ?? [];
      list.push(t);
      byDiv.set(t.age_group_id, list);
    }
    for (const list of byDiv.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return byDiv;
  }, [teams]);

  if (divisions.length === 0) {
    return <Empty text="No divisions yet." />;
  }
  return (
    <View style={styles.tabContent}>
      {divisions.map((d) => {
        const ts = grouped.get(d.id) ?? [];
        return (
          <View key={d.id} style={styles.divisionBlock}>
            <Text style={styles.divisionHeader}>
              {d.name}
              <Text style={styles.divisionHeaderMeta}>  ·  {capitalise(d.day)}  ·  {ts.length} {ts.length === 1 ? 'team' : 'teams'}</Text>
            </Text>
            {ts.length === 0 ? (
              <Text style={styles.muted}>No teams yet.</Text>
            ) : (
              ts.map((t) => (
                <View key={t.id} style={styles.teamRow}>
                  {t.color ? (
                    <View style={[styles.teamSwatch, { backgroundColor: t.color }]} />
                  ) : (
                    <View style={[styles.teamSwatch, { backgroundColor: '#cbd5e1' }]} />
                  )}
                  <Text style={styles.teamName}>{t.name}</Text>
                </View>
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}

function StandingsTab({
  tournamentSlug,
  divisions,
  teams,
  matches,
}: {
  tournamentSlug: string;
  divisions: Division[];
  teams: Team[];
  matches: Match[];
}) {
  if (divisions.length === 0) return <Empty text="No divisions yet." />;
  return (
    <View style={styles.tabContent}>
      {divisions.map((d) => {
        const divTeams = teams.filter((t) => t.age_group_id === d.id);
        const divMatches = matches.filter((m) => m.age_group_id === d.id);
        const rows = calculateStandings(divTeams, divMatches);
        return (
          <Link
            key={d.id}
            href={{
              pathname: '/[tournamentSlug]/[day]/[divisionSlug]/index',
              params: { tournamentSlug, day: d.day, divisionSlug: d.slug },
            }}
            asChild
          >
            <Pressable style={styles.standingsCard}>
              <Text style={styles.divisionHeader}>
                {d.name}
                <Text style={styles.divisionHeaderMeta}>  ·  {capitalise(d.day)}</Text>
              </Text>
              {rows.length === 0 ? (
                <Text style={styles.muted}>No teams yet.</Text>
              ) : (
                <View style={styles.miniTable}>
                  <View style={[styles.miniRow, styles.miniHeaderRow]}>
                    <Text style={[styles.miniCellPos, styles.miniHeader]}>#</Text>
                    <Text style={[styles.miniCellName, styles.miniHeader]}>Team</Text>
                    <Text style={[styles.miniCellNum, styles.miniHeader]}>P</Text>
                    <Text style={[styles.miniCellNum, styles.miniHeader]}>GD</Text>
                    <Text style={[styles.miniCellNum, styles.miniHeader]}>Pts</Text>
                  </View>
                  {rows.slice(0, 5).map((r) => (
                    <View key={r.team.id} style={styles.miniRow}>
                      <Text style={styles.miniCellPos}>{r.position}</Text>
                      <Text style={styles.miniCellName} numberOfLines={1}>
                        {r.team.name}
                      </Text>
                      <Text style={styles.miniCellNum}>{r.played}</Text>
                      <Text style={styles.miniCellNum}>{signed(r.goal_difference)}</Text>
                      <Text style={[styles.miniCellNum, styles.bold]}>{r.points}</Text>
                    </View>
                  ))}
                  {rows.length > 5 ? (
                    <Text style={styles.muted}>… {rows.length - 5} more — tap to view full table</Text>
                  ) : null}
                </View>
              )}
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

function ScheduleTab({
  tournamentSlug,
  divisions,
  teams,
  matches,
}: {
  tournamentSlug: string;
  divisions: Division[];
  teams: Team[];
  matches: Match[];
}) {
  const [filter, setFilter] = useState<'upcoming' | 'played' | 'all'>('upcoming');
  const divisionsById = useMemo(
    () => new Map(divisions.map((d) => [d.id, d])),
    [divisions],
  );
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const filtered = useMemo(() => {
    if (filter === 'all') return matches;
    if (filter === 'played') return matches.filter((m) => m.status === 'completed');
    return matches.filter((m) => m.status !== 'completed');
  }, [matches, filter]);

  return (
    <View style={styles.tabContent}>
      <View style={styles.subFilter}>
        {(['upcoming', 'played', 'all'] as const).map((f) => {
          const active = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.subFilterBtn, active && styles.subFilterBtnActive]}
            >
              <Text style={[styles.subFilterLabel, active && styles.subFilterLabelActive]}>
                {f === 'upcoming' ? 'Upcoming' : f === 'played' ? 'Played' : 'All'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <Empty text={`No ${filter} matches.`} />
      ) : (
        filtered.map((m) => {
          const div = divisionsById.get(m.age_group_id);
          const home = m.home_team_id ? teamsById.get(m.home_team_id) : null;
          const away = m.away_team_id ? teamsById.get(m.away_team_id) : null;
          return (
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
                  {div ? `  ·  ${div.name}` : ''}
                </Text>
                <View style={styles.matchRow}>
                  <Text style={styles.matchTeam} numberOfLines={1}>
                    {home?.name ?? 'TBD'}
                  </Text>
                  <Text style={styles.matchScore}>
                    {m.status === 'completed' && m.home_score !== null && m.away_score !== null
                      ? `${m.home_score} – ${m.away_score}`
                      : 'v'}
                  </Text>
                  <Text style={[styles.matchTeam, styles.matchTeamRight]} numberOfLines={1}>
                    {away?.name ?? 'TBD'}
                  </Text>
                </View>
              </Pressable>
            </Link>
          );
        })
      )}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
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

  header: { padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  headerMeta: { marginTop: 4, color: '#475569', fontSize: 13 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#0f172a' },
  tabLabel: { color: '#64748b', fontWeight: '500' },
  tabLabelActive: { color: '#0f172a', fontWeight: '700' },

  tabContent: { padding: 16 },
  description: { color: '#334155', lineHeight: 20, marginBottom: 16 },

  statRow: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },

  progressBlock: { marginTop: 16 },
  progressLabel: { color: '#475569', fontSize: 13, marginBottom: 6 },
  progressTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#0f172a' },

  divisionBlock: { marginBottom: 16 },
  divisionHeader: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  divisionHeaderMeta: { color: '#64748b', fontWeight: '500', fontSize: 13 },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  teamSwatch: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  teamName: { color: '#0f172a', flex: 1 },

  standingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  miniTable: {},
  miniRow: { flexDirection: 'row', paddingVertical: 6 },
  miniHeaderRow: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 4 },
  miniHeader: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  miniCellPos: { width: 24, color: '#0f172a' },
  miniCellName: { flex: 1, color: '#0f172a' },
  miniCellNum: { width: 40, textAlign: 'right', color: '#0f172a' },
  bold: { fontWeight: '700' },

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

  empty: { paddingVertical: 24, alignItems: 'center' },
  muted: { color: '#64748b' },
});
