import { describe, it, expect } from "vitest";
import { createI18n } from "../core/createI18n";
import { headPlugin } from "../plugins/head";
import type { Messages } from "../core/types";

describe("headPlugin", () => {
  it("updates html lang on locale change", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: { es: { hello: "Hola" }, en: { hello: "Hello" } },
    });

    headPlugin(i18n);
    expect(document.documentElement.lang).toBe("es");

    i18n.setLocale("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("updates meta tags", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: { es: { hello: "Hola" }, en: { hello: "Hello" } },
    });

    headPlugin(i18n, {
      meta: [
        { name: "description", content: (locale) => `Description in ${locale}` },
      ],
    });

    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(meta.content).toBe("Description in es");

    i18n.setLocale("en");
    // Re-query because the plugin removes and recreates meta tags.
    meta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(meta.content).toBe("Description in en");
  });

  it("sets dir to rtl for Arabic", () => {
    const i18n = createI18n<Messages>({
      locale: "ar",
      messages: { ar: { hello: "مرحبا" } },
    });

    headPlugin(i18n, { dir: "auto" });
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("returns a cleanup function", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: { es: { hello: "Hola" } },
    });

    const cleanup = headPlugin(i18n);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });
});
