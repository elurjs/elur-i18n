import { describe, it, expect, vi, beforeEach } from "vitest";
import { createI18n } from "../core/createI18n";
import { apiBackend } from "../backends/api";
import { jsonBackend } from "../backends/json";
import { devOverlayPlugin } from "../plugins/devOverlay";
import { icuPluralizePlugin, icuPluralize, icuFormat } from "../plugins/icuPluralize";
import { headPlugin } from "../plugins/head";
import { detectLocalePlugin } from "../plugins/detect";
import { stableStringify } from "../format/intlCache";
import { extractKeysForTest } from "../cli/extract";
import type { Messages } from "../core/types";

describe("Fix #1: apiBackend — no cache on error, retry allowed", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retries on fetch failure (does not cache error)", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("network error");
      }
      return {
        ok: true,
        json: () => Promise.resolve({ hello: "Hola" }),
      } as unknown as Response;
    });

    const backend = apiBackend({ url: "/api/translations" });

    const result1 = await backend.load("es", "common");
    expect(result1).toEqual({}); // graceful fallback

    const result2 = await backend.load("es", "common");
    expect(result2).toEqual({ hello: "Hola" });
    expect(callCount).toBe(2);
  });

  it("retries on HTTP error (does not cache error response)", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 500 } as unknown as Response;
      }
      return {
        ok: true,
        json: () => Promise.resolve({ hello: "Hola" }),
      } as unknown as Response;
    });

    const backend = apiBackend({ url: "/api/translations" });

    await backend.load("es", "common");
    const result = await backend.load("es", "common");

    expect(result).toEqual({ hello: "Hola" });
    expect(callCount).toBe(2);
  });

  it("caches successful results (single-flight still works)", async () => {
    const json = vi.fn(() => Promise.resolve({ hello: "Hola" }));
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json,
    } as unknown as Response));

    const backend = apiBackend({ url: "/api/translations" });

    await backend.load("es", "common");
    await backend.load("es", "common");

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("supports cacheTtl for successful results", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      return {
        ok: true,
        json: () => Promise.resolve({ hello: "Hola" }),
      } as unknown as Response;
    });

    const backend = apiBackend({ url: "/api/translations", cacheTtl: 50 });

    await backend.load("es", "common");
    expect(callCount).toBe(1);

    await backend.load("es", "common");
    expect(callCount).toBe(1);

    await new Promise((r) => setTimeout(r, 60));
    await backend.load("es", "common");
    expect(callCount).toBe(2);
  });
});

describe("Fix #2: jsonBackend — no cache on error, retry allowed", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retries on fetch failure", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error("network error");
      return {
        ok: true,
        json: () => Promise.resolve({ hello: "Hola" }),
      } as unknown as Response;
    });

    const backend = jsonBackend({ baseUrl: "/locales" });

    await backend.load("es", "common");
    const result = await backend.load("es", "common");

    expect(result).toEqual({ hello: "Hola" });
    expect(callCount).toBe(2);
  });

  it("retries on HTTP 404", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) return { ok: false, status: 404 } as unknown as Response;
      return {
        ok: true,
        json: () => Promise.resolve({ hello: "Hola" }),
      } as unknown as Response;
    });

    const backend = jsonBackend({ baseUrl: "/locales" });

    await backend.load("es", "common");
    const result = await backend.load("es", "common");

    expect(result).toEqual({ hello: "Hola" });
    expect(callCount).toBe(2);
  });

  it("caches successful results", async () => {
    const json = vi.fn(() => Promise.resolve({ hello: "Hola" }));
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json,
    } as unknown as Response));

    const backend = jsonBackend({ baseUrl: "/locales" });

    await backend.load("es", "common");
    await backend.load("es", "common");

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("Fix #3: CLI AST parser", () => {
  it("extracts keys from string literals", () => {
    const keys = new Set<string>();
    extractKeysForTest(`t("hello"); t('world');`, "test.ts", keys);
    expect(keys.has("hello")).toBe(true);
    expect(keys.has("world")).toBe(true);
  });

  it("extracts keys from template literals (static only)", () => {
    const keys = new Set<string>();
    extractKeysForTest("t(`hello`); t(`world`);", "test.ts", keys);
    expect(keys.has("hello")).toBe(true);
    expect(keys.has("world")).toBe(true);
  });

  it("does not extract dynamic keys", () => {
    const keys = new Set<string>();
    extractKeysForTest(`t(variable); t("static" + dynamic);`, "test.ts", keys);
    expect(keys.size).toBe(0);
  });

  it("does not extract from comments", () => {
    const keys = new Set<string>();
    extractKeysForTest(`// t("comment_key")\n/* t("block_key") */\nt("real_key");`, "test.ts", keys);
    expect(keys.has("comment_key")).toBe(false);
    expect(keys.has("block_key")).toBe(false);
    expect(keys.has("real_key")).toBe(true);
  });

  it("extracts from i18n.t() and i18n.n()", () => {
    const keys = new Set<string>();
    extractKeysForTest(`i18n.t("greeting"); i18n.n(5, "items");`, "test.ts", keys);
    expect(keys.has("greeting")).toBe(true);
    expect(keys.has("items")).toBe(true);
  });

  it("extracts from member expressions like this.t()", () => {
    const keys = new Set<string>();
    extractKeysForTest(`this.t("self_key"); obj.t("obj_key");`, "test.ts", keys);
    expect(keys.has("self_key")).toBe(true);
    expect(keys.has("obj_key")).toBe(true);
  });

  it("handles TypeScript syntax", () => {
    const keys = new Set<string>();
    extractKeysForTest(
      `const x: string = t("typed_key"); interface Foo { bar: string }`,
      "test.ts",
      keys,
    );
    expect(keys.has("typed_key")).toBe(true);
  });
});

