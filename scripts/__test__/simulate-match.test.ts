import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

import { seedBoard } from '../../src/helpers/__test__/atoms-test-fixtures';
import { createMatch } from '../../src/helpers/atoms-match-rules';
import {
  formatMatchSnapshot,
  serializeMatchSnapshot
} from '../../src/helpers/atoms-match-snapshot';

const runCli = (args: string[], stdin?: string) =>
  Bun.spawnSync({
    cmd: ['bun', 'run', 'simulate-match', '--', ...args],
    cwd: process.cwd(),
    stderr: 'pipe',
    stdin: stdin ? new Response(stdin) : undefined,
    stdout: 'pipe'
  });

const createSnapshotSource = () =>
  formatMatchSnapshot(
    serializeMatchSnapshot({
      match: createMatch({ columns: 3, rows: 3 }),
      mode: 'local',
      presetIndex: null
    })
  );

describe('simulate-match CLI', () => {
  it('reads a snapshot file and prints a human summary by default', () => {
    const directory = mkdtempSync(join(tmpdir(), 'atoms-simulate-'));
    const snapshotPath = join(directory, 'snapshot.json');
    writeFileSync(snapshotPath, createSnapshotSource());

    const result = runCli([snapshotPath, '--max-turns', '1']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('Outcome: turn-cap-reached');
    expect(result.stdout.toString()).toContain('Strategy: heuristic');
    expect(result.stdout.toString()).toContain('Turns simulated: 1');
  });

  it('reads stdin and prints JSON when requested', () => {
    const result = runCli(
      ['--json', '--max-turns', '1'],
      createSnapshotSource()
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout.toString());
    expect(output).toMatchObject({
      finalStatus: 'playing',
      maxTurns: 1,
      outcome: 'turn-cap-reached',
      strategyId: 'heuristic',
      turnsSimulated: 1
    });
    expect(output.finalBoardControl.players).toHaveLength(2);
  });

  it('rejects invalid JSON input', () => {
    const result = runCli(['--json'], '{');

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('JSON Parse error');
  });

  it('rejects invalid snapshots', () => {
    const result = runCli(['--json'], '{"version":2}');

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('match must be an object');
  });

  it('rejects invalid max turn arguments', () => {
    const result = runCli(['--max-turns', '0'], createSnapshotSource());

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      '--max-turns must be a positive integer'
    );
  });

  it('rejects unknown strategies', () => {
    const result = runCli(['--strategy', 'random'], createSnapshotSource());

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('Unknown strategy: random');
  });

  it('prints terminal snapshot results without simulating turns', () => {
    const terminal = formatMatchSnapshot(
      serializeMatchSnapshot({
        match: {
          ...seedBoard(createMatch({ columns: 3, rows: 3 }), [
            { column: 0, count: 1, ownerId: 'player-1', row: 0 }
          ]),
          status: 'won',
          winnerId: 'player-1'
        },
        mode: 'npc-vs-npc',
        presetIndex: null
      })
    );

    const result = runCli(['--json'], terminal);
    const output = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(0);
    expect(output.outcome).toBe('won');
    expect(output.turnsSimulated).toBe(0);
    expect(output.winnerId).toBe('player-1');
  });
});
