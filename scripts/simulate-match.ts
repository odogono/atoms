import { readFile } from 'node:fs/promises';

import {
  DEFAULT_MAX_SIMULATION_TURNS,
  simulateNpcMatch,
  type MatchSimulationResult
} from '../src/helpers/atoms-match-simulation';
import {
  parseMatchSnapshotJson,
  type ParseSnapshotResult
} from '../src/helpers/atoms-match-snapshot';
import { type MatchMetric } from '../src/helpers/atoms-match-stats';
import { getMatchStrategy } from '../src/helpers/atoms-match-strategy';

type CliOptions = {
  inputPath: string | null;
  json: boolean;
  maxTurns: number;
  strategyId: string;
};

type ParsedSnapshotSuccess = Extract<ParseSnapshotResult, { ok: true }>;

const usage = `Usage: bun run simulate-match -- [snapshot.json] [--json] [--max-turns N] [--strategy heuristic]\n`;

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const parsePositiveInteger = (value: string, flag: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    fail(`${flag} must be a positive integer.`);
  }
  return parsed;
};

const readFlagValue = (args: string[], index: number, flag: string): string => {
  const value = args[index + 1] ?? fail(`${flag} requires a value.`);
  if (value.startsWith('--')) {
    fail(`${flag} requires a value.`);
  }
  return value;
};

const parseArgs = (args: string[]): CliOptions => {
  const options: CliOptions = {
    inputPath: null,
    json: false,
    maxTurns: DEFAULT_MAX_SIMULATION_TURNS,
    strategyId: 'heuristic'
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;

    if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage);
      process.exit(0);
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--max-turns') {
      options.maxTurns = parsePositiveInteger(
        readFlagValue(args, index, '--max-turns'),
        '--max-turns'
      );
      index += 1;
      continue;
    }

    if (arg.startsWith('--max-turns=')) {
      options.maxTurns = parsePositiveInteger(
        arg.slice('--max-turns='.length),
        '--max-turns'
      );
      continue;
    }

    if (arg === '--strategy') {
      options.strategyId = readFlagValue(args, index, '--strategy');
      index += 1;
      continue;
    }

    if (arg.startsWith('--strategy=')) {
      options.strategyId = arg.slice('--strategy='.length);
      continue;
    }

    if (arg.startsWith('--')) {
      fail(`Unknown option: ${arg}\n${usage}`);
    }

    if (options.inputPath) {
      fail('Only one snapshot path can be provided.');
    }

    options.inputPath = arg;
  }

  return options;
};

const readSnapshotSource = async (inputPath: string | null) =>
  inputPath ? readFile(inputPath, 'utf8') : Bun.stdin.text();

const isParsedSnapshotSuccess = (
  result: ParseSnapshotResult
): result is ParsedSnapshotSuccess => result.ok;

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const formatMetricPlayers = (metric: MatchMetric) =>
  metric.players
    .map(
      player =>
        `${player.playerId}: ${player.value.toFixed(3)} (${formatPercent(
          player.share
        )})`
    )
    .join(', ');

const toPrintableResult = ({
  finalMatch: _finalMatch,
  ...rest
}: MatchSimulationResult) => rest;

const formatHumanResult = (result: MatchSimulationResult) =>
  [
    `Outcome: ${result.outcome}`,
    `Strategy: ${result.strategyId}`,
    `Final status: ${result.finalStatus}`,
    `Winner: ${result.winnerId ?? 'none'}`,
    `Stalled player: ${result.stalledPlayerId ?? 'none'}`,
    `Turns simulated: ${result.turnsSimulated}`,
    `Turn number: ${result.startingTurnNumber} -> ${result.endingTurnNumber}`,
    `Completed rounds: ${result.completedRounds}`,
    `Explosion waves: ${result.totalExplosionWaves} total, ${result.maxCascadeWaves} max cascade`,
    `Board control: ${formatMetricPlayers(result.finalBoardControl)}`,
    `Board control delta: ${formatMetricPlayers(result.boardControlDelta)}`,
    `Critical pressure: ${formatMetricPlayers(result.finalCriticalPressure)}`
  ].join('\n');

const main = async () => {
  const options = parseArgs(Bun.argv.slice(2));
  const strategy =
    getMatchStrategy(options.strategyId) ??
    fail(`Unknown strategy: ${options.strategyId}`);

  const source = await readSnapshotSource(options.inputPath);
  const parsed = parseMatchSnapshotJson(source);
  const match = isParsedSnapshotSuccess(parsed)
    ? parsed.match
    : fail(parsed.errors.join('\n'));

  const result = simulateNpcMatch(match, {
    maxTurns: options.maxTurns,
    strategy
  });

  process.stdout.write(
    options.json
      ? `${JSON.stringify(toPrintableResult(result), null, 2)}\n`
      : `${formatHumanResult(result)}\n`
  );
};

await main();
