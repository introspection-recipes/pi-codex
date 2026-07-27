import { spawn as spawnChild, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn as spawnPty, type IPty } from "node-pty";
import { Type, type Static } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

const DEFAULT_EXEC_YIELD_MS = 10_000;
const DEFAULT_POLL_YIELD_MS = 5_000;
const DEFAULT_WRITE_YIELD_MS = 250;
const DEFAULT_MAX_OUTPUT_TOKENS = 10_000;
const MAX_SESSION_CHARS = 4_000_000;

const ExecCommandParams = Type.Object({
  cmd: Type.String({ description: "Shell command to execute." }),
  workdir: Type.Optional(
    Type.String({ description: "Working directory. Defaults to the turn cwd." }),
  ),
  yield_time_ms: Type.Optional(
    Type.Number({
      minimum: 250,
      maximum: 30_000,
      description: "Wait before yielding output. Defaults to 10000 ms.",
    }),
  ),
  max_output_tokens: Type.Optional(
    Type.Number({
      minimum: 100,
      maximum: 100_000,
      description: "Approximate output token budget. Defaults to 10000.",
    }),
  ),
  tty: Type.Optional(
    Type.Boolean({ description: "Allocate a pseudo-terminal for interactive commands." }),
  ),
  shell: Type.Optional(
    Type.String({ description: "Shell binary. Defaults to the user's shell." }),
  ),
  login: Type.Optional(
    Type.Boolean({ description: "Use login-shell semantics. Defaults to true." }),
  ),
});

const WriteStdinParams = Type.Object({
  session_id: Type.Number({ description: "Session ID returned by exec_command." }),
  chars: Type.Optional(Type.String({ description: "Characters to write. Empty polls output." })),
  yield_time_ms: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 300_000,
      description: "Wait before yielding new output.",
    }),
  ),
  max_output_tokens: Type.Optional(
    Type.Number({
      minimum: 100,
      maximum: 100_000,
      description: "Approximate output token budget. Defaults to 10000.",
    }),
  ),
});

type ExecCommandInput = Static<typeof ExecCommandParams>;
type WriteStdinInput = Static<typeof WriteStdinParams>;

interface ExecDetails {
  chunk_id: string;
  session_id?: number;
  exit_code?: number;
  original_token_count?: number;
  output: string;
  wall_time_seconds: number;
}

interface RunningProcess {
  write(chars: string): void;
  kill(): void;
}

interface ExecSession {
  id: number;
  process: RunningProcess;
  startedAt: number;
  output: string;
  deliveredOffset: number;
  droppedChars: number;
  chunk: number;
  exitCode?: number;
  settled: Promise<void>;
  settle(): void;
}

function shellArgs(command: string, login: boolean | undefined): string[] {
  return [login === false ? "-c" : "-lc", command];
}

function environment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

function appendOutput(session: ExecSession, data: string): void {
  session.output += data;
  if (session.output.length <= MAX_SESSION_CHARS) return;
  const excess = session.output.length - MAX_SESSION_CHARS;
  const undeliveredDropped = Math.max(0, excess - session.deliveredOffset);
  session.output = session.output.slice(excess);
  session.deliveredOffset = Math.max(0, session.deliveredOffset - excess);
  session.droppedChars += undeliveredDropped;
}

function createSettledPromise(): { promise: Promise<void>; settle: () => void } {
  let settle = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    settle = resolvePromise;
  });
  return { promise, settle };
}

