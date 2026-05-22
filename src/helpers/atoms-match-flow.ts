import {
  createBoardSetupFromPreset,
  createMatchFromBoardSetup,
  type BoardSetup
} from './atoms-board-setup';
import {
  getInitialCursor,
  moveCursor,
  type CursorDirection
} from './atoms-cursor';
import {
  BOARD_SIZE_PRESETS,
  executeMatchAction,
  isLegalPlacement,
  isLegalShieldPlacement,
  type ExplosionWave,
  type MatchAction,
  type PlaceAtomResult,
  type PlayerId,
  type Position,
  type MatchState as RuleMatchState,
  type Ruleset
} from './atoms-match-rules';
import { defaultNpcMatchStrategy } from './atoms-match-strategy';
import {
  getDefaultControllers,
  getNextGameMode,
  isNpcController,
  type GameMode,
  type PlayerControllerById
} from './atoms-mode';

export const MATCH_TIMINGS = {
  illegalFlashMs: 280,
  npcDelayMs: 600,
  playbackPauseMs: 80,
  waveDurationMs: 560
} as const;

type Playback = {
  result: PlaceAtomResult;
  runId: number;
};

export type MatchFlowState = {
  boardSetup: BoardSetup;
  controllers: PlayerControllerById;
  currentWave: ExplosionWave | null;
  cursorTile: Position;
  hoveredTile: Position | null;
  illegalTile: Position | null;
  isResolving: boolean;
  match: RuleMatchState;
  mode: GameMode;
  playback: Playback | null;
  playerCount: number;
  presetIndex: number | null;
  runId: number;
};

export type MatchFlowEvent =
  | { runId: number; type: 'advance-playback'; waveIndex: number }
  | { action: MatchAction; type: 'attempt-action' }
  | { position: Position; type: 'attempt-move' }
  | { runId: number; type: 'clear-illegal-flash' }
  | { type: 'cycle-mode' }
  | { runId: number; type: 'execute-npc-move' }
  | { runId: number; type: 'finish-wave'; waveIndex: number }
  | { direction: CursorDirection; type: 'move-cursor' }
  | { position: Position | null; type: 'hover-tile' }
  | { type: 'reset' }
  | { presetIndex: number; type: 'select-board-preset' }
  | { mode: GameMode; type: 'select-mode' }
  | {
      boardSetup?: BoardSetup;
      controllers?: PlayerControllerById;
      mode?: GameMode;
      playerCount?: number;
      presetIndex?: number | null;
      ruleset?: Ruleset;
      type: 'start-match';
    };

export type MatchFlowEffect = {
  delayMs: number;
  event: MatchFlowEvent;
};

type MatchFlowUpdate = {
  effects: MatchFlowEffect[];
  state: MatchFlowState;
};

type CreateMatchOptions = {
  boardSetup?: BoardSetup;
  controllers?: PlayerControllerById;
  mode?: GameMode;
  playerCount?: number;
  presetIndex?: number | null;
  ruleset?: Ruleset;
};

const getPreset = (presetIndex: number) =>
  BOARD_SIZE_PRESETS[presetIndex] ?? BOARD_SIZE_PRESETS[1]!;

const getBoardSetupForPreset = (presetIndex: number) =>
  createBoardSetupFromPreset(getPreset(presetIndex), presetIndex);

const getControllerCount = (controllers: PlayerControllerById) =>
  Object.keys(controllers).length;

const getControllersForPlayerCount = (
  controllers: PlayerControllerById,
  playerCount: number
): PlayerControllerById => {
  const next: PlayerControllerById = {};

  for (let index = 1; index <= playerCount; index += 1) {
    const playerId = `player-${index}` as PlayerId;
    next[playerId] = controllers[playerId] ?? 'human';
  }

  return next;
};

const isNpcTurn = (state: MatchFlowState) =>
  state.match.status === 'playing' &&
  !state.isResolving &&
  isNpcController(state.controllers, state.match.activePlayerId);

const scheduleNpcMove = (state: MatchFlowState): MatchFlowEffect[] =>
  isNpcTurn(state)
    ? [
        {
          delayMs: MATCH_TIMINGS.npcDelayMs,
          event: { runId: state.runId, type: 'execute-npc-move' }
        }
      ]
    : [];

