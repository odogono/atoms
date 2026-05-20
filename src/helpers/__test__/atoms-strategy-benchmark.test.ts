import { describe, expect, it } from 'bun:test';

import { createMatch, getLegalPlacements } from '../atoms-match-rules';
import { type MatchStrategy } from '../atoms-match-strategy';
import {
  createBenchmarkCorpus,
  runStrategyBenchmark,
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
});
