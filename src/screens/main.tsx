import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';

import { Canvas } from '@react-three/fiber';

import {
  Activity,
  AlertTriangle,
  FlagOff,
  Play,
  Plus,
  RotateCcw,
  X
} from 'lucide-react';

import { BoardSetupCarousel } from '@components/board-setup-carousel';
import { GameBoard } from '@components/game-board';
import { SegmentedControl } from '@components/segmented-control';
import { ThemeTogglePortal } from '@components/theme/toggle-portal';
import { useTheme } from '@contexts/theme/context';
import {
  getBuiltInBoardSetups,
  type BoardSetup
} from '@helpers/atoms-board-setup';
import {
  isCursorDirection,
  type CursorDirection
} from '@helpers/atoms-cursor';
import {
  createMatchFlowState,
  updateMatchFlow,
  type MatchFlowEffect,
  type MatchFlowEvent
} from '@helpers/atoms-match-flow';
import {
  type ExplosionWave,
  type MatchState,
  type PlayerId,
  type Position
} from '@helpers/atoms-match-rules';
import {
  getBoardControl,
  getCompletedRounds,
  getCriticalPressure,
  type MatchMetric,
  type PlayerMetric
} from '@helpers/atoms-match-stats';
import {
  getControllerPlayerLabel,
  isNpcController,
  type PlayerController,
  type PlayerControllerById
} from '@helpers/atoms-mode';
import { cn } from '@helpers/tailwind';


const isInteractiveTarget = (target: EventTarget | null) => {
  if (!target || !('tagName' in target)) {
    return false;
  }

  const element = target as HTMLElement;
  return (
    element.isContentEditable ||
    ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)
  );
};

const getStatusText = (
  controllers: PlayerControllerById,
  winnerId: PlayerId | undefined,
  isStalemate: boolean,
  isResolving: boolean,
  currentWave: ExplosionWave | null,
  isNpcTurn: boolean,
  activePlayerId: PlayerId
): string => {
  if (winnerId) {
    return `${getControllerPlayerLabel(controllers, winnerId)} wins`;
  }
  if (isStalemate) {
    return 'Stalemate: cascade cannot stabilize';
  }
  if (isResolving) {
    if (currentWave) {
      const count = currentWave.sources.length;
      return `Explosion wave with ${count} critical tile${count === 1 ? '' : 's'}`;
    }
    return 'Resolving turn';
  }
  if (isNpcTurn) {
    return `${getControllerPlayerLabel(controllers, activePlayerId)} is choosing`;
  }
  return `${getControllerPlayerLabel(controllers, activePlayerId)} to move`;
};

type DialogState = 'closed' | 'confirm-abandon' | 'setup';

type MatchSetupDraft = {
  boardSetupId: string;
  controllers: PlayerControllerById;
  playerCount: number;
};

const iconClassName = 'h-4 w-4';
const playerCountOptions = [2, 3, 4].map(count => ({
  label: `${count}P`,
  value: count
}));
const playerControllerOptions: Array<{
  label: string;
  value: PlayerController;
}> = [
  { label: 'Human', value: 'human' },
  { label: 'NPC', value: 'npc' }
];

const getMetricForPlayer = (metric: MatchMetric, playerId: PlayerId) =>
  metric.players.find(player => player.playerId === playerId)?.value ?? 0;

const formatPercent = (share: number) => `${Math.round(share * 100)}%`;

const ModalShell = ({
  children,
  maxWidthClassName = 'max-w-lg',
  onClose,
  title
}: {
  children: ReactNode;
  maxWidthClassName?: string;
  onClose: () => void;
  title: string;
}) => {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/65 p-4">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          'max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-lg border border-slate-300 bg-white p-4 text-slate-950 shadow-xl sm:p-5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
          maxWidthClassName
        )}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold" id={titleId}>
            {title}
          </h2>
          <button
            aria-label="Close dialog"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
};

