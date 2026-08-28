import { describe, it, expect, vi } from "vitest";
import { createI18n } from "../core/createI18n";
import { devOverlayPlugin } from "../plugins/devOverlay";
import type { Messages } from "../core/types";

describe("devOverlayPlugin", () => {
  it("logs missing keys", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const i18n = createI18n<Messages>({
      locale: "es",
      messages: { es: { hello: "Hola" } },
    });

    devOverlayPlugin(i18n, { log: true });
    i18n.t("missingKey");

    expect(warn).toHaveBeenCalledWith("[elur-i18n] Missing key: missingKey");
    warn.mockRestore();
  });

  it("does not log when key is found", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const i18n = createI18n<Messages>({
      locale: "es",
      messages: { es: { hello: "Hola" } },
    });

    devOverlayPlugin(i18n, { log: true });
    i18n.t("hello");

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns a cleanup function", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: { es: { hello: "Hola" } },
    });

    const cleanup = devOverlayPlugin(i18n);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });
});