function spawnPipeProcess(
  shell: string,
  args: string[],
  cwd: string,
  onData: (data: string) => void,
  onExit: (exitCode: number) => void,
): RunningProcess {
  const child: ChildProcessWithoutNullStreams = spawnChild(shell, args, {
    cwd,
    detached: process.platform !== "win32",
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdout.on("data", (data: Buffer) => onData(data.toString("utf8")));
  child.stderr.on("data", (data: Buffer) => onData(data.toString("utf8")));
  child.on("error", (error) => onData(`\nFailed to start command: ${error.message}\n`));
  child.on("close", (code) => onExit(code ?? 1));
  return {
    write: (chars) => child.stdin.write(chars),
    kill: () => {
      if (child.pid && process.platform !== "win32") {
        try {
          process.kill(-child.pid, "SIGKILL");
          return;
        } catch {
          // Fall back to killing the direct child.
        }
      }
      child.kill("SIGKILL");
    },
  };
}

function spawnTerminalProcess(
  shell: string,
  args: string[],
  cwd: string,
  onData: (data: string) => void,
  onExit: (exitCode: number) => void,
): RunningProcess {
  const pty: IPty = spawnPty(shell, args, {
    cwd,
    env: environment(),
    name: "xterm-256color",
    cols: 120,
    rows: 40,
    encoding: "utf8",
  });
  pty.onData(onData);
  pty.onExit(({ exitCode }) => onExit(exitCode));
  return {
    write: (chars) => pty.write(chars),
    kill: () => pty.kill(),
  };
}

function waitForSession(session: ExecSession, yieldMs: number): Promise<void> {
  if (session.exitCode !== undefined || yieldMs === 0) return Promise.resolve();
  return Promise.race([
    session.settled,
    new Promise<void>((resolvePromise) => setTimeout(resolvePromise, yieldMs)),
  ]);
}

function outputBudget(input?: number): number {
  return Math.max(400, (input ?? DEFAULT_MAX_OUTPUT_TOKENS) * 4);
}

function takeOutput(session: ExecSession, maxTokens?: number): {
  output: string;
  originalTokenCount?: number;
} {
  let output = session.output.slice(session.deliveredOffset);
  session.deliveredOffset = session.output.length;
  if (session.droppedChars > 0) {
    output = `[${session.droppedChars} earlier output characters were dropped]\n${output}`;
    session.droppedChars = 0;
  }
  const budget = outputBudget(maxTokens);
  if (output.length <= budget) return { output };
  const originalTokenCount = Math.ceil(output.length / 4);
  return {
    output: `[Output truncated to the last ${budget} characters]\n${output.slice(-budget)}`,
    originalTokenCount,
  };
}

function renderDetails(session: ExecSession, maxTokens?: number): ExecDetails {
  const { output, originalTokenCount } = takeOutput(session, maxTokens);
  session.chunk += 1;
  return {
    chunk_id: `${session.id}:${session.chunk}`,
    ...(session.exitCode === undefined
      ? { session_id: session.id }
      : { exit_code: session.exitCode }),
    ...(originalTokenCount === undefined ? {} : { original_token_count: originalTokenCount }),
    output,
    wall_time_seconds: Number(((Date.now() - session.startedAt) / 1000).toFixed(3)),
  };
}

function resultText(details: ExecDetails): string {
  const output = details.output || "(no output)";
  if (details.session_id !== undefined) {
    return `${output}\n\nScript running with session ID ${details.session_id}`;
  }
  return `${output}\n\nProcess exited with code ${details.exit_code}`;
}

export interface UnifiedExecTools {
  execCommandTool: ToolDefinition<typeof ExecCommandParams, ExecDetails>;
  writeStdinTool: ToolDefinition<typeof WriteStdinParams, ExecDetails>;
  closeAll(): void;
}

export function createUnifiedExecTools(): UnifiedExecTools {
  const sessions = new Map<number, ExecSession>();
  let nextSessionId = 1;

  const startSession = (params: ExecCommandInput, defaultCwd: string): ExecSession => {
    const cwd = resolve(params.workdir ?? defaultCwd);
    if (!existsSync(cwd)) throw new Error(`Working directory does not exist: ${cwd}`);
    const shell = params.shell ?? process.env.SHELL ?? "/bin/sh";
    const id = nextSessionId++;
    const deferred = createSettledPromise();
    const session = {
      id,
      process: undefined as unknown as RunningProcess,
      startedAt: Date.now(),
      output: "",
      deliveredOffset: 0,
      droppedChars: 0,
      chunk: 0,
      settled: deferred.promise,
      settle: deferred.settle,
    } satisfies ExecSession;
    const onExit = (exitCode: number) => {
      session.exitCode = exitCode;
      session.settle();
    };
    const onData = (data: string) => appendOutput(session, data);
    const args = shellArgs(params.cmd, params.login);
    session.process = params.tty
      ? spawnTerminalProcess(shell, args, cwd, onData, onExit)
      : spawnPipeProcess(shell, args, cwd, onData, onExit);
    sessions.set(id, session);
    return session;
  };

  const execCommandTool = defineTool({
    name: "exec_command",
    label: "Execute command",
    description:
      "Run a command in a reusable process session. Quick commands return their exit code; " +
      "long-running commands yield a session_id for write_stdin.",
    promptSnippet: "Run shell commands, including long-running and interactive commands.",
    parameters: ExecCommandParams,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const session = startSession(params, ctx.cwd);
      const onAbort = () => session.process.kill();
      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort, { once: true });
      await waitForSession(session, params.yield_time_ms ?? DEFAULT_EXEC_YIELD_MS);
      signal?.removeEventListener("abort", onAbort);
      const details = renderDetails(session, params.max_output_tokens);
      if (session.exitCode !== undefined) sessions.delete(session.id);
      return { content: [{ type: "text", text: resultText(details) }], details };
    },
  });

  const writeStdinTool = defineTool({
    name: "write_stdin",
    label: "Write to command",
    description:
      "Write characters to a running exec_command session or poll it for new output. " +
      "An empty chars value polls without writing.",
    promptSnippet: "Continue or interact with a running command session.",
    parameters: WriteStdinParams,
    async execute(_toolCallId, params, signal) {
      const session = sessions.get(params.session_id);
      if (!session) throw new Error(`Unknown or completed session: ${params.session_id}`);
      const chars = params.chars ?? "";
      if (chars && session.exitCode === undefined) session.process.write(chars);
      const onAbort = () => session.process.kill();
      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort, { once: true });
      const yieldMs =
        params.yield_time_ms ?? (chars ? DEFAULT_WRITE_YIELD_MS : DEFAULT_POLL_YIELD_MS);
      await waitForSession(session, yieldMs);
      signal?.removeEventListener("abort", onAbort);
      const details = renderDetails(session, params.max_output_tokens);
      if (session.exitCode !== undefined) sessions.delete(session.id);
      return { content: [{ type: "text", text: resultText(details) }], details };
    },
  });

  return {
    execCommandTool,
    writeStdinTool,
    closeAll() {
      for (const session of sessions.values()) session.process.kill();
      sessions.clear();
    },
  };
}
