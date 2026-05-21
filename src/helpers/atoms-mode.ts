import type { PlayerId } from './atoms-match-rules';

export type GameMode = 'local' | 'npc' | 'npc-vs-npc';
export type PlayerController = 'human' | 'npc';
export type PlayerControllerById = Partial<Record<PlayerId, PlayerController>>;

export const GAME_MODES = [
  { label: '1P vs NPC', value: 'npc' },
  { label: '2P local', value: 'local' },
  { label: 'NPC vs NPC', value: 'npc-vs-npc' }
] as const satisfies Array<{ label: string; value: GameMode }>;

export const isNpcControlled = (mode: GameMode, playerId: PlayerId) =>
  mode === 'npc-vs-npc' || (mode === 'npc' && playerId === 'player-2');

export const getDefaultControllers = (
  mode: GameMode,
  playerCount = 2
): PlayerControllerById => {
  const controllers: PlayerControllerById = {};

  for (let index = 1; index <= playerCount; index += 1) {
    const playerId = `player-${index}` as PlayerId;
    controllers[playerId] = isNpcControlled(mode, playerId) ? 'npc' : 'human';
  }

  return controllers;
};

export const isNpcController = (
  controllers: PlayerControllerById,
  playerId: PlayerId
) => controllers[playerId] === 'npc';

export const getControllerPlayerLabel = (
  controllers: PlayerControllerById,
  playerId: PlayerId
) => {
  if (!isNpcController(controllers, playerId)) {
    return playerId === 'player-1'
      ? 'Player 1'
      : `Player ${playerId.replace('player-', '')}`;
  }

  const npcIds = Object.entries(controllers)
    .filter(([, controller]) => controller === 'npc')
    .map(([id]) => id)
    .sort();

  return npcIds.length === 1 ? 'NPC' : `NPC ${npcIds.indexOf(playerId) + 1}`;
};

export const getPlayerLabel = (mode: GameMode, playerId: PlayerId) => {
  if (mode === 'npc-vs-npc') {
    return playerId === 'player-1' ? 'NPC 1' : 'NPC 2';
  }

  if (mode === 'npc' && playerId === 'player-2') {
    return 'NPC';
  }

  return playerId === 'player-1' ? 'Player 1' : 'Player 2';
};

export const getNextGameMode = (mode: GameMode) => {
  const currentIndex = GAME_MODES.findIndex(
    candidate => candidate.value === mode
  );
  return GAME_MODES[(currentIndex + 1) % GAME_MODES.length]!.value;
};
