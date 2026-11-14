import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import * as crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { isIP } from "node:net";
import { URL } from "node:url";
import ts from "typescript";

export function loadSigner() {
  const source = readFileSync(new URL("../../src/lib/server/gateway-assertions.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  return new Script(`(function () { const exports = {}; ${outputText}\nreturn exports; })()`)
    .runInNewContext({ Uint8Array, Buffer, require(name) {
      if (name === "server-only") return {};
      if (name === "node:crypto") return crypto;
      if (name === "node:buffer") return { Buffer };
      if (name === "node:net") return { isIP };
      if (name === "node:url") return { URL };
      assert.fail("Unexpected module dependency");
    }});
}
