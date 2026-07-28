# Codex Template

A Pi coding-agent recipe inspired by OpenAI Codex CLI, with persistent command sessions, patch editing, planning, review, and subagents.

## Quick start

Install Node.js 24 or newer and the Introspection CLI, then create your own recipe from this template. `init` also installs the compatible Pi harness and Recipes extension.

```bash
npm install -g @introspection-ai/cli
introspection init codex-agent template-codex
cd codex-agent
npm install
```

Web search is optional. To test it locally, get a key from [Parallel](https://parallel.ai) and export it for the Pi process:

```bash
export PARALLEL_API_KEY=your-key
```

Validate the recipe, run its extension tests, and start a fresh local Pi session:

```bash
introspection check
npm test
introspection local --runtime codex-agent
```

Ask:

> Inspect this repository, run the relevant validation, and summarize the result. Do not change any files.

The local loop needs no Introspection login or cloud runtime. Pi may ask you to configure the model provider on the first run.

## Move the recipe through its lifecycle

The everyday flow is:

```text
Local Pi → Development → Staging → Production → Learn and repeat
```

### 1. Change and prove it locally

Customize `SYSTEM.md`, the definitions under `agents/`, the tools under `extensions/`, the prompts under `prompts/`, or the reusable workflows under `skills/`. Repeat `introspection check`, `npm test`, and the local prompt above in fresh sessions. Exercise any command-session, interaction, editing, or delegation behavior you changed.

### 2. Create the runtime and test development

Development requires the recipe's first runtime. Commit the locally proven recipe, push it to your own GitHub repository, then:

1. In the Introspection app, open your organization's **Integrations** page and grant the Introspection GitHub App access to the repository.
2. Open the target project, go to **Runtimes**, and select **New runtime**.
3. Choose the repository and the runtime in `.introspection/codex-agent.yaml`, confirm that its recipe path is `.`, and create the first version from `main`.
4. If you need `web_search`, add `PARALLEL_API_KEY` as a secret environment-variable binding for **Development**, **Staging**, and **Production**. Bindings are environment-specific.
5. In **Versions**, confirm that the immutable version's recipe commit matches the `main` commit you intended to deploy.

Once the runtime exists, exercise uncommitted changes through the cloud development path:

```bash
introspection login
introspection dev --runtime codex-agent
```

Leave the command running, open the development chat URL it prints, and repeat the inspect-and-validate prompt. Saved recipe changes are picked up without a commit or push. `introspection dev` uses the Development binding for `PARALLEL_API_KEY`; it does not upload the key from your shell. Stopping the command removes the local overlay and does not deploy a version.

### 3. Verify a pull-request candidate in staging

Push a feature branch and open a pull request. The GitHub integration creates an immutable candidate version for that commit; do not create another runtime for the same agent.

In the runtime's **Versions** view, find the candidate by branch and commit, pin it to **Staging**, and select **Preview**. Repeat the inspect-and-validate prompt. If your change affects search, also ask a current question and confirm the Parallel binding works. Verify that the conversation used the intended candidate commit and completed without an unhandled tool or binding error.

### 4. Merge it to production

After the staging behavior and pull request are approved, merge into the repository's configured production branch. The GitHub integration creates the immutable version and activates it for production; there is no separate promotion command.

Run one small production check through the stable `codex-agent` runtime and confirm that it resolves to the merged recipe commit.

### 5. Learn and repeat

Use production conversations and recurring patterns to choose the smallest useful change, then return to the local loop. See the [agent development lifecycle](https://docs.introspection.dev/guides/development-lifecycle) for the full workflow.

## What's included

- A lead agent with explorer, worker, and review subagents
- Codex-style execution, patching, planning, and interaction tools
- `/plan` and `/review` prompts
- Runtime metadata in `.introspection/codex-agent.yaml`

[Read the Recipes documentation →](https://docs.introspection.dev/recipes)
