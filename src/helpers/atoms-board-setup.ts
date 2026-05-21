import {
  BOARD_SIZE_PRESETS,
  PLAYER_DEFINITIONS,
  createMatch,
  positionKey,
  type BoardCell,
  type BoardSizePreset,
  type DestructibleTileSetup,
  type MatchState,
  type NeutralAtomSetup,
  type Position
} from './atoms-match-rules';

const BOARD_SETUP_STORAGE_KEY = 'atoms.boardSetups.v1';
const BOARD_SETUP_DOCUMENT_VERSION = 1;
const BOARD_SETUP_MIN_SIZE = 4;
const BOARD_SETUP_MAX_SIZE = 12;

export type BoardSetup = {
  columns: number;
  destructibleTiles: DestructibleTileSetup[];
  holes: Position[];
  id: string;
  name: string;
  neutralAtoms: NeutralAtomSetup[];
  rows: number;
};

type BoardSetupDocument = {
  boardSetup: BoardSetup;
  version: typeof BOARD_SETUP_DOCUMENT_VERSION;
};

type ParseBoardSetupDocumentResult =
  | { boardSetup: BoardSetup; ok: true }
  | { errors: string[]; ok: false };

export type BoardSetupTool = 'destructible' | 'empty' | 'hole' | 'neutral';

type BoardSetupToolEdit = {
  destructibleHitPoints?: number;
  neutralAtomCount?: number;
  position: Position;
  tool: BoardSetupTool;
};

type BoardSetupToolResult = { ok: true; setup: BoardSetup };

type CreateBlankBoardSetupOptions = {
  columns?: number;
  destructibleTiles?: DestructibleTileSetup[];
  holes?: Position[];
  id?: string;
  name?: string;
  neutralAtoms?: NeutralAtomSetup[];
  rows?: number;
};

