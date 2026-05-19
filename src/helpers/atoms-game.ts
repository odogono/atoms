export type PlayerId = `player-${number}`;

export type Position = {
  column: number;
  row: number;
};

export type BoardDimensions = {
  columns: number;
  rows: number;
};

export type BoardSizePreset = {
  columns: number;
  label: string;
  rows: number;
};

export type Player = {
  color: string;
  eliminated: boolean;
  hasTakenTurn: boolean;
  id: PlayerId;
  name: string;
};

export type Tile = {
  atomCount: number;
  ownerId: PlayerId | null;
};

export type ExplosionPath = {
  from: Position;
  ownerId: PlayerId;
  to: Position;
};

export type ExplosionWave = {
  paths: ExplosionPath[];
  sources: Array<Position & { ownerId: PlayerId }>;
};

export type GameStatus = 'playing' | 'won';

export type GameState = {
  activePlayerId: PlayerId;
  columns: number;
  players: Player[];
  rows: number;
  status: GameStatus;
  tiles: Tile[];
  turnNumber: number;
  winnerId: PlayerId | null;
};

export type ApplyMoveResult = {
  state: GameState;
  timeline: GameState[];
  waves: ExplosionWave[];
};

export const BOARD_SIZE_PRESETS = [
  { columns: 6, label: 'Small', rows: 6 },
  { columns: 8, label: 'Standard', rows: 8 },
  { columns: 10, label: 'Large', rows: 10 }
] as const satisfies BoardSizePreset[];

export const PLAYER_DEFINITIONS = [
  { color: '#2563eb', id: 'player-1', name: 'Player 1' },
  { color: '#dc2626', id: 'player-2', name: 'Player 2' },
  { color: '#16a34a', id: 'player-3', name: 'Player 3' },
  { color: '#ca8a04', id: 'player-4', name: 'Player 4' }
] as const satisfies Array<Pick<Player, 'color' | 'id' | 'name'>>;

type CreateGameOptions = {
  columns?: number;
  playerCount?: number;
  rows?: number;
};

const assertPosition = (game: GameState, position: Position) => {
  if (
    position.row < 0 ||
    position.row >= game.rows ||
    position.column < 0 ||
    position.column >= game.columns
  ) {
    throw new Error(
      `Position out of bounds: ${position.row},${position.column}`
    );
  }
};

const cloneGame = (game: GameState): GameState => ({
  ...game,
  players: game.players.map(player => ({ ...player })),
  tiles: game.tiles.map(tile => ({ ...tile }))
});

export const positionKey = (position: Position) =>
  `${position.row}:${position.column}`;

const getTileIndex = (game: Pick<GameState, 'columns'>, position: Position) =>
  position.row * game.columns + position.column;

export const createGame = ({
  columns = 8,
  playerCount = 2,
  rows = 8
}: CreateGameOptions = {}): GameState => {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error('Atoms supports between 2 and 4 players.');
  }

  const players = PLAYER_DEFINITIONS.slice(0, playerCount).map(player => ({
    ...player,
    eliminated: false,
    hasTakenTurn: false
  }));

  return {
    activePlayerId: players[0]!.id,
    columns,
    players,
    rows,
    status: 'playing',
    tiles: Array.from({ length: rows * columns }, () => ({
      atomCount: 0,
      ownerId: null
    })),
    turnNumber: 0,
    winnerId: null
  };
};

export const getTile = (game: GameState, position: Position) => {
  assertPosition(game, position);
  return game.tiles[getTileIndex(game, position)]!;
};

export const getNeighbours = (game: GameState, position: Position) => {
  const candidates = [
    { column: position.column, row: position.row - 1 },
    { column: position.column + 1, row: position.row },
    { column: position.column, row: position.row + 1 },
    { column: position.column - 1, row: position.row }
  ];

  return candidates.filter(
    candidate =>
      candidate.row >= 0 &&
      candidate.row < game.rows &&
      candidate.column >= 0 &&
      candidate.column < game.columns
  );
};

export const getCapacity = (game: GameState, position: Position) =>
  getNeighbours(game, position).length;

export const isLegalMove = (game: GameState, position: Position) => {
  if (game.status !== 'playing') {
    return false;
  }

  const tile = getTile(game, position);
  return tile.ownerId === null || tile.ownerId === game.activePlayerId;
};

export const getLegalMoves = (game: GameState) => {
  const moves: Position[] = [];

  for (let row = 0; row < game.rows; row += 1) {
    for (let column = 0; column < game.columns; column += 1) {
      const position = { column, row };
      if (isLegalMove(game, position)) {
        moves.push(position);
      }
    }
  }

  return moves;
};

const findCriticalSources = (game: GameState) => {
  const sources: Array<Position & { ownerId: PlayerId }> = [];

  for (let row = 0; row < game.rows; row += 1) {
    for (let column = 0; column < game.columns; column += 1) {
      const position = { column, row };
      const tile = getTile(game, position);
      if (tile.ownerId && tile.atomCount >= getCapacity(game, position)) {
        sources.push({ ...position, ownerId: tile.ownerId });
      }
    }
  }

  return sources;
};

