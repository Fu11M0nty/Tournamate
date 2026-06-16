import type { createClient } from './supabase'
import type {
  Division,
  Match,
  Phase,
  PhaseType,
  Pool,
  PhaseElement,
  ProgressionSourceType,
  StandingsMode,
  Team,
} from './types'

type Supabase = ReturnType<typeof createClient>

interface PoolTemplate {
  slug: string
  name: string
  isDefault?: boolean
}

interface PhaseTemplate {
  slug: string
  name: string
  phaseType: PhaseType
  standingsMode: StandingsMode
  displayColumn?: number
  yAlignNode?: string  // nodeId (phaseSlug:poolSlug) to align this phase's y-position with
  pools: PoolTemplate[]
}

export type FinalsStyle =
  | 'none'
  | 'final_only'
  | 'final_and_third'
  | 'semi_final_final'
  | 'top4_double_elimination'

export type PlacementStyle =
  | 'final_only'
  | 'final_and_third'
  | 'all_placements'
  | 'top4_double_elimination'

export interface FormatBuilderTemplate {
  id: string
  name: string
  description: string
  teamSplit: 'all' | 'seeded-pools' | 'two-pools' | 'four-pools' | 'none'
  configurable?: {
    pools?: {
      label: string
      phaseSlug: string
      min: number
      max: number
      defaultValue: number
    }
    teamsPerPool?: {
      min: number
      max: number
      defaultValue: number | null
    }
    championshipRanks?: {
      label: string
      defaultValue: number[]
    }
    plateRanks?: {
      label: string
      defaultValue: number[]
    }
    playInTeams?: {
      label: string
    }
    directToFinals?: {
      label: string
    }
    teamCount?: {
      label: string
      min: number
      max: number
      defaultValue: number
    }
    leagueRepeatCount?: {
      label: string
      defaultValue: 1 | 2
    }
    champGroupSize?: {
      label: string
      min: number
      max: number
      defaultValue: number
    }
    finalsStyle?: {
      label: string
      defaultValue: FinalsStyle
    }
    placementStyle?: {
      label: string
      defaultValue: PlacementStyle
    }
  }
  phases: PhaseTemplate[]
  progressions?: ProgressionTemplate[]
}

interface ProgressionTemplate {
  fromPhase: string
  fromPool: string  // '__best_rank__' sentinel for cross-pool BNT selections
  ranks: number[]
  sourceType?: ProgressionSourceType
  toPhase: string
  toPool: string
  startSlot: number
  isBestRank?: boolean       // cross-pool best-nth selection; fromPool is ignored
  bestRankCount?: number     // total BNT picks at this rank (e.g. 2 of 3 pools)
  bestRankCriteria?: string[] // tie-breaker ordering for BNT
  showEdgeLabel?: boolean    // render Winner/Loser label on this edge in the diagram
}

export interface FormatBuilderOptions {
  poolCount?: number
  teamsPerPool?: number | null
  championshipRanks?: number[]
  plateRanks?: number[]
  champGroupSize?: number      // max teams entering each championship/plate group (grading only)
  teamCount?: number
  expectedTeamCount?: number | null
  playInTeamIds?: string[]
  byeTeamIds?: string[]
  leagueRepeatCount?: 1 | 2
  finalsStyle?: FinalsStyle
  placementStyle?: PlacementStyle
  directToFinals?: boolean
  bestRankCriteria?: string[] // criteria order for best-nth-placed team tiebreaking
}

interface TeamAssignment {
  team: Team
  slotOrder: number
}

export const FORMAT_BUILDERS: FormatBuilderTemplate[] = [
  {
    id: 'simple-round-robin',
    name: 'Simple Round Robin',
    description: 'One visible table where every team belongs to one pool.',
    teamSplit: 'all',
    phases: [
      {
        slug: 'round-robin',
        name: 'Round Robin',
        phaseType: 'round_robin',
        standingsMode: 'visible',
        pools: [{ slug: 'default', name: 'Default Pool', isDefault: true }],
      },
    ],
  },
  {
    id: 'two-pools',
    name: 'Two Pools',
    description: 'Group-stage setup with Pool A and Pool B standings.',
    teamSplit: 'two-pools',
    configurable: {
      pools: {
        label: 'Number of pools',
        phaseSlug: 'group-stage',
        min: 2,
        max: 12,
        defaultValue: 2,
      },
      teamsPerPool: {
        min: 4,
        max: 20,
        defaultValue: null,
      },
    },
    phases: [
      {
        slug: 'group-stage',
        name: 'Group Stage',
        phaseType: 'group_stage',
        standingsMode: 'visible',
        pools: [
          { slug: 'pool-a', name: 'Pool A' },
          { slug: 'pool-b', name: 'Pool B' },
        ],
      },
    ],
  },
  {
    id: 'group-stage-finals',
    name: 'Group Stage + Finals',
    description: 'Pool standings feed into a configurable finals format.',
    teamSplit: 'two-pools',
    configurable: {
      pools: {
        label: 'Group-stage pools',
        phaseSlug: 'group-stage',
        min: 1,
        max: 8,
        defaultValue: 2,
      },
      teamsPerPool: {
        min: 4,
        max: 20,
        defaultValue: 4,
      },
      championshipRanks: {
        label: 'Ranks that qualify to finals',
        defaultValue: [1, 2],
      },
      finalsStyle: {
        label: 'Finals format',
        defaultValue: 'semi_final_final',
      },
    },
    phases: [
      {
        slug: 'group-stage',
        name: 'Group Stage',
        phaseType: 'group_stage',
        standingsMode: 'visible',
        pools: [
          { slug: 'pool-a', name: 'Pool A' },
          { slug: 'pool-b', name: 'Pool B' },
        ],
      },
      {
        slug: 'semi-finals',
        name: 'Semi-finals',
        phaseType: 'knockout',
        standingsMode: 'hidden',
        pools: [{ slug: 'default', name: 'Knockout', isDefault: true }],
      },
      {
        slug: 'finals',
        name: 'Finals',
        phaseType: 'knockout',
        standingsMode: 'hidden',
        pools: [{ slug: 'default', name: 'Finals', isDefault: true }],
      },
    ],
  },
  {
    id: 'knockout-play-ins',
    name: 'Knockout',
    description: 'Direct knockout bracket for any team count. Seeded teams receive a first-round bye when the count isn\'t a clean power-of-two.',
    teamSplit: 'seeded-pools',
    configurable: {
      teamCount: {
        label: 'Number of teams',
        min: 2,
        max: 64,
        defaultValue: 16,
      },
    },
    phases: [],
  },
  {
    id: 'league-season',
    name: 'League Season',
    description: 'One league table for fixtures across weeks or months.',
    teamSplit: 'all',
    configurable: {
      leagueRepeatCount: {
        label: 'How many times should each team play each other?',
        defaultValue: 1,
      },
      finalsStyle: {
        label: 'Optional league finals',
        defaultValue: 'none',
      },
    },
    phases: [
      {
        slug: 'league-season',
        name: 'League Season',
        phaseType: 'league',
        standingsMode: 'visible',
        pools: [{ slug: 'default', name: 'League', isDefault: true }],
      },
    ],
  },
  {
    id: 'festival-fixtures',
    name: 'Festival Fixtures',
    description: 'Fixture-list event with no public standings table.',
    teamSplit: 'all',
    phases: [
      {
        slug: 'festival-fixtures',
        name: 'Festival Fixtures',
        phaseType: 'friendly',
        standingsMode: 'none',
        pools: [{ slug: 'default', name: 'Festival', isDefault: true }],
      },
    ],
  },
  {
    id: 'grading-championship',
    name: 'Grading + Championship',
    description: 'Grading pools split into Championship and Plate groups, each with optional finals.',
    teamSplit: 'four-pools',
    configurable: {
      pools: {
        label: 'Grading pools',
        phaseSlug: 'grading',
        min: 2,
        max: 12,
        defaultValue: 4,
      },
      teamsPerPool: {
        min: 4,
        max: 20,
        defaultValue: 6,
      },
      championshipRanks: {
        label: 'Ranks to Championship',
        defaultValue: [1, 2],
      },
      plateRanks: {
        label: 'Ranks to Plate',
        defaultValue: [3, 4],
      },
      champGroupSize: {
        label: 'Championship & Plate group size',
        min: 4,
        max: 16,
        defaultValue: 8,
      },
      finalsStyle: {
        label: 'Finals format (Championship & Plate)',
        defaultValue: 'none',
      },
      directToFinals: {
        label: 'Skip group phases — qualify directly to finals',
      },
    },
    phases: [
      {
        slug: 'grading',
        name: 'Grading',
        phaseType: 'group_stage',
        standingsMode: 'visible',
        pools: [
          { slug: 'pool-a', name: 'Pool A' },
          { slug: 'pool-b', name: 'Pool B' },
          { slug: 'pool-c', name: 'Pool C' },
          { slug: 'pool-d', name: 'Pool D' },
        ],
      },
      {
        slug: 'championship',
        name: 'Championship',
        phaseType: 'group_stage',
        standingsMode: 'visible',
        pools: [{ slug: 'default', name: 'Championship', isDefault: true }],
      },
      {
        slug: 'plate',
        name: 'Plate',
        phaseType: 'group_stage',
        standingsMode: 'visible',
        pools: [{ slug: 'default', name: 'Plate', isDefault: true }],
      },
    ],
  },
  {
    id: 'round-robin-placement',
    name: 'Round Robin + Final Placings',
    description: 'Teams play a round robin first, then standings decide finals or placement fixtures.',
    teamSplit: 'all',
    configurable: {
      placementStyle: {
        label: 'Placement format',
        defaultValue: 'all_placements',
      },
    },
    phases: [
      {
        slug: 'round-robin',
        name: 'Round Robin',
        phaseType: 'round_robin',
        standingsMode: 'visible',
        pools: [{ slug: 'default', name: 'Default Pool', isDefault: true }],
      },
      {
        slug: 'placement-finals',
        name: 'Placement Finals',
        phaseType: 'knockout',
        standingsMode: 'hidden',
        pools: [
          { slug: 'match-1', name: 'Final' },
          { slug: 'match-2', name: '3rd Place' },
          { slug: 'match-3', name: '5th Place' },
          { slug: 'match-4', name: '7th Place' },
        ],
      },
    ],
    progressions: [
      { fromPhase: 'round-robin', fromPool: 'default', ranks: [1], toPhase: 'placement-finals', toPool: 'match-1', startSlot: 1 },
      { fromPhase: 'round-robin', fromPool: 'default', ranks: [2], toPhase: 'placement-finals', toPool: 'match-1', startSlot: 2 },
      { fromPhase: 'round-robin', fromPool: 'default', ranks: [3], toPhase: 'placement-finals', toPool: 'match-2', startSlot: 1 },
      { fromPhase: 'round-robin', fromPool: 'default', ranks: [4], toPhase: 'placement-finals', toPool: 'match-2', startSlot: 2 },
      { fromPhase: 'round-robin', fromPool: 'default', ranks: [5], toPhase: 'placement-finals', toPool: 'match-3', startSlot: 1 },
      { fromPhase: 'round-robin', fromPool: 'default', ranks: [6], toPhase: 'placement-finals', toPool: 'match-3', startSlot: 2 },
      { fromPhase: 'round-robin', fromPool: 'default', ranks: [7], toPhase: 'placement-finals', toPool: 'match-4', startSlot: 1 },
      { fromPhase: 'round-robin', fromPool: 'default', ranks: [8], toPhase: 'placement-finals', toPool: 'match-4', startSlot: 2 },
    ],
  },
  {
    id: 'swiss-rounds',
    name: 'Swiss-style Rounds',
    description: 'Visible standings for adaptive rounds generated over time.',
    teamSplit: 'all',
    phases: [
      {
        slug: 'swiss-rounds',
        name: 'Swiss-style Rounds',
        phaseType: 'friendly',
        standingsMode: 'visible',
        pools: [{ slug: 'default', name: 'Swiss', isDefault: true }],
      },
    ],
  },
]

