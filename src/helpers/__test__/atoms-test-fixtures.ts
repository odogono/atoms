import type { MatchState, PlayerId } from '../atoms-match-rules';

type SeedTile = {
  column: number;
  count: number;
  ownerId: PlayerId;
  row: number;
};

export const seedBoard = (match: MatchState, tiles: SeedTile[]) => {
  const next: MatchState = {
    ...match,
    tiles: match.tiles.map(tile => ({ ...tile }))
  };

  for (const tile of tiles) {
    next.tiles[tile.row * match.columns + tile.column] = {
      atomCount: tile.count,
      ownerId: tile.ownerId
    };
  }

  return next;
};

export const withPlayersHavingTakenTurns = (match: MatchState): MatchState => ({
  ...match,
  players: match.players.map(player => ({
    ...player,
    hasTakenTurn: true
  }))
});
