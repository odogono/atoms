import {
  cloneGame,
  createMatch,
  getLegalPlacements,
  isLegalPlacement,
  placeAtom,
  type ExplosionWave,
  type MatchState,
  type PlaceAtomResult,
  type PlayerId,
  type Position
} from './atoms-match-rules';

const GOLF_BEST_STROKES_STORAGE_KEY = 'atoms.golf.bestStrokes.v1';
const GOLF_PLAYER_ID: PlayerId = 'player-1';
const GOLF_TARGET_PLAYER_ID: PlayerId = 'player-2';

export type GolfHoleStatus = 'failed' | 'playing' | 'solved';

export type GolfHole = {
  id: string;
  name: string;
  solution: Position[];
  startingMatch: MatchState;
};

export type GolfCourse = {
  holes: GolfHole[];
  id: string;
  name: string;
};

export type GolfBestStrokes = Record<string, number>;

type GolfPlayback = {
  finalState: GolfFlowState;
  result: PlaceAtomResult;
  runId: number;
};

export type GolfFlowState = {
  bestStrokesByHole: GolfBestStrokes;
  course: GolfCourse;
  currentWave: ExplosionWave | null;
  holeIndex: number;
  illegalTile: Position | null;
  isResolving: boolean;
  lastWaves: ExplosionWave[];
  match: MatchState;
  playback: GolfPlayback | null;
  runId: number;
  status: GolfHoleStatus;
  strokes: number;
  strokesByHole: GolfBestStrokes;
};

type CreateGolfFlowStateOptions = {
  bestStrokesByHole?: GolfBestStrokes;
  course?: GolfCourse;
  holeIndex?: number;
};

type GolfTileSetup = Position & {
  count: number;
  ownerId: PlayerId | null;
};

type CreateGolfMatchOptions = {
  columns?: number;
  holes?: Position[];
  neutralAtoms?: Array<Position & { count: number }>;
  rows?: number;
  tiles: GolfTileSetup[];
};

type StoredGolfBestStrokes = Record<string, GolfBestStrokes>;

const createGolfMatch = ({
  columns = 4,
  holes = [],
  neutralAtoms = [],
  rows = 4,
  tiles
}: CreateGolfMatchOptions): MatchState => {
  const match = createMatch({
    columns,
    holes,
    neutralAtoms,
    playerCount: 2,
    rows
  });
  const next = cloneGame(match);

  for (const tile of tiles) {
    next.cells[tile.row * next.columns + tile.column] = {
      atomCount: tile.count,
      kind: 'tile',
      ownerId: tile.ownerId
    };
  }

  return {
    ...next,
    activePlayerId: GOLF_PLAYER_ID,
    players: next.players.map(player => ({
      ...player,
      hasTakenTurn: true
    }))
  };
};

const createHole = (
  id: string,
  name: string,
  match: MatchState,
  solution: Position[]
): GolfHole => ({
  id,
  name,
  solution,
  startingMatch: match
});

