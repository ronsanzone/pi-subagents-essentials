# pi-subagents-essentials One-Shot Simplification Plan

## Instructions for future sessions

This repository is a fork used by one user. There is **no need to preserve backwards compatibility** with the current upstream-style orchestration API. Prefer deleting complexity over incremental migration.

As you work through this plan:

- Update this `plan.md` directly.
- Check off completed tasks with `[x]`.
- Add brief notes under the relevant task when implementation details or decisions change.
- If you discover a task is obsolete, mark it `[x]` and explain why.
- Keep the product model simple: **parent session orchestrates; subagents are fresh-context child runs that return summaries and save artifacts**.

## Target product model

The simplified extension should support only:

1. Foreground single fresh-context subagent run.
2. Foreground simple parallel fresh-context subagent runs.
3. Single detached background fresh-context subagent run.
4. Exact-ID status for background runs.
5. `list`, `get`, and `doctor` management actions.
6. Automatic artifact capture for input/output/metadata.

The extension should not support agent swarms, chains, nested delegation, intercom, worktree fanout, resume/interrupt, forked context, TUI clarify flows, slash workflow engines, or share/export.

---

## Supported API after rewrite

### Management

```ts
subagent({ action: "list" })
subagent({ action: "get", agent: "codebase-analyzer" })
subagent({ action: "doctor" })
subagent({ action: "status", id: "abc123" })
```

### Foreground single

```ts
subagent({
  agent: "codebase-analyzer",
  task: "Analyze the auth flow and return file:line-cited summary."
})
```

### Foreground simple parallel

```ts
subagent({
  tasks: [
    { agent: "codebase-locator", task: "Find auth implementation files." },
    { agent: "codebase-pattern-finder", task: "Find auth test patterns." }
  ],
  concurrency: 2
})
```

### Background single

```ts
subagent({
  agent: "codebase-analyzer",
  task: "Analyze this large subsystem and write a report.",
  background: true
})
```

---

## Unsupported API to delete

Delete support for these actions:

- `create`
- `update`
- `delete`
- `resume`
- `interrupt`

Delete support for these params:

- `chain`
- `chainDir`
- `chainName`
- `clarify`
- `context`
- `worktree`
- `share`
- `sessionDir`
- `outputMode`
- `includeProgress`
- `control`
- `runId`
- `message`
- `index`
- `config`
- `async`

Use `background: true`, not `async: true`.

Unsupported fields should fail loudly with a concise error.

---

# Task checklist

## 0. Preparation / baseline

- [x] Run the current test suite and record baseline failures, if any.
  - Command: `npm test` or `npm run test:all`.
  - Notes: `npm test` passed (464 tests, 0 failures) before implementation.
- [x] Inspect `package.json` scripts and dependencies before deleting files.
  - Notes: scripts are `test`, `test:unit`, `test:integration`, `test:all`; runtime deps are `jiti` and `typebox`, with Pi packages as peer/dev deps. `@earendil-works/pi-tui` is no longer a direct dependency of this package; any remaining package-lock entry is transitive through the `@earendil-works/pi-coding-agent` devDependency used for tests/development.
- [ ] Create a temporary scratch note, if needed, listing imports that break after deletions.
  - Notes:

---

## 1. Delete unsupported orchestration code

Delete code first, then rebuild the smaller architecture around the remaining primitives.

### 1.1 Delete intercom, slash, and TUI layers

- [x] Delete `src/intercom/`.
- [x] Delete `src/slash/`.
- [x] Delete `src/tui/`.
- [x] Remove imports/references to deleted intercom, slash, and TUI modules.
- [x] Remove package/runtime references to slash prompt-template bridges.
- Notes: Removed the three layer directories. Removed slash command, slash bridge, and prompt-template bridge registration from extension runtime. Replaced deleted TUI render imports with minimal local rendering/no-op widget helpers. Follow-up cleanup removed stale unit tests/imports for deleted intercom, slash, and TUI modules, dropped the remaining slash result/event constants and child-runtime slash-result filtering, and deleted the temporary no-op intercom shim after imports were removed. Final cleanup removed the remaining `@earendil-works/pi-tui` import/custom render hooks from `src/extension/index.ts` and dropped the direct package dependency. The package-lock may still contain `@earendil-works/pi-tui` only as a transitive dependency of the `@earendil-works/pi-coding-agent` devDependency; that is not a runtime dependency of `pi-subagents`.

### 1.2 Delete old async/background orchestration system

Delete these files:

