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
    leagueRepeatCount?: {
      label: string
      defaultValue: 1 | 2
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
}

export interface FormatBuilderOptions {
  poolCount?: number
  teamsPerPool?: number | null
  championshipRanks?: number[]
  plateRanks?: number[]
  teamCount?: number
  expectedTeamCount?: number | null
  playInTeamIds?: string[]
  leagueRepeatCount?: 1 | 2
  finalsStyle?: FinalsStyle
  placementStyle?: PlacementStyle
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
        min: 2,
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
        min: 2,
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
    id: 'basic-knockout',
    name: 'Basic Knockout',
    description: 'Last 16 bracket where winners progress to quarter-finals, semi-finals and final.',
    teamSplit: 'seeded-pools',
    configurable: {
      teamsPerPool: {
        min: 2,
        max: 2,
        defaultValue: 2,
      },
    },
    phases: [
      {
        slug: 'last-16',
        name: 'Last 16',
        phaseType: 'knockout',
        standingsMode: 'hidden',
        pools: [
          { slug: 'match-1', name: 'Last 16 Match 1' },
          { slug: 'match-2', name: 'Last 16 Match 2' },
          { slug: 'match-3', name: 'Last 16 Match 3' },
          { slug: 'match-4', name: 'Last 16 Match 4' },
          { slug: 'match-5', name: 'Last 16 Match 5' },
          { slug: 'match-6', name: 'Last 16 Match 6' },
          { slug: 'match-7', name: 'Last 16 Match 7' },
          { slug: 'match-8', name: 'Last 16 Match 8' },
        ],
      },
      {
        slug: 'quarter-finals',
        name: 'Quarter-finals',
        phaseType: 'knockout',
        standingsMode: 'hidden',
        pools: [
          { slug: 'match-1', name: 'Quarter-final 1' },
          { slug: 'match-2', name: 'Quarter-final 2' },
          { slug: 'match-3', name: 'Quarter-final 3' },
          { slug: 'match-4', name: 'Quarter-final 4' },
        ],
      },
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
        slug: 'final',
        name: 'Final',
        phaseType: 'knockout',
        standingsMode: 'hidden',
        pools: [{ slug: 'match-1', name: 'Final', isDefault: true }],
      },
    ],
    progressions: [
      { fromPhase: 'last-16', fromPool: 'match-1', ranks: [1], sourceType: 'match_winner', toPhase: 'quarter-finals', toPool: 'match-1', startSlot: 1 },
      { fromPhase: 'last-16', fromPool: 'match-2', ranks: [1], sourceType: 'match_winner', toPhase: 'quarter-finals', toPool: 'match-1', startSlot: 2 },
      { fromPhase: 'last-16', fromPool: 'match-3', ranks: [1], sourceType: 'match_winner', toPhase: 'quarter-finals', toPool: 'match-2', startSlot: 1 },
      { fromPhase: 'last-16', fromPool: 'match-4', ranks: [1], sourceType: 'match_winner', toPhase: 'quarter-finals', toPool: 'match-2', startSlot: 2 },
      { fromPhase: 'last-16', fromPool: 'match-5', ranks: [1], sourceType: 'match_winner', toPhase: 'quarter-finals', toPool: 'match-3', startSlot: 1 },
      { fromPhase: 'last-16', fromPool: 'match-6', ranks: [1], sourceType: 'match_winner', toPhase: 'quarter-finals', toPool: 'match-3', startSlot: 2 },
      { fromPhase: 'last-16', fromPool: 'match-7', ranks: [1], sourceType: 'match_winner', toPhase: 'quarter-finals', toPool: 'match-4', startSlot: 1 },
      { fromPhase: 'last-16', fromPool: 'match-8', ranks: [1], sourceType: 'match_winner', toPhase: 'quarter-finals', toPool: 'match-4', startSlot: 2 },
      { fromPhase: 'quarter-finals', fromPool: 'match-1', ranks: [1], sourceType: 'match_winner', toPhase: 'semi-finals', toPool: 'match-1', startSlot: 1 },
      { fromPhase: 'quarter-finals', fromPool: 'match-2', ranks: [1], sourceType: 'match_winner', toPhase: 'semi-finals', toPool: 'match-1', startSlot: 2 },
      { fromPhase: 'quarter-finals', fromPool: 'match-3', ranks: [1], sourceType: 'match_winner', toPhase: 'semi-finals', toPool: 'match-2', startSlot: 1 },
      { fromPhase: 'quarter-finals', fromPool: 'match-4', ranks: [1], sourceType: 'match_winner', toPhase: 'semi-finals', toPool: 'match-2', startSlot: 2 },
      { fromPhase: 'semi-finals', fromPool: 'match-1', ranks: [1], sourceType: 'match_winner', toPhase: 'final', toPool: 'match-1', startSlot: 1 },
      { fromPhase: 'semi-finals', fromPool: 'match-2', ranks: [1], sourceType: 'match_winner', toPhase: 'final', toPool: 'match-1', startSlot: 2 },
    ],
  },
  {
    id: 'knockout-play-ins',
    name: 'Knockout + Play-ins',
    description: 'Builds the correct knockout bracket for awkward team counts, with preliminary play-in ties feeding the main bracket.',
    teamSplit: 'seeded-pools',
    configurable: {
      playInTeams: {
        label: 'Teams entering preliminary / play-in ties',
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
    description: 'Four grading pools followed by championship and plate pools.',
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
        min: 2,
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
    progressions: [
      { fromPhase: 'grading', fromPool: 'pool-a', ranks: [1, 2], toPhase: 'championship', toPool: 'default', startSlot: 1 },
      { fromPhase: 'grading', fromPool: 'pool-b', ranks: [1, 2], toPhase: 'championship', toPool: 'default', startSlot: 3 },
      { fromPhase: 'grading', fromPool: 'pool-c', ranks: [1, 2], toPhase: 'championship', toPool: 'default', startSlot: 5 },
      { fromPhase: 'grading', fromPool: 'pool-d', ranks: [1, 2], toPhase: 'championship', toPool: 'default', startSlot: 7 },
      { fromPhase: 'grading', fromPool: 'pool-a', ranks: [3, 4], toPhase: 'plate', toPool: 'default', startSlot: 1 },
      { fromPhase: 'grading', fromPool: 'pool-b', ranks: [3, 4], toPhase: 'plate', toPool: 'default', startSlot: 3 },
      { fromPhase: 'grading', fromPool: 'pool-c', ranks: [3, 4], toPhase: 'plate', toPool: 'default', startSlot: 5 },
      { fromPhase: 'grading', fromPool: 'pool-d', ranks: [3, 4], toPhase: 'plate', toPool: 'default', startSlot: 7 },
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
      pools: [{ slug: 'match-1', name: 'Preliminary Final', isDefault: true }],
    },
    {
      slug: 'grand-final',
      name: 'Grand Final',
      phaseType: 'knockout',
      standingsMode: 'hidden',
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
      toPhase: 'grand-final',
      toPool: 'match-1',
      startSlot: 1,
    },
    {
      fromPhase: 'major-minor-finals',
      fromPool: 'major-semi-final',
      ranks: [1],
      sourceType: 'match_loser',
      toPhase: 'preliminary-final',
      toPool: 'match-1',
      startSlot: 1,
    },
    {
      fromPhase: 'major-minor-finals',
      fromPool: 'minor-semi-final',
      ranks: [1],
      sourceType: 'match_winner',
      toPhase: 'preliminary-final',
      toPool: 'match-1',
      startSlot: 2,
    },
    {
      fromPhase: 'preliminary-final',
      fromPool: 'match-1',
      ranks: [1],
      sourceType: 'match_winner',
      toPhase: 'grand-final',
      toPool: 'match-1',
      startSlot: 2,
    },
  ]

  return { phases, progressions }
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

function previousPowerOfTwo(value: number) {
  let power = 1
  while (power * 2 <= value) power *= 2
  return power
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

function playInWinnerSlotOrders(bracketSize: number, playInMatchCount: number) {
  const firstRoundMatchCount = bracketSize / 2
  const firstSlotOrders = Array.from(
    { length: Math.min(playInMatchCount, firstRoundMatchCount) },
    (_, index) => index * 2 + 1
  )
  const secondSlotOrders = Array.from(
    { length: Math.max(0, playInMatchCount - firstRoundMatchCount) },
    (_, index) => index * 2 + 2
  )

  return [...firstSlotOrders, ...secondSlotOrders]
}

function buildDynamicKnockout(teamCount: number) {
  const count = Math.max(2, teamCount)
  const bracketSize = previousPowerOfTwo(count)
  const playInMatchCount = count - bracketSize
  const phases: PhaseTemplate[] = []
  const progressions: ProgressionTemplate[] = []

  if (playInMatchCount > 0) {
    phases.push({
      slug: 'preliminary',
      name: 'Preliminary',
      phaseType: 'knockout',
      standingsMode: 'hidden',
      pools: createMatchPoolTemplates(playInMatchCount, 'Play-in'),
    })
  }

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

  const mainPhaseSlug = knockoutRoundSlug(bracketSize)
  const playInSlots = playInWinnerSlotOrders(bracketSize, playInMatchCount)
  for (let playInIndex = 1; playInIndex <= playInMatchCount; playInIndex += 1) {
    const targetSlotOrder = playInSlots[playInIndex - 1]
    progressions.push({
      fromPhase: 'preliminary',
      fromPool: `match-${playInIndex}`,
      ranks: [1],
      sourceType: 'match_winner',
      toPhase: mainPhaseSlug,
      toPool: `match-${Math.ceil(targetSlotOrder / 2)}`,
      startSlot: targetSlotOrder % 2 === 0 ? 2 : 1,
    })
  }

  for (let entrants = bracketSize; entrants > 2; entrants /= 2) {
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

  return { bracketSize, playInMatchCount, phases, progressions }
}

// Builds the (poolIdx, rankIdx) slot-fill order for QF matches so that:
// - no same-pool matchup appears within a single QF match
// - for even pool counts with 2 ranks: 1st-placed teams play 2nd-placed teams from a
//   different pool, and the two bracket halves (QF1+QF2 → SF1, QF3+QF4 → SF2) are each
//   drawn from a different pool pair → no same-pool matchup is possible before the final
// - for odd pool counts (3, 5, …): circular seeding is used; a rare same-pool SF matchup
//   is theoretically possible but every QF match is still cross-pool
function buildQFCrossSeededAssignments(
  resolvedPoolCount: number,
  ranks: number[]          // e.g. [1, 2] — already resolved championship ranks
): Array<{ poolIdx: number; rankIdx: number }> {
  const M = ranks.length
  const N = resolvedPoolCount
  const result: Array<{ poolIdx: number; rankIdx: number }> = []

  if (M >= 2 && N % 2 === 0) {
    // Even N + ≥2 ranks → FIFA-style bracket seeding.
    // Phase 1: one match per pool-pair (even pool rank0 vs odd pool rank1), all pairs interleaved.
    for (let pairStart = 0; pairStart < N; pairStart += 2) {
      result.push({ poolIdx: pairStart, rankIdx: 0 })
      result.push({ poolIdx: pairStart + 1, rankIdx: 1 })
    }
    // Phase 2: reverse match per pool-pair (odd pool rank0 vs even pool rank1), all pairs.
    for (let pairStart = 0; pairStart < N; pairStart += 2) {
      result.push({ poolIdx: pairStart + 1, rankIdx: 0 })
      result.push({ poolIdx: pairStart, rankIdx: 1 })
    }
    // Additional ranks (rank2, rank3, …) fill remaining slots rank-outer / pool-inner.
    for (let rankIdx = 2; rankIdx < M; rankIdx++) {
      for (let poolIdx = 0; poolIdx < N; poolIdx++) {
        result.push({ poolIdx, rankIdx })
      }
    }
    return result
  }

  if (M >= 2 && N % 2 !== 0) {
    // Odd N + ≥2 ranks → circular seeding: pool k rank0 vs pool (k+1 mod N) rank1.
    for (let k = 0; k < N; k++) {
      result.push({ poolIdx: k, rankIdx: 0 })
      result.push({ poolIdx: (k + 1) % N, rankIdx: 1 })
    }
    // Additional ranks fill rank-outer / pool-inner.
    for (let rankIdx = 2; rankIdx < M; rankIdx++) {
      for (let poolIdx = 0; poolIdx < N; poolIdx++) {
        result.push({ poolIdx, rankIdx })
      }
    }
    return result
  }

  // Single rank (M=1) or fallback: rank-outer / pool-inner.
  for (let rankIdx = 0; rankIdx < M; rankIdx++) {
    for (let poolIdx = 0; poolIdx < N; poolIdx++) {
      result.push({ poolIdx, rankIdx })
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
    playInTeamIds: [],
    expectedTeamCount: null,
    leagueRepeatCount: builder.configurable?.leagueRepeatCount?.defaultValue,
    finalsStyle: builder.configurable?.finalsStyle?.defaultValue,
    placementStyle: builder.configurable?.placementStyle?.defaultValue,
    bestRankCriteria: ['points', 'goal_difference', 'goals_for'],
  }
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
        dynamic.playInMatchCount > 0
          ? `${dynamic.playInMatchCount} preliminary play-in tie${dynamic.playInMatchCount === 1 ? '' : 's'} feed a ${dynamic.bracketSize}-team main knockout bracket.`
          : `Clean ${dynamic.bracketSize}-team knockout bracket with no play-ins needed.`,
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
    const progressions: ProgressionTemplate[] = []
    for (let poolIndex = 0; poolIndex < resolvedPoolCount; poolIndex += 1) {
      progressions.push({
        fromPhase: 'grading',
        fromPool: poolSlug(poolIndex),
        ranks: championshipRanks,
        toPhase: 'championship',
        toPool: 'default',
        startSlot: poolIndex * championshipRanks.length + 1,
      })
      if (plateRanks.length > 0) {
        progressions.push({
          fromPhase: 'grading',
          fromPool: poolSlug(poolIndex),
          ranks: plateRanks,
          toPhase: 'plate',
          toPool: 'default',
          startSlot: poolIndex * plateRanks.length + 1,
        })
      }
    }
    return { ...builder, phases, progressions }
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
      let qfSlot = 1

      if (qualifierCount > qfCapacity) {
        // More qualifiers than QF slots: deterministic rounds via cross-seeding + BNT for remainder.
        // Bracket seeding (seed[m] vs seed[qfCapacity-1-m]) guarantees BNT never faces another BNT.
        const fullRanks = Math.floor(qfCapacity / resolvedPoolCount)
        const remainder = qfCapacity % resolvedPoolCount
        const bestRankCriteria = options.bestRankCriteria ?? ['points', 'goal_difference', 'goals_for']
        const deterministicRanks = championshipRanks.slice(0, fullRanks)
        const assignments = buildQFCrossSeededAssignments(resolvedPoolCount, deterministicRanks)

        if (remainder > 0 && championshipRanks.length > fullRanks) {
          // BNT path: build entries list (deterministic first, BNT appended) then bracket-seed into QF.
          const bntRank = championshipRanks[fullRanks]
          type QFSlot = { fromPool: string; rank: number; isBnt: boolean }
          const slotData: QFSlot[] = [
            ...assignments.map(({ poolIdx, rankIdx }) => ({
              fromPool: poolSlug(poolIdx),
              rank: deterministicRanks[rankIdx],
              isBnt: false,
            })),
            ...Array.from({ length: remainder }, () => ({
              fromPool: '__best_rank__',
              rank: bntRank,
              isBnt: true,
            })),
          ]
          const matchCount = qfCapacity / 2
          for (let m = 0; m < matchCount; m++) {
            const hi = slotData[m]!
            const lo = slotData[qfCapacity - 1 - m]!
            progressions.push({
              fromPhase: 'group-stage',
              fromPool: hi.fromPool,
              ranks: [hi.rank],
              ...(hi.isBnt ? { sourceType: 'best_rank' as const, isBestRank: true, bestRankCount: remainder, bestRankCriteria } : {}),
              toPhase: 'quarter-finals',
              toPool: `match-${m + 1}`,
              startSlot: 1,
            })
            progressions.push({
              fromPhase: 'group-stage',
              fromPool: lo.fromPool,
              ranks: [lo.rank],
              ...(lo.isBnt ? { sourceType: 'best_rank' as const, isBestRank: true, bestRankCount: remainder, bestRankCriteria } : {}),
              toPhase: 'quarter-finals',
              toPool: `match-${m + 1}`,
              startSlot: 2,
            })
          }
        } else {
          // No BNT remainder: use cross-seeded slot assignment directly.
          for (const { poolIdx, rankIdx } of assignments) {
            if (qfSlot > qfCapacity) break
            progressions.push({
              fromPhase: 'group-stage',
              fromPool: poolSlug(poolIdx),
              ranks: [deterministicRanks[rankIdx]],
              toPhase: 'quarter-finals',
              toPool: `match-${Math.ceil(qfSlot / 2)}`,
              startSlot: qfSlot % 2 === 0 ? 2 : 1,
            })
            qfSlot += 1
          }
        }
      } else {
        // Cross-seeded assignments: avoids same-pool QF matchups and seeds 1sts vs 2nds.
        const assignments = buildQFCrossSeededAssignments(resolvedPoolCount, championshipRanks)
        for (const { poolIdx, rankIdx } of assignments) {
          if (qfSlot > qfCapacity) break
          progressions.push({
            fromPhase: 'group-stage',
            fromPool: poolSlug(poolIdx),
            ranks: [championshipRanks[rankIdx]],
            toPhase: 'quarter-finals',
            toPool: `match-${Math.ceil(qfSlot / 2)}`,
            startSlot: qfSlot % 2 === 0 ? 2 : 1,
          })
          qfSlot += 1
        }
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

function directSlotOrdersForDynamicKnockout(options: FormatBuilderOptions) {
  const dynamic = buildDynamicKnockout(options.teamCount ?? 16)
  const totalMainSlots = dynamic.bracketSize
  const playInWinnerSlots = new Set(
    playInWinnerSlotOrders(dynamic.bracketSize, dynamic.playInMatchCount)
  )
  return Array.from({ length: totalMainSlots }, (_, index) => index + 1).filter(
    (slotOrder) => !playInWinnerSlots.has(slotOrder)
  )
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
    const playInTeamIds = options.playInTeamIds ?? []
    const playInTeamSet = new Set(playInTeamIds)

    if (phaseSlug === 'preliminary') {
      return playInTeamIds
        .slice(poolIndex * 2, poolIndex * 2 + 2)
        .map((teamId, index) => {
          const team = teams.find((candidate) => candidate.id === teamId)
          return team ? { team, slotOrder: index + 1 } : null
        })
        .filter((assignment): assignment is TeamAssignment => Boolean(assignment))
    }

    if (phaseSlug === knockoutRoundSlug(dynamic.bracketSize)) {
      const directTeams = teams.filter((team) => !playInTeamSet.has(team.id))
      const directSlotOrders = directSlotOrdersForDynamicKnockout({
        ...options,
        teamCount: teams.length,
      })
      return directSlotOrders
        .map((slotOrder, index) => ({ slotOrder, team: directTeams[index] }))
        .filter(
          ({ slotOrder }) =>
            Math.ceil(slotOrder / 2) === poolIndex + 1
        )
        .map(({ slotOrder, team }) => {
          return team ? { team, slotOrder: slotOrder % 2 === 0 ? 2 : 1 } : null
        })
        .filter((assignment): assignment is TeamAssignment => Boolean(assignment))
    }

    return []
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
  if (selectedBuilder.id === 'knockout-play-ins' && (resolvedOptions.playInTeamIds ?? []).length === 0) {
    const dynamic = buildDynamicKnockout(teams.length)
    resolvedOptions.playInTeamIds = teams
      .slice(0, dynamic.playInMatchCount * 2)
      .map((team) => team.id)
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
          metadata:
            phaseTemplate.phaseType === 'league' && leagueRepeatCount
              ? { league_repeat_count: leagueRepeatCount }
              : {},
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

