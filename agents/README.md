# Agents

Each YAML file is loaded through `pi.agents`. The `name` field is the identity used by `--agent`, traces, and the main agent's `subagents` allowlist.

| Agent | Model | Reasoning | Tools | Purpose |
|---|---|---|---|---|
| `agent` | `openai/gpt-5.6-sol` | medium | exec, patch, plan, image, interaction, web | Main coding agent |
| `explorer` | `openai/gpt-5.6-terra` | low | exec, image | Fast read-only investigation |
| `worker` | `openai/gpt-5.6-sol` | medium | exec, patch, plan, image | Delegated implementation |
| `review` | `openai/gpt-5.6-sol` | medium | exec, image | Independent review rubric |

The main agent's `subagents` list generates Pi's asynchronous `agent` tool. Starting a child returns a run id immediately; the lead can inspect, wait, steer, interrupt, or close it. Delegation is one level deep, so children receive no further agent tool.

Extensions load in every child session, but a child sees only the tools listed in its own YAML. The interaction helper also auto-resolves child requests because delegated sessions do not own the root user's interaction lifecycle; workers should route decisions back to the lead.

The explorer, worker, and review prompts use `mode: replace` because they are intentionally standalone role contracts. The main agent uses `mode: append` to specialize `SYSTEM.md`.