- [x] `src/runs/background/async-execution.ts`
- [x] `src/runs/background/async-job-tracker.ts`
- [x] `src/runs/background/async-resume.ts`
- [x] `src/runs/background/async-status.ts`
- [x] `src/runs/background/completion-dedupe.ts`
- [x] `src/runs/background/notify.ts`
- [x] `src/runs/background/parallel-groups.ts`
- [x] `src/runs/background/result-watcher.ts`
- [x] `src/runs/background/run-id-resolver.ts`
- [x] `src/runs/background/run-status.ts`
- [x] `src/runs/background/stale-run-reconciler.ts`
- [x] `src/runs/background/subagent-runner.ts`
- [x] `src/runs/background/top-level-async.ts`
- [x] Remove imports/references to old async/background files.
- Notes: Deleted listed files. Removed extension runtime imports of old async job tracker/result watcher/status/notify modules and replaced the old foreground executor with a temporary simplified Section 2-compatible shell so source no longer imports deleted background modules. Background status/execution now returns an explicit not-yet-implemented error pending the Section 3 executor.

### 1.3 Delete chain support

- [x] Delete `src/runs/foreground/chain-clarify.ts`.
- [x] Delete `src/runs/foreground/chain-execution.ts`.
- [x] Delete `src/agents/chain-serializer.ts`.
- [x] Remove chain discovery from agent discovery.
- [x] Remove chain types from shared types/schema.
- [x] Remove `{previous}`, `{task}`, and `{chain_dir}` template support from tool schema.
- Notes: Deleted listed files and removed chain schema/template API from `src/extension/schemas.ts`. Agent discovery now no longer exposes chain types, discovered chains, or chain directory fields. Management was narrowed to the Section 1/2 agent-only list/get surface. Follow-up cleanup removed residual chain helpers from `src/shared/settings.ts` and chain summary formatting from `src/shared/formatters.ts`.

### 1.4 Delete nested/fanout/control/worktree/fork/share support

- [x] Delete `src/runs/shared/nested-events.ts`.
- [x] Delete `src/runs/shared/nested-path.ts`.
- [x] Delete `src/runs/shared/nested-render.ts`.
- [x] Delete `src/runs/shared/subagent-control.ts`.
- [x] Delete `src/runs/shared/worktree.ts`.
- [x] Delete `src/shared/fork-context.ts`.
- [x] Delete `src/extension/control-notices.ts`.
- [x] Delete `src/extension/fanout-child.ts`.
- [x] Remove child fanout extension registration.
- [x] Remove foreground control state and notices.
- [x] Remove fork context defaults and logic.
- [x] Remove share/export logic from tool schema.
- Notes: Deleted listed files and removed unsupported fields from the schema. Extension registration no longer loads fanout-child or control notices. Foreground execution no longer wires interrupt/control-resume hooks or share-derived session discovery. Follow-up cleanup removed fork `defaultContext` parsing/state, agent config serialization/override support, and fork task wrapping helpers.

### 1.5 Search for deleted concepts and clean residual runtime code

Run:

```bash
rg "chain|clarify|intercom|nested|fanout|worktree|resume|interrupt|share|asyncByDefault|forceTopLevelAsync|control"
```

- [x] Remove all meaningful runtime implementation references.
- [x] Keep only README/plan/test references that explicitly say unsupported behavior is rejected.
- Notes: Ran the cleanup grep again. Removed chain discovery shape/source types, foreground interrupt/control-resume hooks, foreground share handling, foreground control state from extension state/types, the temporary intercom shim, the completion-guard intercom read-only allowlist entry, and unused runner-step orchestration types from parallel utilities (including `worktree`). Follow-up cleanup removed residual chain settings/formatters, async status caches/types/constants, extension async runtime state initialization, and fork default-context parsing. Remaining source hits are unsupported-schema terms, ordinary `shared` path/import text, and unrelated stream `resume()` internals.

---

## 2. Replace schema

Rewrite `src/extension/schemas.ts` to define only the new API.

### 2.1 Define simplified params

- [x] Add action enum: `list`, `get`, `doctor`, `status`.
- [x] Add management/status fields: `agent`, `id`.
- [x] Add single-run field: `task`.
- [x] Add `tasks` array for simple parallel.
- [x] Add execution options: `cwd`, `model`, `skills`, `tools`, `extensions`, `output`, `background`, `concurrency`, `artifacts`, `agentScope`.
- [x] Remove old fields listed in “Unsupported API to delete”.
- Notes: Rewrote `src/extension/schemas.ts` around the simplified API with `additionalProperties: false`.

