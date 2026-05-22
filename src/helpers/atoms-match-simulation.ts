import {
  cloneGame,
  executeMatchAction,
  type MatchState,
  type MatchStatus,
  type PlayerId
} from './atoms-match-rules';
import {
  getBoardControl,
  getCompletedRounds,
  getCriticalPressure,
  type MatchMetric
} from './atoms-match-stats';
import {
  defaultNpcMatchStrategy,
  type MatchStrategy
} from './atoms-match-strategy';

export const DEFAULT_MAX_SIMULATION_TURNS = 10_000;

export type MatchSimulationOutcome =
  | 'stalemate'
  | 'stalled'
  | 'turn-cap-reached'
  | 'won';

type SimulateNpcMatchOptions = {
  maxTurns?: number;
  strategy?: MatchStrategy;
};

export type MatchSimulationResult = {
  boardControlDelta: MatchMetric;
  completedRounds: number;
  endingTurnNumber: number;
  finalBoardControl: MatchMetric;
  finalCriticalPressure: MatchMetric;
  finalMatch: MatchState;
  finalStatus: MatchStatus;
  maxCascadeWaves: number;
  maxTurns: number;
  outcome: MatchSimulationOutcome;
  stalledPlayerId: PlayerId | null;
  startingTurnNumber: number;
  strategyId: string;
  totalExplosionWaves: number;
  turnsSimulated: number;
  winnerId: PlayerId | null;
};

const getMetricValueByPlayer = (metric: MatchMetric) =>
  new Map(metric.players.map(player => [player.playerId, player]));

const getBoardControlDelta = (
  initial: MatchMetric,
  finalMetric: MatchMetric
): MatchMetric => {
  const initialPlayers = getMetricValueByPlayer(initial);

  return {
    players: finalMetric.players.map(player => {
      const initialPlayer = initialPlayers.get(player.playerId);

      return {
        playerId: player.playerId,
        share: player.share - (initialPlayer?.share ?? 0),
        value: player.value - (initialPlayer?.value ?? 0)
      };
    }),
    total: finalMetric.total - initial.total
  };
};

const getTerminalOutcome = (
  match: MatchState
): Extract<MatchSimulationOutcome, 'stalemate' | 'won'> =>
  match.status === 'won' ? 'won' : 'stalemate';

const buildResult = ({
  finalMatch,
  initialBoardControl,
  maxCascadeWaves,
  maxTurns,
  outcome,
  stalledPlayerId,
  startingTurnNumber,
  strategy,
  totalExplosionWaves,
  turnsSimulated
}: {
  finalMatch: MatchState;
  initialBoardControl: MatchMetric;
  maxCascadeWaves: number;
  maxTurns: number;
  outcome: MatchSimulationOutcome;
  stalledPlayerId: PlayerId | null;
  startingTurnNumber: number;
  strategy: MatchStrategy;
  totalExplosionWaves: number;
  turnsSimulated: number;
}): MatchSimulationResult => {
  const finalBoardControl = getBoardControl(finalMatch);

  return {
    boardControlDelta: getBoardControlDelta(
      initialBoardControl,
      finalBoardControl
    ),
    completedRounds: getCompletedRounds(finalMatch),
    endingTurnNumber: finalMatch.turnNumber,
    finalBoardControl,
    finalCriticalPressure: getCriticalPressure(finalMatch),
    finalMatch,
    finalStatus: finalMatch.status,
    maxCascadeWaves,
    maxTurns,
    outcome,
    stalledPlayerId,
    startingTurnNumber,
    strategyId: strategy.id,
    totalExplosionWaves,
    turnsSimulated,
    winnerId: finalMatch.winnerId
  };
};

export const simulateNpcMatch = (
  match: MatchState,
  {
    maxTurns = DEFAULT_MAX_SIMULATION_TURNS,
    strategy = defaultNpcMatchStrategy
  }: SimulateNpcMatchOptions = {}
): MatchSimulationResult => {
  if (!Number.isInteger(maxTurns) || maxTurns < 0) {
    throw new Error('maxTurns must be a non-negative integer.');
  }

  const initialBoardControl = getBoardControl(match);
  const startingTurnNumber = match.turnNumber;
  let finalMatch = cloneGame(match);
  let maxCascadeWaves = 0;
  let totalExplosionWaves = 0;
  let turnsSimulated = 0;

  while (finalMatch.status === 'playing') {
    if (turnsSimulated >= maxTurns) {
      return buildResult({
        finalMatch,
        initialBoardControl,
        maxCascadeWaves,
        maxTurns,
        outcome: 'turn-cap-reached',
        stalledPlayerId: null,
        startingTurnNumber,
        strategy,
        totalExplosionWaves,
        turnsSimulated
      });
    }

    const action = strategy.chooseAction(finalMatch);
    if (!action) {
      return buildResult({
        finalMatch,
        initialBoardControl,
        maxCascadeWaves,
        maxTurns,
        outcome: 'stalled',
        stalledPlayerId: finalMatch.activePlayerId,
        startingTurnNumber,
        strategy,
        totalExplosionWaves,
        turnsSimulated
      });
    }

    const result = executeMatchAction(finalMatch, action);
    turnsSimulated += 1;
    totalExplosionWaves += result.waves.length;
    maxCascadeWaves = Math.max(maxCascadeWaves, result.waves.length);
    finalMatch = result.state;
  }

  return buildResult({
    finalMatch,
    initialBoardControl,
    maxCascadeWaves,
    maxTurns,
    outcome: getTerminalOutcome(finalMatch),
    stalledPlayerId: null,
    startingTurnNumber,
    strategy,
    totalExplosionWaves,
    turnsSimulated
  });
};
