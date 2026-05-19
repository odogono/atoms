import {
  getInitialCursor,
  moveCursor,
  type CursorDirection
} from './atoms-cursor';
import {
  BOARD_SIZE_PRESETS,
  createMatch,
  isLegalPlacement,
  placeAtom,
  type BoardSizePreset,
  type ExplosionWave,
  type PlaceAtomResult,
  type Position,
  type MatchState as RuleMatchState
} from './atoms-match-rules';
import { getNextGameMode, isNpcControlled, type GameMode } from './atoms-mode';
import { chooseNpcPlacement } from './atoms-npc-strategy';

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
  currentWave: ExplosionWave | null;
  cursorTile: Position;
  hoveredTile: Position | null;
  illegalTile: Position | null;
  isResolving: boolean;
  match: RuleMatchState;
  mode: GameMode;
  playback: Playback | null;
  presetIndex: number;
  runId: number;
};

export type MatchFlowEvent =
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

export type MatchFlowEffect = {
  delayMs: number;
  event: MatchFlowEvent;
};

type MatchFlowUpdate = {
  effects: MatchFlowEffect[];
  state: MatchFlowState;
};

type CreateMatchOptions = {
  mode?: GameMode;
  presetIndex?: number;
};

const getPreset = (presetIndex: number): BoardSizePreset =>
  BOARD_SIZE_PRESETS[presetIndex] ?? BOARD_SIZE_PRESETS[1]!;

const createMatchForPreset = (preset: BoardSizePreset) =>
  createMatch({
    columns: preset.columns,
    neutralAtoms: preset.neutralAtoms,
    playerCount: 2,
    rows: preset.rows
  });

const isNpcTurn = (state: MatchFlowState) =>
  state.match.status === 'playing' &&
  !state.isResolving &&
  isNpcControlled(state.mode, state.match.activePlayerId);

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

const startGame = (
  state: MatchFlowState,
  options: { mode?: GameMode; presetIndex?: number } = {}
) => {
  const presetIndex = options.presetIndex ?? state.presetIndex;
  const preset = getPreset(presetIndex);

  const next: MatchFlowState = {
    ...state,
    currentWave: null,
    cursorTile: getInitialCursor(preset),
    hoveredTile: null,
    illegalTile: null,
    isResolving: false,
    match: createMatchForPreset(preset),
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
): MatchFlowUpdate => {
  if (state.isResolving || state.match.status !== 'playing') {
    return { effects: [], state };
  }

  if (isNpcTurn(state)) {
    return { effects: [], state };
  }

  const positionedState = { ...state, cursorTile: position };

  if (!isLegalPlacement(positionedState.match, position)) {
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
    placeAtom(positionedState.match, position),
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

  const move = chooseNpcPlacement(state.match);
  if (!move) {
    return { effects: [], state };
  }

  return startMovePlayback(
    state,
    placeAtom(state.match, move),
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
  mode = 'npc',
  presetIndex = 1
}: CreateMatchOptions = {}): MatchFlowState => {
  const preset = getPreset(presetIndex);

  return {
    currentWave: null,
    cursorTile: getInitialCursor(preset),
    hoveredTile: null,
    illegalTile: null,
    isResolving: false,
    match: createMatchForPreset(preset),
    mode,
    playback: null,
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
  }
};
