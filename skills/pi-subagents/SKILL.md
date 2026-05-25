---
name: pi-subagents
description: >
  Delegate work to builtin or custom subagents with the simplified
  pi-subagents API. Current Section 2 rewrite status: schema and validation
  support list/get/doctor/status plus target single, parallel, and background
  calls; legacy slash, chain, fork, intercom, worktree, resume/interrupt, and
  create/update/delete APIs are unsupported.
---

# pi-subagents simplified API guidance

Use this skill when deciding how to ask Pi's `subagent` tool for help.

## Current rewrite checkpoint

This package is in the simplified rewrite. The old orchestration API has been
removed from the tool schema. Until the simplified executor/background runtime
is completed in later plan sections, treat execution examples below as the
target supported shape, not legacy compatibility.

## Supported tool shapes

### Management and diagnostics

```ts
subagent({ action: "list" })
subagent({ action: "get", agent: "codebase-analyzer" })
subagent({ action: "doctor" })
subagent({ action: "status", id: "<exact-background-run-id>" })
```

### Target foreground single fresh-context run

```ts
subagent({
  agent: "codebase-analyzer",
  task: "Analyze the auth flow and return a concise file:line-cited summary."
})
```

### Target foreground simple parallel fresh-context runs

```ts
subagent({
  tasks: [
    { agent: "codebase-locator", task: "Find auth implementation files." },
    { agent: "codebase-pattern-finder", task: "Find auth test patterns." }
  ],
  concurrency: 2
})
```

### Target detached background single run

Use `background: true`, not `async: true`.

```ts
subagent({
  agent: "codebase-analyzer",
  task: "Analyze this large subsystem and write a report.",
  background: true
})
```

## Supported fields

Top-level fields:

- `action`
- `agent`
- `id`
- `task`
- `tasks`
- `cwd`
- `model`
- `skills`
- `tools`
- `extensions`
- `output`
- `background`
- `concurrency`
- `artifacts`
- `agentScope`

Parallel task item fields:

- `agent`
- `task`
- `cwd`
- `model`
- `skills`
- `tools`
- `extensions`
- `output`
- `artifacts`

## Unsupported legacy APIs

Do not use or recommend these removed features:

- slash commands or saved prompt workflow engines
- `chain`, `chainDir`, `chainName`, `{previous}`, `{task}`, `{chain_dir}` templates
- `create`, `update`, or `delete` management actions
- `async`; use target `background: true` for a single background run instead
- `resume`, `interrupt`, `runId`, `message`, or `index`
- forked context or `context`
- nested subagents or child fanout
- intercom, control notices, `contact_supervisor`, or needs-attention routing
- worktree fanout or `worktree`
- TUI clarify flows or `clarify`
- `share`, `sessionDir`, `outputMode`, `includeProgress`, or `config`

Unsupported fields should fail loudly with validation errors. Do not attempt to
silently translate old calls into new ones.

## Delegation guidance

- Keep each child task narrow and explicit.
- Prefer one focused child for analysis or implementation.
- Use parallel tasks only for independent read/review/research work.
- Do not ask child agents to run subagents; orchestration stays in the parent.
- For implementation work, run one implementation child, then separate review
  children if needed.
- If a background task is started, save the exact returned id before checking
  status.
