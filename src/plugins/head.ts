import { watch } from "@elurjs/core";
import type { I18nInstance, Messages } from "../core/types";

export type HeadOptions = {
  lang?: boolean;
  dir?: "ltr" | "rtl" | "auto";
  meta?: Array<{ name: string; content?: string | ((locale: string) => string) }>;
};

const DATA_ATTR = "data-elur-i18n-head";

export function headPlugin<TMessages extends Messages>(
  i18n: I18nInstance<TMessages>,
  options: HeadOptions = {},
): () => void {
  const { lang = true, dir, meta = [] } = options;

  function update(locale: string) {
    if (typeof document === "undefined") return;

    if (lang) {
      document.documentElement.lang = locale;
    }
    if (dir) {
      document.documentElement.dir = dir === "auto" ? getDir(locale) : dir;
    }

    const previous = document.querySelectorAll(`meta[${DATA_ATTR}]`);
    previous.forEach((el) => el.remove());

    for (const item of meta) {
      const content = typeof item.content === "function" ? item.content(locale) : item.content;
      setMeta(item.name, content);
    }
  }

  function setMeta(name: string, content: string | undefined) {
    if (content === undefined) return;
    const element = document.createElement("meta");
    element.name = name;
    element.content = content;
    element.setAttribute(DATA_ATTR, "true");
    document.head.appendChild(element);
  }

  update(i18n.locale.value);
  const unwatch = watch(i18n.locale, update);

  return () => {
    unwatch();
    if (typeof document !== "undefined") {
      const injected = document.querySelectorAll(`meta[${DATA_ATTR}]`);
      injected.forEach((el) => el.remove());
    }
  };
}

function getDir(locale: string): string {
  const rtl = new Set(["ar", "he", "fa", "ur"]);
  return rtl.has(locale.split("-")[0]) ? "rtl" : "ltr";
}