describe("Fix #4: Plugin composition pipeline", () => {
  it("useTranslateMiddleware composes correctly", () => {
    const i18n = createI18n<Messages>({
      locale: "en",
      messages: { en: { hello: "Hello" } },
    });

    const callOrder: string[] = [];

    i18n.useTranslateMiddleware!((next) => (key, params, opts) => {
      callOrder.push("middleware1");
      return next(key, params, opts);
    });

    i18n.useTranslateMiddleware!((next) => (key, params, opts) => {
      callOrder.push("middleware2");
      return next(key, params, opts);
    });

    i18n.t("hello" as never);

    expect(callOrder[0]).toBe("middleware1");
    expect(callOrder[1]).toBe("middleware2");
  });

  it("cleanup removes middleware in correct order", () => {
    const i18n = createI18n<Messages>({
      locale: "en",
      messages: { en: { hello: "Hello" } },
    });

    const callOrder: string[] = [];

    const cleanup1 = i18n.useTranslateMiddleware!((next) => (key, params, opts) => {
      callOrder.push("m1");
      return next(key, params, opts);
    });

    i18n.useTranslateMiddleware!((next) => (key, params, opts) => {
      callOrder.push("m2");
      return next(key, params, opts);
    });

    cleanup1();

    callOrder.length = 0;
    i18n.t("hello" as never);

    expect(callOrder).toEqual(["m2"]);
  });

  it("devOverlayPlugin uses middleware by default", () => {
    const i18n = createI18n<Messages>({
      locale: "en",
      messages: { en: { hello: "Hello" } },
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
    const cleanup = devOverlayPlugin(i18n, { log: true });

    i18n.t("missing_key" as never);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Missing key: missing_key"));

    cleanup();
    warnSpy.mockRestore();
  });

  it("icuPluralizePlugin uses middleware by default", () => {
    const i18n = createI18n<Messages>({
      locale: "en",
      messages: { en: { items: "{count, plural, one {# item} other {# items}}" } },
    });

    const cleanup = icuPluralizePlugin(i18n);

    expect(i18n.t("items" as never, { count: 1 } as never)).toBe("1 item");
    expect(i18n.t("items" as never, { count: 5 } as never)).toBe("5 items");

    cleanup();
  });

  it("multiple plugins compose without breaking cleanup", () => {
    const i18n = createI18n<Messages>({
      locale: "en",
      messages: { en: { items: "{count, plural, one {# item} other {# items}}" } },
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
    const cleanupDev = devOverlayPlugin(i18n, { log: false });
    const cleanupIcu = icuPluralizePlugin(i18n);

    expect(i18n.t("items" as never, { count: 1 } as never)).toBe("1 item");

    cleanupDev();
    cleanupIcu();

    expect(i18n.t("items" as never, { count: 1 } as never)).toBe("{count, plural, one {# item} other {# items}}");

    warnSpy.mockRestore();
  });
});

describe("Fix #5: detectLocalePlugin reDetect", () => {
  it("returns reDetect function", () => {
    const i18n = createI18n<Messages>({
      locale: "en",
      messages: { en: { hello: "Hello" }, es: { hello: "Hola" } },
    });

    const result = detectLocalePlugin(i18n, { order: ["fallback"] });
    expect(typeof result.reDetect).toBe("function");
  });

  it("reDetect re-runs detection", () => {
    const i18n = createI18n<Messages>({
      locale: "en",
      messages: { en: { hello: "Hello" }, es: { hello: "Hola" } },
    });

    const { reDetect } = detectLocalePlugin(i18n, { order: ["fallback"] });

    i18n.setLocale("es");
    expect(i18n.locale.value).toBe("es");

    reDetect();
    expect(i18n.locale.value).toBe("en"); // fallback is "en"
  });

  it("createI18n exposes reDetect on instance", () => {
    const i18n = createI18n<Messages>({
      locale: "en",
      messages: { en: {}, es: {} },
      detect: { order: ["fallback"] },
    });

    expect(typeof (i18n as { reDetect?: () => void }).reDetect).toBe("function");
  });
});

describe("Fix #6: stableStringify — Map, Set, Date, circular", () => {
  it("serializes Date deterministically (UTC ISO)", () => {
    const d1 = new Date("2024-01-15T10:30:00Z");
    const d2 = new Date("2024-01-15T10:30:00Z");
    expect(stableStringify(d1)).toBe(stableStringify(d2));
    expect(stableStringify(d1)).toContain("2024-01-15T10:30:00.000Z");
  });

  it("serializes Map with sorted entries", () => {
    const m1 = new Map([["b", 2], ["a", 1]]);
    const m2 = new Map([["a", 1], ["b", 2]]);
    expect(stableStringify(m1)).toBe(stableStringify(m2));
  });

  it("serializes Set with sorted values", () => {
    const s1 = new Set([3, 1, 2]);
    const s2 = new Set([1, 2, 3]);
    expect(stableStringify(s1)).toBe(stableStringify(s2));
  });

  it("serializes objects with sorted keys", () => {
    const o1 = { b: 2, a: 1 };
    const o2 = { a: 1, b: 2 };
    expect(stableStringify(o1)).toBe(stableStringify(o2));
  });

  it("throws on circular references", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    expect(() => stableStringify(obj)).toThrow(TypeError);
    expect(() => stableStringify(obj)).toThrow("Circular");
  });

  it("handles nested structures", () => {
    const data = { date: new Date("2024-01-01T00:00:00Z"), map: new Map([["x", 1]]), set: new Set([1, 2]) };
    const result = stableStringify(data);
    expect(result).toContain("2024-01-01T00:00:00.000Z");
    expect(result).toContain('"x"');
  });

  it("produces consistent keys for Intl options", () => {
    const opts1 = { dateStyle: "full", timeZone: "UTC" };
    const opts2 = { timeZone: "UTC", dateStyle: "full" };
    expect(stableStringify(opts1)).toBe(stableStringify(opts2));
  });
});

describe("Fix #7: headPlugin cleans orphan meta tags", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.documentElement.lang = "";
    document.documentElement.dir = "";
  });

  it("removes previous meta tags on locale change", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: { es: {}, en: {} },
    });

    headPlugin(i18n, {
      meta: [{ name: "description", content: (l) => `Desc in ${l}` }],
    });

    let metas = document.querySelectorAll('meta[name="description"]');
    expect(metas.length).toBe(1);
    expect((metas[0] as HTMLMetaElement).content).toBe("Desc in es");

    i18n.setLocale("en");

    metas = document.querySelectorAll('meta[name="description"]');
    expect(metas.length).toBe(1);
    expect((metas[0] as HTMLMetaElement).content).toBe("Desc in en");
  });

  it("tags injected with data attribute", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: { es: {} },
    });

    headPlugin(i18n, {
      meta: [{ name: "og:title", content: "Test" }],
    });

    const meta = document.querySelector('meta[name="og:title"]');
    expect(meta).not.toBeNull();
    expect(meta!.getAttribute("data-nix-i18n-head")).toBe("true");
  });

  it("cleanup removes all injected meta tags", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: { es: {} },
    });

    const cleanup = headPlugin(i18n, {
      meta: [
        { name: "description", content: "Test" },
        { name: "og:title", content: "Title" },
      ],
    });

    expect(document.querySelectorAll('meta[data-nix-i18n-head]').length).toBe(2);

    cleanup();

    expect(document.querySelectorAll('meta[data-nix-i18n-head]').length).toBe(0);
  });

  it("does not remove meta tags not injected by the plugin", () => {
    const external = document.createElement("meta");
    external.name = "viewport";
    external.content = "width=device-width";
    document.head.appendChild(external);

    const i18n = createI18n<Messages>({
      locale: "es",
      messages: { es: {} },
    });

    const cleanup = headPlugin(i18n, {
      meta: [{ name: "description", content: "Test" }],
    });

    expect(document.querySelector('meta[name="viewport"]')).not.toBeNull();

    expect(document.querySelector('meta[name="description"]')).not.toBeNull();

    cleanup();

    expect(document.querySelector('meta[name="viewport"]')).not.toBeNull();
    expect(document.querySelector('meta[name="description"]')).toBeNull();
  });
});

