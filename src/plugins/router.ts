import { watch } from "@elurjs/core";
import type { Router } from "@elurjs/core";
import type { I18nInstance, Messages } from "../core/types";

export type RouterLocaleMode = "prefix" | "query" | "subdomain";

export type RouterLocaleOptions = {
  mode?: RouterLocaleMode;
  param?: string;
};

export function routerLocalePlugin<TMessages extends Messages>(
  i18n: I18nInstance<TMessages>,
  router: Router,
  options: RouterLocaleOptions = {},
): void {
  const mode = options.mode ?? "query";
  const param = options.param ?? "lang";

  if (mode === "query") {
    watch(router.query, (query) => {
      const locale = query[param];
      if (locale && typeof locale === "string" && locale !== i18n.locale.value) {
        i18n.setLocale(locale);
      }
    });

    watch(i18n.locale, (locale) => {
      const current = router.query.value[param];
      if (current !== locale) {
        router.replace({ name: "", query: { ...router.query.value, [param]: locale } });
      }
    });
  }

  if (mode === "prefix") {
    watch(router.current, (path) => {
      const match = /^\/([a-z]{2}(?:-[A-Z]{2})?)(?:\/|$)/.exec(path);
      const locale = match?.[1];
      if (locale && locale !== i18n.locale.value) {
        i18n.setLocale(locale);
      }
    });

    watch(i18n.locale, (locale) => {
      const path = router.current.value;
      const currentMatch = /^\/([a-z]{2}(?:-[A-Z]{2})?)(?:\/|$)/.exec(path);
      const currentLocale = currentMatch?.[1];
      if (currentLocale && currentLocale !== locale) {
        const newPath = path.replace(/^\/[a-z]{2}(?:-[A-Z]{2})?\/?/, `/${locale}/`);
        router.replace(newPath);
      }
    });
  }
}
