import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { discoverAgents } from "../../src/agents/agents.ts";

test("discovery option disables builtin agents from extension config", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-discovery-config-"));
	try {
		const cwd = path.join(tmp, "project");
		fs.mkdirSync(cwd, { recursive: true });
		const enabled = discoverAgents(cwd, "both").agents;
		assert.ok(enabled.some((agent) => agent.source === "builtin"));

		const disabled = discoverAgents(cwd, "both", { disableBuiltins: true }).agents;
		assert.equal(disabled.some((agent) => agent.source === "builtin"), false);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});
