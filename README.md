# Codex Template

A starter template inspired by OpenAI Codex CLI.

## Quickstart

Install Pi and the Recipes extension once per machine:

```bash
pi install npm:@introspection-ai/recipes
```

Then clone and run:

```bash
git clone https://github.com/introspection-recipes/pi-codex
cd pi-codex
npm install
pi --recipe .
```

## Make it yours

This is an ordinary source directory. Nothing is generated or hidden.

| Path | What it is |
| --- | --- |
| `SYSTEM.md` | instructions every agent starts from |
| `agents/agent.yaml` | lead/default agent |
| `agents/*.yaml` | explorer, worker, and review subagents |
| `skills/skill-creator/` | on-demand skill authoring workflow |
| `extensions/` | TypeScript tools |
| `prompts/` | `/plan` and `/review` templates |

## Validate

```bash
npm test
npx -y -p @introspection-ai/cli introspection check
```

## Docs

[pi.recipes/docs](https://pi.recipes/docs)
