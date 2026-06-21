# Skills

Skills are loaded via the `pi.skills` glob (`./skills/**/SKILL.md`) in `package.json`. Each skill is a folder with a `SKILL.md` whose YAML frontmatter (`name`, `description`) is always in context; the body and bundled resources load only when the skill triggers.

| Skill | Purpose |
|---|---|
| `skill-creator` | Codex's bundled guide for authoring new skills — frontmatter rules, progressive disclosure, bundled-resource layout, and validation. Ported verbatim from `codex-rs/skills/src/assets/samples/skill-creator`, including its `scripts/`, `references/`, and `agents/` resources. |

Codex's other bundled samples (`skill-installer`, `plugin-creator`, `imagegen`, `openai-docs`) are not included to keep the template focused; copy any of them from the Codex repo into this directory the same way.

Add a skill by creating `skills/<name>/SKILL.md` with `name` and `description` frontmatter, plus optional `scripts/`, `references/`, and `assets/`.
