import { describe, expect, it } from 'bun:test';

import {
  createMatch,
  getCell,
  getTile,
  placeAtom,
  shieldTile
} from '../atoms-match-rules';
import {
  formatMatchSnapshot,
  parseMatchSnapshot,
  parseMatchSnapshotJson,
  serializeMatchSnapshot
} from '../atoms-match-snapshot';
import {
  seedBoard,
  seedHoles,
  withPlayersHavingTakenTurns
} from './atoms-test-fixtures';

describe('atoms match snapshots', () => {
  it('serializes a fresh match as versioned JSON with ASCII board rows', () => {
    const snapshot = serializeMatchSnapshot({
      match: createMatch({ columns: 3, rows: 3 }),
      mode: 'npc',
      presetIndex: null
    });

    expect(snapshot).toMatchObject({
      match: {
        activePlayer: '1',
        board: ['[] [] []', '[] [] []', '[] [] []'],
        status: 'playing',
        turnNumber: 0,
        winner: null
      },
      mode: 'npc',
      presetIndex: null,
      ruleset: 'classic',
      version: 4
    });
  });

  it('round-trips an in-progress custom match with holes and neutral atoms', () => {
    const match = {
      ...seedBoard(
        seedHoles(
          createMatch({
            columns: 3,
            neutralAtoms: [{ column: 1, count: 1, row: 2 }],
            rows: 3
          }),
          [{ column: 1, row: 1 }]
        ),
        [
          { column: 0, count: 1, ownerId: 'player-1', row: 0 },
          { column: 2, count: 1, ownerId: 'player-2', row: 1 }
        ]
      ),
      activePlayerId: 'player-2' as const,
      turnNumber: 7
    };
    const snapshot = serializeMatchSnapshot({
      match: withPlayersHavingTakenTurns(match),
      mode: 'local',
      presetIndex: null
    });

    expect(snapshot.match.board).toEqual(['11 [] []', '[] .. 21', '[] N1 []']);

    const parsed = parseMatchSnapshot(snapshot);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.snapshot.match).toEqual(snapshot.match);
      expect(getCell(parsed.match, { column: 1, row: 1 })).toEqual({
        kind: 'hole'
      });
      expect(getCell(parsed.match, { column: 1, row: 2 })).toEqual({
        atomCount: 1,
        kind: 'tile',
        ownerId: null
      });
    }
  });

  it('round-trips destructible tile metadata without changing board tokens', () => {
    const match = {
      ...seedBoard(
        createMatch({
          columns: 3,
          destructibleTiles: [{ column: 1, hitPoints: 2, row: 0 }],
          rows: 3
        }),
        [{ column: 1, count: 1, hitPoints: 2, ownerId: 'player-1', row: 0 }]
      ),
      activePlayerId: 'player-2' as const,
      turnNumber: 3
    };
    const snapshot = serializeMatchSnapshot({
      match,
      mode: 'local',
      presetIndex: null
    });

    expect(snapshot).toMatchObject({
      match: {
        board: ['[] 11 []', '[] [] []', '[] [] []'],
        destructibleTiles: [{ column: 1, hitPoints: 2, row: 0 }]
      },
      ruleset: 'classic',
      version: 4
    });

    const parsed = parseMatchSnapshot(snapshot);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.snapshot).toEqual(snapshot);
      expect(getCell(parsed.match, { column: 1, row: 0 })).toEqual({
        atomCount: 1,
        hitPoints: 2,
        kind: 'tile',
        ownerId: 'player-1'
      });
    }
  });

  it('parses version 1 snapshots without neutral atom tokens', () => {
    const parsed = parseMatchSnapshot({
      match: {
        activePlayer: '1',
        board: ['[] 11 []', '[] .. []', '[] [] []'],
        players: [
          {
            color: '#2563eb',
            eliminated: false,
            hasTakenTurn: false,
            id: 'player-1',
            name: 'Player 1',
            token: '1'
          },
          {
            color: '#dc2626',
            eliminated: false,
            hasTakenTurn: false,
            id: 'player-2',
            name: 'Player 2',
            token: '2'
          }
        ],
        status: 'playing',
        turnNumber: 0,
        winner: null
      },
      mode: 'npc',
      presetIndex: null,
      version: 1
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.snapshot.version).toBe(4);
      expect(parsed.snapshot.ruleset).toBe('classic');
    }
  });

  it('parses flexible whitespace in ASCII board rows', () => {
    const parsed = parseMatchSnapshot({
      match: {
        activePlayer: '1',
        board: ['[]11[]', '  []   ..  [] ', '[] [] []'],
        players: [
          {
            color: '#2563eb',
            eliminated: false,
            hasTakenTurn: false,
            id: 'player-1',
            name: 'Player 1',
            token: '1'
          },
          {
            color: '#dc2626',
            eliminated: false,
            hasTakenTurn: false,
            id: 'player-2',
            name: 'Player 2',
            token: '2'
          }
        ],
        status: 'playing',
        turnNumber: 0,
        winner: null
      },
      mode: 'npc',
      presetIndex: null,
      version: 1
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.snapshot.match.board).toEqual([
        '[] 11 []',
        '[] .. []',
        '[] [] []'
      ]);
    }
  });

  it('rejects malformed cells, duplicate tokens, unknown players, and non-rectangular boards', () => {
    const base = serializeMatchSnapshot({
      match: createMatch({ columns: 3, rows: 3 }),
      mode: 'npc',
      presetIndex: null
    });

    expect(
      parseMatchSnapshot({
        ...base,
        match: { ...base.match, board: ['[] R1 []', '[] [] []', '[] [] []'] }
      }).ok
    ).toBe(false);
    expect(
      parseMatchSnapshot({
        ...base,
        match: { ...base.match, board: ['[] 10 []', '[] [] []', '[] [] []'] }
      }).ok
    ).toBe(false);
    expect(
      parseMatchSnapshot({
        ...base,
        match: {
          ...base.match,
          players: base.match.players.map(player => ({ ...player, token: '1' }))
        }
      }).ok
    ).toBe(false);
    expect(
      parseMatchSnapshot({
        ...base,
        match: {
          ...base.match,
          players: base.match.players.map(player =>
            player.id === 'player-2' ? { ...player, token: '3' } : player
          )
        }
      }).ok
    ).toBe(false);
    expect(
      parseMatchSnapshot({
        ...base,
        match: { ...base.match, board: ['[] []', '[] [] []'] }
      }).ok
    ).toBe(false);
    expect(
      parseMatchSnapshot({
        ...base,
        match: { ...base.match, activePlayer: '9' }
      }).ok
    ).toBe(false);
    expect(
      parseMatchSnapshot({
        ...base,
        match: { ...base.match, board: ['[] N1 []', '[] [] []', '[] [] []'] },
        version: 1
      }).ok
    ).toBe(false);
    expect(
      parseMatchSnapshot({
        ...base,
        match: {
          ...base.match,
          destructibleTiles: [{ column: 1, hitPoints: 1, row: 1 }]
        },
        version: 2
      }).ok
    ).toBe(false);
    expect(
      parseMatchSnapshot({
        ...base,
        match: {
          ...base.match,
          destructibleTiles: [{ column: 1, hitPoints: 10, row: 1 }]
        },
        version: 3
      }).ok
    ).toBe(false);
  });

  it('round-trips Shielded Atoms metadata without changing board tokens', () => {
    const match = seedBoard(
      createMatch({ columns: 3, rows: 3, ruleset: 'shielded' }),
      [
        { column: 0, count: 1, ownerId: 'player-1', row: 0 },
        { column: 1, count: 1, ownerId: 'player-2', row: 1 }
      ]
    );
    const shielded = {
      ...shieldTile(match, { column: 0, row: 0 }).state,
      activePlayerId: 'player-1' as const
    };

    const snapshot = serializeMatchSnapshot({
      match: shielded,
      mode: 'local',
      presetIndex: null
    });

    expect(snapshot).toMatchObject({
      match: {
        board: ['11 [] []', '[] 21 []', '[] [] []'],
        shieldCharges: { '1': 1, '2': 2 },
        shields: [{ column: 0, row: 0 }]
      },
      ruleset: 'shielded',
      version: 4
    });

    const parsed = parseMatchSnapshot(snapshot);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.snapshot).toEqual(snapshot);
      expect(parsed.match.ruleset).toBe('shielded');
      expect(parsed.match.shieldCharges).toEqual({
        'player-1': 1,
        'player-2': 2
      });
      expect(getTile(parsed.match, { column: 0, row: 0 })).toMatchObject({
        ownerId: 'player-1',
        shielded: true
      });
    }
  });

  it('rejects invalid Shield metadata', () => {
    const base = serializeMatchSnapshot({
      match: seedBoard(
        createMatch({ columns: 3, rows: 3, ruleset: 'shielded' }),
        [{ column: 0, count: 1, ownerId: 'player-1', row: 0 }]
      ),
      mode: 'npc',
      presetIndex: null
    });

    expect(
      parseMatchSnapshot({
        ...base,
        match: { ...base.match, shields: [{ column: 1, row: 1 }] }
      }).ok
    ).toBe(false);
    expect(
      parseMatchSnapshot({
        ...base,
        match: {
          ...base.match,
          shieldCharges: { '1': 1, '2': 2 },
          shields: [{ column: 0, row: 0 }]
        },
        ruleset: 'classic'
      }).ok
    ).toBe(false);
    expect(
      parseMatchSnapshot({
        ...base,
        match: { ...base.match, shieldCharges: { '1': 3, '2': 2 } }
      }).ok
    ).toBe(false);
  });

  it('rejects unstable playing snapshots but preserves terminal states', () => {
    const base = serializeMatchSnapshot({
      match: createMatch({ columns: 2, rows: 2 }),
      mode: 'npc',
      presetIndex: null
    });
    const criticalBoard = ['12 []', '[] []'];

    expect(
      parseMatchSnapshot({
        ...base,
        match: { ...base.match, board: criticalBoard }
      }).ok
    ).toBe(false);

    const terminal = parseMatchSnapshot({
      ...base,
      match: {
        ...base.match,
        board: criticalBoard,
        status: 'stalemate'
      }
    });

    expect(terminal.ok).toBe(true);
  });

  it('rejects critical neutral atoms in playing snapshots', () => {
    const base = serializeMatchSnapshot({
      match: createMatch({ columns: 2, rows: 2 }),
      mode: 'npc',
      presetIndex: null
    });

    expect(
      parseMatchSnapshot({
        ...base,
        match: { ...base.match, board: ['N2 []', '[] []'] }
      }).ok
    ).toBe(false);
  });

  it('formats and parses JSON snapshot strings', () => {
    const snapshot = serializeMatchSnapshot({
      match: createMatch({ columns: 3, rows: 3 }),
      mode: 'npc-vs-npc',
      presetIndex: 1
    });
    const parsed = parseMatchSnapshotJson(formatMatchSnapshot(snapshot));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.snapshot).toEqual(snapshot);
    }
  });

  it('round-trips terminal Victory snapshots from the engine', () => {
    const match = withPlayersHavingTakenTurns(
      seedBoard(createMatch({ columns: 3, rows: 3 }), [
        { column: 0, count: 1, ownerId: 'player-1', row: 0 },
        { column: 1, count: 2, ownerId: 'player-2', row: 0 },
        { column: 0, count: 1, ownerId: 'player-1', row: 1 }
      ])
    );
    const result = placeAtom(match, { column: 0, row: 0 });
    const parsed = parseMatchSnapshot(
      serializeMatchSnapshot({
        match: result.state,
        mode: 'npc',
        presetIndex: null
      })
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.match.status).toBe('won');
      expect(parsed.match.winnerId).toBe('player-1');
    }
  });
});
