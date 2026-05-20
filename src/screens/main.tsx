import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';

import { Mesh, Vector3 } from 'three';
import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';

import {
  Activity,
  AlertTriangle,
  FlagOff,
  Play,
  Plus,
  RotateCcw,
  X
} from 'lucide-react';

import { ThemeTogglePortal } from '@components/theme/toggle-portal';
import { useTheme } from '@contexts/theme/context';
import { getBoardCameraPose, getBoardPoint } from '@helpers/atoms-camera';
import { type CursorDirection } from '@helpers/atoms-cursor';
import {
  MATCH_TIMINGS,
  createMatchFlowState,
  updateMatchFlow,
  type MatchFlowEffect,
  type MatchFlowEvent
} from '@helpers/atoms-match-flow';
import {
  BOARD_SIZE_PRESETS,
  getCapacity,
  getLegalPlacements,
  indexToPosition,
  isDestructibleTile,
  isHole,
  positionKey,
  type ExplosionPath,
  type ExplosionWave,
  type MatchState,
  type PlayerId,
  type Position,
  type Tile
} from '@helpers/atoms-match-rules';
import {
  getBoardControl,
  getCompletedRounds,
  getCriticalPressure,
  type MatchMetric,
  type PlayerMetric
} from '@helpers/atoms-match-stats';
import {
  GAME_MODES,
  getPlayerLabel,
  isNpcControlled,
  type GameMode
} from '@helpers/atoms-mode';
import { cn } from '@helpers/tailwind';
import { usePrefersReducedMotion } from '@hooks/use-prefers-reduced-motion';

const TILE_SIZE = 1;
const ATOM_RADIUS = 0.13;
const NEUTRAL_ATOM_COLOR = '#f8fafc';
const TILE_FOCUS_STRENGTH = 0.25;

const ignoreRaycast = () => undefined;

const isCursorDirection = (key: string): key is CursorDirection =>
  key === 'ArrowUp' ||
  key === 'ArrowRight' ||
  key === 'ArrowDown' ||
  key === 'ArrowLeft';

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

const getWorldPosition = (match: MatchState, position: Position, y = 0) =>
  new Vector3(...getBoardPoint(match, position, y));

const ATOM_OFFSETS: Array<Array<readonly [number, number]>> = [
  [[0, 0]],
  [
    [-0.16, -0.12],
    [0.16, 0.12]
  ],
  [
    [0, -0.2],
    [-0.18, 0.12],
    [0.18, 0.12]
  ],
  [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18]
  ]
];

const getAtomOffsets = (atomCount: number): Array<readonly [number, number]> =>
  ATOM_OFFSETS[Math.min(atomCount, 4) - 1] ?? [];

const CameraRig = ({
  focusedTile,
  focusStrength,
  match
}: {
  focusedTile: Position | null;
  focusStrength: number;
  match: MatchState;
}) => {
  const { camera } = useThree();
  const desiredPosition = useRef(new Vector3());
  const desiredTarget = useRef(new Vector3());
  const lookTarget = useRef(new Vector3());

  useEffect(() => {
    const pose = getBoardCameraPose({
      columns: match.columns,
      rows: match.rows
    });
    desiredPosition.current.set(...pose.position);
    desiredTarget.current.set(...pose.target);
    camera.position.copy(desiredPosition.current);
    lookTarget.current.copy(desiredTarget.current);
    camera.lookAt(lookTarget.current);
    camera.updateProjectionMatrix();
  }, [camera, match.columns, match.rows]);

  useEffect(() => {
    const pose = getBoardCameraPose(
      {
        columns: match.columns,
        rows: match.rows
      },
      focusedTile,
      { focusStrength }
    );
    desiredPosition.current.set(...pose.position);
    desiredTarget.current.set(...pose.target);
  }, [focusedTile, focusStrength, match.columns, match.rows]);

  useFrame(() => {
    camera.position.lerp(desiredPosition.current, 0.025);
    lookTarget.current.lerp(desiredTarget.current, 0.04);
    camera.lookAt(lookTarget.current);
  });

  return null;
};

