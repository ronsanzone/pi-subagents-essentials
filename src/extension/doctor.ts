import * as fs from "node:fs";
import * as path from "node:path";
import { discoverAgentsAll } from "../agents/agents.ts";
import { discoverAvailableSkills } from "../agents/skills.ts";
import { getAgentDir } from "../shared/utils.ts";
import type { ExtensionConfig, SubagentState } from "../shared/types.ts";

interface DoctorReportInput {
	cwd: string;
	config: ExtensionConfig;
	state: SubagentState;
	expandTilde?: (value: string) => string;
}

function checkDir(label: string, dir: string): string {
	try {
		fs.mkdirSync(dir, { recursive: true });
		fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
		return `- ${label}: ok (${dir})`;
	} catch (error) {
		return `- ${label}: failed (${dir}) — ${error instanceof Error ? error.message : String(error)}`;
	}
}

export function buildDoctorReport(input: DoctorReportInput): string {
	const all = discoverAgentsAll(input.cwd);
	const agents = [...all.builtin, ...all.user, ...all.project].filter((agent) => agent.disabled !== true);
	const skills = discoverAvailableSkills(input.cwd);
	const runsDir = input.config.background?.runsDir ?? path.join(getAgentDir(), "background-runs");
	return [
		"Subagents doctor report",
		"",
		"Runtime",
		`- cwd: ${input.cwd}`,
		`- current session id: ${input.state.currentSessionId ?? "not available"}`,
		"",
		"Config",
		`- resolved config: ${JSON.stringify(input.config)}`,
		"",
		"Agents",
		`- user agent dir: ${all.userDir}`,
		`- project agent dir: ${all.projectDir ?? "not found"}`,
		`- discovered agents: ${agents.length} (builtin ${all.builtin.length}, user ${all.user.length}, project ${all.project.length})`,
		`- discovered skills: ${skills.length}`,
		"",
		"Background",
		checkDir("runs dir", runsDir),
		"",
		"Artifacts",
		`- enabled: ${input.config.artifacts?.enabled !== false}`,
		`- cleanup days: ${input.config.artifacts?.cleanupDays ?? 7}`,
	].join("\n");
}