export const BUILT_IN_GOLF_COURSE: GolfCourse = {
  holes: [
    createHole(
      'opening-layup',
      'Opening Layup',
      createGolfMatch({
        tiles: [
          { column: 0, count: 1, ownerId: GOLF_PLAYER_ID, row: 0 },
          { column: 1, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 }
        ]
      }),
      [{ column: 0, row: 0 }]
    ),
    createHole(
      'edge-runner',
      'Edge Runner',
      createGolfMatch({
        tiles: [
          { column: 0, count: 1, ownerId: GOLF_PLAYER_ID, row: 0 },
          { column: 1, count: 2, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 },
          { column: 2, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 }
        ]
      }),
      [{ column: 0, row: 0 }]
    ),
    createHole(
      'cross-capture',
      'Cross Capture',
      createGolfMatch({
        tiles: [
          { column: 1, count: 3, ownerId: GOLF_PLAYER_ID, row: 1 },
          { column: 1, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 },
          { column: 2, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 1 },
          { column: 1, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 2 },
          { column: 0, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 1 }
        ]
      }),
      [{ column: 1, row: 1 }]
    ),
    createHole(
      'two-putt-corner',
      'Two-Putt Corner',
      createGolfMatch({
        tiles: [{ column: 1, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 }]
      }),
      [
        { column: 0, row: 0 },
        { column: 0, row: 0 }
      ]
    ),
    createHole(
      'neutral-rough',
      'Neutral Rough',
      createGolfMatch({
        neutralAtoms: [{ column: 3, count: 1, row: 3 }],
        tiles: [
          { column: 0, count: 1, ownerId: GOLF_PLAYER_ID, row: 0 },
          { column: 1, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 }
        ]
      }),
      [{ column: 0, row: 0 }]
    ),
    createHole(
      'long-edge',
      'Long Edge',
      createGolfMatch({
        tiles: [
          { column: 0, count: 1, ownerId: GOLF_PLAYER_ID, row: 0 },
          { column: 1, count: 2, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 },
          { column: 2, count: 2, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 },
          { column: 3, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 }
        ]
      }),
      [{ column: 0, row: 0 }]
    ),
    createHole(
      'build-and-release',
      'Build And Release',
      createGolfMatch({
        tiles: [
          { column: 1, count: 2, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 },
          { column: 2, count: 2, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 }
        ]
      }),
      [
        { column: 0, row: 0 },
        { column: 0, row: 0 }
      ]
    ),
    createHole(
      'broken-fairway',
      'Broken Fairway',
      createGolfMatch({
        holes: [{ column: 1, row: 1 }],
        tiles: [
          { column: 0, count: 1, ownerId: GOLF_PLAYER_ID, row: 0 },
          { column: 1, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 },
          { column: 2, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 }
        ]
      }),
      [{ column: 0, row: 0 }]
    ),
    createHole(
      'final-cascade',
      'Final Cascade',
      createGolfMatch({
        neutralAtoms: [{ column: 3, count: 1, row: 3 }],
        tiles: [
          { column: 0, count: 1, ownerId: GOLF_PLAYER_ID, row: 0 },
          { column: 1, count: 2, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 },
          { column: 2, count: 2, ownerId: GOLF_TARGET_PLAYER_ID, row: 0 },
          { column: 2, count: 3, ownerId: GOLF_TARGET_PLAYER_ID, row: 1 },
          { column: 2, count: 1, ownerId: GOLF_TARGET_PLAYER_ID, row: 2 }
        ]
      }),
      [{ column: 0, row: 0 }]
    )
  ],
  id: 'front-nine',
  name: 'Front Nine'
};

export const getRemainingGolfTargetAtoms = (match: MatchState) =>
  match.cells.reduce(
    (total, cell) =>
      cell.kind === 'tile' && cell.ownerId === GOLF_TARGET_PLAYER_ID
        ? total + cell.atomCount
        : total,
    0
  );

const prepareGolfTurn = (match: MatchState): MatchState => {
  const next = cloneGame(match);
  next.activePlayerId = GOLF_PLAYER_ID;

  if (next.status === 'won' && getRemainingGolfTargetAtoms(next) > 0) {
    next.status = 'playing';
    next.winnerId = null;
  }

  return next;
};

const getGolfHoleStatus = (match: MatchState): GolfHoleStatus => {
  if (match.status === 'stalemate') {
    return 'failed';
  }
  if (getRemainingGolfTargetAtoms(match) === 0) {
    return 'solved';
  }
  if (getLegalPlacements(prepareGolfTurn(match)).length === 0) {
    return 'failed';
  }
  return 'playing';
};

export const createGolfFlowState = ({
  bestStrokesByHole = {},
  course = BUILT_IN_GOLF_COURSE,
  holeIndex = 0
}: CreateGolfFlowStateOptions = {}): GolfFlowState => {
  const safeHoleIndex = Math.min(
    Math.max(0, holeIndex),
    course.holes.length - 1
  );
  const hole = course.holes[safeHoleIndex]!;
  const match = prepareGolfTurn(hole.startingMatch);

  return {
    bestStrokesByHole: { ...bestStrokesByHole },
    course,
    currentWave: null,
    holeIndex: safeHoleIndex,
    illegalTile: null,
    isResolving: false,
    lastWaves: [],
    match,
    playback: null,
    runId: 0,
    status: getGolfHoleStatus(match),
    strokes: 0,
    strokesByHole: {}
  };
};

const finishGolfStroke = (
  state: GolfFlowState,
  result: PlaceAtomResult,
  strokes: number,
  runId: number
): GolfFlowState => {
  const nextMatch = prepareGolfTurn(result.state);
  const status = getGolfHoleStatus(nextMatch);
  const hole = state.course.holes[state.holeIndex]!;

  return {
    ...state,
    currentWave: null,
    illegalTile: null,
    isResolving: false,
    lastWaves: result.waves,
    match: nextMatch,
    playback: null,
    runId,
    status,
    strokes,
    strokesByHole:
      status === 'solved'
        ? {
            ...state.strokesByHole,
            [hole.id]: strokes
          }
        : state.strokesByHole
  };
};

