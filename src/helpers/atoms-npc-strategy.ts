import {
  getCapacity,
  getLegalPlacements,
  getTile,
  placeAtom,
  type MatchState,
  type Position
} from './atoms-match-rules';

const scorePlacement = (
  match: MatchState,
  position: Position,
  beforeOwned: number,
  beforeOpponentAtoms: number
) => {
  const result = placeAtom(match, position);
  if (result.state.status === 'stalemate') {
    return -1_000_000 - position.row * 0.01 - position.column * 0.001;
  }

  const afterOwned = result.state.tiles.filter(
    tile => tile.ownerId === match.activePlayerId
  ).length;
  const afterOpponentAtoms = result.state.tiles.filter(
    tile => tile.ownerId && tile.ownerId !== match.activePlayerId
  ).length;
  const tile = getTile(match, position);
  const capacity = getCapacity(match, position);
  const createsExplosion = tile.atomCount + 1 >= capacity;

  return (
    (result.state.winnerId === match.activePlayerId ? 10_000 : 0) +
    (beforeOpponentAtoms - afterOpponentAtoms) * 120 +
    (afterOwned - beforeOwned) * 30 +
    result.waves.length * 20 +
    (createsExplosion ? 15 : 0) -
    (capacity - tile.atomCount) * 2 -
    position.row * 0.01 -
    position.column * 0.001
  );
};

export const chooseNpcPlacement = (match: MatchState): Position | null => {
  const legalPlacements = getLegalPlacements(match);
  if (legalPlacements.length === 0) {
    return null;
  }

  const beforeOwned = match.tiles.filter(
    tile => tile.ownerId === match.activePlayerId
  ).length;
  const beforeOpponentAtoms = match.tiles.filter(
    tile => tile.ownerId && tile.ownerId !== match.activePlayerId
  ).length;

  return legalPlacements
    .map(placement => ({
      placement,
      score: scorePlacement(match, placement, beforeOwned, beforeOpponentAtoms)
    }))
    .sort((a, b) => b.score - a.score)[0]!.placement;
};
