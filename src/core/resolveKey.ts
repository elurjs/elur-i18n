import type { Messages } from "./types";

export function resolveKey<TMessages extends Messages>(
  messages: Partial<TMessages>,
  key: string,
  nestedFallback = false,
): string | undefined {
  if (!key) return undefined;

  const byPath = resolveByPath(messages, key);
  if (byPath !== undefined) return byPath;

  const exact = resolveExact(messages, key);
  if (exact !== undefined) return exact;

  if (nestedFallback) {
    return resolveNestedFallback(messages, key);
  }

  return undefined;
}

function resolveByPath(messages: unknown, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = messages;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

function resolveExact(messages: unknown, key: string): string | undefined {
  if (messages == null || typeof messages !== "object") return undefined;
  const value = (messages as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function resolveNestedFallback(messages: unknown, key: string): string | undefined {
  const parts = key.split(/[:.]/).filter(Boolean);
  for (let i = 1; i < parts.length; i++) {
    const prefix = parts.slice(0, parts.length - i).join(".");
    const byPath = resolveByPath(messages, prefix);
    if (byPath !== undefined) return byPath;
  }
  for (let i = 1; i < parts.length; i++) {
    const suffix = parts.slice(i).join(".");
    const byPath = resolveByPath(messages, suffix);
    if (byPath !== undefined) return byPath;
  }
  return undefined;
}

export function createResolveKeyCache() {
  let messagesRef: unknown;
  let fallbackRef: unknown;
  const cache = new Map<string, string | undefined>();

  return function cachedResolve<TMessages extends Messages>(
    messages: Partial<TMessages>,
    key: string,
    nestedFallback = false,
    fallback?: Partial<TMessages>,
  ): string | undefined {
    const currentMessages = messages;
    const currentFallback = fallback;

    if (currentMessages !== messagesRef || currentFallback !== fallbackRef) {
      cache.clear();
      messagesRef = currentMessages;
      fallbackRef = currentFallback;
    }

    const cacheKey = nestedFallback + ":" + key;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const result = resolveKey(messages, key, nestedFallback)
      ?? (fallback ? resolveKey(fallback, key, nestedFallback) : undefined);

    cache.set(cacheKey, result);
    return result;
  };
}
