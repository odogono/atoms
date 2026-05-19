import type { PlayerId } from './atoms-game';

export type GameMode = 'local' | 'npc' | 'npc-vs-npc';

export const GAME_MODES = [
  { label: '1P vs NPC', value: 'npc' },
  { label: '2P local', value: 'local' },
  { label: 'NPC vs NPC', value: 'npc-vs-npc' }
] as const satisfies Array<{ label: string; value: GameMode }>;

export const isNpcControlled = (mode: GameMode, playerId: PlayerId) =>
  mode === 'npc-vs-npc' || (mode === 'npc' && playerId === 'player-2');

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
