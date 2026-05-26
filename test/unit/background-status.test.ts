import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { getBackgroundStatus } from "../../src/runs/background-status.ts";

test("rejects unsafe ids", () => {
	assert.equal(getBackgroundStatus("../x", {}).isError, true);
});

test("reports completed status with output preview", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bg-status-"));
	const runDir = path.join(dir, "abc");
	fs.mkdirSync(runDir);
	const files = { outputPath: path.join(runDir, "output.md"), metaPath: path.join(runDir, "meta.json"), stderrPath: path.join(runDir, "stderr.log") };
	fs.writeFileSync(files.outputPath, "done");
	fs.writeFileSync(path.join(runDir, "status.json"), JSON.stringify({ id: "abc", state: "completed", agent: "a", files }));
	const res = getBackgroundStatus("abc", { background: { runsDir: dir } });
	assert.equal(res.isError, undefined);
	assert.match(res.content[0].text, /completed/);
	assert.match(res.content[0].text, /done/);
});
