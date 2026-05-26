import * as fs from "node:fs";
import * as path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Details, ExtensionConfig } from "../shared/types.ts";

function isSafeId(id: string): boolean {
	return /^[A-Za-z0-9._-]+$/.test(id) && !id.includes("..");
}

function tail(filePath: string, lines: number): string {
	try {
		return fs.readFileSync(filePath, "utf-8").split(/\r?\n/).slice(-lines).join("\n").trim();
	} catch {
		return "";
	}
}

function pidAlive(pid: unknown): boolean {
	if (typeof pid !== "number" || !Number.isInteger(pid) || pid < 1) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export function getBackgroundStatus(id: string, config: ExtensionConfig): AgentToolResult<Details> {
	if (!isSafeId(id)) return { content: [{ type: "text", text: "Invalid background run id." }], isError: true, details: { mode: "management", results: [] } };
	const runsDir = config.background?.runsDir ?? path.join(process.env.HOME ?? ".", ".pi", "agent", "background-runs");
	const statusPath = path.join(runsDir, id, "status.json");
	if (!fs.existsSync(statusPath)) return { content: [{ type: "text", text: `Background run not found: ${id}` }], isError: true, details: { mode: "management", results: [] } };
	const status = JSON.parse(fs.readFileSync(statusPath, "utf-8"));
	const files = status.files ?? {};
	let state = status.state;
	if (state === "running" && !pidAlive(status.pid)) {
		state = fs.existsSync(files.outputPath ?? "") ? "completed" : "stale";
		status.state = state;
		status.staleAt = Date.now();
		fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
	}
	const tailLines = config.background?.tailLines ?? 80;
	const parts = [`Background run ${id}: ${state}`, `agent: ${status.agent ?? "unknown"}`, `status: ${statusPath}`];
	if (files.outputPath) parts.push(`output: ${files.outputPath}`);
	if (files.metaPath) parts.push(`meta: ${files.metaPath}`);
	const output = tail(files.outputPath, state === "running" ? tailLines : 20);
	const stderr = tail(files.stderrPath, tailLines);
	if (output) parts.push("", state === "running" ? "Output tail:" : "Output preview:", output);
	if ((state === "failed" || state === "stale") && stderr) parts.push("", "Stderr tail:", stderr);
	return { content: [{ type: "text", text: parts.join("\n") }], ...(state === "failed" ? { isError: true } : {}), details: { mode: "management", runId: id, results: [] } };
}
