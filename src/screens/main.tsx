import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Mesh, Vector3 } from 'three';
import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';

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
  getTile,
  positionKey,
  type ExplosionPath,
  type ExplosionWave,
  type MatchState,
  type PlayerId,
  type Position
} from '@helpers/atoms-match-rules';
import {
  GAME_MODES,
  getPlayerLabel,
  isNpcControlled,
  type GameMode
} from '@helpers/atoms-mode';
import { cn } from '@helpers/tailwind';

const TILE_SIZE = 1;
const ATOM_RADIUS = 0.13;

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
  match
}: {
  focusedTile: Position | null;
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
      focusedTile
    );
    desiredPosition.current.set(...pose.position);
    desiredTarget.current.set(...pose.target);
  }, [focusedTile, match.columns, match.rows]);

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
  tile: ReturnType<typeof getTile>;
}) => {
  const worldPosition = getWorldPosition(match, position);
  const capacity = getCapacity(match, position);

  const tileColor = isIllegalFlash
    ? '#f97316'
    : isHovered
      ? '#fde68a'
      : isCursor
        ? '#bfdbfe'
        : isLegal
          ? '#dbeafe'
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

  return (
    <>
      <CameraRig focusedTile={hoveredTile ?? cursorTile} match={match} />
      <ambientLight intensity={0.7} />
      <directionalLight castShadow intensity={1.15} position={[6, 10, 5]} />
      <group>
        <mesh position={[0, -0.09, 0]} receiveShadow>
          <boxGeometry args={[boardWidth + 0.42, 0.08, boardDepth + 0.42]} />
          <meshStandardMaterial color="#475569" roughness={0.82} />
        </mesh>
        {match.tiles.map((tile, index) => {
          const position = {
            column: index % match.columns,
            row: Math.floor(index / match.columns)
          };
          const key = positionKey(position);
          return (
            <BoardTile
              activePlayerColor={activePlayerColor}
              isCursor={positionKey(cursorTile) === key}
              isHovered={hoveredTile ? positionKey(hoveredTile) === key : false}
              isIllegalFlash={
                illegalTile ? positionKey(illegalTile) === key : false
              }
              isLegal={!isResolving && legalTileKeys.has(key)}
              key={key}
              match={match}
              onTileClick={onTileClick}
              onTileHover={onTileHover}
              playerColor={
                tile.ownerId ? (playerColors.get(tile.ownerId) ?? null) : null
              }
              position={position}
              tile={tile}
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

const PlayerPill = ({
  label,
  match,
  playerId
}: {
  label?: string;
  match: MatchState;
  playerId: PlayerId;
}) => {
  const player = match.players.find(candidate => candidate.id === playerId)!;

  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-slate-300/70 bg-white/80 px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-200">
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: player.color }}
      />
      {label ?? player.name}
      {player.eliminated ? ' eliminated' : ''}
    </span>
  );
};

export const Main = () => {
  const { theme } = useTheme();
  const [matchFlow, setMatchFlow] = useState(() => createMatchFlowState());
  const matchFlowRef = useRef(matchFlow);
  const dispatchRef = useRef<(event: MatchFlowEvent) => void>(() => undefined);
  const timeoutIdsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

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

  const resetGame = useCallback(() => {
    dispatch({ type: 'reset' });
  }, [dispatch]);

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
  }, [dispatch]);

  return (
    <>
      <main
        className={cn(
          'min-h-screen overflow-hidden px-4 py-4 text-slate-950 transition-colors sm:px-6',
          theme === 'dark'
            ? 'bg-slate-950 text-slate-100'
            : 'bg-slate-100 text-slate-950'
        )}
      >
        <div className="mx-auto grid h-[calc(100vh-2rem)] max-w-7xl grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:grid-rows-1">
          <section className="rounded-lg border border-slate-300 bg-white/85 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/85">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
                  Atoms
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                  Chain the board
                </h1>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="mode">
                  Mode
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  disabled={isResolving}
                  id="mode"
                  onChange={event => {
                    dispatch({
                      mode: event.target.value as GameMode,
                      type: 'select-mode'
                    });
                  }}
                  value={mode}
                >
                  {GAME_MODES.map(candidate => (
                    <option key={candidate.value} value={candidate.value}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="board-size">
                  Board
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  disabled={isResolving}
                  id="board-size"
                  onChange={event => {
                    dispatch({
                      presetIndex: Number(event.target.value),
                      type: 'select-board-preset'
                    });
                  }}
                  value={matchFlow.presetIndex}
                >
                  {BOARD_SIZE_PRESETS.map((preset, index) => (
                    <option key={preset.label} value={index}>
                      {preset.label} {preset.rows}x{preset.columns}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-md border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">
                  Status
                </p>
                <p className="mt-2 text-sm font-medium">
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <PlayerPill
                    label={getPlayerLabel(mode, 'player-1')}
                    match={match}
                    playerId="player-1"
                  />
                  <PlayerPill
                    label={getPlayerLabel(mode, 'player-2')}
                    match={match}
                    playerId="player-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  disabled={isResolving}
                  onClick={resetGame}
                  type="button"
                >
                  {winner || isStalemate ? 'Rematch' : 'Reset'}
                </button>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-55 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  disabled={isResolving}
                  onClick={() => {
                    dispatch({ type: 'cycle-mode' });
                  }}
                  type="button"
                >
                  Switch mode
                </button>
              </div>
            </div>
          </section>

          <section
            className="min-h-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-200 dark:border-slate-800 dark:bg-slate-900"
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
    </>
  );
};
