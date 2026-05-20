import { describe, expect, it } from 'bun:test';

import {
  BOARD_SIZE_PRESETS,
  createMatch,
  getCapacity,
  getCell,
  getLegalPlacements,
  getTile,
  isHole,
  isLegalPlacement,
  placeAtom
} from '../atoms-match-rules';
import {
  seedBoard,
  seedHoles,
  withPlayersHavingTakenTurns
} from './atoms-test-fixtures';

describe('atoms match rules', () => {
  it('uses neighbour count as tile capacity', () => {
    const match = createMatch({ columns: 4, rows: 4 });

    expect(getCapacity(match, { column: 0, row: 0 })).toBe(2);
    expect(getCapacity(match, { column: 1, row: 0 })).toBe(3);
    expect(getCapacity(match, { column: 1, row: 1 })).toBe(4);
  });

  it('treats holes as absent board space for capacity and placement', () => {
    const match = seedHoles(createMatch({ columns: 3, rows: 3 }), [
      { column: 1, row: 1 }
    ]);

    expect(getCapacity(match, { column: 1, row: 0 })).toBe(2);
    expect(getCapacity(match, { column: 1, row: 1 })).toBe(0);
    expect(isLegalPlacement(match, { column: 1, row: 1 })).toBe(false);
    expect(getLegalPlacements(match)).not.toContainEqual({ column: 1, row: 1 });
  });

  it('does not emit atoms into holes during a cascade', () => {
    const match = seedBoard(
      seedHoles(createMatch({ columns: 3, rows: 3 }), [{ column: 1, row: 1 }]),
      [{ column: 1, count: 1, ownerId: 'player-1', row: 0 }]
    );

    const result = placeAtom(match, { column: 1, row: 0 });

    expect(result.waves[0]?.paths).toEqual([
      {
        from: { column: 1, row: 0 },
        ownerId: 'player-1',
        to: { column: 2, row: 0 }
      },
      {
        from: { column: 1, row: 0 },
        ownerId: 'player-1',
        to: { column: 0, row: 0 }
      }
    ]);
    expect(getTile(result.state, { column: 1, row: 0 })).toEqual({
      atomCount: 0,
      kind: 'tile',
      ownerId: null
    });
  });

  it('rejects hole layouts that leave a tile with capacity below two', () => {
    expect(() =>
      createMatch({
        columns: 3,
        holes: [
          { column: 0, row: 1 },
          { column: 1, row: 0 },
          { column: 1, row: 2 },
          { column: 2, row: 1 }
        ],
        rows: 3
      })
    ).toThrow('capacity');
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

  it('allows direct placement on destructible tiles without damaging hit points', () => {
    const match = createMatch({
      columns: 3,
      destructibleTiles: [{ column: 1, hitPoints: 2, row: 1 }],
      rows: 3
    });

    const result = placeAtom(match, { column: 1, row: 1 });

    expect(getTile(result.state, { column: 1, row: 1 })).toEqual({
      atomCount: 1,
      hitPoints: 2,
      kind: 'tile',
      ownerId: 'player-1'
    });
  });

  it('damages and captures destructible tiles from incoming explosion atoms', () => {
    const match = seedBoard(
      createMatch({
        columns: 3,
        destructibleTiles: [{ column: 1, hitPoints: 2, row: 0 }],
        rows: 3
      }),
      [
        { column: 0, count: 1, ownerId: 'player-1', row: 0 },
        { column: 1, count: 1, hitPoints: 2, ownerId: 'player-2', row: 0 }
      ]
    );

    const result = placeAtom(match, { column: 0, row: 0 });

    expect(getTile(result.state, { column: 1, row: 0 })).toEqual({
      atomCount: 2,
      hitPoints: 1,
      kind: 'tile',
      ownerId: 'player-1'
    });
  });

  it('turns destructible tiles into holes when incoming damage exhausts hit points', () => {
    const match = seedBoard(
      createMatch({
        columns: 3,
        destructibleTiles: [{ column: 1, hitPoints: 1, row: 0 }],
        rows: 3
      }),
      [{ column: 0, count: 1, ownerId: 'player-1', row: 0 }]
    );

    const result = placeAtom(match, { column: 0, row: 0 });

    expect(isHole(getCell(result.state, { column: 1, row: 0 }))).toBe(true);
  });

  it('self-damages destructible source tiles after emitting atoms', () => {
    const match = seedBoard(
      createMatch({
        columns: 3,
        destructibleTiles: [{ column: 1, hitPoints: 2, row: 0 }],
        rows: 3
      }),
      [{ column: 1, count: 2, hitPoints: 2, ownerId: 'player-1', row: 0 }]
    );

    const result = placeAtom(match, { column: 1, row: 0 });

    expect(getTile(result.state, { column: 1, row: 0 })).toEqual({
      atomCount: 0,
      hitPoints: 1,
      kind: 'tile',
      ownerId: null
    });
  });

  it('batches same-wave incoming atoms before removing destroyed tiles', () => {
    const match = seedBoard(
      createMatch({
        columns: 3,
        destructibleTiles: [{ column: 1, hitPoints: 1, row: 1 }],
        playerCount: 3,
        rows: 3
      }),
      [
        { column: 1, count: 2, ownerId: 'player-1', row: 0 },
        { column: 0, count: 3, ownerId: 'player-2', row: 1 },
        { column: 1, count: 1, hitPoints: 1, ownerId: 'player-3', row: 1 }
      ]
    );

    const result = placeAtom(match, { column: 1, row: 0 });

    expect(result.waves[0]?.paths).toEqual(
      expect.arrayContaining([
        {
          from: { column: 1, row: 0 },
          ownerId: 'player-1',
          to: { column: 1, row: 1 }
        },
        {
          from: { column: 0, row: 1 },
          ownerId: 'player-2',
          to: { column: 1, row: 1 }
        }
      ])
    );
    expect(isHole(getCell(result.state, { column: 1, row: 1 }))).toBe(true);
  });

  it('collapses unsupported tiles after destructible tiles are destroyed', () => {
    const match = seedBoard(
      createMatch({
        columns: 3,
        destructibleTiles: [{ column: 1, hitPoints: 1, row: 0 }],
        rows: 3
      }),
      [
        { column: 0, count: 1, ownerId: 'player-2', row: 0 },
        { column: 0, count: 1, ownerId: 'player-1', row: 1 },
        { column: 1, count: 2, hitPoints: 1, ownerId: 'player-1', row: 0 }
      ]
    );

    const result = placeAtom(match, { column: 1, row: 0 });

    expect(isHole(getCell(result.state, { column: 1, row: 0 }))).toBe(true);
    expect(isHole(getCell(result.state, { column: 0, row: 0 }))).toBe(true);
  });

  it('treats neutral atom tiles as occupied but not player-placeable', () => {
    const match = createMatch({
      columns: 3,
      neutralAtoms: [{ column: 1, count: 1, row: 0 }],
      rows: 3
    });

    expect(getTile(match, { column: 1, row: 0 })).toEqual({
      atomCount: 1,
      kind: 'tile',
      ownerId: null
    });
    expect(isLegalPlacement(match, { column: 1, row: 0 })).toBe(false);
    expect(getLegalPlacements(match)).not.toContainEqual({
      column: 1,
      row: 0
    });
  });

  it('converts neutral atoms to the incoming owner during an explosion', () => {
    const match = seedBoard(
      createMatch({
        columns: 3,
        neutralAtoms: [{ column: 1, count: 1, row: 0 }],
        rows: 3
      }),
      [{ column: 0, count: 1, ownerId: 'player-1', row: 0 }]
    );

    const result = placeAtom(match, { column: 0, row: 0 });

    expect(getTile(result.state, { column: 1, row: 0 })).toEqual({
      atomCount: 2,
      kind: 'tile',
      ownerId: 'player-1'
    });
  });

  it('lets captured neutral atoms explode in the next wave', () => {
    const match = seedBoard(
      createMatch({
        columns: 3,
        neutralAtoms: [{ column: 1, count: 2, row: 0 }],
        rows: 3
      }),
      [{ column: 0, count: 1, ownerId: 'player-1', row: 0 }]
    );

    const result = placeAtom(match, { column: 0, row: 0 });

    expect(result.waves).toHaveLength(2);
    expect(result.waves[1]?.sources).toEqual([
      { column: 1, ownerId: 'player-1', row: 0 }
    ]);
  });

  it('rejects critical neutral atoms in initial board setup', () => {
    expect(() =>
      createMatch({
        columns: 3,
        neutralAtoms: [{ column: 0, count: 2, row: 0 }],
        rows: 3
      })
    ).toThrow('Neutral Atom');
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
      kind: 'tile',
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
      kind: 'tile',
      ownerId: 'player-1'
    });
    expect(getTile(result.state, { column: 1, row: 0 })).toEqual({
      atomCount: 0,
      kind: 'tile',
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

  it('ignores neutral atoms for Victory and Elimination', () => {
    const afterPlayerTwoHasPlayed = withPlayersHavingTakenTurns(
      seedBoard(
        createMatch({
          columns: 3,
          neutralAtoms: [{ column: 2, count: 1, row: 2 }],
          rows: 3
        }),
        [
          { column: 0, count: 1, ownerId: 'player-1', row: 0 },
          { column: 1, count: 2, ownerId: 'player-2', row: 0 },
          { column: 0, count: 1, ownerId: 'player-1', row: 1 }
        ]
      )
    );

    const result = placeAtom(afterPlayerTwoHasPlayed, { column: 0, row: 0 });

    expect(result.state.status).toBe('won');
    expect(result.state.winnerId).toBe('player-1');
    expect(getTile(result.state, { column: 2, row: 2 })).toEqual({
      atomCount: 1,
      kind: 'tile',
      ownerId: null
    });
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
      { columns: 10, label: 'Large', rows: 10 },
      {
        columns: 8,
        label: 'Neutral',
        neutralAtoms: [
          { column: 3, count: 1, row: 2 },
          { column: 2, count: 1, row: 3 },
          { column: 5, count: 1, row: 4 },
          { column: 4, count: 1, row: 5 }
        ],
        rows: 8
      },
      {
        columns: 6,
        destructibleTiles: [
          { column: 1, hitPoints: 1, row: 0 },
          { column: 0, hitPoints: 1, row: 1 },
          { column: 4, hitPoints: 1, row: 0 },
          { column: 5, hitPoints: 1, row: 1 },
          { column: 0, hitPoints: 1, row: 4 },
          { column: 1, hitPoints: 1, row: 5 },
          { column: 5, hitPoints: 1, row: 4 },
          { column: 4, hitPoints: 1, row: 5 }
        ],
        label: 'Destructible',
        rows: 6
      }
    ]);
  });
});
