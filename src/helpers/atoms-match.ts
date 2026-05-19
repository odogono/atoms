import {
  getInitialCursor,
  moveCursor,
  type CursorDirection
} from './atoms-cursor';
import {
  BOARD_SIZE_PRESETS,
  applyMove,
  chooseNpcMove,
  createGame,
  isLegalMove,
  type ApplyMoveResult,
  type BoardSizePreset,
  type ExplosionWave,
  type GameState,
  type Position
} from './atoms-game';
import { getNextGameMode, isNpcControlled, type GameMode } from './atoms-mode';

export const MATCH_TIMINGS = {
  illegalFlashMs: 280,
  npcDelayMs: 600,
  playbackPauseMs: 80,
  waveDurationMs: 560
} as const;

type Playback = {
  result: ApplyMoveResult;
  runId: number;
};

export type MatchState = {
  currentWave: ExplosionWave | null;
  cursorTile: Position;
  game: GameState;
  hoveredTile: Position | null;
  illegalTile: Position | null;
  isResolving: boolean;
  mode: GameMode;
  playback: Playback | null;
  presetIndex: number;
  runId: number;
};

export type MatchEvent =
  | { runId: number; type: 'advance-playback'; waveIndex: number }
  | { position: Position; type: 'attempt-move' }
  | { runId: number; type: 'clear-illegal-flash' }
  | { type: 'cycle-mode' }
  | { runId: number; type: 'execute-npc-move' }
  | { runId: number; type: 'finish-wave'; waveIndex: number }
  | { direction: CursorDirection; type: 'move-cursor' }
  | { position: Position | null; type: 'hover-tile' }
  | { type: 'reset' }
  | { presetIndex: number; type: 'select-board-preset' }
  | { mode: GameMode; type: 'select-mode' };

export type MatchEffect = {
  delayMs: number;
  event: MatchEvent;
};

type MatchUpdate = {
  effects: MatchEffect[];
  state: MatchState;
};

type CreateMatchOptions = {
  mode?: GameMode;
  presetIndex?: number;
};

const getPreset = (presetIndex: number): BoardSizePreset =>
  BOARD_SIZE_PRESETS[presetIndex] ?? BOARD_SIZE_PRESETS[1]!;

const createGameForPreset = (preset: BoardSizePreset) =>
  createGame({
    columns: preset.columns,
    playerCount: 2,
    rows: preset.rows
  });

const isNpcTurn = (state: MatchState) =>
  state.game.status === 'playing' &&
  !state.isResolving &&
  isNpcControlled(state.mode, state.game.activePlayerId);

const scheduleNpcMove = (state: MatchState): MatchEffect[] =>
  isNpcTurn(state)
    ? [
        {
          delayMs: MATCH_TIMINGS.npcDelayMs,
          event: { runId: state.runId, type: 'execute-npc-move' }
        }
      ]
    : [];

const scheduleWaveFinish = (
  state: MatchState,
  waveIndex: number
): MatchEffect[] =>
  state.currentWave
    ? [
        {
          delayMs: MATCH_TIMINGS.waveDurationMs,
          event: { runId: state.runId, type: 'finish-wave', waveIndex }
        }
      ]
    : [];

const startGame = (
  state: MatchState,
  options: { mode?: GameMode; presetIndex?: number } = {}
) => {
  const presetIndex = options.presetIndex ?? state.presetIndex;
  const preset = getPreset(presetIndex);

  const next: MatchState = {
    ...state,
    currentWave: null,
    cursorTile: getInitialCursor(preset),
    game: createGameForPreset(preset),
    hoveredTile: null,
    illegalTile: null,
    isResolving: false,
    mode: options.mode ?? state.mode,
    playback: null,
    presetIndex,
    runId: state.runId + 1
  };

  return {
    effects: scheduleNpcMove(next),
    state: next
  };
};

const finishMove = (state: MatchState, result: ApplyMoveResult) => {
  const next: MatchState = {
    ...state,
    currentWave: null,
    game: result.state,
    isResolving: false,
    playback: null
  };

  return {
    effects: scheduleNpcMove(next),
    state: next
  };
};

const startMovePlayback = (
  state: MatchState,
  result: ApplyMoveResult,
  runId: number
): MatchUpdate => {
  if (result.waves.length === 0) {
    return finishMove(
      {
        ...state,
        currentWave: null,
        game: result.state,
        illegalTile: null,
        isResolving: false,
        playback: null,
        runId
      },
      result
    );
  }

  const next: MatchState = {
    ...state,
    currentWave: result.waves[0]!,
    game: result.timeline[0] ?? result.state,
    illegalTile: null,
    isResolving: true,
    playback: { result, runId },
    runId
  };

  return {
    effects: scheduleWaveFinish(next, 0),
    state: next
  };
};

const attemptMove = (state: MatchState, position: Position): MatchUpdate => {
  if (state.isResolving || state.game.status !== 'playing') {
    return { effects: [], state };
  }

  if (isNpcTurn(state)) {
    return { effects: [], state };
  }

  const positionedState = { ...state, cursorTile: position };

  if (!isLegalMove(positionedState.game, position)) {
    const next = {
      ...positionedState,
      illegalTile: position,
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
    applyMove(positionedState.game, position),
    positionedState.runId + 1
  );
};

const executeNpcMove = (state: MatchState, runId: number): MatchUpdate => {
  if (runId !== state.runId || !isNpcTurn(state)) {
    return { effects: [], state };
  }

  const move = chooseNpcMove(state.game);
  if (!move) {
    return { effects: [], state };
  }

  return startMovePlayback(state, applyMove(state.game, move), state.runId + 1);
};

const finishWave = (
  state: MatchState,
  runId: number,
  waveIndex: number
): MatchUpdate => {
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
    game: state.playback.result.timeline[waveIndex + 1] ?? state.game
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
  state: MatchState,
  runId: number,
  waveIndex: number
): MatchUpdate => {
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
    game: state.playback.result.timeline[nextWaveIndex] ?? state.game
  };

  return {
    effects: scheduleWaveFinish(next, nextWaveIndex),
    state: next
  };
};

export const createMatchState = ({
  mode = 'npc',
  presetIndex = 1
}: CreateMatchOptions = {}): MatchState => {
  const preset = getPreset(presetIndex);

  return {
    currentWave: null,
    cursorTile: getInitialCursor(preset),
    game: createGameForPreset(preset),
    hoveredTile: null,
    illegalTile: null,
    isResolving: false,
    mode,
    playback: null,
    presetIndex,
    runId: 0
  };
};

export const updateMatch = (
  state: MatchState,
  event: MatchEvent
): MatchUpdate => {
  switch (event.type) {
    case 'advance-playback':
      return advancePlayback(state, event.runId, event.waveIndex);
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
            { columns: state.game.columns, rows: state.game.rows },
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
  }
};
