# Extensions

Pi extensions loaded at runtime via the `pi.extensions` globs in `package.json`. An extension is a TypeScript module whose default export is an `ExtensionFactory` `(pi) => void`. It can register tools and subscribe to lifecycle events.

This recipe re-implements Codex's tools against the Pi tool API rather than mapping them onto pi's built-ins — that's what makes the port high-fidelity.

| Extension | Registers | Source of truth in Codex |
|-----------|-----------|--------------------------|
| `codex/index.ts` | the gpt-5.5 tool set below | — |
| `codex/shell.ts` | `shell_command` | `core/src/tools/handlers/shell_spec.rs` |
| `codex/apply-patch.ts` | `apply_patch` | `prompts/templates/apply_patch_tool_instructions.md` |
| `codex/update-plan.ts` | `update_plan` | `core/src/tools/handlers/plan_spec.rs` |
| `codex/view-image.ts` | `view_image` | `core/src/tools/handlers/view_image_spec.rs` |
| `web-search.ts` | `web_search` (optional) | hosted Responses `web_search` |

## Tools

- **`shell_command`** — one-shot shell runner with `command`, `workdir`, `timeout_ms` (default 10000), and `login`. Combined stdout+stderr is truncated at standard Pi limits; large output spills to a temp file the agent can read back. This matches gpt-5.5's `shell_type: "shell_command"` — not the `exec_command`/`write_stdin` unified-exec pair other model families use.
- **`apply_patch`** — accepts the Codex patch envelope (`*** Begin Patch` … `*** End Patch`) as a `patch` string and applies it atomically: every write is planned up front, and if any hunk fails the originals are restored. Paths are confined to the workspace.
- **`update_plan`** — records an ordered plan with the single-`in_progress` invariant; the harness renders it.
- **`view_image`** — loads a local image and returns it as an image content block.

There is intentionally **no** dedicated read/grep/find tool: like real Codex, the agent reads and searches through `shell_command` (`rg`, `sed -n`, `cat`).

## Web search

gpt-5.5 supports a hosted `web_search` tool in the Codex CLI, served by OpenAI's Responses API — unavailable through the Pi runtime, and Pi ships no native web search. `extensions/web-search.ts` provides a same-named `web_search` tool backed by the **Parallel AI Search API** (`POST https://api.parallel.ai/v1/search`, `x-api-key` auth). Configure via environment:

| Env var | Purpose | Default |
|---|---|---|
| `PARALLEL_API_KEY` | API key (required to enable `web_search`) | — |
| `PARALLEL_SEARCH_PROCESSOR` | processor tier: `base` or `pro` | `base` |
| `PARALLEL_SEARCH_MAX_RESULTS` | max results per search | `5` |

If `PARALLEL_API_KEY` is unset, `web_search` returns an actionable error instead of failing silently. To swap backends, change the `execute` body — the tool name and `query` parameter stay the same. Remove `web_search` from `agents/agent.yaml` (and delete this file) if you don't want web access.

## Hooks

Codex has two layers beyond its tools, and neither needs to be ported here:

- **Configurable hooks** (`codex-hooks` crate) — external handlers keyed on `PreToolUse`, `PostToolUse`, `PermissionRequest`, `SessionStart`, `UserPromptSubmit`, `Stop`, `SubagentStart`/`SubagentStop`, and `Pre`/`PostCompact`, with `command` / `prompt` / `agent` handler types. **Codex ships none by default** — it's a user-extensibility mechanism configured in `config.toml`. The Pi equivalent is an event subscription via `pi.on(...)` inside an extension (`session_start`, `before_agent_start`, `tool_call`, `tool_result`, `turn_start` / `turn_end`, …). Drop a new `*.ts` file (or `<name>/index.ts`) here to add one.
- **Reminders / injected context** (`codex-rs/core/src/context/`, the `ContextualUserFragment` family) — the per-turn context fragments Codex assembles. The defaults that matter are already provided natively by the Pi runtime: the working-directory / environment block (Codex's `<environment_context>`), the `<available_skills>` listing, AGENTS.md project instructions (`user_instructions`), and the current time. The rest are either Codex-runtime-specific (sandbox/approval permission profiles, token/rollout budgets, plugins/apps, guardian, realtime) or off-by-default feature/mode fragments — none apply to the gpt-5.5 surface this recipe targets.

So this recipe adds no hooks or reminder extensions: doing so would either duplicate what Pi already injects or reproduce Codex internals that don't exist on Pi.
