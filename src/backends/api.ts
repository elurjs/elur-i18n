import type { I18nBackend, Messages } from "../core/types";

export type ApiBackendOptions = {
  url: string;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: (locale: string, namespace: string) => unknown;
  /**
   * Time-to-live in ms for successful cache entries. Set to 0 for infinite.
   * @default 0 (cached forever on success)
   */
  cacheTtl?: number;
};

export function apiBackend<TMessages extends Messages>(
  options: ApiBackendOptions,
): I18nBackend<TMessages> {
  const cacheTtl = options.cacheTtl ?? 0;
  const cache = new Map<string, { promise: Promise<Partial<TMessages>>; expiresAt: number }>();

  return {
    supportsNamespaces: true,
    load(locale: string, namespace: string): Promise<Partial<TMessages>> {
      const cacheKey = `${locale}:${namespace}`;
      const cached = cache.get(cacheKey);

      if (cached && (cacheTtl === 0 || Date.now() < cached.expiresAt)) {
        return cached.promise;
      }

      const base = typeof location !== "undefined" ? location.origin : "http://localhost";
      const url = new URL(options.url, base);
      url.searchParams.set("locale", locale);
      url.searchParams.set("namespace", namespace);

      const init: RequestInit = {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      };

      if (options.method === "POST" && options.body) {
        init.body = JSON.stringify(options.body(locale, namespace));
      }

      const promise = fetch(url.toString(), init)
        .then((res) => {
          if (!res.ok) throw new Error(`[nix-i18n] API error: ${res.status}`);
          return res.json() as Promise<Partial<TMessages>>;
        })
        .then((data) => {
          // Cache successful results only.
          cache.set(cacheKey, {
            promise: Promise.resolve(data),
            expiresAt: cacheTtl > 0 ? Date.now() + cacheTtl : Infinity,
          });
          return data;
        })
        .catch((err) => {
          // Don't cache errors — remove any stale entry so retries can happen.
          cache.delete(cacheKey);
          console.error(`[nix-i18n] Error loading translations from API:`, err);
          return {} as Partial<TMessages>;
        });

      // Store the in-flight promise for single-flight deduplication.
      // If it fails, the .catch above removes it from cache.
      cache.set(cacheKey, {
        promise,
        expiresAt: cacheTtl > 0 ? Date.now() + cacheTtl : Infinity,
      });

      return promise;
    },
  };
}
