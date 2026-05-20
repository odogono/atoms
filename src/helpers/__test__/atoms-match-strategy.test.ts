import { describe, expect, it } from 'bun:test';

import {
  baselineMatchStrategy,
  defaultNpcMatchStrategy,
  getMatchStrategy,
  tacticalMatchStrategy
} from '../atoms-match-strategy';

describe('atoms match strategies', () => {
  it('registers baseline, tactical, and legacy heuristic strategy ids', () => {
    expect(getMatchStrategy('baseline')).toBe(baselineMatchStrategy);
    expect(getMatchStrategy('tactical')).toBe(tacticalMatchStrategy);
    expect(getMatchStrategy('heuristic')).toBe(baselineMatchStrategy);
  });

  it('uses tactical as the default NPC strategy', () => {
    expect(defaultNpcMatchStrategy).toBe(tacticalMatchStrategy);
  });
});
