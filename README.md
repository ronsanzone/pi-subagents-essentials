# pi-subagents

A small Pi extension for running focused fresh-context child agents.

## What this is

`pi-subagents` lets a parent Pi session delegate work to configured agents. Child runs return summaries and write artifacts.

Supported workflows:

- foreground single fresh-context subagent run
- foreground simple parallel fresh-context runs
- single detached background fresh-context run
- exact-ID background status
- `list`, `get`, and `doctor`

## What this intentionally is not

This essentials rewrite does not support chains, nested subagents, intercom, resume/interrupt, worktrees, forked context, slash workflows, share/export, clarify TUI flows, or swarm orchestration.

Unsupported fields fail loudly.

## Installation

```bash
pi install npm:pi-subagents
```

## API

### List

```ts
subagent({ action: "list" })
```

### Get

```ts
subagent({ action: "get", agent: "reviewer" })
```

### Doctor

```ts
subagent({ action: "doctor" })
```

### Foreground single

```ts
subagent({ agent: "reviewer", task: "Review the current diff." })
```

### Foreground parallel

```ts
subagent({
  tasks: [
    { agent: "reviewer", task: "Review correctness." },
    { agent: "reviewer", task: "Review tests." }
  ],
  concurrency: 2
})
```

### Background single

```ts
subagent({ agent: "reviewer", task: "Analyze this subsystem.", background: true })
```

### Background status

```ts
subagent({ action: "status", id: "<background-id>" })
```

## Agent files

Agents are markdown files with YAML frontmatter and a prompt body. User agents live in `~/.pi/agent/agents/` or `~/.agents/`. Project agents live in `.pi/agents/` or `.agents/` and override user agents with the same name.

Example:

```md
---
name: reviewer
description: Reviews code for correctness and simplicity
model: anthropic/claude-sonnet-4
---
You are a careful code reviewer...
```

## Artifacts

Artifacts are on by default. Foreground runs write input, output, and metadata files using stable names:

```text
<runId>_<agent>_<index>_input.md
<runId>_<agent>_<index>_output.md
<runId>_<agent>_<index>_meta.json
```

Use `artifacts: false` to disable them for a call.

Background runs write a per-run directory containing `config.json`, `status.json`, `input.md`, `output.md`, `meta.json`, logs, and `session.jsonl`.

## Configuration

Optional config file: `~/.pi/agent/extensions/subagent/config.json`.

```json
{
  "agents": { "disableBuiltins": false },
  "artifacts": { "enabled": true, "cleanupDays": 7 },
  "parallel": { "concurrency": 4, "maxTasks": 8 },
  "background": { "runsDir": "~/.pi/agent/background-runs", "tailLines": 80 }
}
```

## Unsupported old features

The simplified API rejects: `chain`, `chainDir`, `chainName`, `clarify`, `context`, `worktree`, `share`, `sessionDir`, `outputMode`, `includeProgress`, `control`, `runId`, `message`, `index`, `config`, and `async`.

Unsupported actions: `create`, `update`, `delete`, `resume`, and `interrupt`.
