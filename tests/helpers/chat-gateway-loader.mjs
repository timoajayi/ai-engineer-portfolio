import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { Buffer } from "node:buffer";
import * as crypto from "node:crypto";
import { isIP } from "node:net";
import { URL, fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import ts from "typescript";

// Existing compiler, memory only; VM exposes no environment, HTTP or filesystem.
export function loadGatewayModules(extraGlobals = {}) {
  const root = new URL("../../", import.meta.url);
  const cache = new Map();
  const natives = { "server-only": {}, "node:crypto": crypto, "node:buffer": { Buffer },
    "node:net": { isIP }, "node:url": { URL } };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const source = readFileSync(filename, "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const result = new Script(`(function () { const exports = {}; ${outputText}\nreturn exports; })()`)
      .runInNewContext({ Request, Response, Headers, URL, Buffer, Uint8Array, TextDecoder, TextEncoder,
        AbortController, setTimeout, clearTimeout, performance, ...extraGlobals,
        require(name) {
          if (Object.hasOwn(natives, name)) return natives[name];
          let target;
          if (name.startsWith("./")) target = resolve(dirname(filename), name + ".ts");
          else if (name.startsWith("@/lib/server/")) target = fileURLToPath(new URL("src/lib/server/" + name.slice("@/lib/server/".length) + ".ts", root));
          else throw new Error("Dependency not permitted by offline loader");
          if (!target.startsWith(fileURLToPath(new URL("src/lib/server/", root)))) throw new Error("Module outside allowlist");
          return load(target);
        },
      });
    cache.set(filename, result);
    return result;
  }
  return {
    gateway: load(fileURLToPath(new URL("src/lib/server/chat-gateway.ts", root))),
    identity: load(fileURLToPath(new URL("src/lib/server/visitor-identity.ts", root))),
    load: (path) => load(fileURLToPath(new URL(path, root))),
  };
}
