import {
  getCapacity,
  getCell,
  getPlayablePositions,
  getTile,
  indexToPosition,
  isDestructibleTile,
  isHole,
  positionKey,
  validateBoardTopology,
  type BoardCell,
  type DestructibleTileSetup,
  type MatchState,
  type MatchStatus,
  type Player,
  type PlayerId,
  type Position,
  type Ruleset
} from './atoms-match-rules';
import { type GameMode } from './atoms-mode';

export type SnapshotPlayer = Player & {
  token: string;
};

export type MatchSnapshot = {
  activePlayer: string;
  board: string[];
  destructibleTiles?: DestructibleTileSetup[];
  players: SnapshotPlayer[];
  shieldCharges?: Record<string, number>;
  shields?: Position[];
  status: MatchStatus;
  turnNumber: number;
  winner: string | null;
};

export type AtomsSnapshot = {
  match: MatchSnapshot;
  mode: GameMode;
  presetIndex: number | null;
  ruleset: Ruleset;
  version: 4;
};

export type ParseSnapshotResult =
  | { match: MatchState; ok: true; snapshot: AtomsSnapshot }
  | { errors: string[]; ok: false };

type SerializeMatchSnapshotInput = {
  match: MatchState;
  mode: GameMode;
  presetIndex: number | null;
};

