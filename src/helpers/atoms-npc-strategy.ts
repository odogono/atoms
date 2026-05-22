import {
  executeMatchAction,
  getCapacity,
  getLegalPlacements,
  getLegalShieldPlacements,
  getTile,
  isHole,
  placeAtom,
  shieldTile,
  type MatchAction,
  type MatchState,
  type PlayerId,
  type Position
} from './atoms-match-rules';

const TACTICAL_CANDIDATE_LIMIT = 8;

const comparePositions = (a: Position, b: Position) =>
  a.row - b.row || a.column - b.column;

const countCells = (cells: MatchState['cells'], activePlayerId: string) => {
  let owned = 0;
  let opponentAtoms = 0;
  let neutralAtoms = 0;
  for (const cell of cells) {
    if (isHole(cell)) {
      continue;
    }
    if (cell.ownerId === activePlayerId) {
      owned += 1;
    } else if (cell.ownerId) {
      opponentAtoms += 1;
    } else if (cell.atomCount > 0) {
      neutralAtoms += 1;
    }
  }
  return { neutralAtoms, opponentAtoms, owned };
};

const getPlayer = (match: MatchState, playerId: PlayerId) =>
  match.players.find(player => player.id === playerId)!;

const evaluateMatchForPlayer = (match: MatchState, playerId: PlayerId) => {
  if (match.status === 'won') {
    return match.winnerId === playerId ? 1_000_000 : -1_000_000;
  }

  if (match.status === 'stalemate') {
    return 0;
  }

  const player = getPlayer(match, playerId);
  if (player.eliminated) {
    return -1_000_000;
  }

  let ownedTiles = 0;
  let opponentTiles = 0;
  let ownedAtoms = 0;
  let opponentAtoms = 0;
  let neutralAtoms = 0;
  let ownedShields = 0;
  let opponentShields = 0;
  let ownedCriticalPressure = 0;
  let opponentCriticalPressure = 0;

  for (let row = 0; row < match.rows; row += 1) {
    for (let column = 0; column < match.columns; column += 1) {
      const position = { column, row };
      const cell = match.cells[row * match.columns + column]!;
      if (isHole(cell)) {
        continue;
      }

      if (!cell.ownerId) {
        neutralAtoms += cell.atomCount;
        continue;
      }

      const capacity = getCapacity(match, position);
      const pressure = cell.atomCount / capacity;
      if (cell.ownerId === playerId) {
        ownedTiles += 1;
        ownedAtoms += cell.atomCount;
        ownedShields += cell.shielded ? 1 : 0;
        ownedCriticalPressure += pressure;
      } else {
        opponentTiles += 1;
        opponentAtoms += cell.atomCount;
        opponentShields += cell.shielded ? 1 : 0;
        opponentCriticalPressure += pressure;
      }
    }
  }

  const legalPlacements = getLegalPlacements({
    ...match,
    activePlayerId: playerId
  }).length;

  return (
    ownedTiles * 90 +
    ownedAtoms * 35 +
    ownedShields * 260 +
    ownedCriticalPressure * 28 +
    legalPlacements * 2 -
    opponentTiles * 80 -
    opponentAtoms * 32 -
    opponentShields * 220 -
    opponentCriticalPressure * 22 -
    neutralAtoms * 4
  );
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

const scoreShieldAction = (match: MatchState, position: Position) => {
  const result = shieldTile(match, position);

  return (
    evaluateMatchForPlayer(result.state, match.activePlayerId) -
    position.row * 0.01 -
    position.column * 0.001
  );
};

const rankPlacements = (match: MatchState) => {
  const legalPlacements = getLegalPlacements(match);
  if (legalPlacements.length === 0) {
    return [];
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
    .sort(
      (a, b) => b.score - a.score || comparePositions(a.placement, b.placement)
    );
};

const rankActions = (match: MatchState) => {
  const placementActions = rankPlacements(match).map(entry => ({
    action: {
      position: entry.placement,
      type: 'place-atom'
    } satisfies MatchAction,
    score: entry.score
  }));
  const shieldActions = getLegalShieldPlacements(match).map(position => ({
    action: {
      position,
      type: 'shield-tile'
    } satisfies MatchAction,
    score: scoreShieldAction(match, position)
  }));

  return [...placementActions, ...shieldActions].sort(
    (a, b) =>
      b.score - a.score ||
      (a.action.type === b.action.type
        ? comparePositions(a.action.position, b.action.position)
        : a.action.type.localeCompare(b.action.type))
  );
};

export const chooseBaselineNpcPlacement = (
  match: MatchState
): Position | null => rankPlacements(match)[0]?.placement ?? null;

export const chooseBaselineNpcAction = (
  match: MatchState
): MatchAction | null => rankActions(match)[0]?.action ?? null;

const scoreTacticalAction = (match: MatchState, action: MatchAction) => {
  const playerId = match.activePlayerId;
  const result = executeMatchAction(match, action);

  if (result.state.status === 'stalemate') {
    return (
      -2_000_000 - action.position.row * 0.01 - action.position.column * 0.001
    );
  }

  if (result.state.status !== 'playing') {
    return evaluateMatchForPlayer(result.state, playerId);
  }

  const opponentReplies = rankActions(result.state).slice(
    0,
    TACTICAL_CANDIDATE_LIMIT
  );

  if (opponentReplies.length === 0) {
    return evaluateMatchForPlayer(result.state, playerId);
  }

  return Math.min(
    ...opponentReplies.map(reply =>
      evaluateMatchForPlayer(
        executeMatchAction(result.state, reply.action).state,
        playerId
      )
    )
  );
};

const scoreTacticalPlacement = (match: MatchState, position: Position) =>
  scoreTacticalAction(match, { position, type: 'place-atom' });

export const chooseTacticalNpcPlacement = (
  match: MatchState
): Position | null =>
  rankPlacements(match)
    .slice(0, TACTICAL_CANDIDATE_LIMIT)
    .map(({ placement }) => ({
      placement,
      score: scoreTacticalPlacement(match, placement)
    }))
    .sort(
      (a, b) => b.score - a.score || comparePositions(a.placement, b.placement)
    )[0]?.placement ?? null;

export const chooseTacticalNpcAction = (
  match: MatchState
): MatchAction | null =>
  rankActions(match)
    .slice(0, TACTICAL_CANDIDATE_LIMIT)
    .map(({ action }) => ({
      action,
      score: scoreTacticalAction(match, action)
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.action.type === b.action.type
          ? comparePositions(a.action.position, b.action.position)
          : a.action.type.localeCompare(b.action.type))
    )[0]?.action ?? null;

export const chooseNpcPlacement = chooseTacticalNpcPlacement;
export const chooseNpcAction = chooseTacticalNpcAction;
