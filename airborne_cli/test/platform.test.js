import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidOptionArgumentError } from "commander";
import { parsePlatform } from "../src/utils/platform.js";

test("platforms are case-insensitive and include web", () => {
  assert.equal(parsePlatform("WEB"), "web");
  assert.equal(parsePlatform("Android"), "android");
  assert.equal(parsePlatform("ios"), "ios");
});

test("unknown platforms are rejected", () => {
  assert.throws(() => parsePlatform("windows"), InvalidOptionArgumentError);
});
