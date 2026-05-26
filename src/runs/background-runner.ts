import * as fs from "node:fs";
import { discoverAgents } from "../agents/agents.ts";
import { DEFAULT_ARTIFACT_CONFIG } from "../shared/types.ts";
import { runChild } from "./child-runner.ts";

function writeJson(filePath: string, value: unknown): void {
	fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

const configPath = process.argv[2];
if (!configPath) throw new Error("background runner requires config path");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const files = config.files;
const startedAt = Date.now();
writeJson(files.statusPath, { id: config.id, state: "running", pid: process.pid, agent: config.agent, cwd: config.cwd, startedAt, files });

try {
	const agents = discoverAgents(config.cwd, config.agentScope ?? "both").agents;
	const result = await runChild({
		runId: config.id,
		index: 0,
		agentName: config.agent,
		task: config.task ?? "",
		cwd: config.cwd,
		agents,
		model: config.model,
		skills: Array.isArray(config.skills) ? config.skills : typeof config.skills === "string" ? config.skills.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined,
		tools: Array.isArray(config.tools) ? config.tools : typeof config.tools === "string" ? config.tools.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined,
		extensions: Array.isArray(config.extensions) ? config.extensions : typeof config.extensions === "string" ? config.extensions.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined,
		output: files.outputPath,
		artifactsDir: files.dir,
		artifacts: config.artifacts !== false,
		artifactConfig: DEFAULT_ARTIFACT_CONFIG,
		sessionFile: files.sessionPath,
	});
	fs.writeFileSync(files.outputPath, result.finalOutput ?? result.error ?? "", "utf-8");
	writeJson(files.metaPath, { ...result, messages: undefined, completedAt: Date.now() });
	writeJson(files.statusPath, { id: config.id, state: result.error || result.exitCode !== 0 ? "failed" : "completed", pid: process.pid, agent: config.agent, cwd: config.cwd, startedAt, completedAt: Date.now(), exitCode: result.exitCode, error: result.error, files });
	process.exit(result.error || result.exitCode !== 0 ? 1 : 0);
} catch (error) {
	const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	fs.writeFileSync(files.outputPath, message, "utf-8");
	writeJson(files.metaPath, { error: message, completedAt: Date.now() });
	writeJson(files.statusPath, { id: config.id, state: "failed", pid: process.pid, agent: config.agent, cwd: config.cwd, startedAt, completedAt: Date.now(), error: message, files });
	process.exit(1);
}
