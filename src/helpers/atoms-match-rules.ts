export type PlayerId = `player-${number}`;

export type Position = {
  column: number;
  row: number;
};

export type BoardDimensions = {
  columns: number;
  rows: number;
};

export type NeutralAtomSetup = Position & {
  count: number;
};

export type DestructibleTileSetup = Position & {
  hitPoints: number;
};

export type BoardSizePreset = {
  columns: number;
  destructibleTiles?: readonly DestructibleTileSetup[];
  label: string;
  neutralAtoms?: readonly NeutralAtomSetup[];
  rows: number;
};

export type Player = {
  color: string;
  eliminated: boolean;
  hasTakenTurn: boolean;
  id: PlayerId;
  name: string;
};

type BaseTile = {
  atomCount: number;
  kind: 'tile';
  ownerId: PlayerId | null;
};

export type NormalTile = BaseTile & {
  hitPoints?: never;
};

export type DestructibleTile = BaseTile & {
  hitPoints: number;
};

export type Tile = NormalTile | DestructibleTile;

export type Hole = {
  kind: 'hole';
};

export type BoardCell = Hole | Tile;

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
  cells: BoardCell[];
  columns: number;
  players: Player[];
  rows: number;
  status: MatchStatus;
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
  { columns: 10, label: 'Large', rows: 10 },
  {
    columns: 8,
    label: 'Neutral',
    neutralAtoms: [
      { column: 3, count: 1, row: 2 },
      { column: 2, count: 1, row: 3 },
      { column: 5, count: 1, row: 4 },
      { column: 4, count: 1, row: 5 }
    ],
    rows: 8
  },
  {
    columns: 6,
    destructibleTiles: [
      { column: 1, hitPoints: 1, row: 0 },
      { column: 0, hitPoints: 1, row: 1 },
      { column: 4, hitPoints: 1, row: 0 },
      { column: 5, hitPoints: 1, row: 1 },
      { column: 0, hitPoints: 1, row: 4 },
      { column: 1, hitPoints: 1, row: 5 },
      { column: 5, hitPoints: 1, row: 4 },
      { column: 4, hitPoints: 1, row: 5 }
    ],
    label: 'Destructible',
    rows: 6
  }
] as const satisfies BoardSizePreset[];

export const PLAYER_DEFINITIONS = [
  { color: '#2563eb', id: 'player-1', name: 'Player 1' },
  { color: '#dc2626', id: 'player-2', name: 'Player 2' },
  { color: '#16a34a', id: 'player-3', name: 'Player 3' },
  { color: '#ca8a04', id: 'player-4', name: 'Player 4' }
] as const satisfies Array<Pick<Player, 'color' | 'id' | 'name'>>;

type CreateMatchOptions = {
  columns?: number;
  destructibleTiles?: readonly DestructibleTileSetup[];
  holes?: Position[];
  neutralAtoms?: readonly NeutralAtomSetup[];
  playerCount?: number;
  rows?: number;
};

export const isHole = (cell: BoardCell): cell is Hole => cell.kind === 'hole';

export const isDestructibleTile = (cell: BoardCell): cell is DestructibleTile =>
  !isHole(cell) && 'hitPoints' in cell;

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

export const cloneGame = (game: MatchState): MatchState => ({
  ...game,
  cells: game.cells.map(cell => ({ ...cell })),
  players: game.players.map(player => ({ ...player }))
});

export const positionKey = (position: Position) =>
  `${position.row}:${position.column}`;

const getCellIndex = (game: Pick<MatchState, 'columns'>, position: Position) =>
  position.row * game.columns + position.column;

export const indexToPosition = (
  game: Pick<MatchState, 'columns'>,
  index: number
): Position => ({
  column: index % game.columns,
  row: Math.floor(index / game.columns)
});

const createEmptyTile = (): Tile => ({
  atomCount: 0,
  kind: 'tile',
  ownerId: null
});

const createEmptyTileFromSource = (tile: Tile): Tile =>
  isDestructibleTile(tile)
    ? {
        atomCount: 0,
        hitPoints: tile.hitPoints - 1,
        kind: 'tile',
        ownerId: null
      }
    : createEmptyTile();

export const getCell = (game: MatchState, position: Position) => {
  assertPosition(game, position);
  return game.cells[getCellIndex(game, position)]!;
};

export const getTile = (game: MatchState, position: Position) => {
  const cell = getCell(game, position);
  if (isHole(cell)) {
    throw new Error(`Position is a hole: ${position.row},${position.column}`);
  }
  return cell;
};

export const getPlayablePositions = (game: MatchState) => {
  const positions: Position[] = [];

  for (let row = 0; row < game.rows; row += 1) {
    for (let column = 0; column < game.columns; column += 1) {
      const position = { column, row };
      if (!isHole(getCell(game, position))) {
        positions.push(position);
      }
    }
  }

  return positions;
};

export const getNeighbours = (game: MatchState, position: Position) => {
  const candidates = [
    { column: position.column, row: position.row - 1 },
    { column: position.column + 1, row: position.row },
    { column: position.column, row: position.row + 1 },
    { column: position.column - 1, row: position.row }
  ];

  return candidates.filter(candidate => {
    if (
      candidate.row < 0 ||
      candidate.row >= game.rows ||
      candidate.column < 0 ||
      candidate.column >= game.columns
    ) {
      return false;
    }

    return !isHole(getCell(game, candidate));
  });
};

export const getCapacity = (game: MatchState, position: Position) => {
  if (isHole(getCell(game, position))) {
    return 0;
  }
  return getNeighbours(game, position).length;
};

