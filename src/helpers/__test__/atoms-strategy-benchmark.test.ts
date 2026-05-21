import { describe, expect, it } from 'bun:test';

import {
  createMatch,
  getLegalPlacements,
  isDestructibleTile
} from '../atoms-match-rules';
import { type MatchStrategy } from '../atoms-match-strategy';
import {
  createBenchmarkCorpus,
  getStrategyBenchmarkLadder,
  runStrategyBenchmark,
  runStrategyBenchmarkLadder,
  runStrategyDuel,
  type StrategyBenchmarkDuelResult
} from '../atoms-strategy-benchmark';

const firstLegalStrategy: MatchStrategy = {
  choosePlacement: match => getLegalPlacements(match)[0] ?? null,
  id: 'first-legal'
};

const stalledStrategy: MatchStrategy = {
  choosePlacement: () => null,
  id: 'stalled'
};

describe('atoms strategy benchmark', () => {
  it('classifies a stalled duel as a draw', () => {
    const result = runStrategyDuel(createMatch({ columns: 3, rows: 3 }), {
      baseline: firstLegalStrategy,
      challenger: stalledStrategy,
      challengerPlayerId: 'player-1',
      maxTurns: 4
    });

    expect(result.outcome).toBe('draw');
    expect(result.reason).toBe('stalled');
    expect(result.score).toBe(0.5);
  });

  it('scores benchmark pass and failure from decisive and drawn duels', () => {
    const duels = [
      { outcome: 'challenger-win', score: 1 },
      { outcome: 'challenger-win', score: 1 },
      { outcome: 'baseline-win', score: 0 },
      { outcome: 'draw', score: 0.5 }
    ] as StrategyBenchmarkDuelResult[];

    const summary = runStrategyBenchmark(duels, {
      baselineId: 'baseline',
      challengerId: 'tactical'
    });

    expect(summary.challengerDecisiveWinRate).toBeCloseTo(2 / 3);
    expect(summary.challengerScoreRate).toBe(0.625);
    expect(summary.passed).toBe(true);

    const failure = runStrategyBenchmark(duels.slice(1), {
      baselineId: 'baseline',
      challengerId: 'tactical'
    });

    expect(failure.challengerDecisiveWinRate).toBe(0.5);
    expect(failure.passed).toBe(false);
  });

  it('creates a deterministic generated midgame corpus', () => {
    const corpus = createBenchmarkCorpus();

    expect(corpus.length).toBeGreaterThan(0);
    expect(corpus.every(entry => entry.match.status === 'playing')).toBe(true);
    expect(corpus.some(entry => entry.source === 'generated-midgame')).toBe(
      true
    );
  });

  it('includes neutral, hole, and destructible states in the generated corpus', () => {
    const corpus = createBenchmarkCorpus();

    expect(
      corpus.some(entry =>
        entry.match.cells.some(
          cell => cell.kind === 'tile' && !cell.ownerId && cell.atomCount > 0
        )
      )
    ).toBe(true);
    expect(
      corpus.some(entry => entry.match.cells.some(cell => cell.kind === 'hole'))
    ).toBe(true);
    expect(
      corpus.some(entry =>
        entry.match.cells.some(cell => isDestructibleTile(cell))
      )
    ).toBe(true);
  });

  it('defines a beginner-to-tactical benchmark ladder', () => {
    expect(getStrategyBenchmarkLadder().map(strategy => strategy.id)).toEqual([
      'first-legal',
      'low-capacity',
      'baseline',
      'tactical'
    ]);
  });

  it('runs seat-swapped tactical benchmarks against each weaker ladder strategy', () => {
    const corpus = createBenchmarkCorpus().slice(0, 2);
    const ladder = runStrategyBenchmarkLadder(corpus, { maxTurns: 20 });

    expect(ladder.map(result => result.summary.baselineId)).toEqual([
      'first-legal',
      'low-capacity',
      'baseline'
    ]);
    expect(
      ladder.every(
        result =>
          result.summary.challengerId === 'tactical' &&
          result.duels.length === corpus.length * 2 &&
          result.duels.some(duel => duel.challengerPlayerId === 'player-1') &&
          result.duels.some(duel => duel.challengerPlayerId === 'player-2')
      )
    ).toBe(true);
  });
});