export const attemptGolfStroke = (
  state: GolfFlowState,
  position: Position
): GolfFlowState => {
  if (state.status !== 'playing' || state.isResolving) {
    return state;
  }

  const match = prepareGolfTurn(state.match);
  if (!isLegalPlacement(match, position)) {
    return {
      ...state,
      currentWave: null,
      illegalTile: position,
      isResolving: false,
      lastWaves: [],
      match,
      playback: null,
      runId: state.runId + 1
    };
  }

  const result = placeAtom(match, position);
  const strokes = state.strokes + 1;
  const runId = state.runId + 1;
  const finalState = finishGolfStroke(state, result, strokes, runId);

  if (result.waves.length === 0) {
    return finalState;
  }

  return {
    ...state,
    currentWave: result.waves[0]!,
    illegalTile: null,
    isResolving: true,
    lastWaves: result.waves,
    match: result.timeline[0] ?? result.state,
    playback: {
      finalState,
      result,
      runId
    },
    runId,
    status: 'playing',
    strokes,
    strokesByHole: state.strokesByHole
  };
};

export const finishGolfWave = (
  state: GolfFlowState,
  runId: number,
  waveIndex: number
): GolfFlowState => {
  if (
    runId !== state.runId ||
    state.playback?.runId !== runId ||
    !state.currentWave
  ) {
    return state;
  }

  return {
    ...state,
    currentWave: null,
    match: state.playback.result.timeline[waveIndex + 1] ?? state.match
  };
};

export const advanceGolfPlayback = (
  state: GolfFlowState,
  runId: number,
  waveIndex: number
): GolfFlowState => {
  if (runId !== state.runId || state.playback?.runId !== runId) {
    return state;
  }

  const nextWaveIndex = waveIndex + 1;
  const nextWave = state.playback.result.waves[nextWaveIndex];
  if (!nextWave) {
    return state.playback.finalState;
  }

  return {
    ...state,
    currentWave: nextWave,
    match: state.playback.result.timeline[nextWaveIndex] ?? state.match
  };
};

export const retryGolfHole = (state: GolfFlowState): GolfFlowState =>
  createGolfFlowState({
    bestStrokesByHole: state.bestStrokesByHole,
    course: state.course,
    holeIndex: state.holeIndex
  });

export const advanceGolfHole = (state: GolfFlowState): GolfFlowState => {
  const next = createGolfFlowState({
    bestStrokesByHole: state.bestStrokesByHole,
    course: state.course,
    holeIndex: state.holeIndex + 1
  });

  return {
    ...next,
    strokesByHole: state.strokesByHole
  };
};

const readStoredGolfBestStrokes = (storage: Storage): StoredGolfBestStrokes => {
  const source = storage.getItem(GOLF_BEST_STROKES_STORAGE_KEY);
  if (!source) {
    return {};
  }

  try {
    const parsed = JSON.parse(source);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    const stored: StoredGolfBestStrokes = {};
    for (const [courseId, holes] of Object.entries(parsed)) {
      if (typeof holes !== 'object' || holes === null || Array.isArray(holes)) {
        continue;
      }

      stored[courseId] = {};
      for (const [holeId, strokes] of Object.entries(holes)) {
        if (Number.isInteger(strokes) && strokes > 0) {
          stored[courseId]![holeId] = strokes;
        }
      }
    }

    return stored;
  } catch {
    return {};
  }
};

export const loadGolfBestStrokes = (
  storage: Storage,
  courseId: string
): GolfBestStrokes => ({ ...readStoredGolfBestStrokes(storage)[courseId] });

export const recordGolfBestStroke = (
  storage: Storage,
  courseId: string,
  holeId: string,
  strokes: number
) => {
  const stored = readStoredGolfBestStrokes(storage);
  const courseScores = stored[courseId] ?? {};

  if (Number.isInteger(strokes) && strokes >= 1) {
    const currentBest = courseScores[holeId];
    if (currentBest === undefined || strokes < currentBest) {
      const updated = { ...courseScores, [holeId]: strokes };
      stored[courseId] = updated;
      storage.setItem(GOLF_BEST_STROKES_STORAGE_KEY, JSON.stringify(stored));
      return { ...updated };
    }
  }

  return { ...courseScores };
};
