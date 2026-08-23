import type { I18nBackend, Messages } from "../core/types";

export type JsonBackendOptions = {
  baseUrl: string;
  namespaces?: string[];
  /**
   * Time-to-live in ms for successful cache entries. Set to 0 for infinite.
   * @default 0 (cached forever on success)
   */
  cacheTtl?: number;
};

export function jsonBackend<TMessages extends Messages>(
  options: JsonBackendOptions,
): I18nBackend<TMessages> {
  const { baseUrl, cacheTtl = 0 } = options;
  const cache = new Map<string, { promise: Promise<Partial<TMessages>>; expiresAt: number }>();

  return {
    supportsNamespaces: true,
    load(locale: string, namespace: string): Promise<Partial<TMessages>> {
      const cacheKey = `${locale}:${namespace}`;
      const cached = cache.get(cacheKey);

      if (cached && (cacheTtl === 0 || Date.now() < cached.expiresAt)) {
        return cached.promise;
      }

      const url = `${baseUrl.replace(/\/$/, "")}/${locale}/${namespace}.json`;
      const promise = fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`[nix-i18n] Failed to load ${url}: ${res.status}`);
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
          // Don't cache errors — remove entry so retries can happen.
          cache.delete(cacheKey);
          console.error(`[nix-i18n] Error loading namespace "${namespace}" for locale "${locale}":`, err);
          return {} as Partial<TMessages>;
        });

      // Store in-flight promise for single-flight deduplication.
      cache.set(cacheKey, {
        promise,
        expiresAt: cacheTtl > 0 ? Date.now() + cacheTtl : Infinity,
      });

      return promise;
    },
  };
}