export function formatBuilderById(id: string): FormatBuilderTemplate | undefined {
  return FORMAT_BUILDERS.find((builder) => builder.id === id)
}

function poolName(index: number) {
  const letter = String.fromCharCode(65 + index)
  return `Pool ${letter}`
}

function poolSlug(index: number) {
  return `pool-${String.fromCharCode(97 + index)}`
}

function createPoolTemplates(poolCount: number): PoolTemplate[] {
  return Array.from({ length: poolCount }, (_, index) => ({
    slug: poolSlug(index),
    name: poolName(index),
  }))
}

function createMatchPoolTemplates(count: number, label: string): PoolTemplate[] {
  return Array.from({ length: count }, (_, index) => ({
    slug: `match-${index + 1}`,
    name: count === 1 ? label : `${label} ${index + 1}`,
    isDefault: count === 1,
  }))
}

function knockoutMatchLabel(roundName: string) {
  if (roundName === 'Final') return 'Final'
  if (roundName === 'Quarter-finals') return 'Quarter-final'
  if (roundName === 'Semi-finals') return 'Semi-final'
  return `${roundName} Match`
}

function placementPoolName(index: number) {
  if (index === 0) return 'Final'
  const placing = index * 2 + 1
  return `${placing}${placing === 3 ? 'rd' : 'th'} Place`
}

function createPlacementPoolTemplates(teamCount: number): PoolTemplate[] {
  const matchCount = Math.max(1, Math.floor(teamCount / 2))
  return Array.from({ length: matchCount }, (_, index) => ({
    slug: `match-${index + 1}`,
    name: placementPoolName(index),
    isDefault: matchCount === 1,
  }))
}

function createPlacementPoolsForStyle(teamCount: number, style: PlacementStyle): PoolTemplate[] {
  if (style === 'final_only') return createMatchPoolTemplates(1, 'Final')
  if (style === 'final_and_third') {
    return [
      { slug: 'match-1', name: 'Final' },
      { slug: 'match-2', name: '3rd Place' },
    ]
  }
  return createPlacementPoolTemplates(teamCount)
}

function createRankingProgressions(
  fromPhase: string,
  fromPool: string,
  toPhase: string,
  toPool: string,
  ranks: number[],
  startSlot = 1
): ProgressionTemplate[] {
  return ranks.map((rank, index) => ({
    fromPhase,
    fromPool,
    ranks: [rank],
    toPhase,
    toPool,
    startSlot: startSlot + index,
  }))
}

function buildFinalOnlyFromRankings(
  fromPhase: string,
  fromPool: string,
  targetPhase = 'finals'
) {
  const phases: PhaseTemplate[] = [
    {
      slug: targetPhase,
      name: 'Finals',
      phaseType: 'knockout',
      standingsMode: 'hidden',
      pools: createMatchPoolTemplates(1, 'Final'),
    },
  ]
  const progressions = createRankingProgressions(fromPhase, fromPool, targetPhase, 'match-1', [1, 2])
  return { phases, progressions }
}

function buildFinalAndThirdFromRankings(
  fromPhase: string,
  fromPool: string,
  targetPhase = 'finals'
) {
  const phases: PhaseTemplate[] = [
    {
      slug: targetPhase,
      name: 'Finals',
      phaseType: 'knockout',
      standingsMode: 'hidden',
      pools: [
        { slug: 'match-1', name: 'Final' },
        { slug: 'match-2', name: '3rd Place' },
      ],
    },
  ]
  const progressions = [
    ...createRankingProgressions(fromPhase, fromPool, targetPhase, 'match-1', [1, 2]),
    ...createRankingProgressions(fromPhase, fromPool, targetPhase, 'match-2', [3, 4]),
  ]
  return { phases, progressions }
}

function buildSemiFinalFinalFromRankings(
  fromPhase: string,
  fromPool: string
) {
  const phases: PhaseTemplate[] = [
    {
      slug: 'semi-finals',
      name: 'Semi-finals',
      phaseType: 'knockout',
      standingsMode: 'hidden',
      pools: [
        { slug: 'match-1', name: 'Semi-final 1' },
        { slug: 'match-2', name: 'Semi-final 2' },
      ],
    },
    {
      slug: 'finals',
      name: 'Finals',
      phaseType: 'knockout',
      standingsMode: 'hidden',
      pools: createMatchPoolTemplates(1, 'Final'),
    },
  ]
  const progressions: ProgressionTemplate[] = [
    ...createRankingProgressions(fromPhase, fromPool, 'semi-finals', 'match-1', [1]),
    ...createRankingProgressions(fromPhase, fromPool, 'semi-finals', 'match-1', [4], 2),
    ...createRankingProgressions(fromPhase, fromPool, 'semi-finals', 'match-2', [2]),
    ...createRankingProgressions(fromPhase, fromPool, 'semi-finals', 'match-2', [3], 2),
    {
      fromPhase: 'semi-finals',
      fromPool: 'match-1',
      ranks: [1],
      sourceType: 'match_winner',
      toPhase: 'finals',
      toPool: 'match-1',
      startSlot: 1,
    },
    {
      fromPhase: 'semi-finals',
      fromPool: 'match-2',
      ranks: [1],
      sourceType: 'match_winner',
      toPhase: 'finals',
      toPool: 'match-1',
      startSlot: 2,
    },
  ]

  return { phases, progressions }
}

function buildTop4DoubleEliminationFromRankings(
  fromPhase: string,
  fromPool: string
) {
  const phases: PhaseTemplate[] = [
    {
      slug: 'major-minor-finals',
      name: 'Major / Minor Finals',
      phaseType: 'knockout',
      standingsMode: 'hidden',
      pools: [
        { slug: 'major-semi-final', name: 'Major Semi-final' },
        { slug: 'minor-semi-final', name: 'Minor Semi-final' },
      ],
    },
    {
      slug: 'preliminary-final',
      name: 'Preliminary Final',
      phaseType: 'knockout',
      standingsMode: 'hidden',
      yAlignNode: 'major-minor-finals:minor-semi-final',
      pools: [{ slug: 'match-1', name: 'Preliminary Final', isDefault: true }],
    },
    {
      slug: 'grand-final',
      name: 'Grand Final',
      phaseType: 'knockout',
      standingsMode: 'hidden',
      yAlignNode: 'major-minor-finals:major-semi-final',
      pools: [{ slug: 'match-1', name: 'Grand Final', isDefault: true }],
    },
  ]

  const progressions: ProgressionTemplate[] = [
    ...createRankingProgressions(fromPhase, fromPool, 'major-minor-finals', 'major-semi-final', [1, 2]),
    ...createRankingProgressions(fromPhase, fromPool, 'major-minor-finals', 'minor-semi-final', [3, 4]),
    {
      fromPhase: 'major-minor-finals',
      fromPool: 'major-semi-final',
      ranks: [1],
      sourceType: 'match_winner',
      showEdgeLabel: true,
      toPhase: 'grand-final',
      toPool: 'match-1',
      startSlot: 1,
    },
    {
      fromPhase: 'major-minor-finals',
      fromPool: 'major-semi-final',
      ranks: [1],
      sourceType: 'match_loser',
      showEdgeLabel: true,
      toPhase: 'preliminary-final',
      toPool: 'match-1',
      startSlot: 1,
    },
    {
      fromPhase: 'major-minor-finals',
      fromPool: 'minor-semi-final',
      ranks: [1],
      sourceType: 'match_winner',
      showEdgeLabel: true,
      toPhase: 'preliminary-final',
      toPool: 'match-1',
      startSlot: 2,
    },
    {
      fromPhase: 'preliminary-final',
      fromPool: 'match-1',
      ranks: [1],
      sourceType: 'match_winner',
      showEdgeLabel: true,
      toPhase: 'grand-final',
      toPool: 'match-1',
      startSlot: 2,
    },
  ]

  return { phases, progressions }
}

