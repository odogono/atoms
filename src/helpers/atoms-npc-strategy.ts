import {
  getCapacity,
  getLegalPlacements,
  getTile,
  isHole,
  placeAtom,
  type MatchState,
  type Position
} from './atoms-match-rules';

const countCells = (cells: MatchState['cells'], activePlayerId: string) => {
  let owned = 0;
  let opponentAtoms = 0;
  let neutralAtoms = 0;
  for (const cell of cells) {
    if (isHole(cell)) continue;
    if (cell.ownerId === activePlayerId) owned += 1;
    else if (cell.ownerId) opponentAtoms += 1;
    else if (cell.atomCount > 0) neutralAtoms += 1;
  }
  return { neutralAtoms, opponentAtoms, owned };
};

const scorePlacement = (
  match: MatchState,
  position: Position,
  beforeOwned: number,
  beforeNeutralAtoms: number,
  beforeOpponentAtoms: number
) => {
  const result = placeAtom(match, position);
  if (result.state.status === 'stalemate') {
    return -1_000_000 - position.row * 0.01 - position.column * 0.001;
  }

  const {
    neutralAtoms: afterNeutralAtoms,
    opponentAtoms: afterOpponentAtoms,
    owned: afterOwned
  } = countCells(result.state.cells, match.activePlayerId);
  const tile = getTile(match, position);
  const capacity = getCapacity(match, position);
  const createsExplosion = tile.atomCount + 1 >= capacity;

  return (
    (result.state.winnerId === match.activePlayerId ? 10_000 : 0) +
    (beforeOpponentAtoms - afterOpponentAtoms) * 120 +
    (beforeNeutralAtoms - afterNeutralAtoms) * 55 +
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

  const {
    neutralAtoms: beforeNeutralAtoms,
    opponentAtoms: beforeOpponentAtoms,
    owned: beforeOwned
  } = countCells(match.cells, match.activePlayerId);

  return legalPlacements
    .map(placement => ({
      placement,
      score: scorePlacement(
        match,
        placement,
        beforeOwned,
        beforeNeutralAtoms,
        beforeOpponentAtoms
      )
    }))
    .sort((a, b) => b.score - a.score)[0]!.placement;
};
