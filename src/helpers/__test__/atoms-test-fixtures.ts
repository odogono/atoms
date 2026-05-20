import {
  validateBoardTopology,
  type MatchState,
  type PlayerId,
  type Position
} from '../atoms-match-rules';

type SeedTile = {
  column: number;
  count: number;
  hitPoints?: number;
  ownerId: PlayerId | null;
  row: number;
};

export const seedBoard = (match: MatchState, tiles: SeedTile[]) => {
  const next: MatchState = {
    ...match,
    cells: match.cells.map(cell => ({ ...cell }))
  };

  for (const tile of tiles) {
    next.cells[tile.row * match.columns + tile.column] = {
      atomCount: tile.count,
      ...(tile.hitPoints ? { hitPoints: tile.hitPoints } : {}),
      kind: 'tile',
      ownerId: tile.ownerId
    };
  }

  return next;
};

export const seedHoles = (match: MatchState, holes: Position[]) => {
  const next: MatchState = {
    ...match,
    cells: match.cells.map(cell => ({ ...cell }))
  };

  for (const hole of holes) {
    next.cells[hole.row * match.columns + hole.column] = { kind: 'hole' };
  }

  validateBoardTopology(next);
  return next;
};

export const withPlayersHavingTakenTurns = (match: MatchState): MatchState => ({
  ...match,
  players: match.players.map(player => ({
    ...player,
    hasTakenTurn: true
  }))
});
