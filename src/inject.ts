import { inject } from "@elurjs/core";
import { I18nInjectionKey } from "./core/createI18n";
import type { I18nInstance, Messages } from "./core/types";

export function useI18n<TMessages extends Messages = Messages>(
  fallback?: I18nInstance<TMessages>,
): I18nInstance<TMessages> | undefined {
  return inject(I18nInjectionKey, fallback) as I18nInstance<TMessages> | undefined;
}
