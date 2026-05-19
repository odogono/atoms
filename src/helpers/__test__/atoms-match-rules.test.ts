import { describe, expect, it } from 'bun:test';

import {
  BOARD_SIZE_PRESETS,
  createMatch,
  getCapacity,
  getLegalPlacements,
  getTile,
  isLegalPlacement,
  placeAtom
} from '../atoms-match-rules';
import { seedBoard, withPlayersHavingTakenTurns } from './atoms-test-fixtures';

describe('atoms match rules', () => {
  it('uses neighbour count as tile capacity', () => {
    const match = createMatch({ columns: 4, rows: 4 });

    expect(getCapacity(match, { column: 0, row: 0 })).toBe(2);
    expect(getCapacity(match, { column: 1, row: 0 })).toBe(3);
    expect(getCapacity(match, { column: 1, row: 1 })).toBe(4);
  });

  it('allows placement on empty or owned tiles and rejects opponent tiles', () => {
    const match = seedBoard(createMatch({ columns: 3, rows: 3 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 1, ownerId: 'player-2', row: 0 }
    ]);

    expect(isLegalPlacement(match, { column: 2, row: 0 })).toBe(true);
    expect(isLegalPlacement(match, { column: 0, row: 0 })).toBe(true);
    expect(isLegalPlacement(match, { column: 1, row: 0 })).toBe(false);
  });

  it('converts and increments a captured destination during an explosion', () => {
    const match = seedBoard(createMatch({ columns: 3, rows: 3 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 1, ownerId: 'player-2', row: 0 }
    ]);

    const result = placeAtom(match, { column: 0, row: 0 });

    expect(result.waves).toHaveLength(1);
    expect(getTile(result.state, { column: 1, row: 0 })).toEqual({
      atomCount: 2,
      ownerId: 'player-1'
    });
  });

  it('empties all wave sources before applying incoming atoms', () => {
    const match = seedBoard(createMatch({ columns: 3, rows: 3 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 2, ownerId: 'player-2', row: 0 }
    ]);

    const result = placeAtom(match, { column: 0, row: 0 });

    expect(result.waves).toHaveLength(2);
    expect(getTile(result.state, { column: 0, row: 0 })).toEqual({
      atomCount: 1,
      ownerId: 'player-1'
    });
    expect(getTile(result.state, { column: 1, row: 0 })).toEqual({
      atomCount: 0,
      ownerId: null
    });
  });

  it('ends a cascade as victory after a wave eliminates the opponent', () => {
    const afterPlayerTwoHasPlayed = withPlayersHavingTakenTurns(
      seedBoard(createMatch({ columns: 3, rows: 3 }), [
        { column: 0, count: 1, ownerId: 'player-1', row: 0 },
        { column: 1, count: 2, ownerId: 'player-2', row: 0 },
        { column: 0, count: 1, ownerId: 'player-1', row: 1 }
      ])
    );

    const result = placeAtom(afterPlayerTwoHasPlayed, { column: 0, row: 0 });

    expect(result.waves).toHaveLength(1);
    expect(
      result.state.players.find(player => player.id === 'player-2')
    ).toMatchObject({ eliminated: true });
    expect(result.state.status).toBe('won');
    expect(result.state.winnerId).toBe('player-1');
  });

  it('ends as a stalemate when a cascade repeats with multiple remaining players', () => {
    const match = seedBoard(createMatch({ columns: 2, rows: 2 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 1, ownerId: 'player-1', row: 0 },
      { column: 0, count: 1, ownerId: 'player-1', row: 1 },
      { column: 1, count: 1, ownerId: 'player-1', row: 1 }
    ]);

    const result = placeAtom(match, { column: 0, row: 0 });

    expect(result.state.status).toBe('stalemate');
    expect(result.state.winnerId).toBe(null);
    expect(
      result.state.players.find(player => player.id === 'player-2')
    ).toMatchObject({ eliminated: false, hasTakenTurn: false });
    expect(result.waves.length).toBeLessThan(10);
  });

  it('ends a repeating cascade as victory when one eligible player owns no atoms', () => {
    const afterBothPlayersHavePlayed = {
      ...withPlayersHavingTakenTurns(
        seedBoard(createMatch({ columns: 2, rows: 2 }), [
          { column: 0, count: 1, ownerId: 'player-2', row: 0 },
          { column: 1, count: 1, ownerId: 'player-2', row: 0 },
          { column: 0, count: 1, ownerId: 'player-2', row: 1 },
          { column: 1, count: 1, ownerId: 'player-2', row: 1 }
        ])
      ),
      activePlayerId: 'player-2' as const
    };

    const result = placeAtom(afterBothPlayersHavePlayed, {
      column: 0,
      row: 0
    });

    expect(result.state.status).toBe('won');
    expect(result.state.winnerId).toBe('player-2');
    expect(
      result.state.players.find(player => player.id === 'player-1')
    ).toMatchObject({ eliminated: true });
    expect(result.waves).toHaveLength(1);
  });

  it('does not eliminate players before they have taken a turn', () => {
    const match = createMatch({ columns: 3, rows: 3 });

    const result = placeAtom(match, { column: 0, row: 0 });

    expect(
      result.state.players.find(player => player.id === 'player-2')
    ).toMatchObject({ eliminated: false, hasTakenTurn: false });
    expect(result.state.status).toBe('playing');
  });

  it('keeps the engine generic for up to four players', () => {
    const match = createMatch({ columns: 6, playerCount: 4, rows: 6 });

    expect(match.players).toHaveLength(4);
    expect(getLegalPlacements(match)).toHaveLength(36);
  });

  it('has the planned board size presets', () => {
    expect(BOARD_SIZE_PRESETS).toEqual([
      { columns: 6, label: 'Small', rows: 6 },
      { columns: 8, label: 'Standard', rows: 8 },
      { columns: 10, label: 'Large', rows: 10 }
    ]);
  });
});
