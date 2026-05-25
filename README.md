<p>
  <img src="https://raw.githubusercontent.com/nicobailon/pi-subagents/main/banner.png" alt="pi-subagents" width="1100">
</p>

# pi-subagents

`pi-subagents` is being simplified into a small Pi delegation extension for focused child agents. This branch is currently through the Section 2 rewrite: legacy orchestration APIs have been removed from the schema, while the simplified executor/background runtime is still being rebuilt.

https://github.com/user-attachments/assets/702554ec-faaf-4635-80aa-fb5d6e292fd1

## Installation

```bash
pi install npm:pi-subagents
```

That is the only required step. You can add optional pieces later.

## Current branch status

This branch is mid-rewrite. At the Section 2 checkpoint, the simplified schema and validation are in place and old slash/chain/intercom/TUI/worktree/fork APIs are removed. Foreground execution, parallel execution, background execution, and status are documented as the target API below but are not fully available until the simplified executor is implemented in the next sections of `plan.md`.

## Try this first after the executor rewrite lands

You do not need to create agents, write config, or learn slash commands. After installing a completed build, ask Pi for delegation in plain language:

```text
Use reviewer to review this diff.
```

```text
Ask oracle for a second opinion on my current plan.
```

```text
Use scout to understand this code based on our discussion then ask me clarification questions.
```

```text
Run parallel reviewers: one for correctness, one for tests, and one for unnecessary complexity.
```

That is enough to start.

## What happens

Pi is the parent session. A subagent is a focused child Pi session with its own job.

Target behavior after the executor rewrite: when you ask for a subagent, Pi starts the child, gives it the task, and brings the result back. Foreground runs return in the conversation. Background runs keep working and can be checked later.

Installing the extension does not start an automatic reviewer in the background. It gives Pi a delegation tool. If you want every implementation reviewed, say that in your prompt or put it in your project instructions:

```text
When you finish implementing, run a reviewer subagent before summarizing.
```

## Good first prompts

These cover most day-to-day use:

```text
Ask oracle for a second opinion on my current plan. Challenge assumptions and tell me what I might be missing.
```

```text
Use oracle to help solve this hard bug. Have it inspect the code and propose the best next move before we edit anything.
```

```text
Run parallel reviewers on this diff. I want one focused on correctness, one on tests, and one on unnecessary complexity.
```

```text
Have worker implement this approved plan. Afterward, run parallel reviewers, summarize their feedback, and apply the fixes that make sense.
```

```text
Run a review loop on this change until reviewers stop finding fixes worth doing, with a max of 3 rounds.
```

```text
Use scout to understand the auth flow, then have planner turn that into an implementation plan.
```

Those are ordinary Pi requests for a completed build. Pi decides whether to call `subagent`, which agent to use, and whether a single, parallel, or background-single run makes sense.

## Common workflows

| Want | Ask naturally |
|------|---------------|
| Get a second opinion | “Ask oracle to review this plan and challenge assumptions.” |
| Solve a hard problem | “Use oracle to investigate this bug before we edit.” |
| Review a diff | “Use reviewer to review this diff.” |
| Run parallel reviewers | “Run reviewers for correctness, tests, and cleanup.” |
| Implement then review | “Implement this, then review it.” |
| Review until clean | “Run a review loop on this change with a max of 3 rounds.” |
| Execute a plan carefully | “Have worker implement this approved plan, then run reviewers and apply the feedback.” |
| Scout before planning | “Use scout to inspect the auth flow before planning.” |
| Run in the background | “Run this in the background.” |
| Browse agents | “Show me the available subagents.” |
| See background work after background support lands | “Check the status of run <id>.” |
| Check setup | “Check whether subagents are configured correctly.” |

The extension ships with builtin agents you can use immediately.

## Builtin agents in plain English

