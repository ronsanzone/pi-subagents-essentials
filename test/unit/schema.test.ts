import assert from "node:assert/strict";
import test from "node:test";

let mod: typeof import("../../src/extension/schemas.ts") | undefined;
try {
	mod = await import("../../src/extension/schemas.ts");
} catch {
	// typebox may be absent in stripped local test environments before npm install
}

const maybe = { skip: !mod ? "schema module dependencies not installed" : undefined };
function ok(value: unknown) { assert.equal(mod!.validateSubagentParams(value).valid, true); }
function bad(value: unknown) { assert.equal(mod!.validateSubagentParams(value).valid, false); }

test("accepts simplified modes", maybe, () => {
	ok({ agent: "a", task: "t" });
	ok({ tasks: [{ agent: "a", task: "t" }] });
	ok({ agent: "a", task: "t", background: true });
	ok({ action: "list" });
	ok({ action: "get", agent: "a" });
	ok({ action: "status", id: "abc" });
	ok({ action: "doctor" });
});

test("rejects unsupported old API", maybe, () => {
	bad({ chain: [] });
	bad({ action: "resume", id: "x" });
	bad({ action: "interrupt" });
	bad({ action: "create" });
	bad({ agent: "a", task: "t", unknown: true });
	bad({ tasks: [{ agent: "a", task: "t" }], background: true });
});