const chooseIncomingOwner = (
  game: GameState,
  activePlayerId: PlayerId,
  ownerIds: PlayerId[]
) => {
  const counts = new Map<PlayerId, number>();
  for (const ownerId of ownerIds) {
    counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
  }

  const playerOrder = game.players.map(player => player.id);
  return ownerIds.slice().sort((a, b) => {
    const countDifference = counts.get(b)! - counts.get(a)!;
    if (countDifference !== 0) {
      return countDifference;
    }
    if (a === activePlayerId) {
      return -1;
    }
    if (b === activePlayerId) {
      return 1;
    }
    return playerOrder.indexOf(a) - playerOrder.indexOf(b);
  })[0]!;
};

const resolveCascades = (
  game: GameState,
  activePlayerId: PlayerId
): { timeline: GameState[]; waves: ExplosionWave[] } => {
  const timeline: GameState[] = [];
  const waves: ExplosionWave[] = [];
  let sources = findCriticalSources(game);

  while (sources.length > 0) {
    const paths = sources.flatMap(source =>
      getNeighbours(game, source).map(to => ({
        from: { column: source.column, row: source.row },
        ownerId: source.ownerId,
        to
      }))
    );

    for (const source of sources) {
      game.tiles[getTileIndex(game, source)] = {
        atomCount: 0,
        ownerId: null
      };
    }

    const incomingByTile = new Map<string, ExplosionPath[]>();
    for (const path of paths) {
      const key = positionKey(path.to);
      const existing = incomingByTile.get(key);
      if (existing) {
        existing.push(path);
      } else {
        incomingByTile.set(key, [path]);
      }
    }

    for (const incoming of incomingByTile.values()) {
      const destination = incoming[0]!.to;
      const tile = getTile(game, destination);
      const ownerId = chooseIncomingOwner(
        game,
        activePlayerId,
        incoming.map(path => path.ownerId)
      );

      tile.atomCount += incoming.length;
      tile.ownerId = ownerId;
    }

    waves.push({ paths, sources });
    timeline.push(cloneGame(game));
    sources = findCriticalSources(game);
  }

  return { timeline, waves };
};

const playerOwnsAnyAtoms = (game: GameState, playerId: PlayerId) =>
  game.tiles.some(tile => tile.ownerId === playerId && tile.atomCount > 0);

const finishTurn = (game: GameState) => {
  for (const player of game.players) {
    if (player.hasTakenTurn && !playerOwnsAnyAtoms(game, player.id)) {
      player.eliminated = true;
    }
  }

  const remainingPlayers = game.players.filter(player => !player.eliminated);
  if (remainingPlayers.length === 1) {
    game.status = 'won';
    game.winnerId = remainingPlayers[0]!.id;
    return;
  }

  const activeIndex = game.players.findIndex(
    player => player.id === game.activePlayerId
  );

  for (let offset = 1; offset <= game.players.length; offset += 1) {
    const nextPlayer =
      game.players[(activeIndex + offset) % game.players.length]!;
    if (!nextPlayer.eliminated) {
      game.activePlayerId = nextPlayer.id;
      break;
    }
  }
};

export const applyMove = (
  game: GameState,
  position: Position
): ApplyMoveResult => {
  if (!isLegalMove(game, position)) {
    throw new Error('Illegal move.');
  }

  const next = cloneGame(game);
  const activePlayer = next.players.find(
    player => player.id === next.activePlayerId
  )!;
  const tile = getTile(next, position);

  tile.atomCount += 1;
  tile.ownerId = activePlayer.id;
  activePlayer.hasTakenTurn = true;
  next.turnNumber += 1;

  const timeline = [cloneGame(next)];
  const cascade = resolveCascades(next, activePlayer.id);
  finishTurn(next);
  timeline.push(...cascade.timeline, cloneGame(next));

  return { state: next, timeline, waves: cascade.waves };
};

const scoreMove = (
  game: GameState,
  position: Position,
  beforeOwned: number,
  beforeOpponentAtoms: number
) => {
  const result = applyMove(game, position);
  const afterOwned = result.state.tiles.filter(
    tile => tile.ownerId === game.activePlayerId
  ).length;
  const afterOpponentAtoms = result.state.tiles.filter(
    tile => tile.ownerId && tile.ownerId !== game.activePlayerId
  ).length;
  const tile = getTile(game, position);
  const capacity = getCapacity(game, position);
  const createsExplosion = tile.atomCount + 1 >= capacity;

  return (
    (result.state.winnerId === game.activePlayerId ? 10_000 : 0) +
    (beforeOpponentAtoms - afterOpponentAtoms) * 120 +
    (afterOwned - beforeOwned) * 30 +
    result.waves.length * 20 +
    (createsExplosion ? 15 : 0) -
    (capacity - tile.atomCount) * 2 -
    position.row * 0.01 -
    position.column * 0.001
  );
};

export const chooseNpcMove = (game: GameState) => {
  const legalMoves = getLegalMoves(game);
  if (legalMoves.length === 0) {
    return null;
  }

  const beforeOwned = game.tiles.filter(
    tile => tile.ownerId === game.activePlayerId
  ).length;
  const beforeOpponentAtoms = game.tiles.filter(
    tile => tile.ownerId && tile.ownerId !== game.activePlayerId
  ).length;

  return legalMoves
    .map(move => ({
      move,
      score: scoreMove(game, move, beforeOwned, beforeOpponentAtoms)
    }))
    .sort((a, b) => b.score - a.score)[0]!.move;
};
