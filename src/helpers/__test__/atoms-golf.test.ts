import { describe, expect, it } from 'bun:test';

import {
  BUILT_IN_GOLF_COURSE,
  advanceGolfPlayback,
  attemptGolfStroke,
  createGolfFlowState,
  finishGolfWave,
  getRemainingGolfTargetAtoms,
  loadGolfBestStrokes,
  recordGolfBestStroke
} from '../atoms-golf';
import { createMatch, getTile, type MatchState } from '../atoms-match-rules';

const seedGolfMatch = (
  tiles: Array<{
    column: number;
    count: number;
    ownerId: 'player-1' | 'player-2' | null;
    row: number;
  }>,
  {
    columns = 4,
    rows = 4
  }: {
    columns?: number;
    rows?: number;
  } = {}
) => {
  const match = createMatch({ columns, playerCount: 2, rows });

  return {
    ...match,
    activePlayerId: 'player-1' as const,
    cells: match.cells.map((cell, index) => {
      const column = index % match.columns;
      const row = Math.floor(index / match.columns);
      const tile = tiles.find(
        candidate => candidate.column === column && candidate.row === row
      );

      return tile
        ? {
            atomCount: tile.count,
            kind: 'tile' as const,
            ownerId: tile.ownerId
          }
        : cell;
    }),
    players: match.players.map(player => ({
      ...player,
      hasTakenTurn: true
    }))
  } satisfies MatchState;
};

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const drainGolfPlayback = (state: ReturnType<typeof createGolfFlowState>) => {
  let next = state;
  const runId = state.runId;
  const waveCount = state.lastWaves.length;

  for (let waveIndex = 0; waveIndex < waveCount; waveIndex += 1) {
    next = finishGolfWave(next, runId, waveIndex);
    next = advanceGolfPlayback(next, runId, waveIndex);
  }

  return next;
};

