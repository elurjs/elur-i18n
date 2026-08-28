import { watch } from "@elurjs/core";
import type { I18nInstance, Messages, PersistOptions } from "../core/types";

export function persistLocalePlugin<TMessages extends Messages>(
  i18n: I18nInstance<TMessages>,
  options: PersistOptions = {},
): void {
  const key = options.key ?? "elur-i18n-locale";
  const storage = options.storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);

  if (!storage) return;

  const saved = storage.getItem(key);
  if (saved && saved !== i18n.locale.value) {
    i18n.setLocale(saved);
  }

  watch(i18n.locale, (next) => {
    storage.setItem(key, next);
  });
}