### 2.2 Add validation helpers

- [x] Validate that `action` is not combined with execution-only fields.
- [x] Validate `get` requires `agent`.
- [x] Validate `status` requires `id`.
- [x] Validate execution mode is exactly one of single or parallel.
- [x] Validate `background: true` is only allowed with single mode.
- [x] Validate `tasks.length` is within configured max.
- [x] Validate `concurrency` is positive and within configured max.
- [x] Validate unsupported keys return clear errors.
- Notes: Added `validateSubagentParams` with configurable max task/concurrency limits and explicit unsupported-key errors.

---

## 3. Rewrite extension entrypoint

Rewrite `src/extension/index.ts` around the simple executor.

### 3.1 Remove old runtime setup

- [ ] Remove async job tracker setup.
- [ ] Remove result watcher setup.
- [ ] Remove stale run cleanup setup.
- [ ] Remove slash bridge registration.
- [ ] Remove prompt-template bridge registration.
- [ ] Remove intercom/control renderers.
- [x] Remove TUI-specific result rendering if no longer needed.
- Notes: Removed the last custom TUI render hooks from the extension entrypoint so default tool rendering is used.

### 3.2 Register only the simplified tool

- [ ] Load simplified config.
- [ ] Create simplified executor.
- [ ] Register `subagent` tool with simplified description.
- [ ] Implement simple `renderCall` for action/single/parallel/background.
- [ ] Implement simple `renderResult` or rely on default text rendering.
- Notes:

Expected shape:

```ts
export function registerSubagentExtension(pi) {
  const config = loadConfig();
  const executor = createExecutor({ pi, config });

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description: SIMPLE_DESCRIPTION,
    parameters: SubagentParams,
    execute: executor.execute,
    renderCall,
    renderResult,
  });
}
```

---

## 4. Implement new executor

Create or rewrite:

- `src/runs/executor.ts`

### 4.1 Executor dispatch

- [ ] Resolve request cwd.
- [ ] Validate params.
- [ ] Discover agents for `agentScope`.
- [ ] Dispatch `list`.
- [ ] Dispatch `get`.
- [ ] Dispatch `doctor`.
- [ ] Dispatch `status` to background status only.
- [ ] Dispatch background single.
- [ ] Dispatch foreground parallel.
- [ ] Dispatch foreground single.
- Notes:

### 4.2 Result helpers

- [ ] Add helper for text result.
- [ ] Add helper for validation error result.
- [ ] Add helper for unknown agent error.
- [ ] Add helper to format artifact paths.
- Notes:

---

## 5. Extract and simplify child runner

Create or rewrite:

- `src/runs/child-runner.ts`

Use existing `runSync` / `runSingleAttempt` logic as a starting point, but strip orchestration options.

### 5.1 Child runner API

- [ ] Define `RunChildOptions`.
- [ ] Define `ChildResult`.
- [ ] Support `runId`, `index`, `agentName`, `task`, `cwd`, `agents`, `model`, `skills`, `tools`, `extensions`, `output`, `artifacts`, `sessionFile`, `signal`, `onUpdate`.
- [ ] Return final output, exit code, usage, model, duration, artifact paths, and error.
- Notes:

### 5.2 Preserve useful behavior

- [ ] Resolve agent by name.
- [ ] Build system prompt from agent prompt.
- [ ] Inject resolved skills.
- [ ] Apply model override.
- [ ] Spawn child Pi process.
- [ ] Parse child output/events enough to capture final output.
- [ ] Capture usage if cheap/available.
- [ ] Respect abort signal for foreground runs.
- Notes:

### 5.3 Remove orchestration behavior

- [ ] Remove share/export handling.
- [ ] Remove intercom handling.
- [ ] Remove nested/fanout handling.
- [ ] Remove control event handling.
- [ ] Remove max subagent depth handling.
- [ ] Remove fork context handling.
- [ ] Remove `outputMode` handling.
- Notes:

---

## 6. Simplify Pi args / child runtime

Create or rewrite:

- `src/runs/pi-args.ts`

### 6.1 Build minimal child process args

- [ ] Support cwd.
- [ ] Support model override.
- [ ] Support tools/extensions allowlists if needed.
- [ ] Support system prompt injection.
- [ ] Support session file path if used.
- [ ] Support child prompt/task file.
- Notes:

### 6.2 Minimal child environment