describe('atoms golf', () => {
  it('counts one stroke for a legal placement regardless of explosion waves', () => {
    const course = {
      holes: [
        {
          id: 'test-cascade',
          name: 'Test Cascade',
          solution: [{ column: 0, row: 0 }],
          startingMatch: seedGolfMatch([
            { column: 0, count: 1, ownerId: 'player-1', row: 0 },
            { column: 1, count: 2, ownerId: 'player-2', row: 0 },
            { column: 2, count: 1, ownerId: 'player-2', row: 0 }
          ])
        }
      ],
      id: 'test-course',
      name: 'Test Course'
    };
    const started = createGolfFlowState({ course });
    const moved = attemptGolfStroke(started, { column: 0, row: 0 });

    expect(moved.strokes).toBe(1);
    expect(moved.lastWaves.length).toBeGreaterThan(1);
    expect(moved.currentWave).toEqual(moved.lastWaves[0]!);
    expect(moved.isResolving).toBe(true);
    expect(moved.status).toBe('playing');

    const resolved = drainGolfPlayback(moved);

    expect(resolved.currentWave).toBe(null);
    expect(resolved.isResolving).toBe(false);
    expect(resolved.status).toBe('solved');
    expect(getRemainingGolfTargetAtoms(resolved.match)).toBe(0);
  });

  it('returns control to Player 1 after an unsolved stroke', () => {
    const course = {
      holes: [
        {
          id: 'test-unsolved',
          name: 'Test Unsolved',
          solution: [
            { column: 0, row: 0 },
            { column: 1, row: 0 }
          ],
          startingMatch: seedGolfMatch([
            { column: 0, count: 1, ownerId: 'player-1', row: 0 },
            { column: 3, count: 1, ownerId: 'player-2', row: 3 }
          ])
        }
      ],
      id: 'test-course',
      name: 'Test Course'
    };
    const moved = drainGolfPlayback(
      attemptGolfStroke(createGolfFlowState({ course }), {
        column: 0,
        row: 0
      })
    );

    expect(moved.status).toBe('playing');
    expect(moved.match.activePlayerId).toBe('player-1');
    expect(moved.strokes).toBe(1);
  });

  it('solves a hole when Player 2 atoms are gone while ignoring Neutral Atoms', () => {
    const course = {
      holes: [
        {
          id: 'test-neutral',
          name: 'Test Neutral',
          solution: [{ column: 0, row: 0 }],
          startingMatch: seedGolfMatch([
            { column: 0, count: 1, ownerId: 'player-1', row: 0 },
            { column: 1, count: 1, ownerId: 'player-2', row: 0 },
            { column: 3, count: 1, ownerId: null, row: 3 }
          ])
        }
      ],
      id: 'test-course',
      name: 'Test Course'
    };
    const moved = drainGolfPlayback(
      attemptGolfStroke(createGolfFlowState({ course }), {
        column: 0,
        row: 0
      })
    );

    expect(moved.status).toBe('solved');
    expect(getTile(moved.match, { column: 3, row: 3 })).toMatchObject({
      atomCount: 1,
      ownerId: null
    });
  });

  it('fails a hole on Stalemate or when Player 1 has no legal placement', () => {
    const stalemateMatch: MatchState = {
      ...seedGolfMatch(
        [
          { column: 0, count: 1, ownerId: 'player-1', row: 0 },
          { column: 1, count: 1, ownerId: 'player-2', row: 0 }
        ],
        { columns: 2, rows: 2 }
      ),
      status: 'stalemate'
    };
    const stalemateCourse = {
      holes: [
        {
          id: 'test-stalemate',
          name: 'Test Stalemate',
          solution: [],
          startingMatch: stalemateMatch
        }
      ],
      id: 'test-course',
      name: 'Test Course'
    };
    const failedByStalemate = createGolfFlowState({ course: stalemateCourse });

    const stuckCourse = {
      holes: [
        {
          id: 'test-stuck',
          name: 'Test Stuck',
          solution: [],
          startingMatch: seedGolfMatch(
            [
              { column: 0, count: 1, ownerId: 'player-2', row: 0 },
              { column: 1, count: 1, ownerId: null, row: 0 },
              { column: 0, count: 1, ownerId: null, row: 1 },
              { column: 1, count: 1, ownerId: 'player-2', row: 1 }
            ],
            { columns: 2, rows: 2 }
          )
        }
      ],
      id: 'test-course',
      name: 'Test Course'
    };

    expect(failedByStalemate.status).toBe('failed');
    expect(createGolfFlowState({ course: stuckCourse }).status).toBe('failed');
  });

  it('persists only improved best strokes per hole', () => {
    const storage = new MemoryStorage();

    recordGolfBestStroke(storage, 'course-a', 'hole-a', 5);
    recordGolfBestStroke(storage, 'course-a', 'hole-a', 8);
    recordGolfBestStroke(storage, 'course-a', 'hole-b', 3);
    recordGolfBestStroke(storage, 'course-a', 'hole-a', 4);

    expect(loadGolfBestStrokes(storage, 'course-a')).toEqual({
      'hole-a': 4,
      'hole-b': 3
    });
  });

  it('ships one valid 9-hole course with known solving sequences', () => {
    expect(BUILT_IN_GOLF_COURSE.holes).toHaveLength(9);

    for (const hole of BUILT_IN_GOLF_COURSE.holes) {
      let state = createGolfFlowState({
        course: {
          holes: [hole],
          id: BUILT_IN_GOLF_COURSE.id,
          name: BUILT_IN_GOLF_COURSE.name
        }
      });

      expect(state.match.players).toHaveLength(2);
      expect(getRemainingGolfTargetAtoms(state.match)).toBeGreaterThan(0);
      expect(hole.solution.length).toBeGreaterThan(0);

      for (const placement of hole.solution) {
        state = attemptGolfStroke(state, placement);
        state = drainGolfPlayback(state);
      }

      expect(state.status).toBe('solved');
    }
  });
});