type CreateMatchFromBoardSetupOptions = {
  playerCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clonePositions = (positions: readonly Position[]) =>
  positions.map(position => ({ ...position }));

const cloneNeutralAtoms = (neutralAtoms: readonly NeutralAtomSetup[]) =>
  neutralAtoms.map(neutralAtom => ({ ...neutralAtom }));

const cloneDestructibleTiles = (
  destructibleTiles: readonly DestructibleTileSetup[]
) => destructibleTiles.map(destructibleTile => ({ ...destructibleTile }));

export const createBoardSetupId = () =>
  `setup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const createBlankBoardSetup = ({
  columns = 8,
  destructibleTiles = [],
  holes = [],
  id = createBoardSetupId(),
  name = 'Untitled Board',
  neutralAtoms = [],
  rows = 8
}: CreateBlankBoardSetupOptions = {}): BoardSetup => ({
  columns,
  destructibleTiles: cloneDestructibleTiles(destructibleTiles),
  holes: clonePositions(holes),
  id,
  name,
  neutralAtoms: cloneNeutralAtoms(neutralAtoms),
  rows
});

const cloneBoardSetup = (setup: BoardSetup): BoardSetup => ({
  ...setup,
  destructibleTiles: cloneDestructibleTiles(setup.destructibleTiles),
  holes: clonePositions(setup.holes),
  neutralAtoms: cloneNeutralAtoms(setup.neutralAtoms)
});

export const getBuiltInBoardSetups = (): BoardSetup[] =>
  BOARD_SIZE_PRESETS.map((preset, index) =>
    createBoardSetupFromPreset(preset, index)
  );

export const createBoardSetupFromPreset = (
  preset: BoardSizePreset,
  index: number
): BoardSetup =>
  createBlankBoardSetup({
    columns: preset.columns,
    destructibleTiles: cloneDestructibleTiles(preset.destructibleTiles ?? []),
    holes: [],
    id: `preset-${index}`,
    name: preset.label,
    neutralAtoms: cloneNeutralAtoms(preset.neutralAtoms ?? []),
    rows: preset.rows
  });

export const createMatchFromBoardSetup = (
  setup: BoardSetup,
  { playerCount }: CreateMatchFromBoardSetupOptions
): MatchState =>
  createMatch({
    columns: setup.columns,
    destructibleTiles: setup.destructibleTiles,
    holes: setup.holes,
    neutralAtoms: setup.neutralAtoms,
    playerCount,
    rows: setup.rows
  });

export const createBoardSetupPreviewMatch = (
  setup: BoardSetup,
  { playerCount }: CreateMatchFromBoardSetupOptions
): MatchState => {
  const cellCount =
    setup.columns > 0 && setup.rows > 0 ? setup.columns * setup.rows : 0;
  const cells: BoardCell[] = Array.from({ length: cellCount }, () => ({
    atomCount: 0,
    kind: 'tile',
    ownerId: null
  }));
  const preview: MatchState = {
    activePlayerId: PLAYER_DEFINITIONS[0]!.id,
    cells,
    columns: setup.columns,
    players: PLAYER_DEFINITIONS.slice(0, playerCount).map(player => ({
      ...player,
      eliminated: false,
      hasTakenTurn: false
    })),
    rows: setup.rows,
    status: 'playing',
    turnNumber: 0,
    winnerId: null
  };

  for (const hole of setup.holes) {
    if (isInBounds(setup, hole)) {
      preview.cells[hole.row * setup.columns + hole.column] = {
        kind: 'hole'
      };
    }
  }

  for (const destructibleTile of setup.destructibleTiles) {
    if (isInBounds(setup, destructibleTile)) {
      const index =
        destructibleTile.row * setup.columns + destructibleTile.column;
      const cell = preview.cells[index];
      if (cell?.kind === 'tile') {
        preview.cells[index] = {
          ...cell,
          hitPoints: destructibleTile.hitPoints
        };
      }
    }
  }

  for (const neutralAtom of setup.neutralAtoms) {
    if (isInBounds(setup, neutralAtom)) {
      const index = neutralAtom.row * setup.columns + neutralAtom.column;
      const cell = preview.cells[index];
      if (cell?.kind === 'tile') {
        preview.cells[index] = {
          ...cell,
          atomCount: neutralAtom.count
        };
      }
    }
  }

  return preview;
};

const validateSize = (
  errors: string[],
  axis: 'columns' | 'rows',
  value: number
) => {
  if (
    !Number.isInteger(value) ||
    value < BOARD_SETUP_MIN_SIZE ||
    value > BOARD_SETUP_MAX_SIZE
  ) {
    errors.push(
      `Board Setup ${axis} must be between ${BOARD_SETUP_MIN_SIZE} and ${BOARD_SETUP_MAX_SIZE}.`
    );
  }
};

const isInBounds = (
  setup: Pick<BoardSetup, 'columns' | 'rows'>,
  position: Position
) =>
  position.row >= 0 &&
  position.row < setup.rows &&
  position.column >= 0 &&
  position.column < setup.columns;

const validatePosition = (
  setup: Pick<BoardSetup, 'columns' | 'rows'>,
  position: Position,
  errors: string[]
) => {
  if (
    !Number.isInteger(position.row) ||
    !Number.isInteger(position.column) ||
    !isInBounds(setup, position)
  ) {
    errors.push(
      `Position ${position.row},${position.column} is out of bounds.`
    );
    return false;
  }

  return true;
};

const validateUniquePosition = (
  seen: Set<string>,
  position: Position,
  label: string,
  errors: string[]
) => {
  const key = positionKey(position);
  if (seen.has(key)) {
    errors.push(`Duplicate ${label} at ${position.row},${position.column}.`);
    return false;
  }
  seen.add(key);
  return true;
};

export const validateBoardSetup = (setup: BoardSetup) => {
  const errors: string[] = [];

  if (typeof setup.id !== 'string' || setup.id.trim() === '') {
    errors.push('Board Setup id is required.');
  }
  if (typeof setup.name !== 'string' || setup.name.trim() === '') {
    errors.push('Board Setup name is required.');
  }

  validateSize(errors, 'columns', setup.columns);
  validateSize(errors, 'rows', setup.rows);
  if (errors.length > 0) {
    return { errors, ok: false as const };
  }

  const holeKeys = new Set<string>();
  for (const hole of setup.holes) {
    if (validatePosition(setup, hole, errors)) {
      validateUniquePosition(holeKeys, hole, 'Hole', errors);
    }
  }

  const neutralAtomKeys = new Set<string>();
  for (const neutralAtom of setup.neutralAtoms) {
    if (validatePosition(setup, neutralAtom, errors)) {
      validateUniquePosition(
        neutralAtomKeys,
        neutralAtom,
        'Neutral Atom',
        errors
      );
    }
    if (!Number.isInteger(neutralAtom.count) || neutralAtom.count < 1) {
      errors.push('Neutral Atom count must be a positive integer.');
    }
    if (holeKeys.has(positionKey(neutralAtom))) {
      errors.push(
        `Neutral Atom at ${neutralAtom.row},${neutralAtom.column} overlaps a Hole.`
      );
    }
  }

  const destructibleTileKeys = new Set<string>();
  for (const destructibleTile of setup.destructibleTiles) {
    if (validatePosition(setup, destructibleTile, errors)) {
      validateUniquePosition(
        destructibleTileKeys,
        destructibleTile,
        'Destructible Tile',
        errors
      );
    }
    if (
      !Number.isInteger(destructibleTile.hitPoints) ||
      destructibleTile.hitPoints < 1 ||
      destructibleTile.hitPoints > 9
    ) {
      errors.push('Destructible Tile Hit Points must be between 1 and 9.');
    }
    if (holeKeys.has(positionKey(destructibleTile))) {
      errors.push(
        `Destructible Tile at ${destructibleTile.row},${destructibleTile.column} overlaps a Hole.`
      );
    }
  }

  if (errors.length > 0) {
    return { errors, ok: false as const };
  }

  try {
    createMatchFromBoardSetup(setup, { playerCount: 2 });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return errors.length > 0
    ? { errors, ok: false as const }
    : { errors, ok: true as const };
};

const withoutPosition = <Entry extends Position>(
  entries: readonly Entry[],
  position: Position
) => entries.filter(entry => positionKey(entry) !== positionKey(position));

export const getNextNeutralAtomCount = (
  setup: Pick<BoardSetup, 'neutralAtoms'>,
  position: Position
) => {
  const currentCount =
    setup.neutralAtoms.find(
      entry => positionKey(entry) === positionKey(position)
    )?.count ?? 0;
  return (currentCount + 1) % 4;
};

export const applyBoardSetupTool = (
  setup: BoardSetup,
  edit: BoardSetupToolEdit
): BoardSetupToolResult => {
  const next = cloneBoardSetup(setup);
  next.holes = withoutPosition(next.holes, edit.position);

  switch (edit.tool) {
    case 'empty':
      next.neutralAtoms = withoutPosition(next.neutralAtoms, edit.position);
      next.destructibleTiles = withoutPosition(
        next.destructibleTiles,
        edit.position
      );
      break;
    case 'hole':
      next.holes = [...next.holes, { ...edit.position }];
      next.neutralAtoms = withoutPosition(next.neutralAtoms, edit.position);
      next.destructibleTiles = withoutPosition(
        next.destructibleTiles,
        edit.position
      );
      break;
    case 'neutral': {
      const count = edit.neutralAtomCount ?? 1;
      next.neutralAtoms =
        count === 0
          ? withoutPosition(next.neutralAtoms, edit.position)
          : [
              ...withoutPosition(next.neutralAtoms, edit.position),
              { ...edit.position, count }
            ];
      break;
    }
    case 'destructible':
      next.destructibleTiles = [
        ...withoutPosition(next.destructibleTiles, edit.position),
        { ...edit.position, hitPoints: edit.destructibleHitPoints ?? 1 }
      ];
      break;
  }

  return { ok: true, setup: next };
};

export const resizeBoardSetup = (
  setup: BoardSetup,
  dimensions: Pick<BoardSetup, 'columns' | 'rows'>
): BoardSetup => {
  const next = cloneBoardSetup(setup);
  next.columns = dimensions.columns;
  next.rows = dimensions.rows;
  next.holes = next.holes.filter(position => isInBounds(next, position));
  next.neutralAtoms = next.neutralAtoms.filter(position =>
    isInBounds(next, position)
  );
  next.destructibleTiles = next.destructibleTiles.filter(position =>
    isInBounds(next, position)
  );
  return next;
};

export const serializeBoardSetupDocument = (setup: BoardSetup) =>
  `${JSON.stringify(
    {
      boardSetup: cloneBoardSetup(setup),
      version: BOARD_SETUP_DOCUMENT_VERSION
    } satisfies BoardSetupDocument,
    null,
    2
  )}\n`;

const parsePosition = (
  value: unknown,
  label: string,
  errors: string[]
): Position | null => {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return null;
  }
  const { column, row } = value;
  if (!Number.isInteger(column) || !Number.isInteger(row)) {
    errors.push(`${label} must include integer row and column.`);
    return null;
  }
  return { column: column as number, row: row as number };
};

const parsePositions = (value: unknown, label: string, errors: string[]) => {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return [];
  }

  return value.flatMap((entry, index) => {
    const position = parsePosition(entry, `${label}[${index}]`, errors);
    return position ? [position] : [];
  });
};

const parseNeutralAtoms = (value: unknown, errors: string[]) => {
  if (!Array.isArray(value)) {
    errors.push('neutralAtoms must be an array.');
    return [];
  }

  return value.flatMap((entry, index): NeutralAtomSetup[] => {
    const position = parsePosition(entry, `neutralAtoms[${index}]`, errors);
    if (!position || !isRecord(entry)) {
      return [];
    }
    if (!Number.isInteger(entry.count)) {
      errors.push(`neutralAtoms[${index}].count must be an integer.`);
      return [];
    }
    return [{ ...position, count: entry.count as number }];
  });
};

const parseDestructibleTiles = (value: unknown, errors: string[]) => {
  if (!Array.isArray(value)) {
    errors.push('destructibleTiles must be an array.');
    return [];
  }

  return value.flatMap((entry, index): DestructibleTileSetup[] => {
    const position = parsePosition(
      entry,
      `destructibleTiles[${index}]`,
      errors
    );
    if (!position || !isRecord(entry)) {
      return [];
    }
    if (!Number.isInteger(entry.hitPoints)) {
      errors.push(`destructibleTiles[${index}].hitPoints must be an integer.`);
      return [];
    }
    return [{ ...position, hitPoints: entry.hitPoints as number }];
  });
};

const parseBoardSetupDocument = (
  input: unknown
): ParseBoardSetupDocumentResult => {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { errors: ['Board Setup document must be an object.'], ok: false };
  }
  if (input.version !== BOARD_SETUP_DOCUMENT_VERSION) {
    errors.push('Board Setup document version must be 1.');
  }
  if (!isRecord(input.boardSetup)) {
    errors.push('boardSetup must be an object.');
    return { errors, ok: false };
  }

  const source = input.boardSetup;
  if (typeof source.id !== 'string') {
    errors.push('boardSetup.id must be a string.');
  }
  if (typeof source.name !== 'string') {
    errors.push('boardSetup.name must be a string.');
  }
  const columnsIsInt = Number.isInteger(source.columns);
  const rowsIsInt = Number.isInteger(source.rows);
  if (!columnsIsInt) {
    errors.push('boardSetup.columns must be an integer.');
  }
  if (!rowsIsInt) {
    errors.push('boardSetup.rows must be an integer.');
  }
  if (
    columnsIsInt &&
    rowsIsInt &&
    (Number(source.columns) < 1 || Number(source.rows) < 1)
  ) {
    errors.push('boardSetup dimensions must be positive integers.');
  }

  const setup = createBlankBoardSetup({
    columns: Number(source.columns),
    destructibleTiles: parseDestructibleTiles(source.destructibleTiles, errors),
    holes: parsePositions(source.holes, 'holes', errors),
    id: typeof source.id === 'string' ? source.id : createBoardSetupId(),
    name: typeof source.name === 'string' ? source.name : 'Imported Board',
    neutralAtoms: parseNeutralAtoms(source.neutralAtoms, errors),
    rows: Number(source.rows)
  });

  if (
    columnsIsInt &&
    rowsIsInt &&
    Number(source.columns) > 0 &&
    Number(source.rows) > 0
  ) {
    for (const hole of setup.holes) {
      validatePosition(setup, hole, errors);
    }
    for (const neutralAtom of setup.neutralAtoms) {
      validatePosition(setup, neutralAtom, errors);
    }
    for (const destructibleTile of setup.destructibleTiles) {
      validatePosition(setup, destructibleTile, errors);
    }
  }

  return errors.length > 0
    ? { errors, ok: false }
    : { boardSetup: setup, ok: true };
};

export const parseBoardSetupDocumentJson = (
  source: string
): ParseBoardSetupDocumentResult => {
  try {
    return parseBoardSetupDocument(JSON.parse(source));
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : String(error)],
      ok: false
    };
  }
};

export const loadStoredBoardSetups = (storage: Storage): BoardSetup[] => {
  const raw = storage.getItem(BOARD_SETUP_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap(entry => {
      const parsed = parseBoardSetupDocument({
        boardSetup: entry,
        version: BOARD_SETUP_DOCUMENT_VERSION
      });
      return parsed.ok && validateBoardSetup(parsed.boardSetup).ok
        ? [parsed.boardSetup]
        : [];
    });
  } catch {
    return [];
  }
};

export const saveStoredBoardSetups = (
  storage: Storage,
  setups: readonly BoardSetup[]
) => {
  storage.setItem(BOARD_SETUP_STORAGE_KEY, JSON.stringify(setups));
};
