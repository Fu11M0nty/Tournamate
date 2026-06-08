// Swipeable knockout bracket — a React Native port of the web app's
// MobileRoundCarousel (src/components/PublicBracketView.tsx). Each knockout
// *phase* (Quarter-finals, Semi-finals, Final, …) is treated as one round.
// Rounds are shown one at a time in a paging carousel; swipe horizontally or
// use the ‹ / › buttons to move between them.

import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { slotFallbackLabel } from '../lib/slotFallback';
import type { ElementSlot, Match, Phase, Pool, Team } from '../lib/types';

interface BracketViewProps {
  tournamentSlug: string;
  phases: Phase[];
  matches: Match[];
  teams: Team[];
  slots: ElementSlot[];
  currentPhaseId?: string | null;
}

type RoundGroup = {
  phase: Phase;
  matches: Match[];
};

function isBye(match: Match): boolean {
  return match.away_team_id === null && !match.away_slot_id;
}

function isMatchResolved(match: Match): boolean {
  return isBye(match) || match.status === 'completed';
}

function winnerSide(match: Match): 'home' | 'away' | null {
  if (match.status !== 'completed') return null;
  if (match.home_score === null || match.away_score === null) return null;
  if (match.home_score === match.away_score) return null;
  return match.home_score > match.away_score ? 'home' : 'away';
}

function statusLabel(match: Match): string {
  if (isBye(match)) return 'Bye';
  if (match.status === 'completed') return 'FT';
  if (!match.home_team_id || (!match.away_team_id && match.away_slot_id)) return 'TBD';
  return 'Scheduled';
}

