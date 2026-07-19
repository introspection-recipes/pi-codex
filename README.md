# pi-codex Recipe

A Git-backed Introspection (Pi) recipe that reproduces the **OpenAI Codex CLI** harness — system prompt, tools, subagents, and skills — as a runnable Pi coding agent. Use it as a starter template for building Codex-style agents on the Pi runtime.

It is a high-fidelity port of the [Codex CLI](https://github.com/openai/codex) harness (Apache-2.0): the base instructions are Codex's own `prompt.md`, and the tools (`shell_command`, `apply_patch`, `update_plan`, `view_image`) are re-implemented to match Codex's tool specs rather than mapped onto pi's built-ins.

## What This Is

An Introspection recipe is a package of runtime behavior. This repository contains:

- `.introspection/codex-agent.yaml`: the GitOps manifest Introspection discovers.
- `SYSTEM.md`: the Codex CLI base instructions (verbatim, with a runtime-adapted "Sandbox and approvals" section).
- `agents/agent.yaml`: the default runnable agent (the Codex main agent).
- `agents/*.yaml`: subagents (`explorer`, `review`).
- `skills/`: Codex's bundled `skill-creator` skill.
- `extensions/`: the Codex tools, re-implemented for the Pi tool API.

When you create a runtime from this repo, Introspection reads the manifest, pins the selected git commit, and launches the default agent.

## Model and fidelity

The agent targets **`openai/gpt-5.5`** — Codex's default model (`codex-rs/models-manager/models.json`). The recipe mirrors exactly what gpt-5.5 advertises in the Codex catalog:

| gpt-5.5 catalog field | Value | What this recipe ships |
|---|---|---|
| base instructions | default `prompt.md` | `SYSTEM.md` (verbatim) |
| `shell_type` | `shell_command` | `shell_command` tool (one-shot, `timeout_ms`) |
| `apply_patch_tool_type` | `freeform` | `apply_patch` tool (patch envelope) |
| `default_reasoning_level` | `medium` | `thinking_level: medium` |
| `supports_search_tool` | `true` | optional `web_search` tool |
| (always available) | `update_plan`, `view_image` | both ported |

Older Codex model families (gpt-5.2-codex and the `exec_command`/`write_stdin` unified-exec surface) are intentionally **not** ported — this template tracks gpt-5.5.

## How It Maps to Codex

| Codex harness piece | Where it lives here |
|---|---|
| Base instructions (`models-manager/prompt.md`) | `SYSTEM.md` |
| `shell_command` tool (`shell_spec.rs`) | `extensions/codex/shell.ts` |
| `apply_patch` freeform tool (`apply_patch_tool_instructions.md`) | `extensions/codex/apply-patch.ts` |
| `update_plan` tool (`plan_spec.rs`) | `extensions/codex/update-plan.ts` |
| `view_image` tool (`view_image_spec.rs`) | `extensions/codex/view-image.ts` |
| hosted `web_search` | `extensions/web-search.ts` (Parallel AI; optional) |
| Review rubric (`review/rubric.md`) | `agents/review.yaml` |
| Bundled `skill-creator` skill | `skills/skill-creator/` |

## Repository Layout

```text
.introspection/
  codex-agent.yaml
README.md
SYSTEM.md
package.json
.env.example
agents/
  README.md
  agent.yaml
  explorer.yaml
  review.yaml
skills/
  README.md
  skill-creator/
    SKILL.md
    references/  scripts/  agents/  assets/
extensions/
  README.md
  codex/
    index.ts
    shell.ts
    apply-patch.ts
    update-plan.ts
    view-image.ts
  web-search.ts
  lib/
    safe-path.ts
```

## Customize

Edit these first:

- `SYSTEM.md` for shared behavior and operating rules.
- `agents/agent.yaml` for model, tools, subagents, and role instructions.
- `agents/*.yaml` for subagent behavior and tool scoping.
- `extensions/codex/*.ts` for tool implementations.
- `extensions/web-search.ts` to enable or re-back web search (see `.env.example`).

## Validating Locally

CI validates every push with [`pi-recipes-action`](https://github.com/introspection-org/pi-recipes-action). To run the same check before each commit, enable the bundled pre-commit hook once after cloning:

```bash
git config core.hooksPath .githooks   # or: npm install
```

Or run the check directly at any time:

```bash
npx -y -p @introspection-ai/pi-recipes@latest recipes check . --profile ci
```