- [ ] Set `PI_SUBAGENT_CHILD=1`.
- [ ] Set `PI_SUBAGENT_RUN_ID=<runId>`.
- [ ] Remove nested route env vars.
- [ ] Remove fanout env vars.
- [ ] Remove intercom env vars.
- [ ] Remove control/capability-token env vars.
- Notes:

### 6.3 Prevent child orchestration

- [ ] Ensure child Pi sessions do not auto-register the `subagent` tool.
- [ ] Remove fanout child extension injection.
- [ ] Keep simple boundary instruction if useful: child should complete assigned task directly and not delegate.
- Notes:

---

## 7. Implement artifact handling

Create or keep/simplify:

- `src/artifacts/artifacts.ts` or `src/shared/artifacts.ts`
- `src/artifacts/format.ts` if helpful

### 7.1 Artifact path helpers

- [ ] Compute foreground artifact dir from current parent session when available.
- [ ] Fall back to temp/user artifact dir when no parent session exists.
- [ ] Compute stable file names:
  - `<runId>_<agent>_<index>_input.md`
  - `<runId>_<agent>_<index>_output.md`
  - `<runId>_<agent>_<index>_meta.json`
- Notes:

### 7.2 Artifact writing

- [ ] Write input artifact before child run.
- [ ] Write output artifact after child run.
- [ ] Write metadata artifact after child run.
- [ ] Include run ID, mode, agent, task, index, cwd, timestamps, duration, exit code, model, usage, paths, and error.
- [ ] Make artifacts default-on.
- [ ] Respect `artifacts: false`.
- Notes:

### 7.3 Artifact formatting

- [ ] Include artifact paths in single result.
- [ ] Include artifact paths under each parallel child result.
- [ ] Include background run files in background start/status results.
- Notes:

---

## 8. Implement simple foreground single

Use executor + child runner.

- [ ] Validate required `agent`.
- [ ] Use `task ?? ""`.
- [ ] Run fresh child context only.
- [ ] Return child final output inline.
- [ ] Include artifact paths.
- [ ] Return useful error for unknown agent.
- [ ] Return useful error for child failure.
- Notes:

---

## 9. Implement simple foreground parallel

Create or rewrite:

- `src/runs/parallel.ts`

### 9.1 Concurrency helper

- [ ] Implement small `mapLimit` helper or reuse a simple existing helper.
- [ ] Preserve result order.
- [ ] Respect abort signal.
- Notes:

### 9.2 Parallel behavior

- [ ] Run each task with independent fresh child context.
- [ ] Apply per-task `cwd`, `model`, `skills`, `tools`, `extensions`, `output`.
- [ ] Apply top-level defaults where per-task values are omitted.
- [ ] Save artifacts per child index.
- [ ] Allow partial failures and include all results.
- [ ] Mark overall result as error only for validation failure or all children failing.
- Notes:

### 9.3 Parallel formatting

- [ ] Format as ordered sections:
  - `## 1. agent-name`
  - child result
  - artifact paths
- [ ] Include failed children clearly.
- Notes:

---

## 10. Implement background single

Create:

- `src/runs/background.ts`
- `src/runs/background-runner.ts`
- `src/runs/background-status.ts`

### 10.1 Background config and directories

- [ ] Add default runs dir: `~/.pi/agent/background-runs`.
- [ ] Create per-run dir: `<runsDir>/<runId>/`.
- [ ] Per-run files:
  - `config.json`
  - `status.json`
  - `input.md`
  - `output.md`
  - `meta.json`
  - `stdout.log`
  - `stderr.log`
  - `session.jsonl`
- Notes:

### 10.2 Start background job

- [ ] Validate background only supports single `agent` + `task`.
- [ ] Generate run ID.
- [ ] Write `input.md`.
- [ ] Write initial `status.json` with state `queued`.
- [ ] Write `config.json` for runner.
- [ ] Spawn detached background runner.
- [ ] Redirect stdout/stderr to log files.
- [ ] `unref()` child process.
- [ ] Update status with `running` and PID.
- [ ] Return run ID and file paths.
- Notes:

### 10.3 Background runner

- [ ] Read config from argv.
- [ ] Update status to `running` with PID and timestamp.
- [ ] Discover agents in configured cwd/scope.
- [ ] Call the same `runChild` primitive as foreground.
- [ ] Write `output.md`.
- [ ] Write `meta.json`.
- [ ] Update status to `completed` or `failed`.
- [ ] Exit with appropriate status code.
- Notes:

### 10.4 Background status

