/**
 * TypeBox schemas for the simplified subagent tool parameters.
 */

import { Type } from "typebox";

export const SUBAGENT_ACTIONS = ["list", "get", "doctor", "status"] as const;
export type SubagentAction = typeof SUBAGENT_ACTIONS[number];

const StringArray = Type.Array(Type.String());

const StringListOverride = Type.Unsafe({
	anyOf: [
		{ type: "array", items: { type: "string" } },
		{ type: "string" },
	],
});

const OutputOverride = Type.Unsafe({
	anyOf: [
		{ type: "string" },
		{ type: "boolean" },
	],
	description: "Output filename/path, or false to disable saved final output.",
});

export const SubagentTaskItem = Type.Object({
	agent: Type.String({ description: "Agent name for this child run." }),
	task: Type.String({ description: "Task for this child run." }),
	cwd: Type.Optional(Type.String()),
	model: Type.Optional(Type.String()),
	skills: Type.Optional(StringListOverride),
	tools: Type.Optional(StringListOverride),
	extensions: Type.Optional(StringListOverride),
	output: Type.Optional(OutputOverride),
	artifacts: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });

export const SubagentParams = Type.Object({
	action: Type.Optional(Type.String({
		enum: [...SUBAGENT_ACTIONS],
		description: "Management action. Omit for execution mode.",
	})),
	agent: Type.Optional(Type.String({ description: "Agent name for single execution, or action='get'." })),
	id: Type.Optional(Type.String({ description: "Exact background run id for action='status'." })),
	task: Type.Optional(Type.String({ description: "Task for a single child run." })),
	tasks: Type.Optional(Type.Array(SubagentTaskItem, {
		minItems: 1,
		description: "Parallel fresh-context child runs.",
	})),
	cwd: Type.Optional(Type.String()),
	model: Type.Optional(Type.String()),
	skills: Type.Optional(StringListOverride),
	tools: Type.Optional(StringListOverride),
	extensions: Type.Optional(StringListOverride),
	output: Type.Optional(OutputOverride),
	background: Type.Optional(Type.Boolean({ description: "Detach a single fresh-context child run." })),
	concurrency: Type.Optional(Type.Integer({ minimum: 1, description: "Parallel concurrency." })),
	artifacts: Type.Optional(Type.Boolean({ description: "Capture input/output/metadata artifacts." })),
	agentScope: Type.Optional(Type.String({ enum: ["user", "project", "both"], description: "Agent discovery scope." })),
}, { additionalProperties: false });

export const UNSUPPORTED_SUBAGENT_KEYS = [
	"chain",
	"chainDir",
	"chainName",
	"clarify",
	"context",
	"worktree",
	"share",
	"sessionDir",
	"outputMode",
	"includeProgress",
	"control",
	"runId",
	"message",
	"index",
	"config",
	"async",
] as const;

const TOP_LEVEL_ALLOWED_KEYS = new Set([
	"action",
	"agent",
	"id",
	"task",
	"tasks",
	"cwd",
	"model",
	"skills",
	"tools",
	"extensions",
	"output",
	"background",
	"concurrency",
	"artifacts",
	"agentScope",
]);

const TASK_ITEM_ALLOWED_KEYS = new Set([
	"agent",
	"task",
	"cwd",
	"model",
	"skills",
	"tools",
	"extensions",
	"output",
	"artifacts",
]);

const EXECUTION_ONLY_FIELDS = [
	"task",
	"tasks",
	"cwd",
	"model",
	"skills",
	"tools",
	"extensions",
	"output",
	"background",
	"concurrency",
	"artifacts",
] as const;

export interface SubagentValidationOptions {
	maxTasks?: number;
	maxConcurrency?: number;
}

export interface SubagentValidationResult {
	valid: boolean;
	errors: string[];
}

