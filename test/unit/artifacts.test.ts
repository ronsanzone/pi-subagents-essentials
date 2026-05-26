import assert from "node:assert/strict";
import test from "node:test";
import { getArtifactPaths } from "../../src/shared/artifacts.ts";

test("artifact paths are stable and include index", () => {
	const paths = getArtifactPaths("/tmp/artifacts", "run", "agent/name", 2);
	assert.equal(paths.inputPath, "/tmp/artifacts/run_agent_name_2_input.md");
	assert.equal(paths.outputPath, "/tmp/artifacts/run_agent_name_2_output.md");
	assert.equal(paths.metadataPath, "/tmp/artifacts/run_agent_name_2_meta.json");
});

test("single run defaults to index zero", () => {
	assert.match(getArtifactPaths("/tmp/a", "r", "x").inputPath, /r_x_0_input\.md$/);
});
