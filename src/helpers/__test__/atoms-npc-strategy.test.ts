import { describe, expect, it } from 'bun:test';

import { createMatch, isLegalPlacement, placeAtom } from '../atoms-match-rules';
import {
  chooseBaselineNpcPlacement,
  chooseTacticalNpcPlacement
} from '../atoms-npc-strategy';
import { seedBoard, withPlayersHavingTakenTurns } from './atoms-test-fixtures';

describe('atoms NPC strategy', () => {
  it('baseline chooses a legal placement and prefers an obvious winning capture', () => {
    const npcTurnMatch = {
      ...withPlayersHavingTakenTurns(
        seedBoard(createMatch({ columns: 3, rows: 3 }), [
          { column: 0, count: 1, ownerId: 'player-1', row: 0 },
          { column: 0, count: 2, ownerId: 'player-2', row: 1 },
          { column: 2, count: 1, ownerId: 'player-2', row: 2 }
        ])
      ),
      activePlayerId: 'player-2' as const
    };

    expect(chooseBaselineNpcPlacement(npcTurnMatch)).toEqual({
      column: 0,
      row: 1
    });
    expect(
      isLegalPlacement(npcTurnMatch, chooseBaselineNpcPlacement(npcTurnMatch)!)
    ).toBe(true);
  });

  it('tactical chooses a legal placement and prefers immediate Victory', () => {
    const npcTurnMatch = {
      ...withPlayersHavingTakenTurns(
        seedBoard(createMatch({ columns: 3, rows: 3 }), [
          { column: 0, count: 1, ownerId: 'player-1', row: 0 },
          { column: 0, count: 2, ownerId: 'player-2', row: 1 },
          { column: 2, count: 1, ownerId: 'player-2', row: 2 }
        ])
      ),
      activePlayerId: 'player-2' as const
    };

    const move = chooseTacticalNpcPlacement(npcTurnMatch);

    expect(move).toEqual({ column: 0, row: 1 });
    expect(isLegalPlacement(npcTurnMatch, move!)).toBe(true);
    expect(placeAtom(npcTurnMatch, move!).state.winnerId).toBe('player-2');
  });

  it('tactical avoids a stalemate placement when a non-stalemate placement is available', () => {
    const npcTurnMatch = seedBoard(createMatch({ columns: 3, rows: 3 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 2, ownerId: 'player-1', row: 0 },
      { column: 2, count: 1, ownerId: 'player-1', row: 0 },
      { column: 0, count: 2, ownerId: 'player-2', row: 1 },
      { column: 1, count: 1, ownerId: 'player-1', row: 1 },
      { column: 2, count: 2, ownerId: 'player-1', row: 1 },
      { column: 0, count: 1, ownerId: 'player-1', row: 2 },
      { column: 2, count: 1, ownerId: 'player-1', row: 2 }
    ]);
    const move = chooseTacticalNpcPlacement(npcTurnMatch);

    expect(move).not.toBe(null);
    expect(placeAtom(npcTurnMatch, move!).state.status).not.toBe('stalemate');
  });

  it('tactical does not place on neutral atoms and values capturing them', () => {
    const npcTurnMatch = {
      ...seedBoard(
        createMatch({
          columns: 3,
          neutralAtoms: [{ column: 1, count: 2, row: 0 }],
          rows: 3
        }),
        [
          { column: 0, count: 1, ownerId: 'player-2', row: 0 },
          { column: 2, count: 1, ownerId: 'player-2', row: 2 }
        ]
      ),
      activePlayerId: 'player-2' as const
    };

    expect(isLegalPlacement(npcTurnMatch, { column: 1, row: 0 })).toBe(false);
    expect(chooseTacticalNpcPlacement(npcTurnMatch)).toEqual({
      column: 0,
      row: 0
    });
  });
});
