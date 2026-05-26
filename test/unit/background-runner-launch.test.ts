import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.resolve("src/runs/background.ts"), "utf-8");
const runner = fs.readFileSync(path.resolve("src/runs/background-runner.mjs"), "utf-8");

test("background launcher uses stable JS runner instead of Node strip-types", () => {
	assert.match(source, /background-runner\.mjs/);
	assert.doesNotMatch(source, /experimental-strip-types/);
	assert.match(runner, /createJiti/);
	assert.match(runner, /background-runner\.ts/);
});
