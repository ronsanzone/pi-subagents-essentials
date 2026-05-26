import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type AgentConfig, type AgentScope, discoverAgentsAll } from "./agents.ts";
import type { Details } from "../shared/types.ts";

type ManagementContext = Pick<ExtensionContext, "cwd" | "modelRegistry">;

interface ManagementParams {
	action?: string;
	agent?: string;
	agentScope?: string;
	config?: unknown;
}

function result(text: string, isError = false): AgentToolResult<Details> {
	return { content: [{ type: "text", text }], isError, details: { mode: "management", results: [] } };
}

function sanitizeName(name: string): string {
	return name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeListScope(scope: unknown): AgentScope | undefined {
	if (scope === undefined) return "both";
	if (scope === "user" || scope === "project" || scope === "both") return scope;
	return undefined;
}

function allAgents(d: { builtin: AgentConfig[]; user: AgentConfig[]; project: AgentConfig[] }): AgentConfig[] {
	return [...d.builtin, ...d.user, ...d.project];
}

function findAgents(name: string, cwd: string, scope: AgentScope = "both"): AgentConfig[] {
	const d = discoverAgentsAll(cwd);
	const raw = name.trim();
	const sanitized = sanitizeName(raw);
	return allAgents(d)
		.filter((a) => (scope === "both" || a.source === scope) && (a.name === raw || a.name === sanitized))
		.sort((a, b) => a.source.localeCompare(b.source));
}

function availableNames(cwd: string): string[] {
	const d = discoverAgentsAll(cwd);
	return [...new Set(allAgents(d).map((x) => x.name))].sort((a, b) => a.localeCompare(b));
}

function formatAgentDetail(agent: AgentConfig): string {
	const lines: string[] = [`Agent: ${agent.name} (${agent.source})`, `Path: ${agent.filePath}`, `Description: ${agent.description}`];
	if (agent.model) lines.push(`Model: ${agent.model}`);
	if (agent.tools?.length) lines.push(`Tools: ${agent.tools.join(", ")}`);
	if (agent.skills?.length) lines.push(`Skills: ${agent.skills.join(", ")}`);
	if (agent.systemPrompt) lines.push("", agent.systemPrompt);
	return lines.join("\n");
}

export function handleList(params: ManagementParams, ctx: ManagementContext): AgentToolResult<Details> {
	const scope = normalizeListScope(params.agentScope);
	if (!scope) return result("agentScope must be 'user', 'project', or 'both'.", true);
	const d = discoverAgentsAll(ctx.cwd);
	const agents = allAgents(d).filter((a) => scope === "both" || a.source === scope).sort((a, b) => a.name.localeCompare(b.name));
	return result([
		"Agents:",
		...(agents.length ? agents.map((a) => `- ${a.name} (${a.source}): ${a.description}`) : ["- (none)"]),
		`User agents dir: ${d.userDir}`,
		`Project agents dir: ${d.projectDir ?? "not found"}`,
	].join("\n"));
}

function handleGet(params: ManagementParams, ctx: ManagementContext): AgentToolResult<Details> {
	if (!params.agent) return result("Specify 'agent' for get.", true);
	const matches = findAgents(params.agent, ctx.cwd, "both");
	if (matches.length === 0) return result(`Agent '${params.agent}' not found. Available: ${availableNames(ctx.cwd).join(", ") || "none"}.`, true);
	return result(matches.map(formatAgentDetail).join("\n\n---\n\n"));
}

export function handleCreate(_params: ManagementParams, _ctx: ManagementContext): AgentToolResult<Details> {
	return result("Agent create is not available in the simplified Section 1/2 management API.", true);
}

export function handleUpdate(_params: ManagementParams, _ctx: ManagementContext): AgentToolResult<Details> {
	return result("Agent update is not available in the simplified Section 1/2 management API.", true);
}

function handleDelete(_params: ManagementParams, _ctx: ManagementContext): AgentToolResult<Details> {
	return result("Agent delete is not available in the simplified Section 1/2 management API.", true);
}

export function handleManagementAction(action: string, params: ManagementParams, ctx: ManagementContext): AgentToolResult<Details> {
	switch (action) {
		case "list": return handleList(params, ctx);
		case "get": return handleGet(params, ctx);
		case "create": return handleCreate(params, ctx);
		case "update": return handleUpdate(params, ctx);
		case "delete": return handleDelete(params, ctx);
		default: return result(`Unknown management action '${action}'.`, true);
	}
}