describe("Fix #8: ICU MessageFormat — select, selectordinal, nested", () => {
  it("handles plural (backward compat)", () => {
    expect(icuPluralize("{count, plural, one {# item} other {# items}}", 1, "en")).toBe("1 item");
    expect(icuPluralize("{count, plural, one {# item} other {# items}}", 5, "en")).toBe("5 items");
    expect(icuPluralize("{count, plural, zero {no items} one {# item} other {# items}}", 0, "en")).toBe("no items");
  });

  it("handles select (gender)", () => {
    const template = "{gender, select, male {He} female {She} other {They}}";
    expect(icuFormat(template, { gender: "male" }, "en")).toBe("He");
    expect(icuFormat(template, { gender: "female" }, "en")).toBe("She");
    expect(icuFormat(template, { gender: "other" }, "en")).toBe("They");
    expect(icuFormat(template, { gender: "unknown" }, "en")).toBe("They"); // falls to other
  });

  it("handles selectordinal", () => {
    const template = "{count, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}";
    expect(icuFormat(template, { count: 1 }, "en")).toBe("1st");
    expect(icuFormat(template, { count: 2 }, "en")).toBe("2nd");
    expect(icuFormat(template, { count: 3 }, "en")).toBe("3rd");
    expect(icuFormat(template, { count: 4 }, "en")).toBe("4th");
  });

  it("handles nested plural inside select", () => {
    const template = "{gender, select, male {{count, plural, one {He has # item} other {He has # items}}} female {{count, plural, one {She has # item} other {She has # items}}} other {{count, plural, one {They have # item} other {They have # items}}}}";
    expect(icuFormat(template, { gender: "male", count: 1 }, "en")).toBe("He has 1 item");
    expect(icuFormat(template, { gender: "female", count: 5 }, "en")).toBe("She has 5 items");
    expect(icuFormat(template, { gender: "other", count: 0 }, "en")).toBe("They have 0 items");
  });

  it("handles simple argument interpolation", () => {
    const template = "Hello {name}!";
    expect(icuFormat(template, { name: "World" }, "en")).toBe("Hello World!");
  });

  it("handles escaped opening brace {{", () => {
    const template = "Use {{literal}";
    expect(icuFormat(template, {}, "en")).toBe("Use {literal}");
  });

  it("handles =N exact match in plural", () => {
    const template = "{count, plural, =0 {no items} one {# item} other {# items}}";
    expect(icuFormat(template, { count: 0 }, "en")).toBe("no items");
    expect(icuFormat(template, { count: 1 }, "en")).toBe("1 item");
    expect(icuFormat(template, { count: 5 }, "en")).toBe("5 items");
  });

  it("icuPluralizePlugin processes select through t()", () => {
    const i18n = createI18n<Messages>({
      locale: "en",
      messages: { en: { greeting: "{gender, select, male {Sir} female {Madam} other {Friend}}" } },
    });

    const cleanup = icuPluralizePlugin(i18n);

    expect(i18n.t("greeting" as never, { gender: "male" } as never)).toBe("Sir");
    expect(i18n.t("greeting" as never, { gender: "female" } as never)).toBe("Madam");
    expect(i18n.t("greeting" as never, { gender: "other" } as never)).toBe("Friend");

    cleanup();
  });

  it("icuPluralizePlugin processes selectordinal through t()", () => {
    const i18n = createI18n<Messages>({
      locale: "en",
      messages: { en: { place: "{count, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}" } },
    });

    const cleanup = icuPluralizePlugin(i18n);

    expect(i18n.t("place" as never, { count: 1 } as never)).toBe("1st");
    expect(i18n.t("place" as never, { count: 2 } as never)).toBe("2nd");

    cleanup();
  });

  it("falls back gracefully on parse error", () => {
    expect(icuFormat("invalid {template", {}, "en")).toBe("invalid {template");
  });
});
