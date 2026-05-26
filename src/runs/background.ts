import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionConfig, Details } from "../shared/types.ts";
import type { SubagentParamsLike } from "./executor.ts";

interface StartInput {
	id: string;
	params: SubagentParamsLike;
	cwd: string;
	config: ExtensionConfig;
}

function safeAgent(value: string): string {
	return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function pathsFor(runsDir: string, id: string) {
	const dir = path.join(runsDir, id);
	return {
		dir,
		configPath: path.join(dir, "config.json"),
		statusPath: path.join(dir, "status.json"),
		inputPath: path.join(dir, "input.md"),
		outputPath: path.join(dir, "output.md"),
		metaPath: path.join(dir, "meta.json"),
		stdoutPath: path.join(dir, "stdout.log"),
		stderrPath: path.join(dir, "stderr.log"),
		sessionPath: path.join(dir, "session.jsonl"),
	};
}

function readStatusState(statusPath: string): string | undefined {
	try {
		const parsed = JSON.parse(fs.readFileSync(statusPath, "utf-8"));
		return typeof parsed.state === "string" ? parsed.state : undefined;
	} catch {
		return undefined;
	}
}

function sleepSync(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function startBackgroundRun(input: StartInput): AgentToolResult<Details> {
	const runsDir = input.config.background?.runsDir ?? path.join(process.env.HOME ?? ".", ".pi", "agent", "background-runs");
	const runId = `${Date.now().toString(36)}-${safeAgent(input.params.agent ?? "agent")}-${input.id.slice(0, 8)}`;
	const files = pathsFor(runsDir, runId);
	fs.mkdirSync(files.dir, { recursive: true });
	const task = input.params.task ?? "";
	fs.writeFileSync(files.inputPath, `# Background task for ${input.params.agent}\n\n${task}`, "utf-8");
	fs.writeFileSync(files.statusPath, JSON.stringify({ id: runId, state: "starting", agent: input.params.agent, cwd: input.cwd, createdAt: Date.now(), files }, null, 2));
	fs.writeFileSync(files.configPath, JSON.stringify({ ...input.params, cwd: input.cwd, id: runId, files }, null, 2));
	const stdout = fs.openSync(files.stdoutPath, "a");
	const stderr = fs.openSync(files.stderrPath, "a");
	const runner = path.join(path.dirname(new URL(import.meta.url).pathname), "background-runner.mjs");
	const child = spawn(process.execPath, [runner, files.configPath], {
		detached: true,
		stdio: ["ignore", stdout, stderr],
		cwd: input.cwd,
		windowsHide: true,
	});
	child.unref();
	let ready = false;
	for (let attempt = 0; attempt < 20; attempt++) {
		const state = readStatusState(files.statusPath);
		if (state === "running" || state === "completed" || state === "failed") {
			ready = true;
			break;
		}
		sleepSync(25);
	}
	if (!ready) {
		const text = `Background runner did not initialize for ${runId}. See ${files.stderrPath}`;
		fs.writeFileSync(files.statusPath, JSON.stringify({ id: runId, state: "failed", pid: child.pid, agent: input.params.agent, cwd: input.cwd, error: text, files }, null, 2));
		return { content: [{ type: "text", text }], isError: true, details: { mode: "management", runId, results: [] } };
	}
	const text = [`Background run started: ${runId}`, `status: ${files.statusPath}`, `output: ${files.outputPath}`, `meta: ${files.metaPath}`].join("\n");
	return { content: [{ type: "text", text }], details: { mode: "management", runId, results: [] } };
}