const scheduleWaveFinish = (
  state: MatchFlowState,
  waveIndex: number
): MatchFlowEffect[] =>
  state.currentWave
    ? [
        {
          delayMs: MATCH_TIMINGS.waveDurationMs,
          event: { runId: state.runId, type: 'finish-wave', waveIndex }
        }
      ]
    : [];

const startGame = (state: MatchFlowState, options: CreateMatchOptions = {}) => {
  const presetIndex =
    options.presetIndex === undefined ? state.presetIndex : options.presetIndex;
  const boardSetup =
    options.boardSetup ??
    (typeof presetIndex === 'number'
      ? getBoardSetupForPreset(presetIndex)
      : state.boardSetup);
  const mode = options.mode ?? state.mode;
  const playerCount =
    options.playerCount ??
    (options.controllers
      ? getControllerCount(options.controllers)
      : undefined) ??
    state.playerCount;
  const controllers = getControllersForPlayerCount(
    options.controllers ?? getDefaultControllers(mode, playerCount),
    playerCount
  );

  const next: MatchFlowState = {
    ...state,
    boardSetup,
    controllers,
    currentWave: null,
    cursorTile: getInitialCursor(boardSetup),
    hoveredTile: null,
    illegalTile: null,
    isResolving: false,
    match: createMatchFromBoardSetup(boardSetup, {
      playerCount,
      ruleset: options.ruleset ?? state.match.ruleset
    }),
    mode,
    playback: null,
    playerCount,
    presetIndex,
    runId: state.runId + 1
  };

  return {
    effects: scheduleNpcMove(next),
    state: next
  };
};

const finishMove = (state: MatchFlowState, result: PlaceAtomResult) => {
  const next: MatchFlowState = {
    ...state,
    currentWave: null,
    isResolving: false,
    match: result.state,
    playback: null
  };

  return {
    effects: scheduleNpcMove(next),
    state: next
  };
};

const startMovePlayback = (
  state: MatchFlowState,
  result: PlaceAtomResult,
  runId: number
): MatchFlowUpdate => {
  if (result.waves.length === 0) {
    return finishMove(
      {
        ...state,
        currentWave: null,
        illegalTile: null,
        isResolving: false,
        match: result.state,
        playback: null,
        runId
      },
      result
    );
  }

  const next: MatchFlowState = {
    ...state,
    currentWave: result.waves[0]!,
    illegalTile: null,
    isResolving: true,
    match: result.timeline[0] ?? result.state,
    playback: { result, runId },
    runId
  };

  return {
    effects: scheduleWaveFinish(next, 0),
    state: next
  };
};

const attemptMove = (
  state: MatchFlowState,
  position: Position
): MatchFlowUpdate => attemptAction(state, { position, type: 'place-atom' });

const isLegalAction = (match: RuleMatchState, action: MatchAction) =>
  action.type === 'place-atom'
    ? isLegalPlacement(match, action.position)
    : isLegalShieldPlacement(match, action.position);

const attemptAction = (
  state: MatchFlowState,
  action: MatchAction
): MatchFlowUpdate => {
  if (state.isResolving || state.match.status !== 'playing') {
    return { effects: [], state };
  }

  if (isNpcTurn(state)) {
    return { effects: [], state };
  }

  const positionedState = { ...state, cursorTile: action.position };

  if (!isLegalAction(positionedState.match, action)) {
    const next = {
      ...positionedState,
      illegalTile: action.position,
      runId: positionedState.runId + 1
    };

    return {
      effects: [
        {
          delayMs: MATCH_TIMINGS.illegalFlashMs,
          event: { runId: next.runId, type: 'clear-illegal-flash' }
        }
      ],
      state: next
    };
  }

  return startMovePlayback(
    positionedState,
    executeMatchAction(positionedState.match, action),
    positionedState.runId + 1
  );
};

const executeNpcMove = (
  state: MatchFlowState,
  runId: number
): MatchFlowUpdate => {
  if (runId !== state.runId || !isNpcTurn(state)) {
    return { effects: [], state };
  }

  const action = defaultNpcMatchStrategy.chooseAction(state.match);
  if (!action) {
    return { effects: [], state };
  }

  return startMovePlayback(
    state,
    executeMatchAction(state.match, action),
    state.runId + 1
  );
};

