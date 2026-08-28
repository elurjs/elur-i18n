import { describe, it, expect } from "vitest";
import type { Validator } from "@elurjs/core";
import { createI18n } from "../core/createI18n";
import { formValidationPlugin, createI18nValidator } from "../plugins/forms";
import type { Messages } from "../core/types";

const required = (message = "Required") => (value: unknown): string | undefined =>
  value == null || value === "" ? message : undefined;

const minLength = (n: number, message = `Minimum ${n} characters`) => (value: unknown): string | undefined =>
  typeof value === "string" && value.length < n ? message : undefined;

const validatorFactories: Record<string, (...args: unknown[]) => Validator<unknown>> = {
  required: (message = "Required") => required(message as string),
  minLength: (n, message = `Minimum ${n} characters`) => minLength(n as number, message as string),
};

describe("formValidationPlugin", () => {
  it("translates validator errors using i18n keys", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: {
        es: {
          required: "Campo obligatorio",
          "auth:required": "El campo es obligatorio",
        },
      },
    });

    const validators = formValidationPlugin(i18n, validatorFactories);
    const validate = validators.required();

    expect(validate("")).toBe("Campo obligatorio");
    expect(validate("hello")).toBeUndefined();
  });

  it("uses key prefix for namespaced messages", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: {
        es: {
          required: "Campo obligatorio",
          "auth:required": "El campo es obligatorio",
        },
      },
    });

    const validators = formValidationPlugin(i18n, validatorFactories, { keyPrefix: "auth" });
    const validate = validators.required();

    expect(validate("")).toBe("El campo es obligatorio");
  });

  it("interpolates parameters for minLength", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: {
        es: {
          minLength: "Mínimo {min} caracteres",
        },
      },
    });

    const validators = formValidationPlugin(i18n, validatorFactories);
    const validate = validators.minLength(5);

    expect(validate("hi")).toBe("Mínimo 5 caracteres");
  });

  it("maps validator names to custom keys", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: {
        es: {
          required: "Campo obligatorio",
          "errors.required": "Este campo es obligatorio",
        },
      },
    });

    const validators = formValidationPlugin(
      i18n,
      validatorFactories,
      { keyMap: { required: "errors.required" } },
    );

    expect(validators.required()("")).toBe("Este campo es obligatorio");
  });
});

describe("createI18nValidator", () => {
  it("returns a translated message or default fallback", () => {
    const i18n = createI18n<Messages>({
      locale: "es",
      messages: {
        es: {
          custom: "Valor inválido: {value}",
        },
      },
    });

    const validator = createI18nValidator(i18n, "custom", "Invalid value");
    expect(validator("bad")).toBe("Valor inválido: bad");
  });
});
