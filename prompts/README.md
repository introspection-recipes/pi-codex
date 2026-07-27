# Prompts

Prompt templates are declared through `pi.prompts` and appear as slash commands.

| Prompt | Purpose |
|---|---|
| `/plan <task>` | Inspect without editing and return an implementation-ready plan |
| `/review [target]` | Delegate an independent bug-focused review |

Prompts define the requested deliverable. Reusable methods belong in skills, while rules that must apply to every run belong in `SYSTEM.md`.
