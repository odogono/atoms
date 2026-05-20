import {
  BOARD_SIZE_PRESETS,
  cloneGame,
  createMatch,
  placeAtom,
  type MatchState,
  type PlayerId
} from './atoms-match-rules';
import {
  baselineMatchStrategy,
  type MatchStrategy
} from './atoms-match-strategy';

export const BENCHMARK_DECISIVE_WIN_RATE = 0.6;
export const BENCHMARK_SCORE_RATE = 0.5;
export const BENCHMARK_MIDGAME_DEPTHS = [0, 4, 8, 16, 32] as const;
const MAX_BENCHMARK_MIDGAME_DEPTH = BENCHMARK_MIDGAME_DEPTHS.at(-1)!;

export type StrategyBenchmarkCorpusEntry = {
  id: string;
  match: MatchState;
  source: 'generated-midgame' | 'snapshot';
};

export type StrategyDuelOutcome = 'baseline-win' | 'challenger-win' | 'draw';

export type StrategyDuelReason =
  | 'stalemate'
  | 'stalled'
  | 'turn-cap-reached'
  | 'won';

export type StrategyBenchmarkDuelResult = {
  baselineId: string;
  challengerId: string;
  challengerPlayerId: PlayerId;
  fixtureId: string;
  outcome: StrategyDuelOutcome;
  reason: StrategyDuelReason;
  score: number;
  turnsSimulated: number;
  winnerId: PlayerId | null;
};

type StrategyDuelOptions = {
  baseline: MatchStrategy;
  challenger: MatchStrategy;
  challengerPlayerId: PlayerId;
  fixtureId?: string;
  maxTurns?: number;
};

export type StrategyBenchmarkSummary = {
  baselineId: string;
  baselineWins: number;
  challengerDecisiveWinRate: number;
  challengerId: string;
  challengerScore: number;
  challengerScoreRate: number;
  challengerWins: number;
  decisiveGames: number;
  draws: number;
  passed: boolean;
  totalGames: number;
};

type StrategyBenchmarkOptions = {
  baselineId: string;
  challengerId: string;
};

const getPresetMatch = (preset: (typeof BOARD_SIZE_PRESETS)[number]) =>
  createMatch({
    columns: preset.columns,
    neutralAtoms: 'neutralAtoms' in preset ? preset.neutralAtoms : undefined,
    playerCount: 2,
    rows: preset.rows
  });

const isBenchmarkMidgameDepth = (turn: number) =>
  BENCHMARK_MIDGAME_DEPTHS.some(depth => depth === turn);

export const createBenchmarkCorpus = (): StrategyBenchmarkCorpusEntry[] => {
  const corpus: StrategyBenchmarkCorpusEntry[] = [];

  for (const [presetIndex, preset] of BOARD_SIZE_PRESETS.entries()) {
    let match = getPresetMatch(preset);

    for (let turn = 0; turn <= MAX_BENCHMARK_MIDGAME_DEPTH; turn += 1) {
      if (isBenchmarkMidgameDepth(turn)) {
        if (match.status === 'playing') {
          corpus.push({
            id: `preset-${presetIndex}-turn-${turn}`,
            match: cloneGame(match),
            source: 'generated-midgame'
          });
        }
      }

      if (turn === MAX_BENCHMARK_MIDGAME_DEPTH || match.status !== 'playing') {
        break;
      }

      const placement = baselineMatchStrategy.choosePlacement(match);
      if (!placement) {
        break;
      }
      match = placeAtom(match, placement).state;
    }
  }

  return corpus;
};

const getDuelStrategy = (
  playerId: PlayerId,
  challengerPlayerId: PlayerId,
  challenger: MatchStrategy,
  baseline: MatchStrategy
) => (playerId === challengerPlayerId ? challenger : baseline);

const getDuelOutcome = (
  winnerId: PlayerId,
  challengerPlayerId: PlayerId
): Pick<StrategyBenchmarkDuelResult, 'outcome' | 'score'> =>
  winnerId === challengerPlayerId
    ? { outcome: 'challenger-win', score: 1 }
    : { outcome: 'baseline-win', score: 0 };

const getDrawOutcome = (): Pick<
  StrategyBenchmarkDuelResult,
  'outcome' | 'score'
> => ({ outcome: 'draw', score: 0.5 });

export const runStrategyDuel = (
  startingMatch: MatchState,
  {
    baseline,
    challenger,
    challengerPlayerId,
    fixtureId = 'ad-hoc',
    maxTurns = 10_000
  }: StrategyDuelOptions
): StrategyBenchmarkDuelResult => {
  let match = cloneGame(startingMatch);
  let turnsSimulated = 0;

  while (match.status === 'playing') {
    if (turnsSimulated >= maxTurns) {
      return {
        ...getDrawOutcome(),
        baselineId: baseline.id,
        challengerId: challenger.id,
        challengerPlayerId,
        fixtureId,
        reason: 'turn-cap-reached',
        turnsSimulated,
        winnerId: null
      };
    }

    const strategy = getDuelStrategy(
      match.activePlayerId,
      challengerPlayerId,
      challenger,
      baseline
    );
    const placement = strategy.choosePlacement(match);
    if (!placement) {
      return {
        ...getDrawOutcome(),
        baselineId: baseline.id,
        challengerId: challenger.id,
        challengerPlayerId,
        fixtureId,
        reason: 'stalled',
        turnsSimulated,
        winnerId: null
      };
    }

    match = placeAtom(match, placement).state;
    turnsSimulated += 1;
  }

  const outcome =
    match.status === 'won' && match.winnerId
      ? getDuelOutcome(match.winnerId, challengerPlayerId)
      : getDrawOutcome();

  return {
    ...outcome,
    baselineId: baseline.id,
    challengerId: challenger.id,
    challengerPlayerId,
    fixtureId,
    reason: match.status === 'won' ? 'won' : 'stalemate',
    turnsSimulated,
    winnerId: match.winnerId
  };
};

export const runStrategyBenchmark = (
  duels: StrategyBenchmarkDuelResult[],
  { baselineId, challengerId }: StrategyBenchmarkOptions
): StrategyBenchmarkSummary => {
  const challengerWins = duels.filter(
    duel => duel.outcome === 'challenger-win'
  ).length;
  const baselineWins = duels.filter(
    duel => duel.outcome === 'baseline-win'
  ).length;
  const draws = duels.filter(duel => duel.outcome === 'draw').length;
  const decisiveGames = challengerWins + baselineWins;
  const challengerScore = duels.reduce((total, duel) => total + duel.score, 0);
  const challengerDecisiveWinRate =
    decisiveGames === 0 ? 0 : challengerWins / decisiveGames;
  const challengerScoreRate =
    duels.length === 0 ? 0 : challengerScore / duels.length;

  return {
    baselineId,
    baselineWins,
    challengerDecisiveWinRate,
    challengerId,
    challengerScore,
    challengerScoreRate,
    challengerWins,
    decisiveGames,
    draws,
    passed:
      challengerDecisiveWinRate >= BENCHMARK_DECISIVE_WIN_RATE &&
      challengerScoreRate > BENCHMARK_SCORE_RATE,
    totalGames: duels.length
  };
};