- [ ] Exact ID lookup only.
- [ ] Reject unsafe IDs.
- [ ] Read `status.json`.
- [ ] If `running`, check whether PID is alive.
- [ ] Mark stale if PID is dead and no completion was written.
- [ ] Show output tail for running jobs.
- [ ] Show stderr tail for failed jobs.
- [ ] Show output preview and paths for completed jobs.
- Notes:

---

## 11. Simplify config

Rewrite `src/extension/config.ts` and `src/shared/settings.ts` as needed.

### 11.1 New config shape

Support:

```ts
type SubagentsConfig = {
  agents?: {
    disableBuiltins?: boolean;
  };
  artifacts?: {
    enabled?: boolean;
    cleanupDays?: number;
  };
  parallel?: {
    concurrency?: number;
    maxTasks?: number;
  };
  background?: {
    runsDir?: string;
    tailLines?: number;
  };
};
```

- [ ] Implement defaults.
- [ ] Expand `~` in paths.
- [ ] Remove old config options.
- [ ] Ensure doctor reports resolved config.
- Notes:

### 11.2 Remove old config fields

Remove support for:

- [x] `asyncByDefault`
- [x] `forceTopLevelAsync`
- [ ] `intercomBridge`
- [ ] `control`
- [ ] `maxSubagentDepth`
- [x] `worktreeSetupHook`
- [x] `worktreeSetupHookTimeoutMs`
- [ ] `defaultSessionDir`
- Notes:

---

## 12. Simplify agent discovery and builtins

### 12.1 Agent discovery

- [ ] Keep user agent discovery.
- [ ] Keep project agent discovery.
- [ ] Project agents override user agents.
- [ ] Keep basic frontmatter parsing.
- [ ] Keep `disabled: true` support if simple.
- [x] Remove chain discovery.
- [ ] Remove runtime create/update/delete management.
- [ ] Remove default fork context behavior.
- [ ] Remove package namespace complexity if not needed.
- Notes:

### 12.2 Builtin agents decision

Recommendation: disable or remove most/all bundled builtins.

- [ ] Decide whether to ship no builtins or only neutral builtins.
- [ ] If keeping builtins, keep only neutral ones such as `delegate`, `scout`, `researcher`, `reviewer`.
- [ ] Remove orchestration-oriented builtins such as `context-builder`, `oracle`, `planner`, `worker`.
- [ ] Ensure `list` output clearly distinguishes user/project/builtin if builtins remain.
- Notes:

---

## 13. Rewrite doctor

Simplify `src/extension/doctor.ts`.

Doctor should report:

- [ ] Current cwd.
- [ ] Config path(s) loaded.
- [ ] Resolved config.
- [ ] User agent dir.
- [ ] Project agent dir.
- [ ] Number of discovered agents.
- [ ] Agent parse errors.
- [ ] Background runs dir.
- [ ] Artifact behavior.
- [ ] Relevant package/version info if easy.

Doctor should not report:

- [ ] Intercom status.
- [ ] Nested/fanout status.
- [ ] Async watcher status.
- [ ] Control status.
- Notes:

---

## 14. Rewrite README

Replace current README with a short essentials-focused README.

Sections:

- [ ] What this is.
- [ ] What this intentionally is not.
- [ ] Installation.
- [ ] Supported workflows.
- [ ] API: `list`.
- [ ] API: `get`.
- [ ] API: foreground single.
- [ ] API: foreground parallel.
- [ ] API: background single.
- [ ] API: background status.
- [ ] API: doctor.
- [ ] Agent files and frontmatter.
- [ ] Artifacts.
- [ ] Configuration.
- [ ] Unsupported old features.
- Notes:

Explicitly say unsupported:

- chains
- nested subagents
- intercom
- resume/interrupt
- worktrees
- forked context
- slash workflows
- share/export

---

## 15. Rewrite tests

Delete old tests tied to removed features. Add focused tests for the simplified extension.

### 15.1 Schema tests

Create/update `test/unit/schema.test.ts`.

- [ ] Accepts single.
- [ ] Accepts parallel.
- [ ] Accepts background single.
- [ ] Accepts `list`.
- [ ] Accepts `get`.
- [ ] Accepts `status`.
- [ ] Accepts `doctor`.
- [ ] Rejects chain.
- [ ] Rejects resume/interrupt/create/update/delete.
- [ ] Rejects background parallel.
- [ ] Rejects unknown fields.
- Notes:

### 15.2 Agent discovery tests

Create/update `test/unit/agent-discovery.test.ts`.

