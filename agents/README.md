# Agents

Each `*.yaml` here is a Pi agent definition loaded via the `pi.agents` glob in `package.json`.

| Agent | Role | Model | Tools |
|---|---|---|---|
| `agent` | Main Codex agent | openai/gpt-5.5 | shell_command, apply_patch, update_plan, view_image, web_search |
| `explorer` | Fast, read-only codebase questions | openai/gpt-5.5 (low) | shell_command, view_image |
| `worker` | Delegated execution / production work | openai/gpt-5.5 | shell_command, apply_patch, update_plan, view_image |
| `review` | Independent code review against the Codex rubric | openai/gpt-5.5 | shell_command, view_image |

`explorer` and `worker` are Codex's built-in `spawn_agent` roles (`codex-rs/core/src/agent/role.rs`); `review` adapts the separate `codex review` task. Codex's `awaiter` role is commented out upstream ("temp removed") and is not ported.

## Schema

```yaml
name: <agent name>            # also the subagent name referenced by the parent
description: <when to use>     # surfaced to the parent agent for delegation decisions
model:
  name: openai/gpt-5.5
  thinking_level: medium      # off | minimal | low | medium | high | xhigh
                              # (reasoning_effort is accepted as an alias)
tools: [shell_command, apply_patch, update_plan, view_image]
skills: [skill-creator]       # skill names the agent may load
subagents: [explorer, review] # subagents this agent may spawn (main agent only)
system_instructions:
  mode: replace | append      # replace = standalone prompt; append = add to SYSTEM.md
  content: |
    ...
```

The main `agent` uses `mode: append` so it inherits `SYSTEM.md` (the Codex base instructions) and adds recipe-specific tool and delegation guidance. The subagents use `mode: replace` because each ships a complete standalone system prompt — `review` embeds the Codex review rubric verbatim.
