import { createStore, computed, batch } from "@elurjs/core";
import type { I18nBackend, I18nOptions, I18nStore, Messages } from "./types";

export function createI18nStore<TMessages extends Messages>(
  options: I18nOptions<TMessages>,
  backend?: I18nBackend<TMessages>,
): I18nStore<TMessages> {
  const initialMessages = options.messages ?? {};

  return createStore(
    {
      locale: options.locale,
      messages: initialMessages as Record<string, Partial<TMessages>>,
      loadedNamespaces: [] as string[],
      isLoading: false as boolean,
    },
    {
      name: "elur-i18n",
      actions: (s) => ({
        setLocale(locale: string) {
          s.locale.value = locale;
        },
        setMessages(locale: string, messages: Partial<TMessages>) {
          s.messages.value = {
            ...s.messages.value,
            [locale]: { ...(s.messages.value[locale] ?? {}), ...messages },
          };
        },
        async loadNamespace(namespace: string) {
          if (!backend || !backend.supportsNamespaces) return;
          if (s.loadedNamespaces.value.includes(namespace)) return;

          s.isLoading.value = true;
          try {
            const locale = s.locale.value;
            const data = await Promise.resolve(backend.load(locale, namespace));
            if (data) {
              batch(() => {
                s.messages.value = {
                  ...s.messages.value,
                  [locale]: { ...(s.messages.value[locale] ?? {}), ...data },
                };
                s.loadedNamespaces.value = [...s.loadedNamespaces.value, namespace];
              });
            }
          } finally {
            s.isLoading.value = false;
          }
        },
      }),
      getters: (s) => ({
        currentMessages: computed(() => s.messages.value[s.locale.value] ?? {}),
        fallbackMessages: computed(() =>
          options.fallbackLocale
            ? (s.messages.value[options.fallbackLocale] ?? {})
            : {}
        ),
      }),
    },
  );
}