const FlightAtom = ({
  match,
  path,
  playerColor
}: {
  match: MatchState;
  path: ExplosionPath;
  playerColor: string;
}) => {
  const meshRef = useRef<Mesh>(null);
  const startedAt = useRef<number | null>(null);
  const from = useMemo(
    () => getWorldPosition(match, path.from, 0.42),
    [match, path.from]
  );
  const to = useMemo(
    () => getWorldPosition(match, path.to, 0.42),
    [match, path.to]
  );
  const framePosition = useRef(new Vector3());

  useFrame(({ clock }) => {
    startedAt.current ??= clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAt.current;
    const progress = Math.min(
      elapsed / (MATCH_TIMINGS.waveDurationMs / 1000),
      1
    );
    const eased = 1 - (1 - progress) ** 3;
    const position = framePosition.current.copy(from).lerp(to, eased);
    position.y += Math.sin(progress * Math.PI) * 0.55;
    meshRef.current?.position.copy(position);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[ATOM_RADIUS, 24, 16]} />
      <meshStandardMaterial
        color={playerColor}
        emissive={playerColor}
        emissiveIntensity={0.25}
      />
    </mesh>
  );
};

const AtomCluster = ({
  atomCount,
  playerColor,
  position
}: {
  atomCount: number;
  playerColor: string;
  position: Vector3;
}) => (
  <group position={[position.x, 0.26, position.z]}>
    {getAtomOffsets(atomCount).map(([x, z], index) => (
      <mesh
        key={`${index}-${x}-${z}`}
        position={[x, 0, z]}
        raycast={ignoreRaycast}
      >
        <sphereGeometry args={[ATOM_RADIUS, 24, 16]} />
        <meshStandardMaterial color={playerColor} roughness={0.42} />
      </mesh>
    ))}
  </group>
);

const BoardTile = ({
  activePlayerColor,
  isCursor,
  isHovered,
  isIllegalFlash,
  isLegal,
  match,
  onTileClick,
  onTileHover,
  playerColor,
  position,
  tile
}: {
  activePlayerColor: string;
  isCursor: boolean;
  isHovered: boolean;
  isIllegalFlash: boolean;
  isLegal: boolean;
  match: MatchState;
  onTileClick: (position: Position) => void;
  onTileHover: (position: Position | null) => void;
  playerColor: string | null;
  position: Position;
  tile: Tile;
}) => {
  const worldPosition = getWorldPosition(match, position);
  const capacity = getCapacity(match, position);
  const isDestructible = isDestructibleTile(tile);

  const tileColor = isIllegalFlash
    ? '#f97316'
    : isHovered
      ? '#fde68a'
      : isCursor
        ? '#bfdbfe'
        : isLegal
          ? '#dbeafe'
          : isDestructible
            ? '#a8a29e'
            : '#e5e7eb';
  const tileEmissive = isHovered
    ? '#facc15'
    : isCursor || isLegal
      ? activePlayerColor
      : '#000000';
  const tileEmissiveIntensity = isHovered
    ? 0.2
    : isCursor
      ? 0.22
      : isLegal
        ? 0.08
        : 0;

  return (
    <>
      <mesh
        onPointerDown={event => {
          event.stopPropagation();
          onTileClick(position);
        }}
        onPointerOver={event => {
          event.stopPropagation();
          onTileHover(position);
        }}
        position={[worldPosition.x, 0, worldPosition.z]}
        receiveShadow
      >
        <boxGeometry args={[0.92, 0.12, 0.92]} />
        <meshStandardMaterial
          color={tileColor}
          emissive={tileEmissive}
          emissiveIntensity={tileEmissiveIntensity}
          roughness={0.72}
        />
      </mesh>
      {isDestructible ? (
        <>
          <group
            position={[worldPosition.x, 0.075, worldPosition.z]}
            raycast={ignoreRaycast}
          >
            <mesh position={[-0.16, 0, -0.03]} rotation={[0, 0.72, 0]}>
              <boxGeometry args={[0.035, 0.018, 0.44]} />
              <meshStandardMaterial color="#57534e" roughness={0.88} />
            </mesh>
            <mesh position={[0.08, 0, 0.05]} rotation={[0, -0.55, 0]}>
              <boxGeometry args={[0.028, 0.018, 0.32]} />
              <meshStandardMaterial color="#6b5f58" roughness={0.88} />
            </mesh>
            <mesh position={[0.2, 0, -0.14]} rotation={[0, 1.12, 0]}>
              <boxGeometry args={[0.024, 0.018, 0.22]} />
              <meshStandardMaterial color="#78716c" roughness={0.88} />
            </mesh>
          </group>
          <Html
            center
            distanceFactor={16}
            position={[worldPosition.x - 0.31, 0.14, worldPosition.z - 0.31]}
            style={{ pointerEvents: 'none' }}
            transform
            zIndexRange={[10, 0]}
          >
            <span className="pointer-events-none rounded-sm border border-stone-500/50 bg-stone-100 px-1 text-[8px] font-bold text-stone-800 shadow-sm select-none">
              {tile.hitPoints}
            </span>
          </Html>
        </>
      ) : null}
      {tile.atomCount > 0 && playerColor ? (
        <AtomCluster
          atomCount={tile.atomCount}
          playerColor={playerColor}
          position={worldPosition}
        />
      ) : null}
      <Html
        center
        distanceFactor={16}
        position={[worldPosition.x + 0.31, 0.13, worldPosition.z + 0.31]}
        style={{ pointerEvents: 'none' }}
        transform
        zIndexRange={[10, 0]}
      >
        <span className="pointer-events-none text-[8px] font-semibold text-slate-500 select-none">
          {capacity}
        </span>
      </Html>
    </>
  );
};