// First not-yet-resolved round, otherwise the final round.
function defaultRoundIndex(rounds: RoundGroup[]): number {
  if (rounds.length === 0) return 0;
  for (let i = 0; i < rounds.length; i += 1) {
    if (i === rounds.length - 1) return i;
    if (!rounds[i].matches.every(isMatchResolved)) return i;
  }
  return rounds.length - 1;
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BracketView({
  tournamentSlug,
  phases,
  matches,
  teams,
  slots,
  currentPhaseId,
}: BracketViewProps) {
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const slotsById = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const poolsById = useMemo(() => {
    const m = new Map<string, Pool>();
    for (const phase of phases) {
      for (const pool of phase.pools ?? []) m.set(pool.id, pool);
    }
    return m;
  }, [phases]);

  const rounds = useMemo<RoundGroup[]>(() => {
    return phases
      .filter((p) => p.phase_type === 'knockout')
      .slice()
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
      .map((phase) => ({
        phase,
        matches: matches
          .filter((m) => m.phase_id === phase.id)
          .slice()
          .sort((a, b) => {
            const poolA = a.pool_id ? poolsById.get(a.pool_id) : null;
            const poolB = b.pool_id ? poolsById.get(b.pool_id) : null;
            return (
              (poolA?.display_order ?? 999) - (poolB?.display_order ?? 999) ||
              new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
            );
          }),
      }))
      .filter((r) => r.matches.length > 0);
  }, [phases, matches, poolsById]);

  // Default the carousel to the active phase's round if it's a knockout round,
  // otherwise to the first unresolved round.
  const defaultIndex = useMemo(() => {
    const fromCurrent = rounds.findIndex((r) => r.phase.id === currentPhaseId);
    return fromCurrent >= 0 ? fromCurrent : defaultRoundIndex(rounds);
  }, [rounds, currentPhaseId]);

  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const [pageWidth, setPageWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setActiveIndex(defaultIndex);
  }, [defaultIndex]);

  // Keep the scroll position in sync when the active round changes via buttons
  // or a new default (e.g. switching phase tab).
  useEffect(() => {
    if (pageWidth > 0) {
      scrollRef.current?.scrollTo({ x: activeIndex * pageWidth, animated: true });
    }
  }, [activeIndex, pageWidth]);

  if (rounds.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.muted}>No bracket fixtures have been published yet.</Text>
      </View>
    );
  }

  const completed = rounds.reduce(
    (sum, r) => sum + r.matches.filter((m) => m.status === 'completed').length,
    0,
  );
  const total = rounds.reduce((sum, r) => sum + r.matches.length, 0);
  const activeRound = rounds[activeIndex] ?? rounds[0];

  function goTo(index: number) {
    setActiveIndex(Math.min(Math.max(index, 0), rounds.length - 1));
  }

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pageWidth <= 0) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (index !== activeIndex) setActiveIndex(index);
  }

  return (
    <View style={styles.section}>
      <View style={styles.summaryRow}>
        <Text style={styles.eyebrow}>Bracket</Text>
        <Text style={styles.summaryText}>
          {completed}/{total} complete
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.navRow}>
          <Pressable
            onPress={() => goTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            style={[styles.navBtn, activeIndex === 0 && styles.navBtnDisabled]}
            hitSlop={8}
          >
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>
          <View style={styles.navCenter}>
            <Text style={styles.navEyebrow}>
              Round {activeIndex + 1} of {rounds.length}
            </Text>
            <Text style={styles.navTitle} numberOfLines={1}>
              {activeRound.phase.name}
            </Text>
          </View>
          <Pressable
            onPress={() => goTo(activeIndex + 1)}
            disabled={activeIndex === rounds.length - 1}
            style={[styles.navBtn, activeIndex === rounds.length - 1 && styles.navBtnDisabled]}
            hitSlop={8}
          >
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.dots}>
          {rounds.map((r, i) => (
            <View
              key={r.phase.id}
              style={[
                styles.dot,
                i === activeIndex
                  ? styles.dotActive
                  : r.matches.every(isMatchResolved)
                    ? styles.dotDone
                    : styles.dotPending,
              ]}
            />
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
          scrollEventThrottle={16}
        >
          {pageWidth > 0
            ? rounds.map((round) => (
                <View key={round.phase.id} style={[styles.page, { width: pageWidth }]}>
                  {round.matches.map((m) => (
                    <MatchNode
                      key={m.id}
                      tournamentSlug={tournamentSlug}
                      match={m}
                      poolName={m.pool_id ? poolsById.get(m.pool_id)?.name ?? null : null}
                      phaseName={round.phase.name}
                      teamsById={teamsById}
                      slotsById={slotsById}
                    />
                  ))}
                </View>
              ))
            : null}
        </ScrollView>
      </View>
    </View>
  );
}

function MatchNode({
  tournamentSlug,
  match,
  poolName,
  phaseName,
  teamsById,
  slotsById,
}: {
  tournamentSlug: string;
  match: Match;
  poolName: string | null;
  phaseName: string;
  teamsById: Map<string, Team>;
  slotsById: Map<string, ElementSlot>;
}) {
  const bye = isBye(match);
  const winner = winnerSide(match);
  const status = statusLabel(match);

  const homeTeam = match.home_team_id ? teamsById.get(match.home_team_id) ?? null : null;
  const awayTeam = match.away_team_id ? teamsById.get(match.away_team_id) ?? null : null;
  const homeSlot = match.home_slot_id ? slotsById.get(match.home_slot_id) : undefined;
  const awaySlot = match.away_slot_id ? slotsById.get(match.away_slot_id) : undefined;

  const home = {
    team: homeTeam,
    label: homeTeam?.name ?? slotFallbackLabel(homeSlot),
    score: match.home_score,
    winner: winner === 'home' || bye,
    placeholder: !homeTeam,
    bye: false,
  };
  const away = {
    team: awayTeam,
    label: bye ? 'Bye' : awayTeam?.name ?? slotFallbackLabel(awaySlot),
    score: bye ? null : match.away_score,
    winner: winner === 'away',
    placeholder: !awayTeam && !bye,
    bye,
  };

  const statusStyle =
    status === 'FT'
      ? styles.pillDone
      : status === 'Scheduled'
        ? styles.pillScheduled
        : styles.pillTbd;

  return (
    <Link
      href={{
        pathname: '/[tournamentSlug]/match/[matchId]',
        params: { tournamentSlug, matchId: match.id },
      }}
      asChild
    >
      <Pressable style={styles.node}>
        <View style={styles.nodeHeader}>
          <Text style={styles.nodeHeaderText} numberOfLines={1}>
            {poolName ?? phaseName}
          </Text>
          <View style={[styles.pill, statusStyle]}>
            <Text style={styles.pillText}>{status}</Text>
          </View>
        </View>

        <EntrantRow entrant={home} />
        <View style={styles.entrantDivider} />
        <EntrantRow entrant={away} />

        <View style={styles.nodeFooter}>
          <Text style={styles.nodeFooterText}>{formatKickoff(match.kickoff_time)}</Text>
          <Text style={styles.nodeFooterText} numberOfLines={1}>
            {match.court ?? 'Court TBC'}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

function EntrantRow({
  entrant,
}: {
  entrant: {
    team: Team | null;
    label: string;
    score: number | null;
    winner: boolean;
    placeholder: boolean;
    bye: boolean;
  };
}) {
  return (
    <View style={[styles.entrant, entrant.winner && styles.entrantWinner]}>
      {entrant.team ? (
        <View style={[styles.swatch, { backgroundColor: entrant.team.color ?? '#cbd5e1' }]} />
      ) : (
        <View style={styles.swatchPlaceholder}>
          <Text style={styles.swatchPlaceholderText}>{entrant.bye ? '–' : '?'}</Text>
        </View>
      )}
      <Text
        style={[
          styles.entrantName,
          entrant.winner && styles.entrantNameWinner,
          (entrant.placeholder || entrant.bye) && styles.entrantNameMuted,
        ]}
        numberOfLines={1}
      >
        {entrant.label}
      </Text>
      <View style={[styles.scoreChip, entrant.winner && styles.scoreChipWinner]}>
        <Text style={[styles.scoreText, entrant.winner && styles.scoreTextWinner]}>
          {entrant.score ?? '–'}
        </Text>
      </View>
    </View>
  );
}

const NAVY = '#0f172a';
const ORANGE = '#f47c20';

const styles = StyleSheet.create({
  section: { padding: 16 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 16,
    fontWeight: '700',
    color: NAVY,
  },
  summaryText: { color: '#64748b', fontSize: 13, fontWeight: '600' },

  empty: { padding: 16 },
  muted: { color: '#64748b' },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 22, fontWeight: '700', color: NAVY, lineHeight: 24 },
  navCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  navEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: ORANGE,
  },
  navTitle: { fontSize: 17, fontWeight: '800', color: NAVY, marginTop: 2 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 22, backgroundColor: ORANGE },
  dotDone: { width: 12, backgroundColor: '#10b981' },
  dotPending: { width: 12, backgroundColor: '#cbd5e1' },

  page: { paddingHorizontal: 12, paddingBottom: 14, gap: 10 },

  node: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nodeHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#475569',
  },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: '#ffffff' },
  pillDone: { backgroundColor: '#10b981' },
  pillScheduled: { backgroundColor: ORANGE },
  pillTbd: { backgroundColor: '#94a3b8' },

  entrant: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  entrantWinner: { backgroundColor: '#f0f9ff' },
  entrantDivider: { height: 1, backgroundColor: '#f1f5f9' },
  swatch: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  swatchPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 8,
    marginLeft: -3,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchPlaceholderText: { fontSize: 10, fontWeight: '800', color: '#94a3b8' },
  entrantName: { flex: 1, fontSize: 14, fontWeight: '600', color: NAVY },
  entrantNameWinner: { fontWeight: '800' },
  entrantNameMuted: { color: '#94a3b8', fontWeight: '500' },
  scoreChip: {
    minWidth: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    marginLeft: 8,
  },
  scoreChipWinner: { backgroundColor: ORANGE },
  scoreText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  scoreTextWinner: { color: '#ffffff' },

  nodeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  nodeFooterText: { fontSize: 11, fontWeight: '600', color: '#94a3b8', flexShrink: 1 },
});
