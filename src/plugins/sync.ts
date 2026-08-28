import { watch } from "@elurjs/core";
import type { I18nInstance, Messages } from "../core/types";

export type SyncLocaleOptions = {
  channelName?: string;
};

export function syncLocalePlugin<TMessages extends Messages>(
  i18n: I18nInstance<TMessages>,
  options: SyncLocaleOptions = {},
): () => void {
  if (typeof BroadcastChannel === "undefined") {
    return () => {};
  }

  const channelName = options.channelName ?? "elur-i18n-locale";
  const channel = new BroadcastChannel(channelName);

  channel.onmessage = (event) => {
    if (event.data?.type === "locale-change" && event.data.locale !== i18n.locale.value) {
      i18n.setLocale(event.data.locale);
    }
  };

  const unwatch = watch(i18n.locale, (locale) => {
    channel.postMessage({ type: "locale-change", locale });
  });

  return () => {
    unwatch();
    channel.close();
  };
}