- [ ] User agents load.
- [ ] Project agents load.
- [ ] Project overrides user.
- [ ] Disabled agents omitted.
- [ ] Parse errors are visible to doctor/list diagnostics.
- Notes:

### 15.3 Artifact tests

Create/update `test/unit/artifacts.test.ts`.

- [ ] Input artifact path is stable.
- [ ] Output artifact path is stable.
- [ ] Metadata artifact path is stable.
- [ ] Parallel child artifact names include index.
- [ ] Metadata contains required fields.
- Notes:

### 15.4 Parallel tests

Create/update `test/unit/parallel.test.ts`.

- [ ] Respects concurrency.
- [ ] Preserves result order.
- [ ] Captures partial failures.
- [ ] Marks all-failed result as error.
- Notes:

### 15.5 Background status tests

Create/update `test/unit/background-status.test.ts`.

- [ ] Missing ID returns not found.
- [ ] Unsafe ID is rejected.
- [ ] Running status displays output tail.
- [ ] Completed status displays output path and preview.
- [ ] Failed status displays error/stderr tail.
- [ ] Dead PID becomes stale.
- Notes:

### 15.6 Integration tests

Create/update:

- `test/integration/single-run.test.ts`
- `test/integration/background-run.test.ts`

Tasks:

- [ ] Single run invokes child runner and writes artifacts.
- [ ] Background run creates run dir and status files.
- [ ] Background runner completes and status reports completed.
- Notes:

---

## 16. Final cleanup and verification

### 16.1 Search cleanup

Run:

```bash
rg "chain|clarify|intercom|nested|fanout|worktree|resume|interrupt|share|asyncByDefault|forceTopLevelAsync|control"
```

- [ ] Confirm remaining matches are only in docs/tests that assert unsupported behavior.
- [ ] Remove remaining runtime matches.
- Notes:

### 16.2 Type/test verification

- [ ] Run `npm test`.
- [ ] Run `npm run test:all` if available and practical.
- [ ] Fix TypeScript/module import errors.
- [ ] Fix failing tests.
- Notes:

### 16.3 Manual smoke tests

Use the installed/dev extension if practical.

- [ ] `subagent({ action: "list" })` works.
- [ ] `subagent({ action: "get", agent: "agent" })` works with a known agent.
- [ ] `subagent({ action: "doctor" })` works.
- [ ] Foreground single run works.
- [ ] Foreground parallel run works.
- [ ] Background single start returns run ID.
- [ ] Background status returns running/completed.
- [ ] Unsupported `chain` call returns a clear error.
- Notes:

---

# Acceptance criteria

## Supported behavior works

- [ ] `subagent({ action: "list" })`
- [ ] `subagent({ action: "get", agent: "agent" })`
- [ ] `subagent({ action: "doctor" })`
- [ ] `subagent({ action: "status", id: "<background-id>" })`
- [ ] `subagent({ agent: "agent", task: "..." })`
- [ ] `subagent({ tasks: [...] })`
- [ ] `subagent({ agent: "agent", task: "...", background: true })`

## Unsupported behavior is gone

- [ ] No runtime chain implementation.
- [ ] No runtime clarify UI implementation.
- [ ] No runtime intercom implementation.
- [ ] No runtime nested/fanout implementation.
- [ ] No runtime worktree implementation.
- [ ] No runtime resume/interrupt implementation.
- [ ] No runtime share/export implementation.
- [ ] No foreground control/needs-attention notices.

## Codebase is simpler

- [ ] `src/intercom/` gone.
- [ ] `src/slash/` gone.
- [ ] `src/tui/` gone.
- [ ] Old `src/runs/background/` orchestration files gone.
- [ ] Chain files gone.
- [ ] Nested/control/worktree/fork helpers gone.
- [ ] Tool schema and README are small enough to understand quickly.

## Background remains useful but simple

- [ ] Background supports exactly one fresh-context child job.
- [ ] Background writes file-backed status/output/meta.
- [ ] Background status uses exact ID only.
- [ ] Background has no resume/interrupt/intercom/notifications/chains/parallel.

---

# Final target architecture

```text
subagent tool
  ├─ action=list/get/doctor/status
  ├─ single foreground
  │    └─ runChild → artifacts → inline result
  ├─ simple parallel foreground
  │    └─ mapLimit(runChild) → artifacts → ordered combined result
  └─ single background
       ├─ write run config/status
       ├─ spawn detached background-runner
       └─ status reads status/output files
```

Everything else should be deleted.
