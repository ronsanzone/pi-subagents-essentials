import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AgentConfig, AgentScope } from "../agents/agents.ts";
import { buildDoctorReport } from "../extension/doctor.ts";
import { validateSubagentParams } from "../extension/schemas.ts";
import { DEFAULT_ARTIFACT_CONFIG, type Details, type ExtensionConfig, type SingleResult, type SubagentState } from "../shared/types.ts";
import { startBackgroundRun } from "./background.ts";
import { getBackgroundStatus } from "./background-status.ts";
import { runChild } from "./child-runner.ts";
import { mapLimit } from "./parallel.ts";

export interface TaskParam {
	agent: string;
	task: string;
	cwd?: string;
	model?: string;
	skills?: string | string[];
	tools?: string | string[];
	extensions?: string | string[];
	output?: string | boolean;
	artifacts?: boolean;
}

export interface SubagentParamsLike {
	action?: string;
	agent?: string;
	id?: string;
	task?: string;
	tasks?: TaskParam[];
	concurrency?: number;
	background?: boolean;
	cwd?: string;
	model?: string;
	skills?: string | string[];
	tools?: string | string[];
	extensions?: string | string[];
	output?: string | boolean;
	artifacts?: boolean;
	agentScope?: AgentScope;
	[key: string]: unknown;
}

interface ExecutorDeps {
	pi: ExtensionAPI;
	state: SubagentState;
	config: ExtensionConfig;
	resolveArtifactsDir: (ctx: ExtensionContext) => string;
	expandTilde: (p: string) => string;
	discoverAgents: (cwd: string, scope: AgentScope, options?: { disableBuiltins?: boolean }) => { agents: AgentConfig[] };
}

function textResult(text: string, isError = false, details?: Partial<Details>): AgentToolResult<Details> {
	return {
		content: [{ type: "text", text }],
		...(isError ? { isError: true } : {}),
		details: { mode: "management", results: [], ...details },
	};
}

function validationErrorResult(errors: string[]): AgentToolResult<Details> {
	return textResult(errors.join("\n"), true);
}

function unknownAgentResult(agent: string): AgentToolResult<Details> {
	return textResult(`Agent not found: ${agent}`, true);
}

function formatArtifactPaths(result: Pick<SingleResult, "artifactPaths" | "sessionFile">): string {
	const paths = result.artifactPaths;
	if (!paths && !result.sessionFile) return "";
	const lines = ["", "Artifacts:"];
	if (paths?.inputPath) lines.push(`- input: ${paths.inputPath}`);
	if (paths?.outputPath) lines.push(`- output: ${paths.outputPath}`);
	if (paths?.metadataPath) lines.push(`- metadata: ${paths.metadataPath}`);
	if (paths?.jsonlPath) lines.push(`- jsonl: ${paths.jsonlPath}`);
	if (result.sessionFile) lines.push(`- session: ${result.sessionFile}`);
	return lines.join("\n");
}

function formatAgentList(agents: AgentConfig[]): string {
	if (agents.length === 0) return "No agents found.";
	return agents
		.map((agent) => {
			const disabled = agent.disabled ? " (disabled)" : "";
			const description = agent.description ? ` - ${agent.description}` : "";
			return `- ${agent.name}${disabled}${description}`;
		})
		.join("\n");
}

function formatAgent(agent: AgentConfig): string {
	return [
		`# ${agent.name}`,
		agent.description,
		`source: ${agent.source}`,
		agent.filePath ? `file: ${agent.filePath}` : undefined,
		agent.model ? `model: ${agent.model}` : undefined,
		agent.tools?.length ? `tools: ${agent.tools.join(", ")}` : undefined,
		agent.skills?.length ? `skills: ${agent.skills.join(", ")}` : undefined,
		"",
		agent.systemPrompt,
	].filter((line) => line !== undefined).join("\n");
}

function normalizeList(value: string | string[] | undefined): string[] | undefined {
	if (Array.isArray(value)) return value;
	if (typeof value === "string") return value.split(",").map((part) => part.trim()).filter(Boolean);
	return undefined;
}

function outputPath(value: string | boolean | undefined): string | undefined {
	return typeof value === "string" && value !== "false" ? value : undefined;
}