const GameBoard = ({
  currentWave,
  cursorTile,
  hoveredTile,
  illegalTile,
  isResolving,
  match,
  onTileClick,
  onTileHover
}: {
  currentWave: ExplosionWave | null;
  cursorTile: Position;
  hoveredTile: Position | null;
  illegalTile: Position | null;
  isResolving: boolean;
  match: MatchState;
  onTileClick: (position: Position) => void;
  onTileHover: (position: Position | null) => void;
}) => {
  const playerColors = useMemo(
    () => new Map(match.players.map(player => [player.id, player.color])),
    [match.players]
  );
  const legalTileKeys = useMemo(
    () => new Set(getLegalPlacements(match).map(positionKey)),
    [match]
  );
  const activePlayerColor = playerColors.get(match.activePlayerId) ?? '#2563eb';
  const boardWidth = match.columns * TILE_SIZE;
  const boardDepth = match.rows * TILE_SIZE;
  const cursorKey = positionKey(cursorTile);
  const hoveredKey = hoveredTile ? positionKey(hoveredTile) : null;
  const illegalKey = illegalTile ? positionKey(illegalTile) : null;
  const prefersReducedMotion = usePrefersReducedMotion();
  const focusStrength = prefersReducedMotion ? 0 : TILE_FOCUS_STRENGTH;

  return (
    <>
      <CameraRig
        focusedTile={hoveredTile ?? cursorTile}
        focusStrength={focusStrength}
        match={match}
      />
      <ambientLight intensity={0.7} />
      <directionalLight castShadow intensity={1.15} position={[6, 10, 5]} />
      <group>
        <mesh position={[0, -0.09, 0]} receiveShadow>
          <boxGeometry args={[boardWidth + 0.42, 0.08, boardDepth + 0.42]} />
          <meshStandardMaterial color="#475569" roughness={0.82} />
        </mesh>
        {match.cells.map((cell, index) => {
          const position = indexToPosition(match, index);
          const key = positionKey(position);
          if (isHole(cell)) {
            return null;
          }

          return (
            <BoardTile
              activePlayerColor={activePlayerColor}
              isCursor={cursorKey === key}
              isHovered={hoveredKey === key}
              isIllegalFlash={illegalKey === key}
              isLegal={!isResolving && legalTileKeys.has(key)}
              key={key}
              match={match}
              onTileClick={onTileClick}
              onTileHover={onTileHover}
              playerColor={
                cell.ownerId
                  ? (playerColors.get(cell.ownerId) ?? null)
                  : cell.atomCount > 0
                    ? NEUTRAL_ATOM_COLOR
                    : null
              }
              position={position}
              tile={cell}
            />
          );
        })}
      </group>
      {currentWave?.paths.map((path, index) => (
        <FlightAtom
          key={`${index}-${positionKey(path.from)}-${positionKey(path.to)}`}
          match={match}
          path={path}
          playerColor={playerColors.get(path.ownerId) ?? '#2563eb'}
        />
      ))}
    </>
  );
};

const getStatusText = (
  mode: GameMode,
  winnerId: PlayerId | undefined,
  isStalemate: boolean,
  isResolving: boolean,
  currentWave: ExplosionWave | null,
  isNpcTurn: boolean,
  activePlayerId: PlayerId
): string => {
  if (winnerId) {
    return `${getPlayerLabel(mode, winnerId)} wins`;
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
    return `${getPlayerLabel(mode, activePlayerId)} is choosing`;
  }
  return `${getPlayerLabel(mode, activePlayerId)} to move`;
};

type DialogState = 'closed' | 'confirm-abandon' | 'setup';

type MatchSetupDraft = {
  mode: GameMode;
  presetIndex: number;
};

const iconClassName = 'h-4 w-4';

