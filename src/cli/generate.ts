import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { resolve } from "path";

const usage = `Usage: elur-i18n-generate <paths...> --locales <es,en> [--output <file>]

Generates a JSON translation file with empty values for every locale from the
keys found in source files. Uses the same key extraction rules as elur-i18n-extract.
`;

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    process.exit(0);
  }

  const localesIndex = args.indexOf("--locales");
  const locales = localesIndex !== -1 ? args[localesIndex + 1].split(",") : ["en"];
  if (localesIndex !== -1) {
    args.splice(localesIndex, 2);
  }

  const outputIndex = args.indexOf("--output");
  const output = outputIndex !== -1 ? args[outputIndex + 1] : "translations.json";
  if (outputIndex !== -1) {
    args.splice(outputIndex, 2);
  }

  const paths = args.length > 0 ? args : ["./src"];
  const files = collectFiles(paths);
  const keys = new Set<string>();

  for (const file of files) {
    extractKeys(readFileSync(file, "utf-8"), keys);
  }

  const result: Record<string, Record<string, string>> = {};
  for (const locale of locales) {
    result[locale] = {};
    for (const key of [...keys].sort()) {
      result[locale][key] = "";
    }
  }

  writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(`Generated ${keys.size} keys for ${locales.length} locales into ${output}`);
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
      collectDirectoryFiles(fullPath, files);
    } else if (/\.(ts|tsx|js|jsx|vue|svelte)$/.test(entry)) {
      files.push(fullPath);
    }
  }
}

function extractKeys(content: string, keys: Set<string>): void {
  const patterns = [
    /(?:\bt\(|i18n\.t\(|i18nWithNs\.t\()\s*["']([^"']+)["']\s*[,)]/g,
    /(?:\bn\(|i18n\.n\(|i18nWithNs\.n\()\s*[^,]+,\s*["']([^"']+)["']\s*[,)]/g,
  ];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      keys.add(match[1]);
    }
  }
}

main();