function finalText(result: SingleResult): string {
	const body = result.finalOutput ?? result.error ?? "";
	const status = result.error ? `Error: ${result.error}\n\n` : "";
	return `${status}${body}${formatArtifactPaths(result)}`.trim();
}

export function createExecutor(deps: ExecutorDeps): {
	execute: (
		id: string,
		params: SubagentParamsLike,
		signal: AbortSignal,
		onUpdate: ((r: AgentToolResult<Details>) => void) | undefined,
		ctx: ExtensionContext,
	) => Promise<AgentToolResult<Details>> | AgentToolResult<Details>;
} {
	return {
		async execute(id, params, signal, onUpdate, ctx) {
			const maxTasks = deps.config.parallel?.maxTasks;
			const maxConcurrency = deps.config.parallel?.concurrency;
			const validation = validateSubagentParams(params, { maxTasks, maxConcurrency });
			if (!validation.valid) return validationErrorResult(validation.errors);

			const scope = params.agentScope ?? "both";
			const cwd = params.cwd ?? ctx.cwd;
			const discoveryOptions = { disableBuiltins: deps.config.agents?.disableBuiltins === true };
			const agents = deps.discoverAgents(cwd, scope, discoveryOptions).agents;

			if (params.action === "list") return textResult(formatAgentList(agents));
			if (params.action === "get") {
				const agent = agents.find((candidate) => candidate.name === params.agent);
				return agent ? textResult(formatAgent(agent)) : unknownAgentResult(params.agent ?? "");
			}
			if (params.action === "doctor") {
				return textResult(buildDoctorReport({ cwd, config: deps.config, state: deps.state, expandTilde: deps.expandTilde }));
			}
			if (params.action === "status") return getBackgroundStatus(params.id!, deps.config);
			if (params.background) return startBackgroundRun({ id, params, cwd, config: deps.config });

			const artifactsDir = deps.resolveArtifactsDir(ctx);
			const artifactConfig = {
				...DEFAULT_ARTIFACT_CONFIG,
				...(deps.config.artifacts ?? {}),
				enabled: params.artifacts !== false && deps.config.artifacts?.enabled !== false,
			};

			if (params.tasks) {
				const concurrency = Math.min(params.concurrency ?? deps.config.parallel?.concurrency ?? 4, params.tasks.length);
				const results = await mapLimit(params.tasks, concurrency, (task, index) => {
					const childCwd = task.cwd ?? cwd;
					const childAgents = childCwd === cwd ? agents : deps.discoverAgents(childCwd, scope, discoveryOptions).agents;
					return runChild({
					runId: id,
					index,
					agentName: task.agent,
					task: task.task,
					cwd: childCwd,
					agents: childAgents,
					model: task.model ?? params.model,
					skills: normalizeList(task.skills ?? params.skills),
					tools: normalizeList(task.tools ?? params.tools),
					extensions: normalizeList(task.extensions ?? params.extensions),
					output: outputPath(task.output ?? params.output),
					artifactsDir,
					artifacts: task.artifacts !== false && artifactConfig.enabled,
					artifactConfig,
					signal,
					onUpdate,
				});
				});
				const text = results.map((result, index) => `## ${index + 1}. ${result.agent}\n\n${finalText(result)}`).join("\n\n");
				return { content: [{ type: "text", text }], isError: results.every((r) => r.exitCode !== 0 || Boolean(r.error)), details: { mode: "parallel", context: "fresh", runId: id, results } };
			}

			const result = await runChild({
				runId: id,
				agentName: params.agent!,
				task: params.task!,
				cwd,
				agents,
				model: params.model,
				skills: normalizeList(params.skills),
				tools: normalizeList(params.tools),
				extensions: normalizeList(params.extensions),
				output: outputPath(params.output),
				artifactsDir,
				artifacts: params.artifacts !== false,
				artifactConfig,
				signal,
				onUpdate,
			});
			return { content: [{ type: "text", text: finalText(result) }], ...(result.exitCode !== 0 || result.error ? { isError: true } : {}), details: { mode: "single", context: "fresh", runId: id, results: [result] } };
		},
	};
}