export function validateSubagentParams(raw: unknown, options: SubagentValidationOptions = {}): SubagentValidationResult {
	const errors: string[] = [];
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return { valid: false, errors: ["subagent params must be an object"] };
	}

	const params = raw as Record<string, unknown>;
	for (const key of Object.keys(params)) {
		if (!TOP_LEVEL_ALLOWED_KEYS.has(key)) {
			errors.push(`Unknown subagent parameter '${key}'.`);
		}
	}
	for (const key of UNSUPPORTED_SUBAGENT_KEYS) {
		if (Object.prototype.hasOwnProperty.call(params, key)) {
			errors.push(`Unsupported subagent parameter '${key}'. This simplified API does not support it.`);
		}
	}

	const action = params.action;
	if (action !== undefined && !SUBAGENT_ACTIONS.includes(action as SubagentAction)) {
		errors.push(`Unsupported subagent action '${String(action)}'. Supported actions: ${SUBAGENT_ACTIONS.join(", ")}.`);
	}

	if (typeof action === "string") {
		for (const field of EXECUTION_ONLY_FIELDS) {
			if (Object.prototype.hasOwnProperty.call(params, field)) {
				errors.push(`action='${action}' cannot be combined with execution field '${field}'.`);
			}
		}
		if (params.agentScope !== undefined && params.agentScope !== "user" && params.agentScope !== "project" && params.agentScope !== "both") {
			errors.push("agentScope must be one of 'user', 'project', or 'both'.");
		}
		if (action === "get" && typeof params.agent !== "string") errors.push("action='get' requires string field 'agent'.");
		if (action === "status" && typeof params.id !== "string") errors.push("action='status' requires string field 'id'.");
		return { valid: errors.length === 0, errors };
	}

	const hasSingle = typeof params.agent === "string" || typeof params.task === "string";
	const hasParallel = Array.isArray(params.tasks);
	if (hasSingle === hasParallel) {
		errors.push("Execution mode must be exactly one of single ({agent, task}) or parallel ({tasks}).");
	}
	if (params.background === true && !hasSingle) {
		errors.push("background: true is only supported for single execution mode.");
	}
	if (hasSingle) {
		if (typeof params.agent !== "string") errors.push("Single execution requires string field 'agent'.");
		if (typeof params.task !== "string") errors.push("Single execution requires string field 'task'.");
	}
	if (hasParallel) {
		const tasks = params.tasks as unknown[];
		const maxTasks = options.maxTasks ?? Number.POSITIVE_INFINITY;
		if (tasks.length < 1) errors.push("tasks must contain at least one item.");
		if (tasks.length > maxTasks) errors.push(`tasks length ${tasks.length} exceeds max ${maxTasks}.`);
		tasks.forEach((task, index) => {
			if (!task || typeof task !== "object" || Array.isArray(task)) {
				errors.push(`tasks[${index}] must be an object.`);
				return;
			}
			const item = task as Record<string, unknown>;
			for (const key of Object.keys(item)) {
				if (!TASK_ITEM_ALLOWED_KEYS.has(key)) errors.push(`Unknown tasks[${index}] parameter '${key}'.`);
			}
			if (typeof item.agent !== "string") errors.push(`tasks[${index}] requires string field 'agent'.`);
			if (typeof item.task !== "string") errors.push(`tasks[${index}] requires string field 'task'.`);
			for (const key of ["cwd", "model", "output"] as const) {
				if (item[key] !== undefined && typeof item[key] !== "string" && !(key === "output" && typeof item[key] === "boolean")) {
					errors.push(`tasks[${index}].${key} must be a string${key === "output" ? " or boolean" : ""}.`);
				}
			}
			for (const key of ["skills", "tools", "extensions"] as const) {
				const value = item[key];
				if (value !== undefined && typeof value !== "string" && !(Array.isArray(value) && value.every((entry) => typeof entry === "string"))) {
					errors.push(`tasks[${index}].${key} must be a string or string array.`);
				}
			}
			if (item.artifacts !== undefined && typeof item.artifacts !== "boolean") {
				errors.push(`tasks[${index}].artifacts must be a boolean.`);
			}
		});
	}
	if (params.concurrency !== undefined) {
		const maxConcurrency = options.maxConcurrency ?? Number.POSITIVE_INFINITY;
		if (!Number.isInteger(params.concurrency) || (params.concurrency as number) < 1) {
			errors.push("concurrency must be a positive integer.");
		} else if ((params.concurrency as number) > maxConcurrency) {
			errors.push(`concurrency ${(params.concurrency as number)} exceeds max ${maxConcurrency}.`);
		}
	}
	return { valid: errors.length === 0, errors };
}