| Agent | Use it when you want... |
|-------|--------------------------|
| `scout` | Fast local codebase recon: relevant files, entry points, data flow, risks, and where another agent should start. |
| `researcher` | Web/docs research with sources: official docs, specs, benchmarks, recent changes, and a concise research brief. |
| `planner` | A concrete implementation plan from existing context. It should read and plan, not edit code. |
| `worker` | Implementation work, including approved oracle handoffs. It edits files, validates, and escalates unapproved decisions instead of guessing. |
| `reviewer` | Code review and small fixes. It checks the implementation against the task/plan, tests, edge cases, and simplicity. |
| `context-builder` | A stronger setup pass before planning: gathers code context and writes handoff material such as `context.md` and `meta-prompt.md`. |
| `oracle` | A second opinion before acting. It challenges assumptions, catches drift, and recommends the safest next move without editing. |
| `delegate` | A lightweight general delegate when you want a child agent that behaves close to the parent session. |

A simple rule of thumb: use `scout` before you understand the code, `researcher` before you trust external facts, `planner` before a bigger change, `worker` to implement, `reviewer` to check, and `oracle` when the decision itself feels risky.

## Changing a builtin agent's model

Builtin agents inherit your current Pi default model by default. This keeps new installs from depending on a provider you may not have configured. If you want a role to use a specific model, set an override instead of copying the bundled agent file.

For one run, put the override in the tool call:

```ts
{ agent: "reviewer", task: "Review this diff", model: "anthropic/claude-sonnet-4:high" }
```

For a persistent override, edit settings. This example pins the reviewer everywhere, adds a backup model for provider failures, and keeps the other builtins on your normal default model:

```json
{
  "subagents": {
    "agentOverrides": {
      "reviewer": {
        "model": "anthropic/claude-sonnet-4",
        "thinking": "high",
        "fallbackModels": ["openai/gpt-5-mini"]
      }
    }
  }
}
```

Use `~/.pi/agent/settings.json` for a user override or `.pi/settings.json` for a project override. The same `agentOverrides` block can change `tools`, `skills`, inherited context, prompt text, or disable a builtin. If you want a totally different agent, create a user or project agent with the same name; for normal tweaks, prefer overrides.

## Where running subagents show up

Foreground runs stream progress in the conversation while they run.

Background runs keep working after control returns to you. Inspect a specific run with `subagent({ action: "status", id: "..." })`.

Background runs can be inspected later by exact id. Parallel foreground runs report each child result separately.

You can also ask naturally:

```text
Check the status of run <id>.
```

If something feels misconfigured, ask:

```text
Check whether subagents are configured correctly.
```

## Recommended orchestration pattern (scaffolding)

Use orchestration as parent-agent guidance, not as a runtime workflow mode. For implementation work, the recommended loop is:

```text
clarify → planner → worker → fresh reviewers → worker
```

Child-safety boundaries are enforced at runtime. Spawned child sessions do not receive the bundled `pi-subagents` skill, do not register the `subagent` tool, and receive boundary instructions that they are not the parent orchestrator and must not propose or run subagents.

## Unsupported prompt/slash shortcuts

Legacy slash-style shortcuts and saved chain prompts are not documented as supported by the simplified rewrite. Use natural language or the supported `subagent` tool API instead.

At this point, you know enough to use the plugin. The rest of this README is reference material for the supported tool API, custom agents, and configuration.

## Unsupported legacy APIs

The simplified rewrite supports the `subagent` tool only; slash commands, saved chains, forked context, worktree isolation, clarify/launch TUI, and async control APIs are not supported. Use the supported API in the Programmatic tool usage section below.

## Agents

Agents are markdown files with YAML frontmatter and a system prompt body. They define the specialist that will run in the child Pi process.

Agent locations, lowest to highest priority:

| Scope | Path |
|-------|------|
| Builtin | `~/.pi/agent/extensions/subagent/agents/` |
| User | `~/.pi/agent/agents/**/*.md` |
| Project | `.pi/agents/**/*.md` |

Project discovery also reads legacy `.agents/**/*.md` files. Subdirectories are discovered recursively. If both `.agents/` and `.pi/agents/` define the same parsed runtime agent name, `.pi/agents/` wins. Use `agentScope: "user" | "project" | "both"` to control discovery; `both` is the default and project definitions win runtime-name collisions.