const MatchSetupDialog = ({
  boardSetups,
  draft,
  onCancel,
  onChange,
  onManageBoards,
  onStart
}: {
  boardSetups: BoardSetup[];
  draft: MatchSetupDraft;
  onCancel: () => void;
  onChange: (draft: MatchSetupDraft) => void;
  onManageBoards: () => void;
  onStart: () => void;
}) => {
  const updatePlayerCount = (playerCount: number) => {
    const controllers: PlayerControllerById = {};
    for (let index = 1; index <= playerCount; index += 1) {
      const playerId = `player-${index}` as PlayerId;
      controllers[playerId] = draft.controllers[playerId] ?? 'human';
    }
    onChange({ ...draft, controllers, playerCount });
  };

  const updateController = (
    playerId: PlayerId,
    controller: PlayerController
  ) => {
    onChange({
      ...draft,
      controllers: {
        ...draft.controllers,
        [playerId]: controller
      }
    });
  };

  return (
    <ModalShell
      maxWidthClassName="max-w-2xl"
      onClose={onCancel}
      title="New Match"
    >
      <div className="mt-5 space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">Board Setup</p>
          <BoardSetupCarousel
            boardSetups={boardSetups}
            onSelect={boardSetupId => {
              onChange({
                ...draft,
                boardSetupId
              });
            }}
            selectedBoardSetupId={draft.boardSetupId}
          />
          <button
            className="text-sm font-semibold text-slate-600 underline-offset-4 hover:underline dark:text-slate-300"
            onClick={onManageBoards}
            type="button"
          >
            Manage Board Setups
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Players</p>
          <SegmentedControl
            ariaLabel="Player count"
            onChange={count => {
              updatePlayerCount(count);
            }}
            options={playerCountOptions}
            value={draft.playerCount}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Player Control</p>
          <div className="grid gap-2">
            {Array.from({ length: draft.playerCount }, (_value, index) => {
              const playerId = `player-${index + 1}` as PlayerId;
              return (
                <div
                  className="grid items-center gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_12rem]"
                  key={playerId}
                >
                  <span className="font-medium">{`Player ${index + 1}`}</span>
                  <SegmentedControl
                    ariaLabel={`Player ${index + 1} controller`}
                    onChange={controller => {
                      updateController(playerId, controller);
                    }}
                    options={playerControllerOptions}
                    value={draft.controllers[playerId] ?? 'human'}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            onClick={onStart}
            type="button"
          >
            <Play aria-hidden className={iconClassName} />
            Start Match
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const ConfirmAbandonDialog = ({
  onCancel,
  onConfirm
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <ModalShell onClose={onCancel} title="Abandon Match">
    <div className="mt-5 space-y-5">
      <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm">
          This Match will be replaced only when you start the next Match.
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          onClick={onConfirm}
          type="button"
        >
          <FlagOff aria-hidden className={iconClassName} />
          Continue
        </button>
      </div>
    </div>
  </ModalShell>
);

const MetricBar = ({
  formatValue,
  metric,
  playersById,
  title
}: {
  formatValue: (entry: PlayerMetric) => string;
  metric: MatchMetric;
  playersById: Map<PlayerId, MatchState['players'][number]>;
  title: string;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">
        {title}
      </p>
    </div>
    <div
      aria-label={title}
      className="flex h-3 overflow-hidden rounded-sm bg-slate-200 dark:bg-slate-800"
      role="img"
    >
      {metric.total > 0 ? (
        metric.players.map(entry => {
          const player = playersById.get(entry.playerId);
          if (!player || entry.share === 0) {
            return null;
          }

          return (
            <span
              aria-hidden
              className="h-full"
              key={entry.playerId}
              style={{
                backgroundColor: player.color,
                width: `${entry.share * 100}%`
              }}
            />
          );
        })
      ) : (
        <span
          aria-hidden
          className="h-full w-full bg-slate-300 dark:bg-slate-700"
        />
      )}
    </div>
    <div className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
      {metric.players.map(entry => {
        const player = playersById.get(entry.playerId);
        if (!player) {
          return null;
        }

        return (
          <div
            className="flex items-center justify-between gap-2"
            key={entry.playerId}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: player.color }}
              />
              <span className="truncate">{player.name}</span>
            </span>
            <span className="shrink-0 tabular-nums">{formatValue(entry)}</span>
          </div>
        );
      })}
    </div>
  </div>
);

const PlayerPanel = ({
  boardControl,
  criticalPressure,
  isActive,
  label,
  player
}: {
  boardControl: number;
  criticalPressure: number;
  isActive: boolean;
  label: string;
  player: MatchState['players'][number];
}) => (
  <div
    className={cn(
      'rounded-md border bg-white/70 p-3 transition dark:bg-slate-950/50',
      isActive
        ? 'border-slate-950 ring-2 ring-slate-950/10 dark:border-white dark:ring-white/15'
        : 'border-slate-300 dark:border-slate-700',
      player.eliminated && 'opacity-55'
    )}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: player.color }}
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {player.eliminated ? 'Eliminated' : isActive ? 'Active' : 'Waiting'}
      </span>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      <div>
        <p className="text-slate-500 dark:text-slate-400">Control</p>
        <p className="font-semibold tabular-nums">{boardControl}</p>
      </div>
      <div>
        <p className="text-slate-500 dark:text-slate-400">Pressure</p>
        <p className="font-semibold tabular-nums">
          {criticalPressure.toFixed(2)}
        </p>
      </div>
    </div>
  </div>
);

type MainProps = {
  onManageBoardSetups: () => void;
  onPendingBoardSetupConsumed: () => void;
  pendingBoardSetupId: string | null;
  savedBoardSetups: BoardSetup[];
};

export const Main = ({
  onManageBoardSetups,
  onPendingBoardSetupConsumed,
  pendingBoardSetupId,
  savedBoardSetups
}: MainProps) => {
  const { theme } = useTheme();
  const builtInBoardSetups = useMemo(() => getBuiltInBoardSetups(), []);
  const allBoardSetups = useMemo(
    () => [...builtInBoardSetups, ...savedBoardSetups],
    [builtInBoardSetups, savedBoardSetups]
  );
  const [matchFlow, setMatchFlow] = useState(() => createMatchFlowState());
  const matchFlowRef = useRef(matchFlow);
  const dispatchRef = useRef<(event: MatchFlowEvent) => void>(() => undefined);
  const timeoutIdsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [dialogState, setDialogState] = useState<DialogState>('closed');
  const [setupDraft, setSetupDraft] = useState<MatchSetupDraft>(() => ({
    boardSetupId: matchFlow.boardSetup.id,
    controllers: matchFlow.controllers,
    playerCount: matchFlow.playerCount
  }));

  const scheduleEffects = useCallback((effects: MatchFlowEffect[]) => {
    for (const effect of effects) {
      const timeoutId = setTimeout(() => {
        timeoutIdsRef.current = timeoutIdsRef.current.filter(
          candidate => candidate !== timeoutId
        );
        dispatchRef.current(effect.event);
      }, effect.delayMs);
      timeoutIdsRef.current.push(timeoutId);
    }
  }, []);

  const dispatch = useCallback(
    (event: MatchFlowEvent) => {
      const update = updateMatchFlow(matchFlowRef.current, event);
      matchFlowRef.current = update.state;
      setMatchFlow(update.state);
      scheduleEffects(update.effects);
    },
    [scheduleEffects]
  );

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(
    () => () => {
      for (const timeoutId of timeoutIdsRef.current) {
        clearTimeout(timeoutId);
      }
      timeoutIdsRef.current = [];
    },
    []
  );

  const {
    currentWave,
    cursorTile,
    hoveredTile,
    illegalTile,
    isResolving,
    match
  } = matchFlow;
  const activePlayer = match.players.find(
    player => player.id === match.activePlayerId
  )!;
  const winner = match.winnerId
    ? match.players.find(player => player.id === match.winnerId)
    : null;
  const isStalemate = match.status === 'stalemate';
  const isNpcTurn =
    isNpcController(matchFlow.controllers, match.activePlayerId) &&
    match.status === 'playing';
  const isTerminal = Boolean(winner || isStalemate);
  const isActiveMatch = match.turnNumber > 0 && !isTerminal;
  const playersById = useMemo(
    () => new Map(match.players.map(player => [player.id, player])),
    [match.players]
  );
  const boardControl = useMemo(() => getBoardControl(match), [match]);
  const criticalPressure = useMemo(() => getCriticalPressure(match), [match]);
  const completedRounds = useMemo(() => getCompletedRounds(match), [match]);
  const controllerSummary = useMemo(() => {
    const npcCount = match.players.filter(player =>
      isNpcController(matchFlow.controllers, player.id)
    ).length;
    return `${match.players.length} Players, ${npcCount} NPC`;
  }, [match.players, matchFlow.controllers]);

  const resetGame = useCallback(() => {
    dispatch({ type: 'reset' });
  }, [dispatch]);

  const openSetup = useCallback(() => {
    const current = matchFlowRef.current;
    setSetupDraft({
      boardSetupId: current.boardSetup.id,
      controllers: current.controllers,
      playerCount: current.playerCount
    });
    setDialogState('setup');
  }, []);

  const openAbandonConfirmation = useCallback(() => {
    setDialogState('confirm-abandon');
  }, []);

  const confirmAbandon = openSetup;

  const closeDialog = useCallback(() => {
    setDialogState('closed');
  }, []);

  const startMatch = useCallback(() => {
    const boardSetup =
      allBoardSetups.find(setup => setup.id === setupDraft.boardSetupId) ??
      allBoardSetups[0]!;
    const presetIndex = boardSetup.id.startsWith('preset-')
      ? Number(boardSetup.id.replace('preset-', ''))
      : null;

    dispatch({
      boardSetup,
      controllers: setupDraft.controllers,
      playerCount: setupDraft.playerCount,
      presetIndex,
      type: 'start-match'
    });
    setDialogState('closed');
  }, [allBoardSetups, dispatch, setupDraft]);

  useEffect(() => {
    if (!pendingBoardSetupId) {
      return;
    }

    const setup = allBoardSetups.find(
      candidate => candidate.id === pendingBoardSetupId
    );
    if (!setup) {
      onPendingBoardSetupConsumed();
      return;
    }

    const current = matchFlowRef.current;
    setSetupDraft({
      boardSetupId: setup.id,
      controllers: current.controllers,
      playerCount: current.playerCount
    });
    setDialogState('setup');
    onPendingBoardSetupConsumed();
  }, [allBoardSetups, onPendingBoardSetupConsumed, pendingBoardSetupId]);

  const handleTileClick = useCallback(
    (position: Position) => {
      dispatch({ position, type: 'attempt-move' });
    },
    [dispatch]
  );

  const handleTileHover = useCallback(
    (position: Position | null) => {
      dispatch({ position, type: 'hover-tile' });
    },
    [dispatch]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogState !== 'closed') {
        return;
      }

      if (isInteractiveTarget(event.target)) {
        return;
      }

      if (isCursorDirection(event.key)) {
        event.preventDefault();
        dispatch({ direction: event.key, type: 'move-cursor' });
        return;
      }

      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        dispatch({
          position: matchFlowRef.current.cursorTile,
          type: 'attempt-move'
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dialogState, dispatch]);

  return (
    <>
      <main
        className={cn(
          'min-h-screen overflow-x-hidden px-4 py-4 text-slate-950 transition-colors sm:px-6',
          theme === 'dark'
            ? 'bg-slate-950 text-slate-100'
            : 'bg-slate-100 text-slate-950'
        )}
      >
        <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 lg:h-[calc(100vh-2rem)] lg:grid-cols-[22rem_minmax(0,1fr)]">
          <section className="min-h-0 rounded-lg border border-slate-300 bg-white/85 p-4 shadow-sm lg:overflow-y-auto dark:border-slate-700 dark:bg-slate-900/85">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
                  Atoms
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                  Chain the board
                </h1>
              </div>

              <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  >
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                      {getStatusText(
                        matchFlow.controllers,
                        winner?.id,
                        isStalemate,
                        isResolving,
                        currentWave,
                        isNpcTurn,
                        activePlayer.id
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Players
                    </p>
                    <p className="truncate font-semibold">
                      {controllerSummary}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Board
                    </p>
                    <p className="truncate font-semibold">
                      {`${matchFlow.boardSetup.name} ${match.rows}x${match.columns}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Rounds completed
                    </p>
                    <p className="font-semibold tabular-nums">
                      {completedRounds}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Placements
                    </p>
                    <p className="font-semibold tabular-nums">
                      {match.turnNumber}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <MetricBar
                  formatValue={entry =>
                    `${entry.value} ${formatPercent(entry.share)}`
                  }
                  metric={boardControl}
                  playersById={playersById}
                  title="Board Control"
                />
                <MetricBar
                  formatValue={entry =>
                    `${entry.value.toFixed(2)} ${formatPercent(entry.share)}`
                  }
                  metric={criticalPressure}
                  playersById={playersById}
                  title="Critical Pressure"
                />
              </div>

              <div className="grid gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                {match.players.map(player => (
                  <PlayerPanel
                    boardControl={getMetricForPlayer(boardControl, player.id)}
                    criticalPressure={getMetricForPlayer(
                      criticalPressure,
                      player.id
                    )}
                    isActive={
                      match.status === 'playing' &&
                      player.id === match.activePlayerId
                    }
                    key={player.id}
                    label={getControllerPlayerLabel(
                      matchFlow.controllers,
                      player.id
                    )}
                    player={player}
                  />
                ))}
              </div>

              <div className="grid gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                {isTerminal ? (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    onClick={resetGame}
                    type="button"
                  >
                    <RotateCcw aria-hidden className={iconClassName} />
                    Rematch
                  </button>
                ) : null}
                <button
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition',
                    isActiveMatch
                      ? 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                      : 'bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200'
                  )}
                  onClick={isActiveMatch ? openAbandonConfirmation : openSetup}
                  type="button"
                >
                  {isActiveMatch ? (
                    <FlagOff aria-hidden className={iconClassName} />
                  ) : (
                    <Plus aria-hidden className={iconClassName} />
                  )}
                  {isActiveMatch ? 'Abandon Match' : 'New Match'}
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={onManageBoardSetups}
                  type="button"
                >
                  Manage Board Setups
                </button>
              </div>
            </div>
          </section>

          <section
            className="h-[26rem] min-h-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-200 sm:h-[34rem] lg:h-auto dark:border-slate-800 dark:bg-slate-900"
            onPointerLeave={() => {
              dispatch({ position: null, type: 'hover-tile' });
            }}
          >
            <Canvas
              camera={{ fov: 42, position: [8, 9, 8] }}
              dpr={[1, 2]}
              shadows
              style={{
                background:
                  theme === 'dark'
                    ? 'linear-gradient(#0f172a, #020617)'
                    : 'linear-gradient(#e2e8f0, #cbd5e1)'
              }}
            >
              <GameBoard
                currentWave={currentWave}
                cursorTile={cursorTile}
                hoveredTile={hoveredTile}
                illegalTile={illegalTile}
                isResolving={isResolving}
                match={match}
                onTileClick={handleTileClick}
                onTileHover={handleTileHover}
              />
            </Canvas>
          </section>
        </div>
      </main>
      <ThemeTogglePortal />
      {dialogState === 'confirm-abandon' ? (
        <ConfirmAbandonDialog
          onCancel={closeDialog}
          onConfirm={confirmAbandon}
        />
      ) : null}
      {dialogState === 'setup' ? (
        <MatchSetupDialog
          boardSetups={allBoardSetups}
          draft={setupDraft}
          onCancel={closeDialog}
          onChange={setSetupDraft}
          onManageBoards={() => {
            setDialogState('closed');
            onManageBoardSetups();
          }}
          onStart={startMatch}
        />
      ) : null}
    </>
  );
};