export const validateBoardTopology = (game: MatchState) => {
  if (game.cells.length !== game.rows * game.columns) {
    throw new Error('Board cell count does not match dimensions.');
  }

  for (const position of getPlayablePositions(game)) {
    const capacity = getNeighbours(game, position).length;
    if (capacity < 2) {
      throw new Error(
        `Tile at ${position.row},${position.column} has capacity ${capacity}; holes must leave every tile with capacity at least 2.`
      );
    }
  }
};

const validateNeutralAtom = (
  game: MatchState,
  neutralAtom: NeutralAtomSetup
) => {
  if (!Number.isInteger(neutralAtom.count) || neutralAtom.count < 1) {
    throw new Error('Neutral Atom count must be a positive integer.');
  }

  const tile = getTile(game, neutralAtom);
  if (tile.atomCount > 0 || tile.ownerId) {
    throw new Error(
      `Neutral Atom at ${neutralAtom.row},${neutralAtom.column} overlaps another atom.`
    );
  }

  if (neutralAtom.count >= getCapacity(game, neutralAtom)) {
    throw new Error(
      `Neutral Atom at ${neutralAtom.row},${neutralAtom.column} must be below Capacity.`
    );
  }
};

const validateDestructibleTile = (
  game: MatchState,
  destructibleTile: DestructibleTileSetup
) => {
  if (
    !Number.isInteger(destructibleTile.hitPoints) ||
    destructibleTile.hitPoints < 1 ||
    destructibleTile.hitPoints > 9
  ) {
    throw new Error('Destructible Tile hit points must be between 1 and 9.');
  }

  const tile = getTile(game, destructibleTile);
  if (tile.atomCount > 0 || tile.ownerId) {
    throw new Error(
      `Destructible Tile at ${destructibleTile.row},${destructibleTile.column} overlaps another atom.`
    );
  }
};

export const createMatch = ({
  columns = 8,
  destructibleTiles = [],
  holes = [],
  neutralAtoms = [],
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
  const cells: BoardCell[] = Array.from(
    { length: rows * columns },
    createEmptyTile
  );

  const match: MatchState = {
    activePlayerId: players[0]!.id,
    cells,
    columns,
    players,
    rows,
    status: 'playing',
    turnNumber: 0,
    winnerId: null
  };

  for (const hole of holes) {
    assertPosition(match, hole);
    match.cells[getCellIndex(match, hole)] = { kind: 'hole' };
  }

  validateBoardTopology(match);

  for (const destructibleTile of destructibleTiles) {
    assertPosition(match, destructibleTile);
    validateDestructibleTile(match, destructibleTile);
    getTile(match, destructibleTile).hitPoints = destructibleTile.hitPoints;
  }

  for (const neutralAtom of neutralAtoms) {
    assertPosition(match, neutralAtom);
    validateNeutralAtom(match, neutralAtom);
    getTile(match, neutralAtom).atomCount = neutralAtom.count;
  }

  return match;
};

export const isLegalPlacement = (game: MatchState, position: Position) => {
  if (game.status !== 'playing') {
    return false;
  }

  const cell = getCell(game, position);
  if (isHole(cell)) {
    return false;
  }

  return (
    (cell.ownerId === null && cell.atomCount === 0) ||
    cell.ownerId === game.activePlayerId
  );
};

export const getLegalPlacements = (game: MatchState) => {
  const moves: Position[] = [];

  for (const position of getPlayablePositions(game)) {
    if (isLegalPlacement(game, position)) {
      moves.push(position);
    }
  }

  return moves;
};

const findCriticalSources = (game: MatchState) => {
  const sources: Array<Position & { ownerId: PlayerId }> = [];

  for (const position of getPlayablePositions(game)) {
    const tile = getTile(game, position);
    if (tile.ownerId && tile.atomCount >= getCapacity(game, position)) {
      sources.push({ ...position, ownerId: tile.ownerId });
    }
  }

  return sources;
};

const getCascadeSignature = (
  game: MatchState,
  sources: Array<Position & { ownerId: PlayerId }>
) =>
  [
    game.cells
      .map(cell =>
        isHole(cell)
          ? 'hole'
          : `${cell.ownerId ?? 'none'}:${cell.atomCount}:${
              isDestructibleTile(cell) ? cell.hitPoints : 'solid'
            }`
      )
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
  game.cells.some(
    cell => !isHole(cell) && cell.ownerId === playerId && cell.atomCount > 0
  );

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

const removeDestroyedDestructibleTiles = (game: MatchState) => {
  for (let index = 0; index < game.cells.length; index += 1) {
    const cell = game.cells[index]!;
    if (isDestructibleTile(cell) && cell.hitPoints <= 0) {
      game.cells[index] = { kind: 'hole' };
    }
  }
};

const collapseUnsupportedTiles = (game: MatchState) => {
  let collapsed = false;

  while (true) {
    const unsupported = getPlayablePositions(game).filter(
      position => getCapacity(game, position) < 2
    );

    if (unsupported.length === 0) {
      return collapsed;
    }

    collapsed = true;
    for (const position of unsupported) {
      game.cells[getCellIndex(game, position)] = { kind: 'hole' };
    }
  }
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
      game.cells[getCellIndex(game, source)] = createEmptyTileFromSource(
        getTile(game, source)
      );
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

      if (isDestructibleTile(tile)) {
        tile.hitPoints -= incoming.length;
      }
      tile.atomCount += incoming.length;
      tile.ownerId = ownerId;
    }

    removeDestroyedDestructibleTiles(game);
    collapseUnsupportedTiles(game);

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