const finishWave = (
  state: MatchFlowState,
  runId: number,
  waveIndex: number
): MatchFlowUpdate => {
  if (
    runId !== state.runId ||
    state.playback?.runId !== runId ||
    !state.currentWave
  ) {
    return { effects: [], state };
  }

  const next = {
    ...state,
    currentWave: null,
    match: state.playback.result.timeline[waveIndex + 1] ?? state.match
  };

  return {
    effects: [
      {
        delayMs: MATCH_TIMINGS.playbackPauseMs,
        event: { runId, type: 'advance-playback', waveIndex }
      }
    ],
    state: next
  };
};

const advancePlayback = (
  state: MatchFlowState,
  runId: number,
  waveIndex: number
): MatchFlowUpdate => {
  if (runId !== state.runId || state.playback?.runId !== runId) {
    return { effects: [], state };
  }

  const nextWaveIndex = waveIndex + 1;
  const nextWave = state.playback.result.waves[nextWaveIndex];
  if (!nextWave) {
    return finishMove(state, state.playback.result);
  }

  const next = {
    ...state,
    currentWave: nextWave,
    match: state.playback.result.timeline[nextWaveIndex] ?? state.match
  };

  return {
    effects: scheduleWaveFinish(next, nextWaveIndex),
    state: next
  };
};

export const createMatchFlowState = ({
  boardSetup,
  controllers,
  mode = 'npc',
  playerCount,
  presetIndex = 1,
  ruleset
}: CreateMatchOptions = {}): MatchFlowState => {
  const setup = boardSetup ?? getBoardSetupForPreset(presetIndex ?? 1);
  const count =
    playerCount ??
    (controllers ? Math.max(2, getControllerCount(controllers)) : 2);
  const controllerState = getControllersForPlayerCount(
    controllers ?? getDefaultControllers(mode, count),
    count
  );

  return {
    boardSetup: setup,
    controllers: controllerState,
    currentWave: null,
    cursorTile: getInitialCursor(setup),
    hoveredTile: null,
    illegalTile: null,
    isResolving: false,
    match: createMatchFromBoardSetup(setup, {
      playerCount: count,
      ruleset
    }),
    mode,
    playback: null,
    playerCount: count,
    presetIndex,
    runId: 0
  };
};

export const updateMatchFlow = (
  state: MatchFlowState,
  event: MatchFlowEvent
): MatchFlowUpdate => {
  switch (event.type) {
    case 'advance-playback':
      return advancePlayback(state, event.runId, event.waveIndex);
    case 'attempt-action':
      return attemptAction(state, event.action);
    case 'attempt-move':
      return attemptMove(state, event.position);
    case 'clear-illegal-flash':
      if (event.runId !== state.runId) {
        return { effects: [], state };
      }
      return { effects: [], state: { ...state, illegalTile: null } };
    case 'cycle-mode':
      return startGame(state, { mode: getNextGameMode(state.mode) });
    case 'execute-npc-move':
      return executeNpcMove(state, event.runId);
    case 'finish-wave':
      return finishWave(state, event.runId, event.waveIndex);
    case 'hover-tile':
      return {
        effects: [],
        state: {
          ...state,
          cursorTile: event.position ?? state.cursorTile,
          hoveredTile: event.position
        }
      };
    case 'move-cursor':
      return {
        effects: [],
        state: {
          ...state,
          cursorTile: moveCursor(
            { columns: state.match.columns, rows: state.match.rows },
            state.cursorTile,
            event.direction
          ),
          hoveredTile: null
        }
      };
    case 'reset':
      return startGame(state);
    case 'select-board-preset':
      return startGame(state, { presetIndex: event.presetIndex });
    case 'select-mode':
      return startGame(state, { mode: event.mode });
    case 'start-match':
      return startGame(state, {
        boardSetup: event.boardSetup,
        controllers: event.controllers,
        mode: event.mode,
        playerCount: event.playerCount,
        presetIndex: event.presetIndex,
        ruleset: event.ruleset
      });
  }
};