// Builds progressions from grading pools into a championship or plate group, applying BNT
// when total qualifiers exceed the group size cap.
function buildGradingGroupProgressions(
  toPhase: string,
  ranks: number[],
  poolCount: number,
  groupSize: number,
  bntCriteria: string[]
): ProgressionTemplate[] {
  const totalQualifiers = poolCount * ranks.length
  const progs: ProgressionTemplate[] = []

  if (totalQualifiers <= groupSize) {
    // All teams fit — pool-grouped slot order (preserves existing behaviour)
    for (let poolIndex = 0; poolIndex < poolCount; poolIndex++) {
      progs.push({
        fromPhase: 'grading', fromPool: poolSlug(poolIndex),
        ranks, toPhase, toPool: 'default',
        startSlot: poolIndex * ranks.length + 1,
      })
    }
    return progs
  }

  // More qualifiers than slots: deterministic full-rank rounds + BNT for the overflow rank
  const effectiveSize = Math.min(groupSize, totalQualifiers)
  const fullRanks = Math.floor(effectiveSize / poolCount)
  const remainder = effectiveSize - fullRanks * poolCount

  // All pools contribute fully for ranks[0..fullRanks-1]
  for (let rankIdx = 0; rankIdx < fullRanks; rankIdx++) {
    for (let poolIndex = 0; poolIndex < poolCount; poolIndex++) {
      progs.push({
        fromPhase: 'grading', fromPool: poolSlug(poolIndex),
        ranks: [ranks[rankIdx]], toPhase, toPool: 'default',
        startSlot: rankIdx * poolCount + poolIndex + 1,
      })
    }
  }

  // BNT: best `remainder` teams at ranks[fullRanks]
  if (remainder > 0 && ranks.length > fullRanks) {
    const bntRank = ranks[fullRanks]
    for (let r = 0; r < remainder; r++) {
      progs.push({
        fromPhase: 'grading', fromPool: '__best_rank__',
        ranks: [bntRank],
        sourceType: 'best_rank' as const,
        isBestRank: true,
        bestRankCount: remainder,
        bestRankCriteria: bntCriteria,
        toPhase, toPool: 'default',
        startSlot: fullRanks * poolCount + r + 1,
      })
    }
  }

  return progs
}

// Builds championship or plate finals phases seeded from a single group (group → finals).
// prefix e.g. 'championship', displayName e.g. 'Championship'
function buildGradingGroupFinalsPhases(
  prefix: string,
  displayName: string,
  fromPhase: string,
  style: FinalsStyle,
  baseCol: number
): { phases: PhaseTemplate[], progressions: ProgressionTemplate[] } {
  const semisSlug = `${prefix}-semis`
  const finalSlug = `${prefix}-final`

  if (style === 'final_only') {
    return {
      phases: [{
        slug: finalSlug, name: `${displayName} Final`,
        phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol,
        pools: [{ slug: 'match-1', name: 'Final', isDefault: true }],
      }],
      progressions: [
        { fromPhase, fromPool: 'default', ranks: [1], toPhase: finalSlug, toPool: 'match-1', startSlot: 1 },
        { fromPhase, fromPool: 'default', ranks: [2], toPhase: finalSlug, toPool: 'match-1', startSlot: 2 },
      ],
    }
  }

  if (style === 'top4_double_elimination') {
    const majorMinorSlug = `${prefix}-major-minor`
    const prelimSlug = `${prefix}-prelim-final`
    const grandFinalSlug = `${prefix}-grand-final`
    return {
      phases: [
        {
          slug: majorMinorSlug, name: `${displayName} Major/Minor`,
          phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol,
          pools: [
            { slug: 'major-semi-final', name: 'Major Semi-final' },
            { slug: 'minor-semi-final', name: 'Minor Semi-final' },
          ],
        },
        {
          slug: prelimSlug, name: `${displayName} Prelim Final`,
          phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol + 1,
          yAlignNode: `${majorMinorSlug}:minor-semi-final`,
          pools: [{ slug: 'match-1', name: 'Prelim Final', isDefault: true }],
        },
        {
          slug: grandFinalSlug, name: `${displayName} Grand Final`,
          phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol + 2,
          yAlignNode: `${majorMinorSlug}:major-semi-final`,
          pools: [{ slug: 'match-1', name: 'Grand Final', isDefault: true }],
        },
      ],
      progressions: [
        { fromPhase, fromPool: 'default', ranks: [1], toPhase: majorMinorSlug, toPool: 'major-semi-final', startSlot: 1 },
        { fromPhase, fromPool: 'default', ranks: [2], toPhase: majorMinorSlug, toPool: 'major-semi-final', startSlot: 2 },
        { fromPhase, fromPool: 'default', ranks: [3], toPhase: majorMinorSlug, toPool: 'minor-semi-final', startSlot: 1 },
        { fromPhase, fromPool: 'default', ranks: [4], toPhase: majorMinorSlug, toPool: 'minor-semi-final', startSlot: 2 },
        { fromPhase: majorMinorSlug, fromPool: 'major-semi-final', ranks: [1], sourceType: 'match_winner' as const, showEdgeLabel: true, toPhase: grandFinalSlug, toPool: 'match-1', startSlot: 1 },
        { fromPhase: majorMinorSlug, fromPool: 'major-semi-final', ranks: [1], sourceType: 'match_loser' as const, showEdgeLabel: true, toPhase: prelimSlug, toPool: 'match-1', startSlot: 1 },
        { fromPhase: majorMinorSlug, fromPool: 'minor-semi-final', ranks: [1], sourceType: 'match_winner' as const, showEdgeLabel: true, toPhase: prelimSlug, toPool: 'match-1', startSlot: 2 },
        { fromPhase: prelimSlug, fromPool: 'match-1', ranks: [1], sourceType: 'match_winner' as const, showEdgeLabel: true, toPhase: grandFinalSlug, toPool: 'match-1', startSlot: 2 },
      ],
    }
  }

  if (style === 'semi_final_final') {
    return {
      phases: [
        {
          slug: semisSlug, name: `${displayName} Semi-finals`,
          phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol,
          pools: [{ slug: 'match-1', name: 'Semi-final 1' }, { slug: 'match-2', name: 'Semi-final 2' }],
        },
        {
          slug: finalSlug, name: `${displayName} Final`,
          phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol + 1,
          pools: [{ slug: 'match-1', name: 'Final', isDefault: true }],
        },
      ],
      progressions: [
        { fromPhase, fromPool: 'default', ranks: [1], toPhase: semisSlug, toPool: 'match-1', startSlot: 1 },
        { fromPhase, fromPool: 'default', ranks: [4], toPhase: semisSlug, toPool: 'match-1', startSlot: 2 },
        { fromPhase, fromPool: 'default', ranks: [2], toPhase: semisSlug, toPool: 'match-2', startSlot: 1 },
        { fromPhase, fromPool: 'default', ranks: [3], toPhase: semisSlug, toPool: 'match-2', startSlot: 2 },
        { fromPhase: semisSlug, fromPool: 'match-1', ranks: [1], sourceType: 'match_winner' as const, toPhase: finalSlug, toPool: 'match-1', startSlot: 1 },
        { fromPhase: semisSlug, fromPool: 'match-2', ranks: [1], sourceType: 'match_winner' as const, toPhase: finalSlug, toPool: 'match-1', startSlot: 2 },
      ],
    }
  }

  return { phases: [], progressions: [] }
}

// Builds championship or plate finals phases seeded pool-by-pool from grading (direct-to-finals).
function buildDirectGradingFinalsPhases(
  prefix: string,
  displayName: string,
  gradeRanks: number[],
  poolCount: number,
  style: FinalsStyle,
  baseCol: number
): { phases: PhaseTemplate[], progressions: ProgressionTemplate[] } {
  const semisSlug = `${prefix}-semis`
  const finalSlug = `${prefix}-final`

  // Pool-by-pool seeding order: for each rank, iterate all pools.
  const seedings: { fromPool: string; rank: number }[] = []
  for (const rank of gradeRanks) {
    for (let p = 0; p < poolCount; p++) {
      seedings.push({ fromPool: poolSlug(p), rank })
    }
  }

  // Slot assignment targets: [ { toPool, startSlot } ] indexed by seeding position.
  type SlotTarget = { toPool: string; startSlot: number }
  const sfTargets: SlotTarget[] = [
    { toPool: 'match-1', startSlot: 1 }, { toPool: 'match-1', startSlot: 2 },
    { toPool: 'match-2', startSlot: 1 }, { toPool: 'match-2', startSlot: 2 },
  ]

  if (style === 'final_only') {
    const slots: SlotTarget[] = [{ toPool: 'match-1', startSlot: 1 }, { toPool: 'match-1', startSlot: 2 }]
    return {
      phases: [{
        slug: finalSlug, name: `${displayName} Final`,
        phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol,
        pools: [{ slug: 'match-1', name: 'Final', isDefault: true }],
      }],
      progressions: seedings.slice(0, slots.length).map((s, i) => ({
        fromPhase: 'grading', fromPool: s.fromPool, ranks: [s.rank],
        toPhase: finalSlug, toPool: slots[i].toPool, startSlot: slots[i].startSlot,
      })),
    }
  }

  if (style === 'top4_double_elimination') {
    const majorMinorSlug = `${prefix}-major-minor`
    const prelimSlug = `${prefix}-prelim-final`
    const grandFinalSlug = `${prefix}-grand-final`
    const deSlots: SlotTarget[] = [
      { toPool: 'major-semi-final', startSlot: 1 },
      { toPool: 'major-semi-final', startSlot: 2 },
      { toPool: 'minor-semi-final', startSlot: 1 },
      { toPool: 'minor-semi-final', startSlot: 2 },
    ]
    return {
      phases: [
        {
          slug: majorMinorSlug, name: `${displayName} Major/Minor`,
          phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol,
          pools: [
            { slug: 'major-semi-final', name: 'Major Semi-final' },
            { slug: 'minor-semi-final', name: 'Minor Semi-final' },
          ],
        },
        {
          slug: prelimSlug, name: `${displayName} Prelim Final`,
          phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol + 1,
          yAlignNode: `${majorMinorSlug}:minor-semi-final`,
          pools: [{ slug: 'match-1', name: 'Prelim Final', isDefault: true }],
        },
        {
          slug: grandFinalSlug, name: `${displayName} Grand Final`,
          phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol + 2,
          yAlignNode: `${majorMinorSlug}:major-semi-final`,
          pools: [{ slug: 'match-1', name: 'Grand Final', isDefault: true }],
        },
      ],
      progressions: [
        ...seedings.slice(0, deSlots.length).map((s, i) => ({
          fromPhase: 'grading', fromPool: s.fromPool, ranks: [s.rank],
          toPhase: majorMinorSlug, toPool: deSlots[i].toPool, startSlot: deSlots[i].startSlot,
        })),
        { fromPhase: majorMinorSlug, fromPool: 'major-semi-final', ranks: [1], sourceType: 'match_winner' as const, showEdgeLabel: true, toPhase: grandFinalSlug, toPool: 'match-1', startSlot: 1 },
        { fromPhase: majorMinorSlug, fromPool: 'major-semi-final', ranks: [1], sourceType: 'match_loser' as const, showEdgeLabel: true, toPhase: prelimSlug, toPool: 'match-1', startSlot: 1 },
        { fromPhase: majorMinorSlug, fromPool: 'minor-semi-final', ranks: [1], sourceType: 'match_winner' as const, showEdgeLabel: true, toPhase: prelimSlug, toPool: 'match-1', startSlot: 2 },
        { fromPhase: prelimSlug, fromPool: 'match-1', ranks: [1], sourceType: 'match_winner' as const, showEdgeLabel: true, toPhase: grandFinalSlug, toPool: 'match-1', startSlot: 2 },
      ],
    }
  }

  if (style === 'semi_final_final') {
    return {
      phases: [
        {
          slug: semisSlug, name: `${displayName} Semi-finals`,
          phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol,
          pools: [{ slug: 'match-1', name: 'Semi-final 1' }, { slug: 'match-2', name: 'Semi-final 2' }],
        },
        {
          slug: finalSlug, name: `${displayName} Final`,
          phaseType: 'knockout', standingsMode: 'hidden', displayColumn: baseCol + 1,
          pools: [{ slug: 'match-1', name: 'Final', isDefault: true }],
        },
      ],
      progressions: [
        ...seedings.slice(0, sfTargets.length).map((s, i) => ({
          fromPhase: 'grading', fromPool: s.fromPool, ranks: [s.rank],
          toPhase: semisSlug, toPool: sfTargets[i].toPool, startSlot: sfTargets[i].startSlot,
        })),
        { fromPhase: semisSlug, fromPool: 'match-1', ranks: [1], sourceType: 'match_winner' as const, toPhase: finalSlug, toPool: 'match-1', startSlot: 1 },
        { fromPhase: semisSlug, fromPool: 'match-2', ranks: [1], sourceType: 'match_winner' as const, toPhase: finalSlug, toPool: 'match-1', startSlot: 2 },
      ],
    }
  }

  return { phases: [], progressions: [] }
}

