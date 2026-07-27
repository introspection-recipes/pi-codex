# pi-codex Recipe

A Git-backed Introspection recipe that reproduces the current OpenAI Codex coding harness on Pi: GPT-5.6 models, persistent command sessions, patch editing, planning, structured user interaction, web search, skills, slash prompts, and delegated agents.

The recipe is a portable adaptation rather than a claim that Pi and Codex have identical host security boundaries. Codex's OS-enforced sandbox, approval escalation, hosted Browser Use, apps, plugins, automations, and hosted web search remain host capabilities; this package implements the coding behavior Pi can faithfully own.

## What ships

- `SYSTEM.md`: lean, outcome-first coding instructions with explicit autonomy, interaction, delegation, and validation boundaries.
- `agents/*.yaml`: main, explorer, worker, and independent review roles.
- `extensions/codex/`: Codex-style `exec_command`, `write_stdin`, `apply_patch`, `update_plan`, `view_image`, and `request_user_input` tools.
- `extensions/web-search.ts`: optional Parallel-backed `web_search`.
- `prompts/`: `/plan` and `/review` deliverable templates.
- `skills/skill-creator/`: Codex's bundled skill-authoring workflow.

## Models

The role mapping follows the GPT-5.6 family instead of applying one flagship model indiscriminately:

| Agent | Model | Reasoning | Role |
|---|---|---|---|
| `agent` | `openai/gpt-5.6-sol` | medium | Main coding agent |
| `explorer` | `openai/gpt-5.6-terra` | low | Fast read-only search |
| `worker` | `openai/gpt-5.6-sol` | medium | Delegated implementation |
| `review` | `openai/gpt-5.6-sol` | medium | Independent code review |

## Tool mapping

| Codex behavior | Recipe implementation |
|---|---|
| Yielding command execution | `extensions/codex/unified-exec.ts` → `exec_command` |
| Continue or poll a process | `extensions/codex/unified-exec.ts` → `write_stdin` |
| Patch-envelope edits | `extensions/codex/apply-patch.ts` → `apply_patch` |
| Visible plan state | `extensions/codex/update-plan.ts` → `update_plan` |
| Local image inspection | `extensions/codex/view-image.ts` → `view_image` |
| Structured user questions | `extensions/codex/request-user-input.ts` → `request_user_input` |
| Current web lookup | `extensions/web-search.ts` → `web_search` |
| Parallel delegated work | Pi's generated `agent` tool from `subagents` |

`exec_command` returns quick command results directly. When a command remains active after `yield_time_ms`, it returns a `session_id`; `write_stdin` can then poll output or send characters. Setting `tty: true` allocates a PTY for interactive programs. Sessions are killed when the Pi session shuts down.

The PTY backend uses `node-pty`. Its macOS prebuild includes a helper whose executable bit can be lost during installation, so `scripts/fix-node-pty-permissions.mjs` restores that bit in `postinstall`. Other platforms are unchanged.

## Interactions

`request_user_input` calls [`@introspection-ai/recipes/interactions`](https://pi.recipes/docs/interactions) and is always sequential. The same tool works in:

- Pi terminal and RPC dialogs;
- deterministic headless or CI mode;
- durable hosts that set `PI_INTERRUPT_RESUME=1`, render `details.interrupt`, and resume the run later;
- hosts without an interaction channel, where the result instructs the model to ask in its normal reply.

The tool accepts exactly one question per call. One interrupt at a time is the portable Pi contract and prevents a paused parallel batch from stranding other tool calls. The root agent owns user interaction; delegated children route decisions back to it.

## Delegation

The main agent can start `explorer`, `worker`, and `review`. Pi's generated agent tool is asynchronous: a start returns a run id, and the lead can use `status`, `wait`, `message`, `interrupt`, and `close`. Labels distinguish concurrent runs of the same role.

## Repository layout

```text
.introspection/codex-agent.yaml
README.md
SYSTEM.md
package.json
agents/
  agent.yaml
  explorer.yaml
  worker.yaml
  review.yaml
extensions/
  codex/
    index.ts
    unified-exec.ts
    request-user-input.ts
    apply-patch.ts
    update-plan.ts
    view-image.ts
  web-search.ts
prompts/
  plan.md
  review.md
scripts/
  fix-node-pty-permissions.mjs
skills/
  skill-creator/
tests/
```

## Run locally

Install the Recipes extension once, then launch this directory:

```bash
pi install npm:@introspection-ai/recipes
npm install
pi --recipe .
```

Configure optional web search through `.env.example`.

## Validate

```bash
npm test
npx -y -p @introspection-ai/recipes@latest recipes check . --profile ci
```

CI runs the same recipe validation on pushes and pull requests.
