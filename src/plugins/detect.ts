import type { I18nInstance, DetectOptions, Messages } from "../core/types";

export type DetectLocalePluginResult = {
  /** Re-runs locale detection. Useful after URL changes or storage clears. */
  reDetect: () => void;
};

export function detectLocalePlugin<TMessages extends Messages>(
  i18n: I18nInstance<TMessages>,
  options: DetectOptions = {},
): DetectLocalePluginResult {
  const order = options.order ?? ["localStorage", "navigator", "fallback"];
  const storageKey = options.storageKey ?? "nix-i18n-locale";
  const urlParam = options.urlParam ?? "lang";

  function detect() {
    for (const source of order) {
      const detected = detectFrom(source, i18n, storageKey, urlParam, options.pathPrefix);
      if (detected) {
        const normalized = normalizeLocale(i18n, detected);
        if (normalized) {
          i18n.setLocale(normalized);
          return;
        }
      }
    }

    const base = i18n.locale.value.split("-")[0];
    if (base && isLocaleSupported(i18n, base)) {
      i18n.setLocale(base);
    }
  }

  detect();

  return { reDetect: detect };
}

function normalizeLocale<TMessages extends Messages>(
  i18n: I18nInstance<TMessages>,
  locale: string,
): string | null {
  const available = Object.keys(i18n.messages.value);
  if (available.length === 0) return locale;
  if (available.includes(locale)) return locale;
  const base = locale.split("-")[0];
  if (base && available.includes(base)) return base;
  return null;
}

function detectFrom<TMessages extends Messages>(
  source: NonNullable<DetectOptions["order"]>[number],
  i18n: I18nInstance<TMessages>,
  storageKey: string,
  urlParam: string,
  pathPrefix?: boolean | string,
): string | null {
  switch (source) {
    case "localStorage":
      return typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
    case "sessionStorage":
      return typeof sessionStorage !== "undefined" ? sessionStorage.getItem(storageKey) : null;
    case "navigator":
      return typeof globalThis.navigator !== "undefined" ? globalThis.navigator.language : null;
    case "url": {
      if (typeof globalThis.location === "undefined") return null;
      const params = new URLSearchParams(globalThis.location.search);
      return params.get(urlParam);
    }
    case "path": {
      if (typeof globalThis.location === "undefined" || pathPrefix === false) return null;
      const prefix = typeof pathPrefix === "string" ? pathPrefix : "";
      const path = prefix
        ? globalThis.location.pathname.replace(new RegExp(`^/${prefix}/?`), "/")
        : globalThis.location.pathname;
      const parts = path.split("/").filter(Boolean);
      return parts[0] ?? null;
    }
    case "fallback":
      return i18n.fallbackLocale ?? i18n.locale.value;
    default:
      return null;
  }
}

function isLocaleSupported<TMessages extends Messages>(
  i18n: I18nInstance<TMessages>,
  locale: string | undefined,
): boolean {
  if (!locale) return false;
  const available = Object.keys(i18n.messages.value);
  if (available.length === 0) return true;
  if (available.includes(locale)) return true;
  const base = locale.split("-")[0] ?? locale;
  return base !== locale && available.includes(base);
}
