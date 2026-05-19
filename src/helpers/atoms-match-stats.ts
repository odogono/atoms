import {
  getCapacity,
  indexToPosition,
  isHole,
  type MatchState,
  type PlayerId
} from './atoms-match-rules';

export type PlayerMetric = {
  playerId: PlayerId;
  share: number;
  value: number;
};

export type MatchMetric = {
  players: PlayerMetric[];
  total: number;
};

const createPlayerTotals = (match: MatchState) =>
  new Map(match.players.map(player => [player.id, 0]));

const formatMetric = (
  match: MatchState,
  totals: Map<PlayerId, number>
): MatchMetric => {
  let total = 0;
  for (const value of totals.values()) {
    total += value;
  }

  return {
    players: match.players.map(player => {
      const value = totals.get(player.id) ?? 0;
      return {
        playerId: player.id,
        share: total > 0 ? value / total : 0,
        value
      };
    }),
    total
  };
};

export const getCompletedRounds = (match: MatchState) => {
  const activePlayerCount = match.players.filter(
    player => !player.eliminated
  ).length;

  if (activePlayerCount === 0) {
    return 0;
  }

  return Math.floor(match.turnNumber / activePlayerCount);
};

export const getBoardControl = (match: MatchState): MatchMetric => {
  const totals = createPlayerTotals(match);

  for (const cell of match.cells) {
    if (isHole(cell) || !cell.ownerId) {
      continue;
    }

    totals.set(cell.ownerId, (totals.get(cell.ownerId) ?? 0) + 1);
  }

  return formatMetric(match, totals);
};

export const getCriticalPressure = (match: MatchState): MatchMetric => {
  const totals = createPlayerTotals(match);

  for (let index = 0; index < match.cells.length; index++) {
    const cell = match.cells[index]!;
    if (isHole(cell) || !cell.ownerId) {
      continue;
    }

    const position = indexToPosition(match, index);
    const capacity = getCapacity(match, position);
    if (capacity === 0) {
      continue;
    }

    totals.set(
      cell.ownerId,
      (totals.get(cell.ownerId) ?? 0) + cell.atomCount / capacity
    );
  }

  return formatMetric(match, totals);
};
