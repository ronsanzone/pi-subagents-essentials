import type { AgentConfig } from "../agents/agents.ts";
import { DEFAULT_ARTIFACT_CONFIG, type ArtifactConfig, type RunSyncOptions, type SingleResult } from "../shared/types.ts";
import { runSync } from "./foreground/execution.ts";

export interface RunChildOptions {
	runId: string;
	index?: number;
	agentName: string;
	task: string;
	cwd: string;
	agents: AgentConfig[];
	model?: string;
	skills?: string[];
	tools?: string[];
	extensions?: string[];
	output?: string;
	artifactsDir?: string;
	artifacts?: boolean;
	artifactConfig?: ArtifactConfig;
	sessionFile?: string;
	signal?: AbortSignal;
	onUpdate?: RunSyncOptions["onUpdate"];
}

export type ChildResult = SingleResult;

function withExecutionOverrides(agents: AgentConfig[], options: RunChildOptions): AgentConfig[] {
	return agents.map((agent) => {
		if (agent.name !== options.agentName) return agent;
		return {
			...agent,
			...(options.model !== undefined ? { model: options.model } : {}),
			...(options.skills !== undefined ? { skills: options.skills } : {}),
			...(options.tools !== undefined ? { tools: options.tools } : {}),
			...(options.extensions !== undefined ? { extensions: options.extensions } : {}),
			// The simplified product model always launches fresh child sessions and
			// prevents child-side delegation. Do not inherit parent project/skill context
			// implicitly; only explicit agent/options skills are injected above.
			inheritProjectContext: false,
			inheritSkills: false,
		};
	});
}

export async function runChild(options: RunChildOptions): Promise<ChildResult> {
	const artifactConfig = {
		...DEFAULT_ARTIFACT_CONFIG,
		...options.artifactConfig,
		enabled: options.artifacts !== false && options.artifactConfig?.enabled !== false,
	};
	return runSync(options.cwd, withExecutionOverrides(options.agents, options), options.agentName, options.task, {
		cwd: options.cwd,
		signal: options.signal,
		onUpdate: options.onUpdate,
		artifactsDir: options.artifactsDir,
		artifactConfig,
		runId: options.runId,
		index: options.index,
		sessionFile: options.sessionFile,
		outputPath: options.output,
		modelOverride: options.model,
		skills: options.skills,
	});
}