function finalsStylePhasesFromRankings(
  style: FinalsStyle,
  fromPhase: string,
  fromPool: string
) {
  if (style === 'final_only') return buildFinalOnlyFromRankings(fromPhase, fromPool)
  if (style === 'final_and_third') return buildFinalAndThirdFromRankings(fromPhase, fromPool)
  if (style === 'semi_final_final') return buildSemiFinalFinalFromRankings(fromPhase, fromPool)
  if (style === 'top4_double_elimination') {
    return buildTop4DoubleEliminationFromRankings(fromPhase, fromPool)
  }
  return { phases: [], progressions: [] as ProgressionTemplate[] }
}

function nextPowerOfTwo(value: number) {
  let power = 1
  while (power < value) power *= 2
  return power
}

function byeMatchPositionSet(firstRoundMatchCount: number, byeCount: number): Set<number> {
  const positions = new Set<number>()
  const oddCount = Math.ceil(firstRoundMatchCount / 2)
  for (let i = 0; i < byeCount; i++) {
    if (i < oddCount) {
      positions.add(i * 2 + 1)
    } else {
      positions.add((i - oddCount) * 2 + 2)
    }
  }
  return positions
}

function knockoutRoundName(entrants: number) {
  if (entrants === 2) return 'Final'
  if (entrants === 4) return 'Semi-finals'
  if (entrants === 8) return 'Quarter-finals'
  return `Last ${entrants}`
}

function knockoutRoundSlug(entrants: number) {
  if (entrants === 2) return 'final'
  if (entrants === 4) return 'semi-finals'
  if (entrants === 8) return 'quarter-finals'
  return `last-${entrants}`
}


function buildDynamicKnockout(teamCount: number) {
  const count = Math.max(2, teamCount)
  const bracketSize = nextPowerOfTwo(count)
  const byeCount = bracketSize - count
  const phases: PhaseTemplate[] = []
  const progressions: ProgressionTemplate[] = []

  // First round contains all teams; bye slots fill the gaps so the bracket is
  // always a clean power-of-two without a separate preliminary phase.
  for (let entrants = bracketSize; entrants >= 2; entrants /= 2) {
    const name = knockoutRoundName(entrants)
    phases.push({
      slug: knockoutRoundSlug(entrants),
      name,
      phaseType: 'knockout',
      standingsMode: 'hidden',
      pools: createMatchPoolTemplates(entrants / 2, knockoutMatchLabel(name)),
    })
  }

  // Each first-round match winner progresses to the next round.
  const firstRoundSlug = knockoutRoundSlug(bracketSize)
  const secondRoundSlug = knockoutRoundSlug(bracketSize / 2)
  const firstRoundMatchCount = bracketSize / 2
  for (let matchIndex = 1; matchIndex <= firstRoundMatchCount; matchIndex += 1) {
    progressions.push({
      fromPhase: firstRoundSlug,
      fromPool: `match-${matchIndex}`,
      ranks: [1],
      sourceType: 'match_winner',
      toPhase: secondRoundSlug,
      toPool: `match-${Math.ceil(matchIndex / 2)}`,
      startSlot: matchIndex % 2 === 0 ? 2 : 1,
    })
  }

  // Subsequent rounds propagate winners forward to the final.
  for (let entrants = bracketSize / 2; entrants > 2; entrants /= 2) {
    const fromPhase = knockoutRoundSlug(entrants)
    const toPhase = knockoutRoundSlug(entrants / 2)
    const matchCount = entrants / 2
    for (let matchIndex = 1; matchIndex <= matchCount; matchIndex += 1) {
      progressions.push({
        fromPhase,
        fromPool: `match-${matchIndex}`,
        ranks: [1],
        sourceType: 'match_winner',
        toPhase,
        toPool: `match-${Math.ceil(matchIndex / 2)}`,
        startSlot: matchIndex % 2 === 0 ? 2 : 1,
      })
    }
  }

  return { bracketSize, byeCount, phases, progressions }
}

