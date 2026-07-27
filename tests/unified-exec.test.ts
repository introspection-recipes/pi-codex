import assert from "node:assert/strict";
import test from "node:test";
import { createUnifiedExecTools } from "../extensions/codex/unified-exec.js";

const ctx = { cwd: process.cwd() } as never;

test("exec_command returns output and an exit code for a quick command", async () => {
  const exec = createUnifiedExecTools();
  try {
    const result = await exec.execCommandTool.execute(
      "quick",
      {
        cmd: `${process.execPath} -e "process.stdout.write('quick-ok')"`,
        workdir: process.cwd(),
        yield_time_ms: 5_000,
      },
      undefined,
      undefined,
      ctx,
    );
    assert.equal(result.details?.exit_code, 0);
    assert.match(result.details?.output ?? "", /quick-ok/);
    assert.equal(result.details?.session_id, undefined);
  } finally {
    exec.closeAll();
  }
});

test("write_stdin polls a yielded command to completion", async () => {
  const exec = createUnifiedExecTools();
  try {
    const started = await exec.execCommandTool.execute(
      "yielded",
      {
        cmd: `${process.execPath} -e "setTimeout(() => console.log('later-ok'), 150)"`,
        workdir: process.cwd(),
        yield_time_ms: 25,
      },
      undefined,
      undefined,
      ctx,
    );
    const sessionId = started.details?.session_id;
    assert.equal(typeof sessionId, "number");

    const completed = await exec.writeStdinTool.execute(
      "poll",
      { session_id: sessionId!, yield_time_ms: 2_000 },
      undefined,
      undefined,
      ctx,
    );
    assert.equal(completed.details?.exit_code, 0);
    assert.match(completed.details?.output ?? "", /later-ok/);
  } finally {
    exec.closeAll();
  }
});

test("write_stdin sends input to a PTY session", async () => {
  const exec = createUnifiedExecTools();
  try {
    const started = await exec.execCommandTool.execute(
      "pty",
      {
        cmd: `${process.execPath} -e "process.stdin.once('data', data => { console.log('input:' + data.toString().trim()); process.exit(0); })"`,
        workdir: process.cwd(),
        tty: true,
        yield_time_ms: 25,
      },
      undefined,
      undefined,
      ctx,
    );
    const sessionId = started.details?.session_id;
    assert.equal(typeof sessionId, "number");

    const completed = await exec.writeStdinTool.execute(
      "input",
      { session_id: sessionId!, chars: "hello\n", yield_time_ms: 2_000 },
      undefined,
      undefined,
      ctx,
    );
    assert.equal(completed.details?.exit_code, 0);
    assert.match(completed.details?.output ?? "", /input:hello/);
  } finally {
    exec.closeAll();
  }
});

test("aborting exec_command terminates the process", async () => {
  const exec = createUnifiedExecTools();
  const controller = new AbortController();
  try {
    setTimeout(() => controller.abort(), 50);
    const result = await exec.execCommandTool.execute(
      "abort",
      {
        cmd: `${process.execPath} -e "setInterval(() => {}, 1000)"`,
        workdir: process.cwd(),
        yield_time_ms: 5_000,
      },
      controller.signal,
      undefined,
      ctx,
    );
    assert.equal(result.details?.exit_code, 1);
    assert.equal(result.details?.session_id, undefined);
  } finally {
    exec.closeAll();
  }
});
