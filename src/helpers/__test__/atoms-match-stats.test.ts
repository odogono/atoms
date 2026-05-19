import { describe, expect, it } from 'bun:test';

import { createMatch } from '../atoms-match-rules';
import {
  getBoardControl,
  getCompletedRounds,
  getCriticalPressure
} from '../atoms-match-stats';
import {
  seedBoard,
  seedHoles,
  withPlayersHavingTakenTurns
} from './atoms-test-fixtures';

describe('atoms match stats', () => {
  it('counts Board Control from owned tiles only', () => {
    const match = seedBoard(
      seedHoles(
        createMatch({
          columns: 3,
          neutralAtoms: [{ column: 2, count: 1, row: 2 }],
          rows: 3
        }),
        [{ column: 1, row: 1 }]
      ),
      [
        { column: 0, count: 1, ownerId: 'player-1', row: 0 },
        { column: 1, count: 2, ownerId: 'player-1', row: 0 },
        { column: 0, count: 1, ownerId: 'player-2', row: 1 }
      ]
    );

    expect(getBoardControl(match)).toEqual({
      players: [
        { playerId: 'player-1', share: 2 / 3, value: 2 },
        { playerId: 'player-2', share: 1 / 3, value: 1 }
      ],
      total: 3
    });
  });

  it('measures Critical Pressure from atom count divided by Capacity', () => {
    const match = seedBoard(
      createMatch({
        columns: 3,
        neutralAtoms: [{ column: 2, count: 1, row: 2 }],
        rows: 3
      }),
      [
        { column: 0, count: 1, ownerId: 'player-1', row: 0 },
        { column: 1, count: 2, ownerId: 'player-1', row: 0 },
        { column: 1, count: 2, ownerId: 'player-2', row: 1 }
      ]
    );

    const stats = getCriticalPressure(match);

    expect(stats.total).toBeCloseTo(1 / 2 + 2 / 3 + 2 / 4);
    expect(stats.players[0]?.value).toBeCloseTo(1 / 2 + 2 / 3);
    expect(stats.players[1]?.value).toBeCloseTo(2 / 4);
    expect(stats.players[0]?.share).toBeCloseTo((1 / 2 + 2 / 3) / stats.total);
    expect(stats.players[1]?.share).toBeCloseTo(2 / 4 / stats.total);
  });

  it('derives completed Rounds from current active player count', () => {
    const match = {
      ...withPlayersHavingTakenTurns(createMatch({ columns: 3, rows: 3 })),
      players: [
        { ...createMatch().players[0]!, eliminated: false },
        { ...createMatch().players[1]!, eliminated: true }
      ],
      turnNumber: 5
    };

    expect(getCompletedRounds(match)).toBe(5);
  });

  it('keeps partial active-player cycles out of completed Rounds', () => {
    const match = {
      ...createMatch({ columns: 3, rows: 3 }),
      turnNumber: 3
    };

    expect(getCompletedRounds(match)).toBe(1);
  });
});