// Builds a bracket-seed order for QF slots: all rank-0 teams first, then rank-1, etc.
// For odd pool counts a per-rank circular offset minimises same-pool matchups when
// bracket seeding (seed[m] vs seed[qfCapacity-1-m]) is applied.
// Even pool counts need no offset — the rank-grouped order already gives cross-pool pairs.
function buildRankGroupedSeeds(
  poolCount: number,
  ranks: number[]
): Array<{ poolIdx: number; rank: number }> {
  const N = poolCount
  const useOffset = N % 2 !== 0
  const result: Array<{ poolIdx: number; rank: number }> = []
  for (let rankIdx = 0; rankIdx < ranks.length; rankIdx++) {
    const shift = useOffset ? rankIdx % N : 0
    for (let i = 0; i < N; i++) {
      result.push({ poolIdx: (i + shift) % N, rank: ranks[rankIdx] })
    }
  }
  return result
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function rankList(value: number[] | undefined, fallback: number[]) {
  const uniqueRanks = Array.from(
    new Set((value && value.length > 0 ? value : fallback).filter((rank) => rank > 0))
  )
  return uniqueRanks.sort((a, b) => a - b)
}

export function defaultFormatBuilderOptions(
  builder: FormatBuilderTemplate
): FormatBuilderOptions {
  return {
    poolCount: builder.configurable?.pools?.defaultValue,
    teamsPerPool: builder.configurable?.teamsPerPool?.defaultValue,
    championshipRanks: builder.configurable?.championshipRanks?.defaultValue,
    plateRanks: builder.configurable?.plateRanks?.defaultValue,
    champGroupSize: builder.configurable?.champGroupSize?.defaultValue,
    teamCount: builder.configurable?.teamCount?.defaultValue,
    playInTeamIds: [],
    byeTeamIds: [],
    expectedTeamCount: null,
    leagueRepeatCount: builder.configurable?.leagueRepeatCount?.defaultValue,
    finalsStyle: builder.configurable?.finalsStyle?.defaultValue,
    placementStyle: builder.configurable?.placementStyle?.defaultValue,
    bestRankCriteria: ['points', 'goal_difference', 'goals_for'],
    directToFinals: false,
  }
}

/**
 * The number of placeholder teams a template needs, derived from the current
 * options. Mirrors the count shown on the wizard's Teams step so generation
 * doesn't depend on the organiser having *changed* the default value.
 *
 * Priority: an explicit count (expectedTeamCount/teamCount) → the pool-derived
 * count (pools × teamsPerPool) → a sensible fallback of 8.
 */
export function resolvePlaceholderTeamCount(
  builder: FormatBuilderTemplate,
  options: FormatBuilderOptions
): number {
  const cfg = builder.configurable
  const poolDerived = cfg?.teamsPerPool
    ? (options.poolCount ?? cfg.pools?.defaultValue ?? cfg.pools?.min ?? 1) *
      (options.teamsPerPool ?? cfg.teamsPerPool.defaultValue ?? cfg.teamsPerPool.min ?? 8)
    : null
  const resolved = options.expectedTeamCount ?? options.teamCount ?? poolDerived ?? 8
  return clamp(resolved, 2, 512)
}

export function resolveFormatBuilder(
  builder: FormatBuilderTemplate,
  options: FormatBuilderOptions = {}
): FormatBuilderTemplate {
  const resolvedPoolCount = builder.configurable?.pools
    ? clamp(
        options.poolCount ?? builder.configurable.pools.defaultValue,
        builder.configurable.pools.min,
        builder.configurable.pools.max
      )
    : undefined
  const championshipRanks = rankList(
    options.championshipRanks,
    builder.configurable?.championshipRanks?.defaultValue ?? []
  )
  const plateRanks = rankList(
    options.plateRanks,
    builder.configurable?.plateRanks?.defaultValue ?? []
  )
  const finalsStyle = options.finalsStyle ?? builder.configurable?.finalsStyle?.defaultValue ?? 'none'
  const placementStyle =
    options.placementStyle ?? builder.configurable?.placementStyle?.defaultValue ?? 'all_placements'
  if (builder.id === 'knockout-play-ins') {
    const dynamic = buildDynamicKnockout(options.teamCount ?? 16)
    return {
      ...builder,
      description:
        dynamic.byeCount > 0
          ? `${dynamic.byeCount} seeded team${dynamic.byeCount === 1 ? '' : 's'} receive${dynamic.byeCount === 1 ? 's' : ''} a first-round bye in a ${dynamic.bracketSize}-team bracket.`
          : `Clean ${dynamic.bracketSize}-team knockout bracket — every team plays from the first round.`,
      phases: dynamic.phases,
      progressions: dynamic.progressions,
    }
  }

  let phases = builder.phases.map((phase) => {
    if (
      resolvedPoolCount &&
      builder.configurable?.pools?.phaseSlug === phase.slug
    ) {
      return {
        ...phase,
        pools: createPoolTemplates(resolvedPoolCount),
      }
    }
    return phase
  })

  if (builder.id === 'grading-championship' && resolvedPoolCount) {
    const useDirectToFinals =
      options.directToFinals === true &&
      resolvedPoolCount <= 4 &&
      finalsStyle !== 'none'

    const gradingPhase: PhaseTemplate = {
      ...phases.find(p => p.slug === 'grading')!,
      displayColumn: 0,
    }

    if (useDirectToFinals) {
      // Skip group phases — pool-by-pool seeding directly into championship/plate finals.
      const champFinals = buildDirectGradingFinalsPhases(
        'championship', 'Championship', championshipRanks, resolvedPoolCount, finalsStyle, 1
      )
      const plateFinals = buildDirectGradingFinalsPhases(
        'plate', 'Plate', plateRanks, resolvedPoolCount, finalsStyle, 1
      )
      return {
        ...builder,
        phases: [gradingPhase, ...champFinals.phases, ...plateFinals.phases],
        progressions: [...champFinals.progressions, ...plateFinals.progressions],
      }
    }

    // Standard mode: grading → championship/plate groups → optional finals.
    const champGroupPhase: PhaseTemplate = {
      ...phases.find(p => p.slug === 'championship')!,
      displayColumn: 1,
    }
    const plateGroupPhase: PhaseTemplate = {
      ...phases.find(p => p.slug === 'plate')!,
      displayColumn: 1,
    }

    const bntCriteria = options.bestRankCriteria ?? ['points', 'goal_difference', 'goals_for']
    const champGroupSize = clamp(options.champGroupSize ?? 8, 4, 16)
    const progressions: ProgressionTemplate[] = [
      ...buildGradingGroupProgressions('championship', championshipRanks, resolvedPoolCount, champGroupSize, bntCriteria),
      ...(plateRanks.length > 0 ? buildGradingGroupProgressions('plate', plateRanks, resolvedPoolCount, champGroupSize, bntCriteria) : []),
    ]

    if (finalsStyle !== 'none') {
      const champFinals = buildGradingGroupFinalsPhases(
        'championship', 'Championship', 'championship', finalsStyle, 2
      )
      const plateFinals = buildGradingGroupFinalsPhases(
        'plate', 'Plate', 'plate', finalsStyle, 2
      )
      return {
        ...builder,
        phases: [gradingPhase, champGroupPhase, plateGroupPhase, ...champFinals.phases, ...plateFinals.phases],
        progressions: [...progressions, ...champFinals.progressions, ...plateFinals.progressions],
      }
    }

    return { ...builder, phases: [gradingPhase, champGroupPhase, plateGroupPhase], progressions }
  }

  if (builder.id === 'group-stage-finals' && resolvedPoolCount && championshipRanks.length > 0) {
    // top4_double_elimination seeds rank 1&2 into the major bracket and rank 3&4 into the minor
    // bracket using pool order, not a cross-pool ranking. With > 2 pools this gives earlier-lettered
    // pools an unfair path advantage, so we fall back to semi_final_final for those cases.
    const effectiveFinalsStyle =
      finalsStyle === 'top4_double_elimination' && resolvedPoolCount > 2
        ? 'semi_final_final'
        : finalsStyle

    if (effectiveFinalsStyle !== 'semi_final_final') {
      const groupStage = phases.find((phase) => phase.slug === 'group-stage')
      const followOn =
        effectiveFinalsStyle === 'final_only'
          ? buildFinalOnlyFromRankings('group-stage', poolSlug(0))
          : effectiveFinalsStyle === 'final_and_third'
            ? buildFinalAndThirdFromRankings('group-stage', poolSlug(0))
            : effectiveFinalsStyle === 'top4_double_elimination'
              ? buildTop4DoubleEliminationFromRankings('group-stage', poolSlug(0))
              : { phases: [], progressions: [] as ProgressionTemplate[] }

      const qualifierTargets = followOn.progressions.filter(
        (progression) => progression.fromPhase === 'group-stage'
      )
      const orderedQualifiers: { poolIndex: number; rank: number }[] = []
      if (
        resolvedPoolCount === 2 &&
        championshipRanks.includes(1) &&
        championshipRanks.includes(2)
      ) {
        orderedQualifiers.push(
          { poolIndex: 0, rank: 1 },
          { poolIndex: 1, rank: 1 },
          { poolIndex: 0, rank: 2 },
          { poolIndex: 1, rank: 2 }
        )
        for (const rank of championshipRanks.filter((candidate) => candidate > 2)) {
          for (let poolIndex = 0; poolIndex < resolvedPoolCount; poolIndex += 1) {
            orderedQualifiers.push({ poolIndex, rank })
          }
        }
      } else {
        for (const rank of championshipRanks) {
          for (let poolIndex = 0; poolIndex < resolvedPoolCount; poolIndex += 1) {
            orderedQualifiers.push({ poolIndex, rank })
          }
        }
      }

      const rankingProgressions = qualifierTargets.flatMap((target, index) => {
        const qualifier = orderedQualifiers[index]
        if (!qualifier) return []
        return [{
          ...target,
          fromPool: poolSlug(qualifier.poolIndex),
          ranks: [qualifier.rank],
        }]
      })
      const matchProgressions = followOn.progressions.filter(
        (progression) => progression.fromPhase !== 'group-stage'
      )

      return {
        ...builder,
        phases: [groupStage, ...followOn.phases].filter((phase): phase is PhaseTemplate => Boolean(phase)),
        progressions: [...rankingProgressions, ...matchProgressions],
      }
    }

    const qualifierCount = resolvedPoolCount * championshipRanks.length
    const groupStagePhase = phases.find((p) => p.slug === 'group-stage')!

    // 5+ qualifiers: expand to quarter-finals + semi-finals + final
    if (qualifierCount > 4) {
      // SF+BNT: qualifiers fit between SF (4) and QF (8), but pools < 4 → QF would have empty slots.
      // Use semi-finals with deterministic rank-1 qualifiers + BNT for rank-2 remainder instead.
      const sfCapacity = 4
      const needsSfBnt = qualifierCount < 8 && resolvedPoolCount < sfCapacity && championshipRanks.length >= 2
      if (needsSfBnt) {
        const bntCount = sfCapacity - resolvedPoolCount
        const bntRank = championshipRanks[1]
        const bntCriteria = options.bestRankCriteria ?? ['points', 'goal_difference', 'goals_for']
        const sfBntPhase: PhaseTemplate = {
          slug: 'semi-finals',
          name: 'Semi-finals',
          phaseType: 'knockout',
          standingsMode: 'hidden',
          pools: createMatchPoolTemplates(2, 'Semi-final'),
        }
        const sfBntFinalPhase: PhaseTemplate = {
          slug: 'finals',
          name: 'Finals',
          phaseType: 'knockout',
          standingsMode: 'hidden',
          pools: createMatchPoolTemplates(1, 'Final'),
        }
        // Bracket seeding: build [rank-1 seeds..., BNT seeds...] then pair
        // seed[m] vs seed[sfCapacity-1-m] so BNT always faces a rank-1 team.
        const sfBntProgressions: ProgressionTemplate[] = []
        type SFSlot = { fromPool: string; rank: number; isBnt: boolean }
        const sfSlotData: SFSlot[] = [
          ...Array.from({ length: resolvedPoolCount }, (_, poolIdx) => ({
            fromPool: poolSlug(poolIdx),
            rank: championshipRanks[0],
            isBnt: false,
          })),
          ...Array.from({ length: bntCount }, () => ({
            fromPool: '__best_rank__',
            rank: bntRank,
            isBnt: true,
          })),
        ]
        const sfMatchCount = sfCapacity / 2
        for (let m = 0; m < sfMatchCount; m++) {
          const hi = sfSlotData[m]!
          const lo = sfSlotData[sfCapacity - 1 - m]!
          sfBntProgressions.push({
            fromPhase: 'group-stage',
            fromPool: hi.fromPool,
            ranks: [hi.rank],
            ...(hi.isBnt ? { sourceType: 'best_rank' as const, isBestRank: true, bestRankCount: bntCount, bestRankCriteria: bntCriteria } : {}),
            toPhase: 'semi-finals',
            toPool: `match-${m + 1}`,
            startSlot: 1,
          })
          sfBntProgressions.push({
            fromPhase: 'group-stage',
            fromPool: lo.fromPool,
            ranks: [lo.rank],
            ...(lo.isBnt ? { sourceType: 'best_rank' as const, isBestRank: true, bestRankCount: bntCount, bestRankCriteria: bntCriteria } : {}),
            toPhase: 'semi-finals',
            toPool: `match-${m + 1}`,
            startSlot: 2,
          })
        }
        for (let sfIdx = 1; sfIdx <= 2; sfIdx++) {
          sfBntProgressions.push({
            fromPhase: 'semi-finals',
            fromPool: `match-${sfIdx}`,
            ranks: [1],
            sourceType: 'match_winner',
            toPhase: 'finals',
            toPool: 'match-1',
            startSlot: sfIdx,
          })
        }
        return { ...builder, phases: [groupStagePhase, sfBntPhase, sfBntFinalPhase], progressions: sfBntProgressions }
      }

      const qfPhase: PhaseTemplate = {
        slug: 'quarter-finals',
        name: 'Quarter-finals',
        phaseType: 'knockout',
        standingsMode: 'hidden',
        pools: createMatchPoolTemplates(4, 'Quarter-final'),
      }
      const sfPhase: PhaseTemplate = {
        slug: 'semi-finals',
        name: 'Semi-finals',
        phaseType: 'knockout',
        standingsMode: 'hidden',
        pools: createMatchPoolTemplates(2, 'Semi-final'),
      }
      const finalPhase: PhaseTemplate = {
        slug: 'finals',
        name: 'Finals',
        phaseType: 'knockout',
        standingsMode: 'hidden',
        pools: createMatchPoolTemplates(1, 'Final'),
      }

      const qfCapacity = 8
      const progressions: ProgressionTemplate[] = []

      // Helper: emit bracket-seeded QF progressions from a slotData array.
      // seed[m] vs seed[qfCapacity-1-m] pairs highest seeds against lowest.
      function emitQFProgressions(
        slotData: Array<{ fromPool: string; rank: number; isBnt: boolean; bestRankCount?: number; bestRankCriteria?: string[] }>
      ) {
        const matchCount = qfCapacity / 2
        for (let m = 0; m < matchCount; m++) {
          const hi = slotData[m]!
          const lo = slotData[qfCapacity - 1 - m]!
          for (const [slot, entry] of [[1, hi], [2, lo]] as const) {
            progressions.push({
              fromPhase: 'group-stage',
              fromPool: entry.fromPool,
              ranks: [entry.rank],
              ...(entry.isBnt ? { sourceType: 'best_rank' as const, isBestRank: true, bestRankCount: entry.bestRankCount ?? 1, bestRankCriteria: entry.bestRankCriteria } : {}),
              toPhase: 'quarter-finals',
              toPool: `match-${m + 1}`,
              startSlot: slot,
            })
          }
        }
      }

      if (qualifierCount > qfCapacity) {
        // More qualifiers than QF slots: deterministic rounds + BNT for the remainder.
        const fullRanks = Math.floor(qfCapacity / resolvedPoolCount)
        const remainder = qfCapacity % resolvedPoolCount
        const bestRankCriteria = options.bestRankCriteria ?? ['points', 'goal_difference', 'goals_for']
        const deterministicRanks = championshipRanks.slice(0, fullRanks)
        // Rank-grouped seeds: all 1sts, then all 2nds, etc. (with per-rank circular offset for odd N).
        const deterministicSeeds = buildRankGroupedSeeds(resolvedPoolCount, deterministicRanks)

        if (remainder > 0 && championshipRanks.length > fullRanks) {
          // BNT path: deterministic seeds first, BNT appended → bracket seeding ensures BNT faces 1sts.
          const bntRank = championshipRanks[fullRanks]
          const slotData = [
            ...deterministicSeeds.map(s => ({ fromPool: poolSlug(s.poolIdx), rank: s.rank, isBnt: false })),
            ...Array.from({ length: remainder }, () => ({ fromPool: '__best_rank__', rank: bntRank, isBnt: true, bestRankCount: remainder, bestRankCriteria })),
          ]
          emitQFProgressions(slotData)
        } else {
          // No BNT remainder: all QF slots filled by deterministic seeds.
          const slotData = deterministicSeeds.slice(0, qfCapacity).map(s => ({ fromPool: poolSlug(s.poolIdx), rank: s.rank, isBnt: false }))
          emitQFProgressions(slotData)
        }
      } else {
        // Exact or under QF capacity: rank-grouped bracket seeding (1sts vs 4ths, 2nds vs 3rds, etc.)
        const seeds = buildRankGroupedSeeds(resolvedPoolCount, championshipRanks)
        const slotData = seeds.slice(0, qfCapacity).map(s => ({ fromPool: poolSlug(s.poolIdx), rank: s.rank, isBnt: false }))
        emitQFProgressions(slotData)
      }

      for (let qfIndex = 1; qfIndex <= 4; qfIndex += 1) {
        progressions.push({
          fromPhase: 'quarter-finals',
          fromPool: `match-${qfIndex}`,
          ranks: [1],
          sourceType: 'match_winner',
          toPhase: 'semi-finals',
          toPool: `match-${Math.ceil(qfIndex / 2)}`,
          startSlot: qfIndex % 2 === 0 ? 2 : 1,
        })
      }
      for (let sfIndex = 1; sfIndex <= 2; sfIndex += 1) {
        progressions.push({
          fromPhase: 'semi-finals',
          fromPool: `match-${sfIndex}`,
          ranks: [1],
          sourceType: 'match_winner',
          toPhase: 'finals',
          toPool: 'match-1',
          startSlot: sfIndex,
        })
      }
      return { ...builder, phases: [groupStagePhase, qfPhase, sfPhase, finalPhase], progressions }
    }

    // ≤4 qualifiers: up to 2 semi-finals → 1 final
    const semiFinalCount = Math.min(2, Math.max(1, Math.ceil(qualifierCount / 2)))
    phases = phases.map((phase) => {
      if (phase.slug === 'semi-finals') {
        return { ...phase, pools: createMatchPoolTemplates(semiFinalCount, 'Semi-final') }
      }
      if (phase.slug === 'finals') {
        return { ...phase, pools: createMatchPoolTemplates(1, 'Final') }
      }
      return phase
    })
    // Remove quarter-finals placeholder if present
    phases = phases.filter((p) => p.slug !== 'quarter-finals')

    const progressions: ProgressionTemplate[] = []
    if (resolvedPoolCount === 1 && semiFinalCount === 2 && championshipRanks.length >= 4) {
      // 1-pool cross-seeding: 1st vs 4th in SF1, 2nd vs 3rd in SF2 — rewards pool-stage performance.
      const r = championshipRanks
      progressions.push(
        { fromPhase: 'group-stage', fromPool: poolSlug(0), ranks: [r[0]], toPhase: 'semi-finals', toPool: 'match-1', startSlot: 1 },
        { fromPhase: 'group-stage', fromPool: poolSlug(0), ranks: [r[3]], toPhase: 'semi-finals', toPool: 'match-1', startSlot: 2 },
        { fromPhase: 'group-stage', fromPool: poolSlug(0), ranks: [r[1]], toPhase: 'semi-finals', toPool: 'match-2', startSlot: 1 },
        { fromPhase: 'group-stage', fromPool: poolSlug(0), ranks: [r[2]], toPhase: 'semi-finals', toPool: 'match-2', startSlot: 2 },
      )
    } else if (
      resolvedPoolCount === 2 &&
      championshipRanks.includes(1) &&
      championshipRanks.includes(2)
    ) {
      // 2-pool cross-seeding: 1stA vs 2ndB, 1stB vs 2ndA.
      progressions.push(
        { fromPhase: 'group-stage', fromPool: poolSlug(0), ranks: [1], toPhase: 'semi-finals', toPool: 'match-1', startSlot: 1 },
        { fromPhase: 'group-stage', fromPool: poolSlug(1), ranks: [2], toPhase: 'semi-finals', toPool: 'match-1', startSlot: 2 },
        { fromPhase: 'group-stage', fromPool: poolSlug(1), ranks: [1], toPhase: 'semi-finals', toPool: 'match-2', startSlot: 1 },
        { fromPhase: 'group-stage', fromPool: poolSlug(0), ranks: [2], toPhase: 'semi-finals', toPool: 'match-2', startSlot: 2 }
      )
    } else {
      let semiFinalSlot = 1
      for (let poolIndex = 0; poolIndex < resolvedPoolCount; poolIndex += 1) {
        for (const rank of championshipRanks) {
          if (semiFinalSlot > semiFinalCount * 2) break
          const semiFinalIndex = Math.ceil(semiFinalSlot / 2)
          progressions.push({
            fromPhase: 'group-stage',
            fromPool: poolSlug(poolIndex),
            ranks: [rank],
            toPhase: 'semi-finals',
            toPool: `match-${semiFinalIndex}`,
            startSlot: semiFinalSlot % 2 === 0 ? 2 : 1,
          })
          semiFinalSlot += 1
        }
      }
    }
    for (let sfIndex = 1; sfIndex <= semiFinalCount; sfIndex += 1) {
      progressions.push({
        fromPhase: 'semi-finals',
        fromPool: `match-${sfIndex}`,
        ranks: [1],
        sourceType: 'match_winner',
        toPhase: 'finals',
        toPool: 'match-1',
        startSlot: sfIndex,
      })
    }
    return { ...builder, phases, progressions }
  }

  if (builder.id === 'league-season' && finalsStyle !== 'none') {
    const followOn = finalsStylePhasesFromRankings(finalsStyle, 'league-season', 'default')
    return {
      ...builder,
      phases: [...phases, ...followOn.phases],
      progressions: followOn.progressions,
    }
  }

  if (builder.id === 'round-robin-placement') {
    const teamCount = Math.max(2, options.teamCount ?? 8)
    if (placementStyle === 'top4_double_elimination') {
      const roundRobinPhase = phases.find((phase) => phase.slug === 'round-robin')
      const followOn = buildTop4DoubleEliminationFromRankings('round-robin', 'default')
      return {
        ...builder,
        phases: [roundRobinPhase, ...followOn.phases].filter((phase): phase is PhaseTemplate => Boolean(phase)),
        progressions: followOn.progressions,
      }
    }

    const placementPools = createPlacementPoolsForStyle(teamCount, placementStyle)
    phases = phases.map((phase) => {
      if (phase.slug !== 'placement-finals') return phase
      return {
        ...phase,
        pools: placementPools,
      }
    })

    const progressions: ProgressionTemplate[] = []
    for (let matchIndex = 1; matchIndex <= placementPools.length; matchIndex += 1) {
      const firstRank = matchIndex * 2 - 1
      if (firstRank > teamCount) break
      progressions.push({
        fromPhase: 'round-robin',
        fromPool: 'default',
        ranks: [firstRank],
        toPhase: 'placement-finals',
        toPool: `match-${matchIndex}`,
        startSlot: 1,
      })
      if (firstRank + 1 <= teamCount) {
        progressions.push({
          fromPhase: 'round-robin',
          fromPool: 'default',
          ranks: [firstRank + 1],
          toPhase: 'placement-finals',
          toPool: `match-${matchIndex}`,
          startSlot: 2,
        })
      }
    }
    return { ...builder, phases, progressions }
  }

  return { ...builder, phases }
}


function teamsForPool(
  teams: Team[],
  template: FormatBuilderTemplate,
  phaseSlug: string,
  poolIndex: number,
  poolCount: number,
  teamsPerPool: number | null,
  options: FormatBuilderOptions
): TeamAssignment[] {
  if (template.teamSplit === 'none') return []
  if (template.id === 'knockout-play-ins') {
    const dynamic = buildDynamicKnockout(options.teamCount ?? teams.length)
    const byeTeamIds = options.byeTeamIds ?? []
    const firstRoundSlug = knockoutRoundSlug(dynamic.bracketSize)

    // Only the first round has direct team assignments; later rounds are filled by progression rules.
    if (phaseSlug !== firstRoundSlug) return []

    const firstRoundMatchCount = dynamic.bracketSize / 2
    const byePositions = byeMatchPositionSet(firstRoundMatchCount, dynamic.byeCount)
    const seededTeams = teams.filter((t) => byeTeamIds.includes(t.id))
    const unseededTeams = teams.filter((t) => !byeTeamIds.includes(t.id))
    const matchPosition = poolIndex + 1

    if (byePositions.has(matchPosition)) {
      // Bye match — assign the seeded team to slot 1; a bye slot will be added separately.
      const sortedByePositions = [...byePositions].sort((a, b) => a - b)
      const seededIndex = sortedByePositions.indexOf(matchPosition)
      const team = seededTeams[seededIndex]
      return team ? [{ team, slotOrder: 1 }] : []
    }

    // Normal match — assign 2 unseeded teams.
    let normalIndex = 0
    for (let pos = 1; pos < matchPosition; pos++) {
      if (!byePositions.has(pos)) normalIndex++
    }
    const team1 = unseededTeams[normalIndex * 2]
    const team2 = unseededTeams[normalIndex * 2 + 1]
    return [
      ...(team1 ? [{ team: team1, slotOrder: 1 }] : []),
      ...(team2 ? [{ team: team2, slotOrder: 2 }] : []),
    ]
  }
  if (template.teamSplit === 'seeded-pools') {
    const size = teamsPerPool ?? 2
    return teams
      .slice(poolIndex * size, poolIndex * size + size)
      .map((team, index) => ({ team, slotOrder: index + 1 }))
  }
  if (poolCount === 1 || template.teamSplit === 'all') {
    return (teamsPerPool ? teams.slice(0, teamsPerPool) : teams).map((team, index) => ({
      team,
      slotOrder: index + 1,
    }))
  }
  const assignedTeams = teams.filter((_, index) => index % poolCount === poolIndex)
  return (teamsPerPool ? assignedTeams.slice(0, teamsPerPool) : assignedTeams).map(
    (team, index) => ({ team, slotOrder: index + 1 })
  )
}

export async function applyFormatBuilder(
  supabase: Supabase,
  ageGroup: Division,
  builderId: string,
  options: FormatBuilderOptions = {}
): Promise<{ phases: number; pools: number; poolTeams: number; slots: number; rules: number; error?: string }> {
  const selectedBuilder = formatBuilderById(builderId)
  if (!selectedBuilder) return { phases: 0, pools: 0, poolTeams: 0, slots: 0, rules: 0, error: 'Unknown format builder' }
  const { data: teamsData, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('age_group_id', ageGroup.id)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (teamsError) {
    return { phases: 0, pools: 0, poolTeams: 0, slots: 0, rules: 0, error: teamsError.message }
  }
  let teams = (teamsData ?? []) as Team[]
  const expectedTeamCount = options.expectedTeamCount
    ? clamp(options.expectedTeamCount, 2, 512)
    : null
  if (teams.length === 0 && expectedTeamCount) {
    const { data: placeholderRows, error: placeholderError } = await supabase
      .from('teams')
      .insert(
        Array.from({ length: expectedTeamCount }, (_, index) => ({
          age_group_id: ageGroup.id,
          name: `Team ${index + 1}`,
          short_name: `T${index + 1}`,
          color: null,
          logo_url: null,
        }))
      )
      .select('*')
    if (placeholderError) {
      return { phases: 0, pools: 0, poolTeams: 0, slots: 0, rules: 0, error: placeholderError.message }
    }
    teams = (placeholderRows ?? []) as Team[]
  }
  const resolvedOptions = { ...options, teamCount: options.teamCount ?? teams.length }
  if (selectedBuilder.id === 'knockout-play-ins') {
    const dynamic = buildDynamicKnockout(resolvedOptions.teamCount ?? teams.length)
    if ((resolvedOptions.byeTeamIds ?? []).length === 0 && dynamic.byeCount > 0) {
      // Auto-assign first byeCount teams as seeded (receives a bye).
      resolvedOptions.byeTeamIds = teams.slice(0, dynamic.byeCount).map((t) => t.id)
    }
    resolvedOptions.playInTeamIds = []
  }
  const builder = resolveFormatBuilder(selectedBuilder, resolvedOptions)
  const teamsPerPool =
    selectedBuilder.configurable?.teamsPerPool && resolvedOptions.teamsPerPool
      ? clamp(
          resolvedOptions.teamsPerPool,
          selectedBuilder.configurable.teamsPerPool.min,
          selectedBuilder.configurable.teamsPerPool.max
        )
      : null
  const leagueRepeatCount =
    selectedBuilder.configurable?.leagueRepeatCount
      ? clamp(
          resolvedOptions.leagueRepeatCount ?? selectedBuilder.configurable.leagueRepeatCount.defaultValue,
          1,
          2
        )
      : null

  let phaseCount = 0
  let poolCount = 0
  let poolTeamCount = 0
  let slotCount = 0
  let ruleCount = 0
  const phaseIdBySlug = new Map<string, string>()
  const poolByKey = new Map<string, Pool>()
  const teamsByPoolKey = new Map<string, TeamAssignment[]>()
  const progressionTargetPhaseSlugs = new Set(
    (builder.progressions ?? []).map((progression) => progression.toPhase)
  )
  const templatePhaseSlugs = new Set(builder.phases.map((phase) => phase.slug))

  const { data: existingPhaseRows, error: existingPhaseError } = await supabase
    .from('phases')
    .select('id, slug, name')
    .eq('age_group_id', ageGroup.id)
  if (existingPhaseError) {
    return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: existingPhaseError.message }
  }

  const obsoletePhases = ((existingPhaseRows ?? []) as Pick<Phase, 'id' | 'slug' | 'name'>[])
    .filter((phase) => !templatePhaseSlugs.has(phase.slug))
  if (obsoletePhases.length > 0) {
    const obsoletePhaseIds = obsoletePhases.map((phase) => phase.id)
    const { data: obsoleteMatches, error: obsoleteMatchesError } = await supabase
      .from('matches')
      .select('id, status, is_planned')
      .in('phase_id', obsoletePhaseIds)
      .is('deleted_at', null)
    if (obsoleteMatchesError) {
      return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: obsoleteMatchesError.message }
    }

    const protectedMatches = ((obsoleteMatches ?? []) as Pick<Match, 'id' | 'status' | 'is_planned'>[])
      .filter((match) => match.is_planned || match.status === 'completed')
    if (protectedMatches.length > 0) {
      return {
        phases: phaseCount,
        pools: poolCount,
        poolTeams: poolTeamCount,
        slots: slotCount,
        rules: ruleCount,
        error: `Cannot replace obsolete phase${obsoletePhases.length === 1 ? '' : 's'} (${obsoletePhases.map((phase) => phase.name).join(', ')}) because they contain scheduled, planned or completed fixtures.`,
      }
    }

    const obsoleteMatchIds = ((obsoleteMatches ?? []) as { id: string }[]).map((match) => match.id)
    if (obsoleteMatchIds.length > 0) {
      const { error: deleteObsoleteMatchesError } = await supabase
        .from('matches')
        .delete()
        .in('id', obsoleteMatchIds)
      if (deleteObsoleteMatchesError) {
        return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: deleteObsoleteMatchesError.message }
      }
    }

    const { error: deleteObsoletePhasesError } = await supabase
      .from('phases')
      .delete()
      .in('id', obsoletePhaseIds)
    if (deleteObsoletePhasesError) {
      return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: deleteObsoletePhasesError.message }
    }
  }

  for (const [phaseIndex, phaseTemplate] of builder.phases.entries()) {
    const phaseMetadata: Record<string, unknown> =
      phaseTemplate.phaseType === 'league' && leagueRepeatCount
        ? { league_repeat_count: leagueRepeatCount }
        : {}

    if (phaseTemplate.displayColumn !== undefined) {
      phaseMetadata.diagram_display_column = phaseTemplate.displayColumn
    }
    if (phaseTemplate.yAlignNode) {
      phaseMetadata.diagram_y_align_node = phaseTemplate.yAlignNode
    }

    const { data: phaseRows, error: phaseError } = await supabase
      .from('phases')
      .upsert(
        {
          age_group_id: ageGroup.id,
          slug: phaseTemplate.slug,
          name: phaseTemplate.name,
          phase_type: phaseTemplate.phaseType,
          display_order: phaseIndex + 1,
          standings_mode: phaseTemplate.standingsMode,
          scoring_system_id: ageGroup.scoring_system_id,
          match_format: ageGroup.match_format,
          period_minutes: ageGroup.period_minutes,
          break_q1_q2_minutes: ageGroup.break_q1_q2_minutes,
          break_half_time_minutes: ageGroup.break_half_time_minutes,
          break_q3_q4_minutes: ageGroup.break_q3_q4_minutes,
          metadata: phaseMetadata,
        },
        { onConflict: 'age_group_id,slug' }
      )
      .select('id')
    if (phaseError) {
      return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: phaseError.message }
    }

    const phaseId = (phaseRows?.[0] as { id?: string } | undefined)?.id
    if (!phaseId) {
      return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: `Could not create ${phaseTemplate.name}` }
    }
    phaseIdBySlug.set(phaseTemplate.slug, phaseId)
    phaseCount += 1

    const templatePoolSlugs = new Set(phaseTemplate.pools.map((pool) => pool.slug))
    const { data: existingPools, error: existingPoolsError } = await supabase
      .from('pools')
      .select('id, slug, name')
      .eq('phase_id', phaseId)
    if (existingPoolsError) {
      return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: existingPoolsError.message }
    }

    const obsoletePools = ((existingPools ?? []) as Pick<Pool, 'id' | 'slug' | 'name'>[])
      .filter((pool) => !templatePoolSlugs.has(pool.slug))
    if (obsoletePools.length > 0) {
      const obsoletePoolIds = obsoletePools.map((pool) => pool.id)
      const { count: obsoleteMatchCount, error: obsoleteMatchError } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .in('pool_id', obsoletePoolIds)
        .is('deleted_at', null)
      if (obsoleteMatchError) {
        return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: obsoleteMatchError.message }
      }
      if ((obsoleteMatchCount ?? 0) > 0) {
        return {
          phases: phaseCount,
          pools: poolCount,
          poolTeams: poolTeamCount,
          slots: slotCount,
          rules: ruleCount,
          error: `Cannot remove obsolete pool${obsoletePools.length === 1 ? '' : 's'} (${obsoletePools.map((pool) => pool.name).join(', ')}) because they still have matches.`,
        }
      }

      const { error: deleteObsoletePoolsError } = await supabase
        .from('pools')
        .delete()
        .in('id', obsoletePoolIds)
      if (deleteObsoletePoolsError) {
        return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: deleteObsoletePoolsError.message }
      }
    }

    for (const [poolIndex, poolTemplate] of phaseTemplate.pools.entries()) {
      const isDefault =
        poolTemplate.isDefault ?? phaseTemplate.pools.length === 1

      const { data: poolRows, error: poolError } = await supabase
        .from('pools')
        .upsert(
          {
            phase_id: phaseId,
            slug: poolTemplate.slug,
            name: poolTemplate.name,
            display_order: poolIndex + 1,
            is_default: isDefault,
          },
          { onConflict: 'phase_id,slug' }
        )
        .select('id')
      if (poolError) {
        return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: poolError.message }
      }

      const poolId = (poolRows?.[0] as { id?: string } | undefined)?.id
      if (!poolId) {
        return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: `Could not create ${poolTemplate.name}` }
      }
      poolByKey.set(`${phaseTemplate.slug}:${poolTemplate.slug}`, {
        id: poolId,
        phase_id: phaseId,
        slug: poolTemplate.slug,
        name: poolTemplate.name,
        display_order: poolIndex + 1,
        is_default: isDefault,
        created_at: '',
      })
      poolCount += 1

      const { error: clearPoolTeamsError } = await supabase
        .from('pool_teams')
        .delete()
        .eq('pool_id', poolId)
      if (clearPoolTeamsError) {
        return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: clearPoolTeamsError.message }
      }

      const assignedTeams =
        progressionTargetPhaseSlugs.has(phaseTemplate.slug) &&
        selectedBuilder.id !== 'knockout-play-ins'
          ? []
          : teamsForPool(
              teams,
              builder,
              phaseTemplate.slug,
              poolIndex,
              phaseTemplate.pools.length,
              teamsPerPool,
              resolvedOptions
            )
      teamsByPoolKey.set(`${phaseTemplate.slug}:${poolTemplate.slug}`, assignedTeams)
      if (assignedTeams.length === 0) continue

      const { data: assignments, error: assignmentError } = await supabase
        .from('pool_teams')
        .upsert(
          assignedTeams.map((assignment) => ({
            pool_id: poolId,
            team_id: assignment.team.id,
            display_order: assignment.slotOrder,
          })),
          { onConflict: 'pool_id,team_id' }
        )
        .select('pool_id')
      if (assignmentError) {
        return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: assignmentError.message }
      }
      poolTeamCount += assignments?.length ?? 0
    }
  }

  const poolIds = Array.from(poolByKey.values()).map((pool) => pool.id)
  const { data: elementRows, error: elementsError } = poolIds.length > 0
    ? await supabase
        .from('phase_elements')
        .select('*')
        .in('pool_id', poolIds)
    : { data: [], error: null }

  if (elementsError) {
    return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: elementsError.message }
  }

  const elementByPoolId = new Map<string, PhaseElement>()
  for (const element of (elementRows ?? []) as PhaseElement[]) {
    if (element.pool_id) elementByPoolId.set(element.pool_id, element)
  }
  const builderElementIds = Array.from(elementByPoolId.values()).map((element) => element.id)

  if (builderElementIds.length > 0) {
    const { error: deleteSlotsError } = await supabase
      .from('element_slots')
      .delete()
      .in('phase_element_id', builderElementIds)
    if (deleteSlotsError) {
      return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: deleteSlotsError.message }
    }

    const { error: deleteRulesError } = await supabase
      .from('progression_rules')
      .delete()
      .in('to_element_id', builderElementIds)
    if (deleteRulesError) {
      return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: deleteRulesError.message }
    }
  }

  const slotPayloads: Record<string, unknown>[] = []
  for (const [poolKey, pool] of poolByKey.entries()) {
    const element = elementByPoolId.get(pool.id)
    if (!element) continue

    const assignedTeams = teamsByPoolKey.get(poolKey) ?? []
    for (const assignment of assignedTeams) {
      slotPayloads.push({
        phase_element_id: element.id,
        display_order: assignment.slotOrder,
        label: assignment.team.name,
        slot_type: 'team',
        team_id: assignment.team.id,
        source_phase_id: null,
        source_element_id: null,
        source_pool_id: null,
        source_match_id: null,
        source_rank: null,
        source_outcome: null,
        metadata: {},
      })
    }
    // For knockout bye matches (exactly 1 assigned team at slot 1), add a bye slot at slot 2.
    if (
      selectedBuilder.id === 'knockout-play-ins' &&
      assignedTeams.length === 1 &&
      assignedTeams[0].slotOrder === 1
    ) {
      slotPayloads.push({
        phase_element_id: element.id,
        display_order: 2,
        label: 'Bye',
        slot_type: 'bye',
        team_id: null,
        source_phase_id: null,
        source_element_id: null,
        source_pool_id: null,
        source_match_id: null,
        source_rank: null,
        source_outcome: null,
        metadata: {},
      })
    }
  }

  const progressionSlotPayloads: Record<string, unknown>[] = []
  const rulePayloads: Record<string, unknown>[] = []
  for (const progression of builder.progressions ?? []) {
    const sourcePhaseId = phaseIdBySlug.get(progression.fromPhase)
    const sourcePool = progression.isBestRank
      ? null
      : poolByKey.get(`${progression.fromPhase}:${progression.fromPool}`)
    const targetPhaseId = phaseIdBySlug.get(progression.toPhase)
    const targetPool = poolByKey.get(`${progression.toPhase}:${progression.toPool}`)
    const targetElement = targetPool ? elementByPoolId.get(targetPool.id) : null
    if (!sourcePhaseId || (!sourcePool && !progression.isBestRank) || !targetPhaseId || !targetElement) continue

    for (const [index, rank] of progression.ranks.entries()) {
      const slotOrder = progression.startSlot + index
      const sourceType = progression.sourceType ?? 'standings_rank'
      const isBNT = sourceType === 'best_rank'
      const sourceOutcome =
        sourceType === 'match_winner' ? 'winner'
        : sourceType === 'match_loser' ? 'loser'
        : isBNT ? 'best_rank'
        : 'rank'
      const ordSuffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'
      const slotLabel = isBNT
        ? `Best ${rank}${ordSuffix} Place`
        : sourceType === 'match_winner'
          ? `Winner of ${sourcePool!.name}`
          : sourceType === 'match_loser'
            ? `Loser of ${sourcePool!.name}`
            : `${sourcePool!.name} ${rank === 1 ? 'winner' : `${rank}${ordSuffix}`}`
      progressionSlotPayloads.push({
        phase_element_id: targetElement.id,
        display_order: slotOrder,
        label: slotLabel,
        slot_type: 'source',
        team_id: null,
        source_phase_id: sourcePhaseId,
        source_element_id: sourcePool ? (elementByPoolId.get(sourcePool.id)?.id ?? null) : null,
        source_pool_id: sourcePool?.id ?? null,
        source_match_id: null,
        source_rank: rank,
        source_outcome: sourceOutcome,
        metadata: {},
      })
      rulePayloads.push({
        from_phase_id: sourcePhaseId,
        from_element_id: sourcePool ? (elementByPoolId.get(sourcePool.id)?.id ?? null) : null,
        from_pool_id: sourcePool?.id ?? null,
        from_match_id: null,
        source_type: sourceType,
        source_rank: rank,
        to_phase_id: targetPhaseId,
        to_element_id: targetElement.id,
        to_slot_id: null,
        to_slot_order: slotOrder,
        display_order: rulePayloads.length + 1,
        rule_config: isBNT
          ? { bestRankCriteria: progression.bestRankCriteria ?? ['points', 'goal_difference', 'goals_for'], bestRankCount: progression.bestRankCount ?? 1 }
          : {},
      })
    }
  }

  if (progressionSlotPayloads.length > 0) slotPayloads.push(...progressionSlotPayloads)

  if (slotPayloads.length > 0) {
    const { data: slots, error: slotError } = await supabase
      .from('element_slots')
      .upsert(slotPayloads, { onConflict: 'phase_element_id,display_order' })
      .select('id')
    if (slotError) {
      return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: slotError.message }
    }
    slotCount = slots?.length ?? 0
  }

  if (rulePayloads.length > 0) {
    const { data: rules, error: ruleError } = await supabase
      .from('progression_rules')
      .insert(rulePayloads)
      .select('id')
    if (ruleError) {
      return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount, error: ruleError.message }
    }
    ruleCount = rules?.length ?? 0
  }

  return { phases: phaseCount, pools: poolCount, poolTeams: poolTeamCount, slots: slotCount, rules: ruleCount }
}