const GAME_MODES = new Set<GameMode>(['local', 'npc', 'npc-vs-npc']);
const MATCH_STATUSES = new Set<MatchStatus>(['playing', 'stalemate', 'won']);
const RULESETS = new Set<Ruleset>(['classic', 'shielded']);
const CELL_TOKEN_LENGTH = 2;
const SNAPSHOT_VERSIONS = new Set([1, 2, 3, 4]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPlayerId = (value: string): value is PlayerId =>
  /^player-\d+$/.test(value);

const getSnapshotPlayers = (match: MatchState): SnapshotPlayer[] =>
  match.players.map((player, index) => ({
    ...player,
    token: String(index + 1)
  }));

const getTokenByPlayerId = (players: SnapshotPlayer[]) =>
  new Map(players.map(player => [player.id, player.token]));

const formatCell = (
  cell: BoardCell,
  tokenByPlayerId: Map<PlayerId, string>
) => {
  if (isHole(cell)) {
    return '..';
  }

  if (cell.atomCount === 0 && cell.ownerId === null) {
    return '[]';
  }

  if (cell.atomCount < 1 || cell.atomCount > 9) {
    throw new Error('Snapshot atom counts must be between 1 and 9.');
  }

  if (!cell.ownerId) {
    return `N${cell.atomCount}`;
  }

  const token = tokenByPlayerId.get(cell.ownerId);
  if (!token) {
    throw new Error(`Cannot serialize unknown player: ${cell.ownerId}`);
  }

  return `${token}${cell.atomCount}`;
};

const formatBoardRows = (
  match: MatchState,
  tokenByPlayerId: Map<PlayerId, string>
) =>
  Array.from({ length: match.rows }, (_, row) =>
    Array.from({ length: match.columns }, (_value, column) =>
      formatCell(getCell(match, { column, row }), tokenByPlayerId)
    ).join(' ')
  );

const getDestructibleTiles = (match: MatchState): DestructibleTileSetup[] => {
  const destructibleTiles: DestructibleTileSetup[] = [];

  for (let index = 0; index < match.cells.length; index += 1) {
    const cell = match.cells[index]!;
    if (!isDestructibleTile(cell)) {
      continue;
    }

    const position = indexToPosition(match, index);
    destructibleTiles.push({ ...position, hitPoints: cell.hitPoints });
  }

  return destructibleTiles;
};

const getShieldedTiles = (match: MatchState): Position[] => {
  const shields: Position[] = [];

  for (let index = 0; index < match.cells.length; index += 1) {
    const cell = match.cells[index]!;
    if (isHole(cell) || !cell.shielded) {
      continue;
    }

    shields.push(indexToPosition(match, index));
  }

  return shields;
};

const getSnapshotShieldCharges = (
  match: MatchState,
  tokenByPlayerId: Map<PlayerId, string>
) =>
  Object.fromEntries(
    match.players.map(player => [
      tokenByPlayerId.get(player.id)!,
      match.shieldCharges[player.id] ?? 0
    ])
  );

export const serializeMatchSnapshot = ({
  match,
  mode,
  presetIndex
}: SerializeMatchSnapshotInput): AtomsSnapshot => {
  const players = getSnapshotPlayers(match);
  const tokenByPlayerId = getTokenByPlayerId(players);
  const destructibleTiles = getDestructibleTiles(match);
  const shields = getShieldedTiles(match);

  return {
    match: {
      activePlayer: tokenByPlayerId.get(match.activePlayerId)!,
      board: formatBoardRows(match, tokenByPlayerId),
      ...(destructibleTiles.length > 0 ? { destructibleTiles } : {}),
      players,
      ...(match.ruleset === 'shielded'
        ? {
            shieldCharges: getSnapshotShieldCharges(match, tokenByPlayerId),
            ...(shields.length > 0 ? { shields } : {})
          }
        : {}),
      status: match.status,
      turnNumber: match.turnNumber,
      winner: match.winnerId
        ? (tokenByPlayerId.get(match.winnerId) ?? null)
        : null
    },
    mode,
    presetIndex,
    ruleset: match.ruleset,
    version: 4
  };
};

export const formatMatchSnapshot = (snapshot: AtomsSnapshot) =>
  `${JSON.stringify(snapshot, null, 2)}\n`;

const addError = (errors: string[], message: string) => {
  errors.push(message);
};

const parsePlayers = (
  value: unknown,
  errors: string[]
): SnapshotPlayer[] | null => {
  if (!Array.isArray(value) || value.length < 2) {
    addError(errors, 'match.players must contain at least two players.');
    return null;
  }

  const players: SnapshotPlayer[] = [];
  const tokens = new Set<string>();
  const ids = new Set<string>();

  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      addError(errors, `match.players[${index}] must be an object.`);
      continue;
    }

    const { color, eliminated, hasTakenTurn, id, name, token } = entry;

    if (typeof id !== 'string' || !isPlayerId(id)) {
      addError(errors, `match.players[${index}].id must be a player id.`);
      continue;
    }
    if (ids.has(id)) {
      addError(errors, `Duplicate player id: ${id}.`);
    }
    ids.add(id);

    if (typeof token !== 'string' || !/^\d$/.test(token)) {
      addError(errors, `match.players[${index}].token must be one digit.`);
      continue;
    }
    if (token !== id.replace('player-', '')) {
      addError(
        errors,
        `match.players[${index}].token must match its player id.`
      );
    }
    if (tokens.has(token)) {
      addError(errors, `Duplicate player token: ${token}.`);
    }
    tokens.add(token);

    if (
      typeof name !== 'string' ||
      typeof color !== 'string' ||
      typeof hasTakenTurn !== 'boolean' ||
      typeof eliminated !== 'boolean'
    ) {
      addError(errors, `match.players[${index}] has invalid player fields.`);
      continue;
    }

    players.push({
      color,
      eliminated,
      hasTakenTurn,
      id,
      name,
      token
    });
  }

  return players;
};

const tokenizeBoardRow = (row: string, rowIndex: number, errors: string[]) => {
  const compact = row.replaceAll(/\s+/g, '');
  if (compact.length % CELL_TOKEN_LENGTH !== 0) {
    addError(errors, `match.board[${rowIndex}] has an incomplete cell token.`);
    return [];
  }

  const cells: string[] = [];
  for (let index = 0; index < compact.length; index += CELL_TOKEN_LENGTH) {
    cells.push(compact.slice(index, index + CELL_TOKEN_LENGTH));
  }
  return cells;
};

