import { describe, expect, it } from 'bun:test';

import {
  BOARD_SIZE_PRESETS,
  applyMove,
  chooseNpcMove,
  createGame,
  getCapacity,
  getLegalMoves,
  getTile,
  isLegalMove,
  type GameState,
  type PlayerId
} from '../atoms-game';

const withTiles = (
  game: GameState,
  tiles: Array<{
    column: number;
    count: number;
    ownerId: PlayerId;
    row: number;
  }>
) => {
  const next: GameState = {
    ...game,
    tiles: game.tiles.map(tile => ({ ...tile }))
  };

  for (const tile of tiles) {
    next.tiles[tile.row * game.columns + tile.column] = {
      atomCount: tile.count,
      ownerId: tile.ownerId
    };
  }

  return next;
};

describe('atoms game rules', () => {
  it('uses neighbour count as tile capacity', () => {
    const game = createGame({ columns: 4, rows: 4 });

    expect(getCapacity(game, { column: 0, row: 0 })).toBe(2);
    expect(getCapacity(game, { column: 1, row: 0 })).toBe(3);
    expect(getCapacity(game, { column: 1, row: 1 })).toBe(4);
  });

  it('allows placement on empty or owned tiles and rejects opponent tiles', () => {
    const game = withTiles(createGame({ columns: 3, rows: 3 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 1, ownerId: 'player-2', row: 0 }
    ]);

    expect(isLegalMove(game, { column: 2, row: 0 })).toBe(true);
    expect(isLegalMove(game, { column: 0, row: 0 })).toBe(true);
    expect(isLegalMove(game, { column: 1, row: 0 })).toBe(false);
  });

  it('converts and increments a captured destination during an explosion', () => {
    const game = withTiles(createGame({ columns: 3, rows: 3 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 1, ownerId: 'player-2', row: 0 }
    ]);

    const result = applyMove(game, { column: 0, row: 0 });

    expect(result.waves).toHaveLength(1);
    expect(getTile(result.state, { column: 1, row: 0 })).toEqual({
      atomCount: 2,
      ownerId: 'player-1'
    });
  });

  it('empties all wave sources before applying incoming atoms', () => {
    const game = withTiles(createGame({ columns: 3, rows: 3 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 2, ownerId: 'player-2', row: 0 }
    ]);

    const result = applyMove(game, { column: 0, row: 0 });

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
    const game = withTiles(createGame({ columns: 3, rows: 3 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 2, ownerId: 'player-2', row: 0 },
      { column: 0, count: 1, ownerId: 'player-1', row: 1 }
    ]);
    const afterPlayerTwoHasPlayed: GameState = {
      ...game,
      players: game.players.map(player => ({
        ...player,
        hasTakenTurn: true
      }))
    };

    const result = applyMove(afterPlayerTwoHasPlayed, { column: 0, row: 0 });

    expect(result.waves).toHaveLength(1);
    expect(
      result.state.players.find(player => player.id === 'player-2')
    ).toMatchObject({ eliminated: true });
    expect(result.state.status).toBe('won');
    expect(result.state.winnerId).toBe('player-1');
  });

  it('ends as a stalemate when a cascade repeats with multiple remaining players', () => {
    const game = withTiles(createGame({ columns: 2, rows: 2 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 1, ownerId: 'player-1', row: 0 },
      { column: 0, count: 1, ownerId: 'player-1', row: 1 },
      { column: 1, count: 1, ownerId: 'player-1', row: 1 }
    ]);

    const result = applyMove(game, { column: 0, row: 0 });

    expect(result.state.status).toBe('stalemate');
    expect(result.state.winnerId).toBe(null);
    expect(
      result.state.players.find(player => player.id === 'player-2')
    ).toMatchObject({ eliminated: false, hasTakenTurn: false });
    expect(result.waves.length).toBeLessThan(10);
  });

  it('ends a repeating cascade as victory when one eligible player owns no atoms', () => {
    const game = withTiles(createGame({ columns: 2, rows: 2 }), [
      { column: 0, count: 1, ownerId: 'player-2', row: 0 },
      { column: 1, count: 1, ownerId: 'player-2', row: 0 },
      { column: 0, count: 1, ownerId: 'player-2', row: 1 },
      { column: 1, count: 1, ownerId: 'player-2', row: 1 }
    ]);
    const afterBothPlayersHavePlayed: GameState = {
      ...game,
      activePlayerId: 'player-2',
      players: game.players.map(player => ({
        ...player,
        hasTakenTurn: true
      }))
    };

    const result = applyMove(afterBothPlayersHavePlayed, {
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
    const game = createGame({ columns: 3, rows: 3 });

    const result = applyMove(game, { column: 0, row: 0 });

    expect(
      result.state.players.find(player => player.id === 'player-2')
    ).toMatchObject({ eliminated: false, hasTakenTurn: false });
    expect(result.state.status).toBe('playing');
  });

  it('keeps the engine generic for up to four players', () => {
    const game = createGame({ columns: 6, playerCount: 4, rows: 6 });

    expect(game.players).toHaveLength(4);
    expect(getLegalMoves(game)).toHaveLength(36);
  });

  it('has the planned board size presets', () => {
    expect(BOARD_SIZE_PRESETS).toEqual([
      { columns: 6, label: 'Small', rows: 6 },
      { columns: 8, label: 'Standard', rows: 8 },
      { columns: 10, label: 'Large', rows: 10 }
    ]);
  });

  it('chooses a legal NPC move and prefers an obvious winning capture', () => {
    const game = withTiles(createGame({ columns: 3, rows: 3 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 0, count: 2, ownerId: 'player-2', row: 1 },
      { column: 2, count: 1, ownerId: 'player-2', row: 2 }
    ]);
    const npcTurnGame: GameState = {
      ...game,
      activePlayerId: 'player-2',
      players: game.players.map(player => ({
        ...player,
        hasTakenTurn: true
      }))
    };

    expect(chooseNpcMove(npcTurnGame)).toEqual({ column: 0, row: 1 });
    expect(isLegalMove(npcTurnGame, chooseNpcMove(npcTurnGame)!)).toBe(true);
  });

  it('avoids a stalemate move when a non-stalemate move is available', () => {
    const game = withTiles(createGame({ columns: 3, rows: 3 }), [
      { column: 0, count: 1, ownerId: 'player-1', row: 0 },
      { column: 1, count: 2, ownerId: 'player-1', row: 0 },
      { column: 2, count: 1, ownerId: 'player-1', row: 0 },
      { column: 0, count: 2, ownerId: 'player-2', row: 1 },
      { column: 1, count: 1, ownerId: 'player-1', row: 1 },
      { column: 2, count: 2, ownerId: 'player-1', row: 1 },
      { column: 0, count: 1, ownerId: 'player-1', row: 2 },
      { column: 2, count: 1, ownerId: 'player-1', row: 2 }
    ]);
    const npcTurnGame: GameState = {
      ...game,
      activePlayerId: 'player-1'
    };
    const move = chooseNpcMove(npcTurnGame);

    expect(move).not.toBe(null);
    expect(applyMove(npcTurnGame, move!).state.status).not.toBe('stalemate');
  });
});
