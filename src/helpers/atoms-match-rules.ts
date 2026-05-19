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

export type MatchStatus = 'playing' | 'stalemate' | 'won';

export type MatchState = {
  activePlayerId: PlayerId;
  columns: number;
  players: Player[];
  rows: number;
  status: MatchStatus;
  tiles: Tile[];
  turnNumber: number;
  winnerId: PlayerId | null;
};

export type PlaceAtomResult = {
  state: MatchState;
  timeline: MatchState[];
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

type CreateMatchOptions = {
  columns?: number;
  playerCount?: number;
  rows?: number;
};

const assertPosition = (game: MatchState, position: Position) => {
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

const cloneGame = (game: MatchState): MatchState => ({
  ...game,
  players: game.players.map(player => ({ ...player })),
  tiles: game.tiles.map(tile => ({ ...tile }))
});

export const positionKey = (position: Position) =>
  `${position.row}:${position.column}`;

const getTileIndex = (game: Pick<MatchState, 'columns'>, position: Position) =>
  position.row * game.columns + position.column;

export const createMatch = ({
  columns = 8,
  playerCount = 2,
  rows = 8
}: CreateMatchOptions = {}): MatchState => {
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

export const getTile = (game: MatchState, position: Position) => {
  assertPosition(game, position);
  return game.tiles[getTileIndex(game, position)]!;
};

export const getNeighbours = (game: MatchState, position: Position) => {
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

export const getCapacity = (game: MatchState, position: Position) =>
  getNeighbours(game, position).length;

export const isLegalPlacement = (game: MatchState, position: Position) => {
  if (game.status !== 'playing') {
    return false;
  }

  const tile = getTile(game, position);
  return tile.ownerId === null || tile.ownerId === game.activePlayerId;
};

export const getLegalPlacements = (game: MatchState) => {
  const moves: Position[] = [];

  for (let row = 0; row < game.rows; row += 1) {
    for (let column = 0; column < game.columns; column += 1) {
      const position = { column, row };
      if (isLegalPlacement(game, position)) {
        moves.push(position);
      }
    }
  }

  return moves;
};

const findCriticalSources = (game: MatchState) => {
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

const getCascadeSignature = (
  game: MatchState,
  sources: Array<Position & { ownerId: PlayerId }>
) =>
  [
    game.tiles
      .map(tile => `${tile.ownerId ?? 'none'}:${tile.atomCount}`)
      .join('|'),
    sources
      .map(source => `${source.row}:${source.column}:${source.ownerId}`)
      .join('|')
  ].join(' -> ');

const chooseIncomingOwner = (
  game: MatchState,
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

const playerOwnsAnyAtoms = (game: MatchState, playerId: PlayerId) =>
  game.tiles.some(tile => tile.ownerId === playerId && tile.atomCount > 0);

const eliminatePlayersWithoutAtoms = (game: MatchState) => {
  for (const player of game.players) {
    if (player.hasTakenTurn && !playerOwnsAnyAtoms(game, player.id)) {
      player.eliminated = true;
    }
  }
};

const declareVictoryIfOnlyOnePlayerRemains = (game: MatchState) => {
  const remainingPlayers = game.players.filter(player => !player.eliminated);
  if (remainingPlayers.length !== 1) {
    return false;
  }

  game.status = 'won';
  game.winnerId = remainingPlayers[0]!.id;
  return true;
};

const resolveEliminations = (game: MatchState) => {
  eliminatePlayersWithoutAtoms(game);
  return declareVictoryIfOnlyOnePlayerRemains(game);
};

const resolveCascades = (
  game: MatchState,
  activePlayerId: PlayerId
): { stalemated: boolean; timeline: MatchState[]; waves: ExplosionWave[] } => {
  const timeline: MatchState[] = [];
  const waves: ExplosionWave[] = [];
  const seenStates = new Set<string>();
  let sources = findCriticalSources(game);

  while (sources.length > 0) {
    const signature = getCascadeSignature(game, sources);
    if (seenStates.has(signature)) {
      game.status = 'stalemate';
      game.winnerId = null;
      return { stalemated: true, timeline, waves };
    }
    seenStates.add(signature);

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
    if (resolveEliminations(game)) {
      timeline.push(cloneGame(game));
      return { stalemated: false, timeline, waves };
    }

    timeline.push(cloneGame(game));
    sources = findCriticalSources(game);
  }

  return { stalemated: false, timeline, waves };
};

const finishTurn = (game: MatchState) => {
  if (game.status !== 'playing') {
    return;
  }

  if (resolveEliminations(game)) {
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

export const placeAtom = (
  game: MatchState,
  position: Position
): PlaceAtomResult => {
  if (!isLegalPlacement(game, position)) {
    throw new Error('Illegal placement.');
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
  if (!cascade.stalemated) {
    finishTurn(next);
  }
  timeline.push(...cascade.timeline, cloneGame(next));

  return { state: next, timeline, waves: cascade.waves };
};