const parseBoard = (
  board: unknown,
  playersByToken: Map<string, SnapshotPlayer>,
  version: number,
  errors: string[]
) => {
  if (!Array.isArray(board) || board.length === 0) {
    addError(errors, 'match.board must be a non-empty array of rows.');
    return null;
  }

  const cells: BoardCell[] = [];
  let columns: number | null = null;

  for (const [rowIndex, row] of board.entries()) {
    if (typeof row !== 'string') {
      addError(errors, `match.board[${rowIndex}] must be a string.`);
      continue;
    }

    const tokens = tokenizeBoardRow(row, rowIndex, errors);
    columns ??= tokens.length;
    if (tokens.length !== columns) {
      addError(errors, 'match.board rows must all have the same length.');
    }

    for (const token of tokens) {
      if (token === '[]') {
        cells.push({ atomCount: 0, kind: 'tile', ownerId: null });
        continue;
      }
      if (token === '..') {
        cells.push({ kind: 'hole' });
        continue;
      }

      const [playerToken, atomCountToken] = token;
      const atomCount = Number(atomCountToken);
      if (playerToken === 'N') {
        if (version < 2) {
          addError(
            errors,
            'Neutral Atom board tokens require snapshot version 2 or newer.'
          );
          continue;
        }

        if (!Number.isInteger(atomCount) || atomCount < 1) {
          addError(errors, `Invalid board cell token: ${token}.`);
          continue;
        }

        cells.push({ atomCount, kind: 'tile', ownerId: null });
        continue;
      }

      const player = playersByToken.get(playerToken ?? '');

      if (!player || !Number.isInteger(atomCount) || atomCount < 1) {
        addError(errors, `Invalid board cell token: ${token}.`);
        continue;
      }

      cells.push({ atomCount, kind: 'tile', ownerId: player.id });
    }
  }

  if (columns === null || columns === 0) {
    addError(errors, 'match.board must contain at least one cell per row.');
    return null;
  }

  return {
    cells,
    columns,
    rows: board.length
  };
};

const parseDestructibleTiles = (
  value: unknown,
  board: Pick<MatchState, 'cells' | 'columns' | 'rows'>,
  errors: string[]
): DestructibleTileSetup[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    addError(errors, 'match.destructibleTiles must be an array.');
    return [];
  }

  const seen = new Set<string>();
  const destructibleTiles: DestructibleTileSetup[] = [];

  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      addError(errors, `match.destructibleTiles[${index}] must be an object.`);
      continue;
    }

    const { column, hitPoints, row } = entry;
    if (
      !Number.isInteger(column) ||
      !Number.isInteger(row) ||
      !Number.isInteger(hitPoints) ||
      (hitPoints as number) < 1 ||
      (hitPoints as number) > 9
    ) {
      addError(errors, `Invalid Destructible Tile metadata at index ${index}.`);
      continue;
    }

    const position = { column: column as number, row: row as number };
    if (
      position.row < 0 ||
      position.row >= board.rows ||
      position.column < 0 ||
      position.column >= board.columns
    ) {
      addError(
        errors,
        `Destructible Tile at ${position.row},${position.column} is out of bounds.`
      );
      continue;
    }

    const key = `${position.row}:${position.column}`;
    if (seen.has(key)) {
      addError(
        errors,
        `Duplicate Destructible Tile at ${position.row},${position.column}.`
      );
      continue;
    }
    seen.add(key);

    const cell = board.cells[position.row * board.columns + position.column]!;
    if (isHole(cell)) {
      addError(
        errors,
        `Destructible Tile at ${position.row},${position.column} overlaps a hole.`
      );
      continue;
    }

    destructibleTiles.push({
      ...position,
      hitPoints: hitPoints as number
    });
  }

  return destructibleTiles;
};