Builtin agents load at the lowest priority, so a user or project agent with the same name overrides them. They do not pin a provider model; they inherit your current Pi default model unless you set `subagents.agentOverrides.<name>.model`. `oracle` is an advisory reviewer that critiques direction and proposes an execution prompt without editing files. `worker` is the implementation agent for normal tasks and approved oracle handoffs.

The `researcher` builtin uses `web_search`, `fetch_content`, and `get_search_content`; those require [pi-web-access](https://github.com/nicobailon/pi-web-access):

```bash
pi install npm:pi-web-access
```

### Builtin overrides

You can override selected builtin fields without copying the whole agent. Overrides live in settings:

- User: `~/.pi/agent/settings.json`
- Project: `.pi/settings.json`

Example:

```json
{
  "subagents": {
    "agentOverrides": {
      "reviewer": {
        "inheritProjectContext": false
      }
    }
  }
}
```

Supported override fields are `model`, `fallbackModels`, `thinking`, `systemPromptMode`, `inheritProjectContext`, `inheritSkills`, `disabled`, `skills`, `tools`, and `systemPrompt`. Project overrides beat user overrides.

Set `disabled: true` to hide a builtin from runtime discovery and agent-facing `subagent({ action: "list" })` output. For bulk control, set `subagents.disableBuiltins: true` in settings.

### Prompt assembly

Subagents are designed to be narrow by default. Custom agents start with a clean system prompt and only the context you intentionally give them. They do not automatically inherit Pi’s whole base prompt, project instruction files, or discovered skills catalog.

Use these fields when an agent should see more:

| Field | Effect |
|-------|--------|
| `systemPromptMode: append` | Append the agent prompt to Pi’s normal base prompt. |
| `inheritProjectContext: true` | Keep inherited project instructions from files like `AGENTS.md` and `CLAUDE.md`. |
| `inheritSkills: true` | Let the child see Pi’s discovered skills catalog. |

Builtin agents opt into project instruction inheritance by default so they follow repo-specific rules out of the box. `delegate` also uses append mode because its job is orchestration inside the parent workflow.

### Agent frontmatter

A typical agent looks like this:

```yaml
---
name: scout
# Optional: registers this as code-analysis.scout while preserving name: scout
package: code-analysis
description: Fast codebase recon
tools: read, grep, find, ls, bash, mcp:chrome-devtools
extensions:
model: claude-haiku-4-5
fallbackModels: openai/gpt-5-mini, anthropic/claude-sonnet-4
thinking: high
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
skills: safe-bash, chrome-devtools
output: context.md
defaultReads: context.md
defaultProgress: true
completionGuard: false
interactive: true
---

Your system prompt goes here.
```

Important fields:

| Field | Notes |
|-------|-------|
| `package` | Optional package identifier. A file with `name: scout` and `package: code-analysis` registers as `code-analysis.scout`; serialization keeps `name` and `package` separate. |
| `tools` | Builtin tool allowlist. `mcp:` entries select direct MCP tools when `pi-mcp-adapter` is installed. |
| `extensions` | Omitted means normal extensions; empty means no extensions; comma-separated values allowlist specific extensions. |
| `model` | Default model. Bare ids prefer the current provider when possible, then unique registry matches. |
| `fallbackModels` | Ordered backup models for provider/model failures such as quota, auth, timeout, or unavailable model. Ordinary task failures do not trigger fallback. |
| `thinking` | Appended as a `:level` suffix at runtime unless a suffix is already present. |
| `systemPromptMode` | `replace` by default; `append` keeps Pi’s base prompt. |
| `inheritProjectContext` | Keeps or strips inherited project instruction blocks. |
| `inheritSkills` | Keeps or strips Pi’s discovered skills catalog. |
| `skills` | Injects specific skills directly, regardless of `inheritSkills`. |
| `output` | Default single-agent output file. |
| `defaultReads` | Files to read before running in parallel behavior. |
| `defaultProgress` | Maintain `progress.md`. |
| `completionGuard` | Set `false` only for non-implementation agents that may mention implementation words while using mutation-capable tools such as `bash`. |
| `interactive` | Parsed for compatibility but not enforced in v1. |

### Tool and extension selection

If `tools` is omitted, `pi-subagents` does not pass `--tools`, so the child gets Pi’s normal builtin tools. If `tools` is present, regular tool names become an explicit allowlist. `mcp:` entries are split out and forwarded as direct MCP selections. Path-like `tools` entries, such as extension paths or `.ts`/`.js` files, are treated as tool-extension paths rather than builtin tool names. Agents that declare only known read-only builtin tools skip the implementation completion guard, but `bash`, unknown tools, and MCP tools stay mutation-capable. Use `completionGuard: false` for bash-enabled validators or advisors that should never be judged as implementation agents.

Examples:

- `tools` omitted and `extensions` omitted: normal builtins and normal extensions.
- `tools: mcp:chrome-devtools`: normal builtins plus direct Chrome DevTools MCP tools.
- `tools: read, bash, mcp:chrome-devtools`: only `read` and `bash` as builtins, plus direct Chrome DevTools MCP tools.

Direct MCP tools require [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter). Subagents only receive direct MCP tools when `mcp:` entries are listed in their frontmatter; global `directTools: true` in `mcp.json` is not enough by itself. The generic `mcp` proxy tool can still be used for discovery when available. The adapter caches tool metadata at startup, so after connecting a new MCP server for the first time, restart Pi before relying on direct tools.

`extensions` controls child extension loading:

```yaml
# Omitted: all normal extensions load

# Empty: no extensions
extensions:

# Allowlist
extensions: /abs/path/to/ext-a.ts, /abs/path/to/ext-b.ts
```

When `extensions` is present, it takes precedence over extension paths implied by `tools` entries.

## Unsupported legacy workflow files

Saved `.chain.md` workflows are not supported in the simplified rewrite. Express repeatable workflows in natural language, or call the supported single, parallel, background-single, list, get, status, and doctor APIs directly.

## Skills

Skills are `SKILL.md` files injected into an agent’s system prompt.

Discovery uses project-first precedence:

1. `.pi/skills/{name}/SKILL.md`
2. Project packages and project settings packages via `package.json -> pi.skills`
3. Current task cwd package via `package.json -> pi.skills`
4. `.pi/settings.json -> skills`
5. `~/.pi/agent/skills/{name}/SKILL.md`
6. User packages and user settings packages via `package.json -> pi.skills`
7. `~/.pi/agent/settings.json -> skills`

Use agent defaults, override them at runtime, or disable them:

```ts
{ agent: "scout", task: "..." }
{ agent: "scout", task: "...", skill: "tmux, safe-bash" }
{ agent: "scout", task: "...", skill: false }
```

Injected skills use this shape:

```xml
<skill name="safe-bash">
[skill content from SKILL.md, frontmatter stripped]
</skill>
```

Missing skills do not fail execution. The result summary shows a warning.

### Bundled skill

The package bundles a `pi-subagents` skill that is automatically available to the parent agent when the extension is installed. It is for the orchestrating parent only: child subagents never receive it, and their context is explicitly filtered to strip parent-only orchestration instructions.

What the bundled skill covers:
- **Delegation patterns**: when to launch which agent, and whether to use single, parallel, or background-single mode
- **Prompt workflow recipes**: how to apply packaged techniques directly with `subagent(...)` when the user describes the workflow in natural language
- **Role-agent prompting guidance**: compact contract prompts instead of long scripts, what to include in role-specific meta prompts, and retrieval budgets for researchers
- **Safety boundaries**: child agents must not run subagents and must escalate unapproved decisions
- **Control and diagnostics**: background status and the `doctor` action

If you are writing an agent that orchestrates subagents, the bundled skill helps it behave correctly without guessing the patterns. If you are a human user, you do not need to read it directly; use the supported `subagent` tool API or ask Pi for delegation in natural language.

## Programmatic tool usage

These are the parameters the LLM passes when it calls the `subagent` tool. Most users can ask naturally instead.

Target execution modes after the simplified executor is implemented:

```ts
// Single fresh-context child run
{ agent: "worker", task: "refactor auth" }

// Parallel fresh-context child runs
{ tasks: [
  { agent: "scout", task: "inspect auth flow" },
  { agent: "reviewer", task: "review the current diff" }
], concurrency: 2 }

// Detached background single child run
{ agent: "scout", task: "audit the codebase", background: true }
```

Management and diagnostics actions in the simplified schema:

```ts
{ action: "list" }
{ action: "list", agentScope: "project" }
{ action: "get", agent: "scout" }
{ action: "status", id: "<background-run-id>" }
{ action: "doctor" }
```

Supported top-level fields are `agent`, `task`, `tasks`, `background`, `concurrency`, `cwd`, `model`, `skills`, `tools`, `extensions`, `output`, `artifacts`, `agentScope`, `action`, and `id`. Task items support `agent`, `task`, `cwd`, `model`, `skills`, `tools`, `extensions`, `output`, and `artifacts`.

Unsupported legacy APIs include slash commands, chains, `chainName`, create/update/delete management actions, forked context, worktree isolation, `async`, `resume`, `interrupt`, `clarify`, `outputMode`, `share`, and session export controls. Passing these fields returns a validation error instead of silently downgrading behavior.

## Unsupported worktree isolation

Worktree isolation is not supported in the simplified rewrite. If parallel children may edit overlapping files, ask for a plan first or run implementation agents sequentially.

## Configuration

`pi-subagents` reads optional JSON config from `~/.pi/agent/extensions/subagent/config.json`. In the simplified rewrite, supported runtime settings are limited to execution limits, artifacts, and agent discovery/overrides. Other legacy workflow settings are unsupported.

## Files, logs, and observability

Target behavior after the artifact/background rewrite: subagent runs write per-run artifacts, and background single runs persist status by id so `subagent({ action: "status", id: "..." })` can inspect them later.

## Session sharing

Child subagents do not receive the bundled parent orchestration skill or the `subagent` tool. If you need multiple children, run them from the parent session using a parallel tool call.

## Events

The simplified rewrite does not document legacy async/control event APIs as supported. Treat extension events as internal unless a future README section explicitly lists them.

## Prompt-template integration

`pi-subagents` works standalone through natural language and the `subagent` tool. If you use [pi-prompt-template-model](https://github.com/nicobailon/pi-prompt-template-model), you can also wrap subagent delegation in your own reusable prompt templates.

Example:

```md
---
description: Take a screenshot
model: claude-sonnet-4-20250514
subagent: browser-screenshoter
cwd: /tmp/screenshots
---
Use url in the prompt to take screenshot: $@
```

Then `/take-screenshot https://example.com` switches to Sonnet, delegates to `browser-screenshoter` with `/tmp/screenshots` as cwd, and restores your model when done. Runtime overrides like `--cwd=<path>` and `--subagent=<name>` work too.

For reusable workflows on top of subagents, use `pi-prompt-template-model` separately and copy the examples you want into `~/.pi/agent/prompts/`.

## Runtime files

The main runtime files are:

| File | Purpose |
|------|---------|
| `src/extension/index.ts` | Extension registration, tool registration, message/render wiring. |
| `src/agents/agents.ts` | Agent discovery and frontmatter parsing. |
| `src/runs/foreground/subagent-executor.ts` | Main execution routing for single, parallel, background, management, status, and doctor actions. |
| `src/runs/foreground/execution.ts` | Core foreground `runSync` handling. |
| `src/runs/shared/` | Shared run helpers for spawning Pi, artifacts, model fallback, background status, and output handling. |
| `src/shared/settings.ts` | Runtime settings and config helpers. |
| `src/extension/schemas.ts` / `src/shared/types.ts` | Tool schemas, shared types, and event constants. |
| `test/unit/` / `test/integration/` | Unit and loader-based integration tests. |
