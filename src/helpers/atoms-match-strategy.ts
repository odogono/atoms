import {
  getCapacity,
  getLegalPlacements,
  getTile,
  type MatchState,
  type Position
} from './atoms-match-rules';
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

const comparePositions = (a: Position, b: Position) =>
  a.row - b.row || a.column - b.column;

export const firstLegalMatchStrategy: MatchStrategy = {
  choosePlacement: match => getLegalPlacements(match)[0] ?? null,
  id: 'first-legal'
};

export const lowCapacityMatchStrategy: MatchStrategy = {
  choosePlacement: match =>
    getLegalPlacements(match)
      .map(placement => ({
        atomCount: getTile(match, placement).atomCount,
        capacity: getCapacity(match, placement),
        placement
      }))
      .sort(
        (a, b) =>
          a.capacity - b.capacity ||
          b.atomCount - a.atomCount ||
          comparePositions(a.placement, b.placement)
      )[0]?.placement ?? null,
  id: 'low-capacity'
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
  firstLegalMatchStrategy,
  lowCapacityMatchStrategy,
  baselineMatchStrategy,
  tacticalMatchStrategy
] as const satisfies readonly MatchStrategy[];

export const getMatchStrategy = (id: string): MatchStrategy | null =>
  id === 'heuristic'
    ? baselineMatchStrategy
    : (MATCH_STRATEGIES.find(strategy => strategy.id === id) ?? null);
