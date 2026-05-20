import { type MatchState, type Position } from './atoms-match-rules';
import {
  chooseBaselineNpcPlacement,
  chooseTacticalNpcPlacement
} from './atoms-npc-strategy';

type MatchStrategyId =
  | 'baseline'
  | 'first-legal'
  | 'heuristic'
  | 'tactical'
  | string;

export type MatchStrategy = {
  choosePlacement: (match: MatchState) => Position | null;
  id: MatchStrategyId;
};

export const baselineMatchStrategy: MatchStrategy = {
  choosePlacement: chooseBaselineNpcPlacement,
  id: 'baseline'
};

export const heuristicMatchStrategy = baselineMatchStrategy;

export const tacticalMatchStrategy: MatchStrategy = {
  choosePlacement: chooseTacticalNpcPlacement,
  id: 'tactical'
};

export const defaultNpcMatchStrategy = tacticalMatchStrategy;

const MATCH_STRATEGIES = [
  baselineMatchStrategy,
  tacticalMatchStrategy
] as const satisfies readonly MatchStrategy[];

export const getMatchStrategy = (id: string): MatchStrategy | null =>
  id === 'heuristic'
    ? baselineMatchStrategy
    : (MATCH_STRATEGIES.find(strategy => strategy.id === id) ?? null);
