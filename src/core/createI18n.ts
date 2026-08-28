import { createInjectionKey } from "@elurjs/core";
import { createI18nStore } from "./createI18nStore";
import { createTranslate, createPlural, createNamespaceApi } from "./translate";
import { createDateFormatter } from "../format/date";
import { createNumberFormatter } from "../format/number";
import { createCurrencyFormatter } from "../format/currency";
import { createRelativeTimeFormatter } from "../format/relativeTime";
import { createListFormatter } from "../format/list";
import { persistLocalePlugin } from "../plugins/persist";
import { detectLocalePlugin } from "../plugins/detect";
import type {
  I18nInstance,
  I18nOptions,
  Messages,
  TranslateMiddleware,
  InterpolationMap,
} from "./types";

export const I18nInjectionKey = createInjectionKey<I18nInstance>("elur-i18n");

export function createI18n<TMessages extends Messages = Messages>(
  options: I18nOptions<TMessages>,
): I18nInstance<TMessages> {
  const backend = options.backend;
  const namespaces = options.namespaces ?? [];

  const store = createI18nStore<TMessages>(options, backend);

  const baseT = createTranslate<TMessages>(store as I18nInstance<TMessages>);
  const n = createPlural(baseT);

  /**
   * Middleware pipeline for translate. Instead of plugins mutating `i18n.t`
   * directly, they register middleware here. The pipeline is rebuilt on each
   * registration/removal, ensuring correct LIFO cleanup order.
   */
  const middlewares: TranslateMiddleware[] = [];

  function rebuildT() {
    let fn = baseT as (key: string, params?: InterpolationMap, options?: { context?: string }) => string;
    // Apply middlewares in reverse order so the first registered runs first.
    for (let i = middlewares.length - 1; i >= 0; i--) {
      fn = middlewares[i](fn);
    }
    i18n.t = fn as I18nInstance<TMessages>["t"];
    i18n.useNamespace = (namespace: string) =>
      createNamespaceApi<TMessages>(i18n.t, n, namespace);
  }

  function useTranslateMiddleware(middleware: TranslateMiddleware): () => void {
    middlewares.push(middleware);
    rebuildT();
    return () => {
      const index = middlewares.indexOf(middleware);
      if (index >= 0) {
        middlewares.splice(index, 1);
        rebuildT();
      }
    };
  }

  const i18n: I18nInstance<TMessages> = Object.assign(store, {
    t: baseT,
    n,
    fallbackLocale: options.fallbackLocale ?? options.locale,
    nestedFallback: options.nestedFallback ?? false,
    d: createDateFormatter(store),
    nFormat: createNumberFormatter(store),
    c: createCurrencyFormatter(store),
    rt: createRelativeTimeFormatter(store),
    list: createListFormatter(store),
    useNamespace: (namespace: string) =>
      createNamespaceApi<TMessages>(baseT, n, namespace),
    useTranslateMiddleware,
  });

  if (options.persist) {
    const persistOptions = typeof options.persist === "object" ? options.persist : {};
    persistLocalePlugin(i18n, persistOptions);
  }

  if (options.detect) {
    const detectOptions = typeof options.detect === "object" ? options.detect : {};
    const result = detectLocalePlugin(i18n, detectOptions);
    (i18n as I18nInstance<TMessages> & { reDetect?: () => void }).reDetect = result.reDetect;
  }

  if (backend && namespaces.length > 0) {
    for (const ns of namespaces) {
      void i18n.loadNamespace(ns);
    }
  }

  return i18n;
}
