import assert from "node:assert/strict";
import test from "node:test";
import { mapLimit } from "../../src/runs/parallel.ts";

test("mapLimit preserves order and respects concurrency", async () => {
	let active = 0;
	let maxActive = 0;
	const result = await mapLimit([1, 2, 3, 4], 2, async (value) => {
		active++;
		maxActive = Math.max(maxActive, active);
		await new Promise((resolve) => setTimeout(resolve, 5));
		active--;
		return value * 2;
	});
	assert.deepEqual(result, [2, 4, 6, 8]);
	assert.equal(maxActive, 2);
});
