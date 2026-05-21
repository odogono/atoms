import { describe, expect, it } from 'bun:test';

import { createMatch, isLegalPlacement } from '../atoms-match-rules';
import {
  baselineMatchStrategy,
  defaultNpcMatchStrategy,
  firstLegalMatchStrategy,
  getMatchStrategy,
  lowCapacityMatchStrategy,
  tacticalMatchStrategy
} from '../atoms-match-strategy';

describe('atoms match strategies', () => {
  it('registers beginner, baseline, tactical, and legacy heuristic strategy ids', () => {
    expect(getMatchStrategy('first-legal')).toBe(firstLegalMatchStrategy);
    expect(getMatchStrategy('low-capacity')).toBe(lowCapacityMatchStrategy);
    expect(getMatchStrategy('baseline')).toBe(baselineMatchStrategy);
    expect(getMatchStrategy('tactical')).toBe(tacticalMatchStrategy);
    expect(getMatchStrategy('heuristic')).toBe(baselineMatchStrategy);
  });

  it('uses tactical as the default NPC strategy', () => {
    expect(defaultNpcMatchStrategy).toBe(tacticalMatchStrategy);
  });

  it('beginner strategies choose legal placements', () => {
    const match = createMatch({ columns: 4, rows: 4 });

    const firstLegalPlacement = firstLegalMatchStrategy.choosePlacement(match);
    const lowCapacityPlacement =
      lowCapacityMatchStrategy.choosePlacement(match);

    expect(firstLegalPlacement).not.toBe(null);
    expect(lowCapacityPlacement).not.toBe(null);
    expect(isLegalPlacement(match, firstLegalPlacement!)).toBe(true);
    expect(isLegalPlacement(match, lowCapacityPlacement!)).toBe(true);
  });
});
