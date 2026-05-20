import { describe, expect, it } from 'bun:test';

import { createMatch } from '../atoms-match-rules';
import {
  DEFAULT_MAX_SIMULATION_TURNS,
  simulateNpcMatch
} from '../atoms-match-simulation';
import { heuristicMatchStrategy } from '../atoms-match-strategy';
import { seedBoard, withPlayersHavingTakenTurns } from './atoms-test-fixtures';

describe('atoms match simulation', () => {
  it('runs an in-progress snapshot to Victory using an NPC strategy', () => {
    const match = withPlayersHavingTakenTurns(
      seedBoard(createMatch({ columns: 3, rows: 3 }), [
        { column: 0, count: 1, ownerId: 'player-1', row: 0 },
        { column: 1, count: 2, ownerId: 'player-2', row: 0 },
        { column: 0, count: 1, ownerId: 'player-1', row: 1 }
      ])
    );

    const result = simulateNpcMatch(match, {
      strategy: heuristicMatchStrategy
    });

    expect(result.outcome).toBe('won');
    expect(result.winnerId).toBe('player-1');
    expect(result.turnsSimulated).toBe(1);
    expect(result.endingTurnNumber).toBe(match.turnNumber + 1);
    expect(result.totalExplosionWaves).toBe(1);
    expect(result.maxCascadeWaves).toBe(1);
    expect(result.finalBoardControl.players[0]?.value).toBe(2);
    expect(result.boardControlDelta.players[0]?.value).toBe(0);
    expect(result.finalCriticalPressure.total).toBeGreaterThan(0);
  });

  it('propagates engine Stalemate as the simulation outcome', () => {
    const match = seedBoard(createMatch({ columns: 2, rows: 2 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 1, ownerId: 'player-1', row: 0 },
      { column: 0, count: 1, ownerId: 'player-1', row: 1 },
      { column: 1, count: 1, ownerId: 'player-1', row: 1 }
    ]);

    const result = simulateNpcMatch(match, {
      strategy: heuristicMatchStrategy
    });

    expect(result.outcome).toBe('stalemate');
    expect(result.finalStatus).toBe('stalemate');
    expect(result.winnerId).toBe(null);
    expect(result.turnsSimulated).toBe(1);
    expect(result.totalExplosionWaves).toBeGreaterThan(0);
  });

  it('stops at a turn cap distinct from domain Stalemate', () => {
    const result = simulateNpcMatch(createMatch({ columns: 3, rows: 3 }), {
      maxTurns: 1,
      strategy: heuristicMatchStrategy
    });

    expect(result.outcome).toBe('turn-cap-reached');
    expect(result.finalStatus).toBe('playing');
    expect(result.maxTurns).toBe(1);
    expect(result.turnsSimulated).toBe(1);
    expect(result.endingTurnNumber).toBe(1);
  });

  it('stops as stalled when the active Player has no legal placement', () => {
    const match = createMatch({
      columns: 2,
      neutralAtoms: [
        { column: 0, count: 1, row: 0 },
        { column: 1, count: 1, row: 0 },
        { column: 0, count: 1, row: 1 },
        { column: 1, count: 1, row: 1 }
      ],
      rows: 2
    });

    const result = simulateNpcMatch(match, {
      strategy: heuristicMatchStrategy
    });

    expect(result.outcome).toBe('stalled');
    expect(result.stalledPlayerId).toBe('player-1');
    expect(result.turnsSimulated).toBe(0);
    expect(result.finalStatus).toBe('playing');
  });

  it('treats terminal snapshots as already complete', () => {
    const result = simulateNpcMatch(
      {
        ...createMatch({ columns: 3, rows: 3 }),
        status: 'won',
        winnerId: 'player-1'
      },
      { strategy: heuristicMatchStrategy }
    );

    expect(result.outcome).toBe('won');
    expect(result.winnerId).toBe('player-1');
    expect(result.turnsSimulated).toBe(0);
    expect(result.maxTurns).toBe(DEFAULT_MAX_SIMULATION_TURNS);
  });
});
