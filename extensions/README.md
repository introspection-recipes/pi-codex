# Extensions

The `pi.extensions` globs in `package.json` load these TypeScript modules for every root and delegated session. Registration is package-wide, while each agent's `tools` list remains the capability allowlist.

| Extension | Registers | Notes |
|---|---|---|
| `codex/index.ts` | Codex coding tools | Composes the tool definitions and cleans up process sessions on shutdown |
| `codex/unified-exec.ts` | `exec_command`, `write_stdin` | Quick commands, yielded sessions, polling, stdin, PTY, cancellation, bounded output |
| `codex/apply-patch.ts` | `apply_patch` | Atomic Codex patch envelope with workspace-confined paths |
| `codex/update-plan.ts` | `update_plan` | Ordered plan with at most one in-progress item |
| `codex/view-image.ts` | `view_image` | Local image content blocks |
| `codex/request-user-input.ts` | `request_user_input` | Sequential, host-neutral questions through Recipes interactions |
| `web-search.ts` | `web_search` | Optional Parallel AI search backend |

## Persistent execution

`exec_command` waits up to `yield_time_ms`. A completed command returns `exit_code`; a running command returns `session_id`. `write_stdin` accepts that id, optional characters, another yield window, and an output budget. Each result also carries a monotonic `chunk_id` and elapsed wall time.

Plain commands use piped stdin/stdout/stderr. `tty: true` uses `node-pty` for terminal semantics. Output retained by a session is bounded, each tool response respects `max_output_tokens`, and every active process is killed during `session_shutdown`.

## User interaction

`request_user_input` calls `askUserQuestion` from `@introspection-ai/recipes/interactions`, passes the tool's own abort signal, and sets `executionMode: "sequential"`. It therefore supports terminal/RPC dialogs, deterministic headless behavior, durable `PI_INTERRUPT_RESUME` interrupts, and the no-channel fallback without recipe-specific host code.

## Web search

`web_search` uses the Parallel AI Search API. Configure:

| Variable | Purpose | Default |
|---|---|---|
| `PARALLEL_API_KEY` | Required API key | — |
| `PARALLEL_SEARCH_PROCESSOR` | `base` or `pro` | `base` |
| `PARALLEL_SEARCH_MAX_RESULTS` | Result count | `5` |

Web search is separate because it is optional and provider-specific. Remove it from an agent's allowlist when the runtime should not expose it.

## Host boundaries

Extensions execute with the Pi process's authority. Tool selection is not filesystem, network, or OS isolation. Hosts should supply sandboxing, credentials, uploaded files, telemetry, hosted browsers, apps, or MCP connections rather than embedding those non-portable resources in this package.
