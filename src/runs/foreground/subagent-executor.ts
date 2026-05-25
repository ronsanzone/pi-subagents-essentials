import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AgentConfig, AgentScope } from "../../agents/agents.ts";
import { buildDoctorReport } from "../../extension/doctor.ts";
import { validateSubagentParams } from "../../extension/schemas.ts";
import type { Details, ExtensionConfig, SubagentState } from "../../shared/types.ts";

interface TaskParam {
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
	tempArtifactsDir: string;
	expandTilde: (p: string) => string;
	discoverAgents: (cwd: string, scope: AgentScope) => { agents: AgentConfig[] };
}

function textResult(text: string, isError = false): AgentToolResult<Details> {
	return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}), details: { mode: "management", results: [] } };
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

export function createSubagentExecutor(deps: ExecutorDeps): {
	execute: (
		id: string,
		params: SubagentParamsLike,
		signal: AbortSignal,
		onUpdate: ((r: AgentToolResult<Details>) => void) | undefined,
		ctx: ExtensionContext,
	) => Promise<AgentToolResult<Details>> | AgentToolResult<Details>;
} {
	return {
		execute(_id, params, _signal, _onUpdate, ctx) {
			const validation = validateSubagentParams(params);
			if (!validation.valid) return textResult(validation.errors.join("\n"), true);

			const scope = params.agentScope ?? "both";
			const cwd = params.cwd ?? ctx.cwd;
			if (params.action === "list") {
				return textResult(formatAgentList(deps.discoverAgents(cwd, scope).agents));
			}
			if (params.action === "get") {
				const agent = deps.discoverAgents(cwd, scope).agents.find((candidate) => candidate.name === params.agent);
				return agent ? textResult(formatAgent(agent)) : textResult(`Agent not found: ${params.agent}`, true);
			}
			if (params.action === "doctor") {
				return textResult(buildDoctorReport({ cwd, config: deps.config, state: deps.state, expandTilde: deps.expandTilde }));
			}
			if (params.action === "status") {
				return textResult("Background status is not available until the simplified Section 3 executor is implemented.", true);
			}

			return textResult("Subagent execution is temporarily unavailable until the simplified Section 3 executor is implemented.", true);
		},
	};
}
