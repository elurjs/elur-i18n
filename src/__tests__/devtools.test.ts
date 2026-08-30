import { describe, expect, it } from "vitest";
import { createI18n } from "../index";
import { getI18nDevtoolsSnapshot } from "../devtools";

describe("devtools plugin", () => {
    it("exposes live i18n instances as a JSON-safe snapshot", () => {
        createI18n({
            locale: "es",
            fallbackLocale: "en",
            messages: {
                es: { home: { title: "Hola" }, bye: "Adiós" },
                en: { home: { title: "Hello" } },
            },
        });

        const snapshot = getI18nDevtoolsSnapshot();
        const instance = snapshot.instances.find((i) => i.locale === "es");
        expect(instance).toBeDefined();
        expect(instance?.fallbackLocale).toBe("en");
        expect(instance?.locales.sort()).toEqual(["en", "es"]);
        expect(instance?.messageKeyCounts.es).toBe(2);
        expect(instance?.messageKeyCounts.en).toBe(1);

        expect(() => JSON.stringify(snapshot)).not.toThrow();
    });
});
