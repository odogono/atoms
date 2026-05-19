import { describe, expect, it } from 'bun:test';

import {
  MATCH_TIMINGS,
  createMatchFlowState,
  updateMatchFlow,
  type MatchFlowEffect,
  type MatchFlowState
} from '../atoms-match-flow';
import { createMatch, getTile } from '../atoms-match-rules';
import { seedBoard, withPlayersHavingTakenTurns } from './atoms-test-fixtures';

const applyEffect = (state: MatchFlowState, effect: MatchFlowEffect) =>
  updateMatchFlow(state, effect.event);

const drainEffects = (state: MatchFlowState, effects: MatchFlowEffect[]) => {
  let nextState = state;
  let nextEffects = effects;

  while (nextEffects.length > 0) {
    const update = applyEffect(nextState, nextEffects[0]!);
    nextState = update.state;
    nextEffects = update.effects;
  }

  return nextState;
};

describe('atoms match flow', () => {
  it('plays a legal human move through its explosion wave playback', () => {
    const initial = createMatchFlowState({ mode: 'local', presetIndex: 0 });
    const flow: MatchFlowState = {
      ...initial,
      match: seedBoard(initial.match, [
        { column: 0, count: 1, ownerId: 'player-1', row: 0 }
      ])
    };

    const started = updateMatchFlow(flow, {
      position: { column: 0, row: 0 },
      type: 'attempt-move'
    });

    expect(started.state.isResolving).toBe(true);
    expect(started.state.currentWave?.sources).toEqual([
      { column: 0, ownerId: 'player-1', row: 0 }
    ]);
    expect(getTile(started.state.match, { column: 0, row: 0 })).toEqual({
      atomCount: 2,
      kind: 'tile',
      ownerId: 'player-1'
    });
    expect(started.effects).toEqual([
      {
        delayMs: MATCH_TIMINGS.waveDurationMs,
        event: {
          runId: started.state.runId,
          type: 'finish-wave',
          waveIndex: 0
        }
      }
    ]);

    const hidden = applyEffect(started.state, started.effects[0]!);

    expect(hidden.state.isResolving).toBe(true);
    expect(hidden.state.currentWave).toBe(null);
    expect(hidden.effects).toEqual([
      {
        delayMs: MATCH_TIMINGS.playbackPauseMs,
        event: {
          runId: started.state.runId,
          type: 'advance-playback',
          waveIndex: 0
        }
      }
    ]);

    const finished = applyEffect(hidden.state, hidden.effects[0]!);

    expect(finished.state.isResolving).toBe(false);
    expect(finished.state.currentWave).toBe(null);
    expect(finished.state.match.activePlayerId).toBe('player-2');
    expect(getTile(finished.state.match, { column: 0, row: 0 })).toEqual({
      atomCount: 0,
      kind: 'tile',
      ownerId: null
    });
    expect(finished.effects).toEqual([]);
  });

  it('flashes an illegal tile and ignores stale flash clearing after reset', () => {
    const initial = createMatchFlowState({ mode: 'local' });
    const flow: MatchFlowState = {
      ...initial,
      match: seedBoard(initial.match, [
        { column: 1, count: 1, ownerId: 'player-2', row: 0 }
      ])
    };

    const illegal = updateMatchFlow(flow, {
      position: { column: 1, row: 0 },
      type: 'attempt-move'
    });

    expect(illegal.state.illegalTile).toEqual({ column: 1, row: 0 });
    expect(illegal.state.match).toEqual(flow.match);
    expect(illegal.effects).toEqual([
      {
        delayMs: MATCH_TIMINGS.illegalFlashMs,
        event: {
          runId: illegal.state.runId,
          type: 'clear-illegal-flash'
        }
      }
    ]);

    const reset = updateMatchFlow(illegal.state, { type: 'reset' });
    const staleClear = applyEffect(reset.state, illegal.effects[0]!);

    expect(staleClear.state.illegalTile).toBe(null);
    expect(staleClear.state.runId).toBe(reset.state.runId);
    expect(staleClear.state.match.turnNumber).toBe(0);
  });

  it('schedules and executes NPC moves through the same match flow', () => {
    const flow = createMatchFlowState({ mode: 'npc' });

    const playerMove = updateMatchFlow(flow, {
      position: { column: 0, row: 0 },
      type: 'attempt-move'
    });

    expect(playerMove.state.isResolving).toBe(false);
    expect(playerMove.state.match.activePlayerId).toBe('player-2');
    expect(playerMove.effects).toEqual([
      {
        delayMs: MATCH_TIMINGS.npcDelayMs,
        event: {
          runId: playerMove.state.runId,
          type: 'execute-npc-move'
        }
      }
    ]);

    const npcMove = applyEffect(playerMove.state, playerMove.effects[0]!);

    expect(npcMove.state.match.turnNumber).toBe(2);
    expect(npcMove.state.match.activePlayerId).toBe('player-1');
    expect(npcMove.state.isResolving).toBe(false);
  });

  it('ignores stale NPC work after a reset changes the run identity', () => {
    const playerMove = updateMatchFlow(createMatchFlowState({ mode: 'npc' }), {
      position: { column: 0, row: 0 },
      type: 'attempt-move'
    });

    const reset = updateMatchFlow(playerMove.state, { type: 'reset' });
    const staleNpc = applyEffect(reset.state, playerMove.effects[0]!);

    expect(staleNpc.state.runId).toBe(reset.state.runId);
    expect(staleNpc.state.match.turnNumber).toBe(0);
    expect(staleNpc.effects).toEqual([]);
  });

  it('starts a new match with selected setup in one flow update', () => {
    const playerMove = updateMatchFlow(createMatchFlowState({ mode: 'npc' }), {
      position: { column: 0, row: 0 },
      type: 'attempt-move'
    });

    const started = updateMatchFlow(playerMove.state, {
      mode: 'local',
      presetIndex: 0,
      type: 'start-match'
    });
    const staleNpc = applyEffect(started.state, playerMove.effects[0]!);

    expect(started.state.mode).toBe('local');
    expect(started.state.presetIndex).toBe(0);
    expect(started.state.match.rows).toBe(6);
    expect(started.state.match.turnNumber).toBe(0);
    expect(staleNpc.state).toEqual(started.state);
    expect(staleNpc.effects).toEqual([]);
  });

  it('does not schedule NPC work after terminal Victory or Stalemate', () => {
    const victoryStart = createMatchFlowState({ mode: 'npc', presetIndex: 0 });
    const victoryFlow: MatchFlowState = {
      ...victoryStart,
      match: withPlayersHavingTakenTurns(
        seedBoard(victoryStart.match, [
          { column: 0, count: 1, ownerId: 'player-1', row: 0 },
          { column: 1, count: 2, ownerId: 'player-2', row: 0 },
          { column: 0, count: 1, ownerId: 'player-1', row: 1 }
        ])
      )
    };

    const victoryUpdate = updateMatchFlow(victoryFlow, {
      position: { column: 0, row: 0 },
      type: 'attempt-move'
    });
    const victory = drainEffects(victoryUpdate.state, victoryUpdate.effects);

    expect(victory.match.status).toBe('won');
    expect(victory.match.winnerId).toBe('player-1');

    const stalemateStart = createMatchFlowState({
      mode: 'npc',
      presetIndex: 0
    });
    const stalemateFlow: MatchFlowState = {
      ...stalemateStart,
      match: seedBoard(createMatch({ columns: 2, rows: 2 }), [
        { column: 0, count: 1, ownerId: 'player-1', row: 0 },
        { column: 1, count: 1, ownerId: 'player-1', row: 0 },
        { column: 0, count: 1, ownerId: 'player-1', row: 1 },
        { column: 1, count: 1, ownerId: 'player-1', row: 1 }
      ])
    };
    const stalemateUpdate = updateMatchFlow(stalemateFlow, {
      position: { column: 0, row: 0 },
      type: 'attempt-move'
    });
    const stalemate = drainEffects(
      stalemateUpdate.state,
      stalemateUpdate.effects
    );

    expect(stalemate.match.status).toBe('stalemate');
    expect(stalemate.match.winnerId).toBe(null);
  });
});
