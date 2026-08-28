import type { Validator } from "@elurjs/core";
import type { I18nInstance, InterpolationMap, Messages } from "../core/types";

export type FormValidationPluginOptions = {
  keyPrefix?: string;
  keyMap?: Record<string, string>;
};

export function formValidationPlugin<TMessages extends Messages>(
  i18n: I18nInstance<TMessages>,
  validators: Record<string, (...args: unknown[]) => Validator<unknown>>,
  options: FormValidationPluginOptions = {},
): Record<string, (...args: unknown[]) => Validator<unknown>> {
  const prefix = options.keyPrefix ? `${options.keyPrefix}:` : "";
  const keyMap = options.keyMap ?? {};
  const wrapped: Record<string, (...args: unknown[]) => Validator<unknown>> = {};

  for (const [name, factory] of Object.entries(validators)) {
    wrapped[name] = (...args: unknown[]) => {
      const params = buildParams(name, args);
      const validator = factory(...args);
      const key = `${prefix}${keyMap[name] ?? name}`;
      return (value: unknown) => {
        const result = validator(value);
        if (result) {
          return i18n.t(key as never, params as never, {});
        }
        return undefined;
      };
    };
  }

  return wrapped;
}

function buildParams(name: string, args: unknown[]): InterpolationMap {
  switch (name) {
    case "minLength":
      return { min: args[0] as number };
    case "maxLength":
      return { max: args[0] as number };
    case "min":
      return { min: args[0] as number };
    case "max":
      return { max: args[0] as number };
    case "pattern":
      return { pattern: String(args[0]) };
    default:
      return {};
  }
}

export function createI18nValidator<TMessages extends Messages>(
  i18n: I18nInstance<TMessages>,
  key: string,
  defaultMessage: string,
): Validator<unknown> {
  return (value: unknown) => {
    const result = i18n.t(key as never, { value } as never, {});
    return result === key ? defaultMessage : result;
  };
}

