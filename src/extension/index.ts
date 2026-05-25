/**
 * Simplified subagent tool registration.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { type ExtensionAPI, type ExtensionContext, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { discoverAgents } from "../agents/agents.ts";
import { cleanupAllArtifactDirs, cleanupOldArtifacts, getArtifactsDir } from "../shared/artifacts.ts";
import { resolveCurrentSessionId } from "../shared/session-identity.ts";
import { SubagentParams } from "./schemas.ts";
import { createSubagentExecutor, type SubagentParamsLike } from "../runs/foreground/subagent-executor.ts";
import { SUBAGENT_CHILD_ENV } from "../runs/shared/pi-args.ts";
import { loadConfig } from "./config.ts";
import {
	type Details,
	type SubagentState,
	DEFAULT_ARTIFACT_CONFIG,
	RESULTS_DIR,
} from "../shared/types.ts";

export { loadConfig } from "./config.ts";

/**
 * Derive subagent session base directory from parent session file.
 * If parent session is ~/.pi/agent/sessions/abc123.jsonl,
 * returns ~/.pi/agent/sessions/abc123/ as the base.
 * Callers add runId to create the actual session root: abc123/{runId}/
 * Falls back to a unique temp directory if no parent session.
 */
function getSubagentSessionRoot(parentSessionFile: string | null): string {
	if (parentSessionFile) {
		const baseName = path.basename(parentSessionFile, ".jsonl");
		const sessionsDir = path.dirname(parentSessionFile);
		return path.join(sessionsDir, baseName);
	}
	return fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-session-"));
}

function expandTilde(p: string): string {
	return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

/**
 * Create a directory and verify it is actually accessible.
 * On Windows with Azure AD/Entra ID, directories created shortly after
 * wake-from-sleep can end up with broken NTFS ACLs (null DACL) when the
 * cloud SID cannot be resolved without network connectivity. This leaves
 * the directory completely inaccessible to the creating user.
 */
function ensureAccessibleDir(dirPath: string): void {
	fs.mkdirSync(dirPath, { recursive: true });
	try {
		fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK);
	} catch {
		try {
			fs.rmSync(dirPath, { recursive: true, force: true });
		} catch {
			// Best effort: retry mkdir/access even if cleanup fails.
		}
		fs.mkdirSync(dirPath, { recursive: true });
		fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK);
	}
}

export default function registerSubagentExtension(pi: ExtensionAPI): void {
	if (process.env[SUBAGENT_CHILD_ENV] === "1") return;
	const globalStore = globalThis as Record<string, unknown>;
	const runtimeCleanupStoreKey = "__piSubagentRuntimeCleanup";
	const previousRuntimeCleanup = globalStore[runtimeCleanupStoreKey];
	if (typeof previousRuntimeCleanup === "function") {
		try {
			previousRuntimeCleanup();
		} catch {
			// Best effort cleanup for stale timers from an older reload.
		}
	}

	ensureAccessibleDir(RESULTS_DIR);
	const config = loadConfig();
	const tempArtifactsDir = getArtifactsDir(null);
	cleanupAllArtifactDirs(DEFAULT_ARTIFACT_CONFIG.cleanupDays);

	const state: SubagentState = {
		baseCwd: "",
		currentSessionId: null,
		lastUiContext: null,
	};

	const runtimeCleanup = () => {};
	globalStore[runtimeCleanupStoreKey] = runtimeCleanup;

	const executor = createSubagentExecutor({
		pi,
		state,
		config,
		tempArtifactsDir,
		getSubagentSessionRoot,
		expandTilde,
		discoverAgents,
	});

	const executeSubagentCollapsed = (id: string, params: SubagentParamsLike, signal: AbortSignal, onUpdate: ((result: AgentToolResult<Details>) => void) | undefined, ctx: ExtensionContext) => {
		if (ctx.hasUI) ctx.ui.setToolsExpanded(false);
		return executor.execute(id, params, signal, onUpdate, ctx);
	};

	const tool: ToolDefinition<typeof SubagentParams, Details> = {
		name: "subagent",
		label: "Subagent",
		description: `Delegate to subagents or manage agent definitions.

EXECUTION (use exactly ONE mode):
• SINGLE: { agent, task } - one fresh-context child run
• PARALLEL: { tasks: [{agent, task}, ...], concurrency?: number } - simple concurrent fresh-context runs
• BACKGROUND: { agent, task, background: true } - detached single child run

MANAGEMENT:
• { action: "list" } - discover executable agents
• { action: "get", agent: "name" } - full detail
• { action: "status", id: "..." } - inspect a background run by exact id
• { action: "doctor" } - read-only report`,
		parameters: SubagentParams,

		execute(id, params, signal, onUpdate, ctx) {
			return executeSubagentCollapsed(id, params, signal, onUpdate, ctx);
		},

	};

	pi.registerTool(tool);
	const eventUnsubscribeStoreKey = "__piSubagentEventUnsubscribes";
	const previousEventUnsubscribes = globalStore[eventUnsubscribeStoreKey];
	if (Array.isArray(previousEventUnsubscribes)) {
		for (const unsubscribe of previousEventUnsubscribes) {
			if (typeof unsubscribe !== "function") continue;
			try {
				unsubscribe();
			} catch {
				// Best effort cleanup for stale handlers from an older reload.
			}
		}
	}
	const eventUnsubscribes: Array<() => void> = [];
	globalStore[eventUnsubscribeStoreKey] = eventUnsubscribes;

	const cleanupSessionArtifacts = (ctx: ExtensionContext) => {
		try {
			const sessionFile = ctx.sessionManager.getSessionFile();
			if (sessionFile) {
				cleanupOldArtifacts(getArtifactsDir(sessionFile), DEFAULT_ARTIFACT_CONFIG.cleanupDays);
			}
		} catch {
			// Cleanup failures should not block session lifecycle events.
		}
	};

	const resetSessionState = (ctx: ExtensionContext) => {
		state.baseCwd = ctx.cwd;
		state.currentSessionId = resolveCurrentSessionId(ctx.sessionManager);
		state.lastUiContext = ctx;
		cleanupSessionArtifacts(ctx);
	};

	pi.on("session_start", (_event, ctx) => {
		resetSessionState(ctx);
	});

	pi.on("session_shutdown", () => {
		for (const unsubscribe of eventUnsubscribes) {
			try {
				unsubscribe();
			} catch {
				// Best effort cleanup during shutdown.
			}
		}
		if (globalStore[eventUnsubscribeStoreKey] === eventUnsubscribes) {
			delete globalStore[eventUnsubscribeStoreKey];
		}
		if (globalStore[runtimeCleanupStoreKey] === runtimeCleanup) {
			delete globalStore[runtimeCleanupStoreKey];
		}
	});
}
