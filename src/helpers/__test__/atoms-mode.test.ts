import { describe, expect, it } from 'bun:test';

import {
  GAME_MODES,
  getControllerPlayerLabel,
  getDefaultControllers,
  getNextGameMode,
  getPlayerLabel,
  isNpcControlled,
  isNpcController
} from '../atoms-mode';

describe('atoms game modes', () => {
  it('lists the selectable modes in UI order', () => {
    expect(GAME_MODES.map(mode => mode.label)).toEqual([
      '1P vs NPC',
      '2P local',
      'NPC vs NPC'
    ]);
  });

  it('marks only player 2 as automated in 1P vs NPC', () => {
    expect(isNpcControlled('npc', 'player-1')).toBe(false);
    expect(isNpcControlled('npc', 'player-2')).toBe(true);
  });

  it('marks both players as automated in NPC vs NPC', () => {
    expect(isNpcControlled('npc-vs-npc', 'player-1')).toBe(true);
    expect(isNpcControlled('npc-vs-npc', 'player-2')).toBe(true);
  });

  it('labels players by mode', () => {
    expect(getPlayerLabel('local', 'player-1')).toBe('Player 1');
    expect(getPlayerLabel('npc', 'player-2')).toBe('NPC');
    expect(getPlayerLabel('npc-vs-npc', 'player-1')).toBe('NPC 1');
    expect(getPlayerLabel('npc-vs-npc', 'player-2')).toBe('NPC 2');
  });

  it('cycles through all modes', () => {
    expect(getNextGameMode('npc')).toBe('local');
    expect(getNextGameMode('local')).toBe('npc-vs-npc');
    expect(getNextGameMode('npc-vs-npc')).toBe('npc');
  });

  it('creates per-player controller defaults from legacy modes', () => {
    const controllers = getDefaultControllers('npc', 4);

    expect(controllers).toEqual({
      'player-1': 'human',
      'player-2': 'npc',
      'player-3': 'human',
      'player-4': 'human'
    });
    expect(isNpcController(controllers, 'player-2')).toBe(true);
  });

  it('labels players by controller assignment', () => {
    expect(
      getControllerPlayerLabel(
        { 'player-1': 'human', 'player-2': 'npc', 'player-3': 'npc' },
        'player-3'
      )
    ).toBe('NPC 2');
  });
});