const parseShieldCharges = (
  value: unknown,
  playersByToken: Map<string, SnapshotPlayer>,
  errors: string[]
): Partial<Record<PlayerId, number>> => {
  if (!isRecord(value)) {
    addError(errors, 'match.shieldCharges must be an object.');
    return {};
  }

  const shieldCharges: Partial<Record<PlayerId, number>> = {};

  for (const player of playersByToken.values()) {
    const charge = value[player.token];
    if (
      !Number.isInteger(charge) ||
      (charge as number) < 0 ||
      (charge as number) > 2
    ) {
      addError(
        errors,
        `match.shieldCharges.${player.token} must be an integer from 0 to 2.`
      );
      continue;
    }
    shieldCharges[player.id] = charge as number;
  }

  for (const token of Object.keys(value)) {
    if (!playersByToken.has(token)) {
      addError(
        errors,
        `match.shieldCharges contains unknown player token ${token}.`
      );
    }
  }

  return shieldCharges;
};

const parseShields = (
  value: unknown,
  board: Pick<MatchState, 'cells' | 'columns' | 'rows'>,
  errors: string[]
): Position[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    addError(errors, 'match.shields must be an array.');
    return [];
  }

  const seen = new Set<string>();
  const shields: Position[] = [];

  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      addError(errors, `match.shields[${index}] must be an object.`);
      continue;
    }

    const { column, row } = entry;
    if (!Number.isInteger(column) || !Number.isInteger(row)) {
      addError(errors, `Invalid Shield metadata at index ${index}.`);
      continue;
    }

    const position = { column: column as number, row: row as number };
    if (
      position.row < 0 ||
      position.row >= board.rows ||
      position.column < 0 ||
      position.column >= board.columns
    ) {
      addError(
        errors,
        `Shield at ${position.row},${position.column} is out of bounds.`
      );
      continue;
    }

    const key = positionKey(position);
    if (seen.has(key)) {
      addError(
        errors,
        `Duplicate Shield at ${position.row},${position.column}.`
      );
      continue;
    }
    seen.add(key);

    const cell = board.cells[position.row * board.columns + position.column]!;
    if (isHole(cell) || !cell.ownerId || cell.atomCount < 1) {
      addError(
        errors,
        `Shield at ${position.row},${position.column} must be on a Player-owned Tile.`
      );
      continue;
    }

    shields.push(position);
  }

  return shields;
};

const hasCriticalTile = (match: MatchState) =>
  getPlayablePositions(match).some(
    position =>
      getTile(match, position).atomCount >= getCapacity(match, position)
  );

