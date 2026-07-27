# pi-codex

A starting point for your coding agent, inspired by the OpenAI Codex CLI harness.

## Quickstart

Install Pi and the Recipes extension once per machine:

```bash
pi install npm:@introspection-ai/recipes
```

Then clone this template and run it:

```bash
git clone https://github.com/introspection-recipes/pi-codex
pi --recipe ./pi-codex
```

## Make it yours

This is a directory, so change it like any other source. Nothing here is
generated and nothing is hidden.

| Path | What it is |
| --- | --- |
| `SYSTEM.md` | instructions every agent in the package starts from |
| `agents/agent.yaml` | the lead agent, and the agent you run |
| `agents/*.yaml` | explorer, worker and review subagents |
| `skills/skill-creator/` | a skill the agent loads on demand |
| `extensions/` | extra tools written in TypeScript |

Check your changes before you commit them:

```bash
introspection check
```

## Docs

The format, the agent file, MCP policy and judges are documented at
[pi.recipes/docs](https://pi.recipes/docs).
