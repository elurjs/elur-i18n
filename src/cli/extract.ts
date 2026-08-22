import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { resolve } from "path";
import { parse } from "@babel/parser";

const usage = `Usage: nix-i18n-extract <paths...> [--output <file>]

Extracts translation keys from source files by parsing calls to t(), n(),
i18n.t(), i18n.n(), etc. Uses an AST parser (Babel) for reliable extraction
in TypeScript/JSX/TSX code. Outputs a JSON file with the discovered keys.
`;

function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const output = outputIndex !== -1 ? args[outputIndex + 1] : "extracted-keys.json";
  if (outputIndex !== -1) {
    args.splice(outputIndex, 2);
  }

  const paths = args.length > 0 ? args : ["./src"];
  const files = collectFiles(paths);
  const keys = new Set<string>();

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    extractKeysAst(content, file, keys);
  }

  const sorted = [...keys].sort();
  writeFileSync(output, JSON.stringify(sorted, null, 2));
  console.log(`Extracted ${sorted.length} keys from ${files.length} files into ${output}`);
}

function collectFiles(paths: string[]): string[] {
  const files: string[] = [];
  for (const path of paths) {
    const stat = statSync(path);
    if (stat.isFile()) {
      files.push(resolve(path));
    } else if (stat.isDirectory()) {
      collectDirectoryFiles(path, files);
    }
  }
  return files;
}

function collectDirectoryFiles(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip node_modules and dist directories.
      if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
      collectDirectoryFiles(fullPath, files);
    } else if (/\.(ts|tsx|js|jsx|vue|svelte)$/.test(entry)) {
      files.push(fullPath);
    }
  }
}

// Function names that are considered translation functions.
const TRANSLATE_FUNCS = new Set(["t", "n", "i18n.t", "i18n.n", "i18nWithNs.t", "i18nWithNs.n"]);

// Simplified set of callee names to match (the first identifier or the property).
const SIMPLE_FUNCS = new Set(["t", "n"]);

function extractKeysAst(content: string, filename: string, keys: Set<string>): void {
  let ast;
  try {
    const isTsx = filename.endsWith(".tsx");
    const isJsx = filename.endsWith(".jsx") || isTsx;
    const plugins: string[] = [
      "typescript",
      "decorators-legacy",
      "objectRestSpread",
      "classProperties",
      "asyncGenerators",
      "dynamicImport",
      "exportDefaultFrom",
      "exportNamespaceFrom",
      "optionalChaining",
      "nullishCoalescingOperator",
    ];
    if (isJsx) plugins.push("jsx");
    ast = parse(content, {
      sourceType: "unambiguous",
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: plugins as never,
    });
  } catch {
    // If parsing fails (e.g. Vue/Svelte templates), fall back to regex.
    extractKeysRegex(content, keys);
    return;
  }

  // Walk the AST and find CallExpressions where the callee is t() or n().
  walkAst(ast, keys);
}

function walkAst(node: unknown, keys: Set<string>): void {
  if (!node || typeof node !== "object") return;

  const n = node as Record<string, unknown>;

  // Check if this is a CallExpression.
  if (n.type === "CallExpression") {
    const callee = n.callee as Record<string, unknown>;
    const args = n.arguments as unknown[];

    const funcName = getCalleeName(callee);
    if (funcName && shouldExtract(funcName, callee)) {
      // For t("key"), the first argument is the key.
      // For n(count, "key"), the second argument is the key.
      // Match both "n" and "i18n.n" / "i18nWithNs.n" etc.
      const isPluralCall = funcName === "n" || funcName.endsWith(".n");
      let keyArg: unknown;
      if (isPluralCall) {
        keyArg = args[1];
      } else {
        keyArg = args[0];
      }

      const keyValue = extractLiteralValue(keyArg);
      if (keyValue !== null) {
        keys.add(keyValue);
      }
      // Dynamic keys (non-literal) are intentionally skipped —
      // they can't be statically extracted.
    }
  }

  // Recurse into all child nodes.
  for (const key of Object.keys(n)) {
    const child = n[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        walkAst(item, keys);
      }
    } else if (child && typeof child === "object" && "type" in (child as Record<string, unknown>)) {
      walkAst(child, keys);
    }
  }
}

function getCalleeName(callee: Record<string, unknown>): string | null {
  if (callee.type === "Identifier") {
    return callee.name as string;
  }
  if (callee.type === "MemberExpression") {
    const property = callee.property as Record<string, unknown>;
    if (property.type === "Identifier") {
      const object = callee.object as Record<string, unknown>;
      const objectName = object.type === "Identifier" ? (object.name as string) : null;
      return objectName ? `${objectName}.${property.name as string}` : (property.name as string);
    }
  }
  return null;
}

function shouldExtract(funcName: string, _callee: Record<string, unknown>): boolean {
  // Match t(), i18n.t(), i18nWithNs.t(), n(), i18n.n(), i18nWithNs.n()
  if (TRANSLATE_FUNCS.has(funcName)) return true;
  // Also match any *.t or *.n member expression.
  if (funcName.endsWith(".t") || funcName.endsWith(".n")) return true;
  // Match simple t() and n() — but only if they look like translation calls.
  if (SIMPLE_FUNCS.has(funcName)) return true;
  return false;
}

function extractLiteralValue(arg: unknown): string | null {
  if (!arg || typeof arg !== "object") return null;
  const node = arg as Record<string, unknown>;

  // String literal: "key" or 'key'
  if (node.type === "StringLiteral") {
    return node.value as string;
  }
  // Template literal: `key` (only if no expressions — static only)
  if (node.type === "TemplateLiteral") {
    const expressions = node.expressions as unknown[];
    if (expressions.length === 0) {
      const quasis = node.quasis as Array<{ value: { raw: string; cooked: string } }>;
      if (quasis.length > 0 && quasis[0].value.cooked) {
        return quasis[0].value.cooked;
      }
    }
  }
  return null;
}

// Fallback regex-based extraction for files that can't be parsed as JS/TS.
function extractKeysRegex(content: string, keys: Set<string>): void {
  const patterns = [
    /(?:\bt\(|i18n\.t\(|i18nWithNs\.t\()\s*["'`]([^"'`]+)["'`]\s*[,)]/g,
    /(?:\bn\(|i18n\.n\(|i18nWithNs\.n\()\s*[^,]+,\s*["'`]([^"'`]+)["'`]\s*[,)]/g,
  ];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      keys.add(match[1]);
    }
  }
}

// Exported for testing.
export function extractKeysForTest(content: string, filename: string, keys: Set<string>): void {
  extractKeysAst(content, filename, keys);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(usage);
  process.exit(0);
}

main();
