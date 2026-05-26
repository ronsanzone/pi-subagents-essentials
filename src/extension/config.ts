import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionConfig } from "../shared/types.ts";
import { getAgentDir } from "../shared/utils.ts";

export const DEFAULT_CONFIG: Required<ExtensionConfig> = {
	agents: { disableBuiltins: false },
	artifacts: { enabled: true, cleanupDays: 7 },
	parallel: { concurrency: 4, maxTasks: 8 },
	background: { runsDir: path.join(getAgentDir(), "background-runs"), tailLines: 80 },
};

function expandTilde(value: string): string {
	return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}

export function resolveConfig(raw: ExtensionConfig = {}): Required<ExtensionConfig> {
	return {
		agents: { ...DEFAULT_CONFIG.agents, ...(raw.agents ?? {}) },
		artifacts: { ...DEFAULT_CONFIG.artifacts, ...(raw.artifacts ?? {}) },
		parallel: { ...DEFAULT_CONFIG.parallel, ...(raw.parallel ?? {}) },
		background: {
			...DEFAULT_CONFIG.background,
			...(raw.background ?? {}),
			runsDir: expandTilde(raw.background?.runsDir ?? DEFAULT_CONFIG.background.runsDir),
		},
	};
}

export function loadConfig(): ExtensionConfig {
	const configPath = path.join(getAgentDir(), "extensions", "subagent", "config.json");
	try {
		if (fs.existsSync(configPath)) {
			return resolveConfig(JSON.parse(fs.readFileSync(configPath, "utf-8")) as ExtensionConfig);
		}
	} catch (error) {
		console.error(`Failed to load subagent config from '${configPath}':`, error);
	}
	return resolveConfig();
}
