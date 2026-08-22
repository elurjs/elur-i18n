/**
 * Stable stringify that handles Map, Set, Date, and circular references.
 * (Fix #6 — v1.3)
 *
 * - Date → ISO UTC string (deterministic across timezones)
 * - Map → sorted entries as [["key","value"],...]
 * - Set → sorted values as ["v1","v2",...]
 * - Circular references → throws TypeError
 * - Object keys → sorted alphabetically
 */
export function stableStringify(value: unknown): string {
  const seen = new WeakSet();
  return _stringify(value, seen);
}

function _stringify(value: unknown, seen: WeakSet<object>): string {
  // Primitives.
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return `"${value}"`;
  if (value === undefined) return "null";

  // Date → ISO UTC (deterministic).
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  // Map → sorted entries.
  if (value instanceof Map) {
    if (seen.has(value)) throw new TypeError("[nix-i18n] Circular reference detected in stableStringify");
    seen.add(value);
    const entries = [...value.entries()].sort((a, b) => {
      const sa = stableStringify(a[0]);
      const sb = stableStringify(b[0]);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
    const parts = entries.map(([k, v]) => `[${_stringify(k, seen)},${_stringify(v, seen)}]`);
    return `[${parts.join(",")}]`;
  }

  // Set → sorted values.
  if (value instanceof Set) {
    if (seen.has(value)) throw new TypeError("[nix-i18n] Circular reference detected in stableStringify");
    seen.add(value);
    const values = [...value].sort((a, b) => {
      const sa = stableStringify(a);
      const sb = stableStringify(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
    return `[${values.map((v) => _stringify(v, seen)).join(",")}]`;
  }

  // Arrays.
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError("[nix-i18n] Circular reference detected in stableStringify");
    seen.add(value);
    return `[${value.map((v) => _stringify(v, seen)).join(",")}]`;
  }

  // Objects.
  if (typeof value === "object") {
    if (seen.has(value as object)) {
      throw new TypeError("[nix-i18n] Circular reference detected in stableStringify");
    }
    seen.add(value as object);
    const keys = Object.keys(value).sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${_stringify((value as Record<string, unknown>)[k], seen)}`);
    return `{${parts.join(",")}}`;
  }

  return "null";
}

export function createIntlFormatterCache<
  TOptions extends object,
  TFormatter extends { format: (...args: any[]) => string },
>(
  createFormatter: (locale: string, options?: TOptions) => TFormatter,
): (locale: string, options?: TOptions) => TFormatter {
  const cache = new Map<string, TFormatter>();
  return (locale, options) => {
    const key = locale + ":" + stableStringify(options ?? {});
    let formatter = cache.get(key);
    if (!formatter) {
      formatter = createFormatter(locale, options);
      cache.set(key, formatter);
    }
    return formatter;
  };
}
