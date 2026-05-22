import { useEffect, useMemo, useRef } from 'react';

import { Mesh, Vector3 } from 'three';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';

import { getBoardCameraPose, getBoardPoint } from '@helpers/atoms-camera';
import { MATCH_TIMINGS } from '@helpers/atoms-match-flow';
import {
  getLegalPlacements,
  indexToPosition,
  isDestructibleTile,
  isHole,
  positionKey,
  type ExplosionPath,
  type ExplosionWave,
  type MatchState,
  type Position,
  type Tile
} from '@helpers/atoms-match-rules';
import { usePrefersReducedMotion } from '@hooks/use-prefers-reduced-motion';

const TILE_SIZE = 1;
const ATOM_RADIUS = 0.13;
const NEUTRAL_ATOM_COLOR = '#f8fafc';
const TILE_FOCUS_STRENGTH = 0.25;

const ignoreRaycast = () => undefined;

const TileInteractionSurface = ({
  onTileClick,
  onTileHover,
  position,
  worldPosition
}: {
  onTileClick: (position: Position) => void;
  onTileHover: (position: Position | null) => void;
  position: Position;
  worldPosition: Vector3;
}) => (
  <mesh
    onPointerDown={event => {
      event.stopPropagation();
      onTileClick(position);
    }}
    onPointerMove={event => {
      event.stopPropagation();
      onTileHover(position);
    }}
    onPointerOver={event => {
      event.stopPropagation();
      onTileHover(position);
    }}
    position={[worldPosition.x, 0.09, worldPosition.z]}
  >
    <boxGeometry args={[0.98, 0.02, 0.98]} />
    <meshBasicMaterial
      color="#ffffff"
      depthWrite={false}
      opacity={0}
      transparent
    />
  </mesh>
);

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
  isInteractive,
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
  isInteractive: boolean;
  isLegal: boolean;
  match: MatchState;
  onTileClick: (position: Position) => void;
  onTileHover: (position: Position | null) => void;
  playerColor: string | null;
  position: Position;
  tile: Tile;
}) => {
  const worldPosition = getWorldPosition(match, position);
  const isDestructible = isDestructibleTile(tile);

  let tileColor: string;
  if (isIllegalFlash) {
    tileColor = '#f97316';
  } else if (isHovered) {
    tileColor = '#fde68a';
  } else if (isCursor) {
    tileColor = '#bfdbfe';
  } else if (isLegal) {
    tileColor = '#dbeafe';
  } else if (isDestructible) {
    tileColor = '#a8a29e';
  } else {
    tileColor = '#e5e7eb';
  }

  let tileEmissiveIntensity: number;
  if (isHovered) {
    tileEmissiveIntensity = 0.2;
  } else if (isCursor) {
    tileEmissiveIntensity = 0.22;
  } else if (isLegal) {
    tileEmissiveIntensity = 0.08;
  } else {
    tileEmissiveIntensity = 0;
  }

  const tileEmissive = isHovered
    ? '#facc15'
    : isCursor || isLegal
      ? activePlayerColor
      : '#000000';

  return (
    <>
      <mesh
        position={[worldPosition.x, 0, worldPosition.z]}
        raycast={ignoreRaycast}
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
      {tile.shielded && playerColor ? (
        <mesh
          position={[worldPosition.x, 0.155, worldPosition.z]}
          raycast={ignoreRaycast}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.39, 0.025, 10, 48]} />
          <meshStandardMaterial
            color={playerColor}
            emissive={playerColor}
            emissiveIntensity={0.2}
            roughness={0.38}
          />
        </mesh>
      ) : null}
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
      {isInteractive ? (
        <TileInteractionSurface
          onTileClick={onTileClick}
          onTileHover={onTileHover}
          position={position}
          worldPosition={worldPosition}
        />
      ) : null}
    </>
  );
};

const HoleCell = ({
  isCursor,
  isHovered,
  isInteractive,
  match,
  onTileClick,
  onTileHover,
  position
}: {
  isCursor: boolean;
  isHovered: boolean;
  isInteractive: boolean;
  match: MatchState;
  onTileClick: (position: Position) => void;
  onTileHover: (position: Position | null) => void;
  position: Position;
}) => {
  const worldPosition = getWorldPosition(match, position);

  return (
    <>
      <mesh
        position={[worldPosition.x, -0.035, worldPosition.z]}
        raycast={ignoreRaycast}
        receiveShadow
      >
        <boxGeometry args={[0.86, 0.045, 0.86]} />
        <meshStandardMaterial
          color={isHovered ? '#334155' : isCursor ? '#1d4ed8' : '#0f172a'}
          roughness={0.9}
        />
      </mesh>
      {isInteractive ? (
        <TileInteractionSurface
          onTileClick={onTileClick}
          onTileHover={onTileHover}
          position={position}
          worldPosition={worldPosition}
        />
      ) : null}
    </>
  );
};

export const GameBoard = ({
  currentWave,
  cursorTile,
  hoveredTile,
  illegalTile,
  isInteractive = true,
  isResolving,
  legalPositions,
  match,
  onTileClick,
  onTileHover,
  renderHoles = false,
  showLegalPlacements = true
}: {
  currentWave: ExplosionWave | null;
  cursorTile: Position | null;
  hoveredTile: Position | null;
  illegalTile: Position | null;
  isInteractive?: boolean;
  isResolving: boolean;
  legalPositions?: Position[];
  match: MatchState;
  onTileClick: (position: Position) => void;
  onTileHover: (position: Position | null) => void;
  renderHoles?: boolean;
  showLegalPlacements?: boolean;
}) => {
  const playerColors = useMemo(
    () => new Map(match.players.map(player => [player.id, player.color])),
    [match.players]
  );
  const legalTileKeys = useMemo(
    () =>
      new Set(
        showLegalPlacements
          ? (legalPositions ?? getLegalPlacements(match)).map(positionKey)
          : []
      ),
    [legalPositions, match, showLegalPlacements]
  );
  const activePlayerColor = playerColors.get(match.activePlayerId) ?? '#2563eb';
  const boardWidth = match.columns * TILE_SIZE;
  const boardDepth = match.rows * TILE_SIZE;
  const cursorKey = cursorTile ? positionKey(cursorTile) : null;
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
            return renderHoles ? (
              <HoleCell
                isCursor={cursorKey === key}
                isHovered={hoveredKey === key}
                isInteractive={isInteractive}
                key={key}
                match={match}
                onTileClick={onTileClick}
                onTileHover={onTileHover}
                position={position}
              />
            ) : null;
          }

          return (
            <BoardTile
              activePlayerColor={activePlayerColor}
              isCursor={cursorKey === key}
              isHovered={hoveredKey === key}
              isIllegalFlash={illegalKey === key}
              isInteractive={isInteractive}
              isLegal={
                showLegalPlacements && !isResolving && legalTileKeys.has(key)
              }
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
      {currentWave?.blockedPaths.map((path, index) => (
        <FlightAtom
          key={`blocked-${index}-${positionKey(path.from)}-${positionKey(path.to)}`}
          match={match}
          path={path}
          playerColor={playerColors.get(path.ownerId) ?? '#2563eb'}
        />
      ))}
    </>
  );
};