export const parseMatchSnapshot = (input: unknown): ParseSnapshotResult => {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { errors: ['Snapshot must be an object.'], ok: false };
  }

  if (
    typeof input.version !== 'number' ||
    !SNAPSHOT_VERSIONS.has(input.version)
  ) {
    addError(errors, 'Snapshot version must be 1, 2, 3, or 4.');
  }

  const version = input.version as number;
  const ruleset =
    version < 4
      ? 'classic'
      : typeof input.ruleset === 'string' &&
          RULESETS.has(input.ruleset as Ruleset)
        ? (input.ruleset as Ruleset)
        : null;
  if (!ruleset) {
    addError(
      errors,
      'ruleset must be classic or shielded for version 4 snapshots.'
    );
  }

  if (
    typeof input.mode !== 'string' ||
    !GAME_MODES.has(input.mode as GameMode)
  ) {
    addError(errors, 'mode must be a known game mode.');
  }

  if (
    input.presetIndex !== null &&
    (typeof input.presetIndex !== 'number' ||
      !Number.isInteger(input.presetIndex) ||
      input.presetIndex < 0)
  ) {
    addError(errors, 'presetIndex must be a non-negative integer or null.');
  }

  if (!isRecord(input.match)) {
    addError(errors, 'match must be an object.');
    return { errors, ok: false };
  }

  const players = parsePlayers(input.match.players, errors);
  if (!players) {
    return { errors, ok: false };
  }

  const playersByToken = new Map(players.map(player => [player.token, player]));
  const activePlayer =
    typeof input.match.activePlayer === 'string'
      ? playersByToken.get(input.match.activePlayer)
      : null;
  if (!activePlayer) {
    addError(errors, 'match.activePlayer must reference a player token.');
  }

  if (
    typeof input.match.status !== 'string' ||
    !MATCH_STATUSES.has(input.match.status as MatchStatus)
  ) {
    addError(errors, 'match.status must be playing, stalemate, or won.');
  }

  const winner =
    typeof input.match.winner === 'string'
      ? playersByToken.get(input.match.winner)
      : null;
  if (input.match.winner !== null && !winner) {
    addError(errors, 'match.winner must be null or reference a player token.');
  }

  if (
    typeof input.match.turnNumber !== 'number' ||
    !Number.isInteger(input.match.turnNumber) ||
    input.match.turnNumber < 0
  ) {
    addError(errors, 'match.turnNumber must be a non-negative integer.');
  }

  const board = parseBoard(input.match.board, playersByToken, version, errors);
  if (errors.length > 0 || !board || !activePlayer) {
    return { errors, ok: false };
  }

  if (input.match.destructibleTiles !== undefined && version < 3) {
    addError(
      errors,
      'Destructible Tile metadata requires snapshot version 3 or newer.'
    );
  }

  if (
    ruleset === 'classic' &&
    (input.match.shields !== undefined ||
      input.match.shieldCharges !== undefined)
  ) {
    addError(errors, 'Shield metadata requires the shielded ruleset.');
  }

  if (ruleset === 'shielded' && input.match.shieldCharges === undefined) {
    addError(errors, 'Shielded snapshots require match.shieldCharges.');
  }

  const destructibleTiles = parseDestructibleTiles(
    input.match.destructibleTiles,
    board,
    errors
  );
  if (errors.length > 0) {
    return { errors, ok: false };
  }

  const shieldCharges =
    ruleset === 'shielded'
      ? parseShieldCharges(input.match.shieldCharges, playersByToken, errors)
      : Object.fromEntries(players.map(player => [player.id, 0]));
  const shields =
    ruleset === 'shielded'
      ? parseShields(input.match.shields, board, errors)
      : [];
  if (errors.length > 0) {
    return { errors, ok: false };
  }

  for (const destructibleTile of destructibleTiles) {
    const cell =
      board.cells[
        destructibleTile.row * board.columns + destructibleTile.column
      ];
    if (cell && !isHole(cell)) {
      cell.hitPoints = destructibleTile.hitPoints;
    }
  }

  const match: MatchState = {
    activePlayerId: activePlayer.id,
    cells: board.cells,
    columns: board.columns,
    players: players.map(({ token: _token, ...player }) => player),
    rows: board.rows,
    ruleset: ruleset ?? 'classic',
    shieldCharges,
    status: input.match.status as MatchStatus,
    turnNumber: input.match.turnNumber as number,
    winnerId: winner ? winner.id : null
  };

  for (const shield of shields) {
    const cell = getTile(match, shield);
    cell.shielded = true;
  }

  try {
    validateBoardTopology(match);
  } catch (error) {
    addError(errors, error instanceof Error ? error.message : String(error));
  }

  if (match.status === 'playing' && hasCriticalTile(match)) {
    addError(errors, 'playing snapshots must not contain critical tiles.');
  }

  if (errors.length > 0) {
    return { errors, ok: false };
  }

  const snapshot = serializeMatchSnapshot({
    match,
    mode: input.mode as GameMode,
    presetIndex: input.presetIndex as number | null
  });

  return { match, ok: true, snapshot };
};

export const parseMatchSnapshotJson = (source: string): ParseSnapshotResult => {
  try {
    return parseMatchSnapshot(JSON.parse(source));
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : String(error)],
      ok: false
    };
  }
};
