import { type MatchState, type Position } from './atoms-match-rules';
import { chooseNpcPlacement } from './atoms-npc-strategy';

type MatchStrategyId = 'heuristic';

export type MatchStrategy = {
  choosePlacement: (match: MatchState) => Position | null;
  id: MatchStrategyId;
};

export const heuristicMatchStrategy: MatchStrategy = {
  choosePlacement: chooseNpcPlacement,
  id: 'heuristic'
};

const MATCH_STRATEGIES = [
  heuristicMatchStrategy
] as const satisfies readonly MatchStrategy[];

export const getMatchStrategy = (id: string): MatchStrategy | null =>
  MATCH_STRATEGIES.find(strategy => strategy.id === id) ?? null;