const getMetricForPlayer = (metric: MatchMetric, playerId: PlayerId) =>
  metric.players.find(player => player.playerId === playerId)?.value ?? 0;

const formatPercent = (share: number) => `${Math.round(share * 100)}%`;

const ModalShell = ({
  children,
  onClose,
  title
}: {
  children: ReactNode;
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
        className="w-full max-w-lg rounded-lg border border-slate-300 bg-white p-4 text-slate-950 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
  draft,
  onCancel,
  onChange,
  onStart
}: {
  draft: MatchSetupDraft;
  onCancel: () => void;
  onChange: (draft: MatchSetupDraft) => void;
  onStart: () => void;
}) => (
  <ModalShell onClose={onCancel} title="New Match">
    <div className="mt-5 space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="setup-mode">
          Mode
        </label>
        <select
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          id="setup-mode"
          onChange={event => {
            onChange({
              ...draft,
              mode: event.target.value as GameMode
            });
          }}
          value={draft.mode}
        >
          {GAME_MODES.map(candidate => (
            <option key={candidate.value} value={candidate.value}>
              {candidate.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="setup-board">
          Board
        </label>
        <select
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          id="setup-board"
          onChange={event => {
            onChange({
              ...draft,
              presetIndex: Number(event.target.value)
            });
          }}
          value={draft.presetIndex}
        >
          {BOARD_SIZE_PRESETS.map((preset, index) => (
            <option key={preset.label} value={index}>
              {preset.label} {preset.rows}x{preset.columns}
            </option>
          ))}
        </select>
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

export const Main = () => {
  const { theme } = useTheme();
  const [matchFlow, setMatchFlow] = useState(() => createMatchFlowState());
  const matchFlowRef = useRef(matchFlow);
  const dispatchRef = useRef<(event: MatchFlowEvent) => void>(() => undefined);
  const timeoutIdsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [dialogState, setDialogState] = useState<DialogState>('closed');
  const [setupDraft, setSetupDraft] = useState<MatchSetupDraft>(() => ({
    mode: matchFlow.mode,
    presetIndex: matchFlow.presetIndex
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
    match,
    mode
  } = matchFlow;
  const activePlayer = match.players.find(
    player => player.id === match.activePlayerId
  )!;
  const winner = match.winnerId
    ? match.players.find(player => player.id === match.winnerId)
    : null;
  const isStalemate = match.status === 'stalemate';
  const isNpcTurn =
    isNpcControlled(mode, match.activePlayerId) && match.status === 'playing';
  const isTerminal = Boolean(winner || isStalemate);
  const isActiveMatch = match.turnNumber > 0 && !isTerminal;
  const playersById = useMemo(
    () => new Map(match.players.map(player => [player.id, player])),
    [match.players]
  );
  const boardControl = useMemo(() => getBoardControl(match), [match]);
  const criticalPressure = useMemo(() => getCriticalPressure(match), [match]);
  const completedRounds = useMemo(() => getCompletedRounds(match), [match]);
  const activePreset = BOARD_SIZE_PRESETS[matchFlow.presetIndex];

  const resetGame = useCallback(() => {
    dispatch({ type: 'reset' });
  }, [dispatch]);

  const openSetup = useCallback(() => {
    const current = matchFlowRef.current;
    setSetupDraft({ mode: current.mode, presetIndex: current.presetIndex });
    setDialogState('setup');
  }, []);

  const openAbandonConfirmation = useCallback(() => {
    setDialogState('confirm-abandon');
  }, []);

  const confirmAbandon = useCallback(() => {
    const current = matchFlowRef.current;
    setSetupDraft({ mode: current.mode, presetIndex: current.presetIndex });
    setDialogState('setup');
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState('closed');
  }, []);

  const startMatch = useCallback(() => {
    dispatch({
      mode: setupDraft.mode,
      presetIndex: setupDraft.presetIndex,
      type: 'start-match'
    });
    setDialogState('closed');
  }, [dispatch, setupDraft]);

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
                        mode,
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
                      Mode
                    </p>
                    <p className="truncate font-semibold">
                      {GAME_MODES.find(candidate => candidate.value === mode)
                        ?.label ?? mode}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Board
                    </p>
                    <p className="truncate font-semibold">
                      {`${activePreset?.label ?? 'Custom'} ${match.rows}x${match.columns}`}
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
                    label={getPlayerLabel(mode, player.id)}
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
          draft={setupDraft}
          onCancel={closeDialog}
          onChange={setSetupDraft}
          onStart={startMatch}
        />
      ) : null}
    </>
  );
};
