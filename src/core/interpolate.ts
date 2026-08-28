import { Signal } from "@elurjs/core";
import type { InterpolationMap, InterpolationValue } from "./types";

export function readValue(value: InterpolationValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Signal) return String(value.value ?? "");
  if (typeof value === "function") return String(value() ?? "");
  return String(value);
}

export function interpolate(template: string, params: InterpolationMap = {}): string {
  return template.replace(/\{([^{}:]+)(?::[^{}]*)?\}/g, (match, rawKey: string) => {
    const key = rawKey.trim();
    if (key in params) {
      return readValue(params[key]);
    }
    return match;
  });
}

export function collectParams(message: string): string[] {
  const keys = new Set<string>();
  message.replace(/\{([^{}:]+)(?::[^{}]*)?\}/g, (_, rawKey: string) => {
    keys.add(rawKey.trim());
    return "";
  });
  return Array.from(keys);
}
