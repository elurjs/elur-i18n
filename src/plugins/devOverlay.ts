import type { I18nInstance, Messages, TranslateMiddleware } from "../core/types";

export type DevOverlayOptions = {
  log?: boolean;
  overlay?: boolean;
  /**
   * If true, uses the middleware pipeline (v1.3). If false, uses the legacy
   * mutation pattern (backward compatible). @default true
   */
  useMiddleware?: boolean;
};

export function devOverlayPlugin<TMessages extends Messages>(
  i18n: I18nInstance<TMessages>,
  options: DevOverlayOptions = {},
): () => void {
  const { log = true, overlay = false, useMiddleware = true } = options;
  const missing = new Set<string>();

  const middleware: TranslateMiddleware = (next) => {
    return (key, params, tOptions) => {
      const result = next(key, params, tOptions);
      if (result === key) {
        missing.add(key);
        if (log) {
          console.warn(`[nix-i18n] Missing key: ${key}`);
        }
        if (overlay && typeof document !== "undefined") {
          renderOverlay(missing);
        }
      }
      return result;
    };
  };

  // Middleware-based (v1.3 — Fix #4): uses the composition pipeline.
  if (useMiddleware && i18n.useTranslateMiddleware) {
    return i18n.useTranslateMiddleware(middleware);
  }

  // Legacy mutation pattern (backward compatible).
  const originalT = i18n.t;

  i18n.t = ((key: string, params?: Record<string, unknown>, tOptions?: { context?: string }) => {
    const result = originalT(key as never, params as never, tOptions);
    if (result === key) {
      missing.add(key);
      if (log) {
        console.warn(`[nix-i18n] Missing key: ${key}`);
      }
      if (overlay && typeof document !== "undefined") {
        renderOverlay(missing);
      }
    }
    return result;
  }) as I18nInstance<TMessages>["t"];

  return () => {
    i18n.t = originalT;
  };
}

let overlayElement: HTMLDivElement | null = null;

function renderOverlay(missing: Set<string>): void {
  if (!overlayElement) {
    overlayElement = document.createElement("div");
    overlayElement.setAttribute(
      "style",
      "position:fixed;bottom:8px;right:8px;max-width:320px;max-height:200px;overflow:auto;background:rgba(255,0,0,0.9);color:#fff;font-family:monospace;font-size:12px;padding:8px;border-radius:4px;z-index:99999;",
    );
    document.body.appendChild(overlayElement);
  }
  overlayElement.innerHTML = `<strong>Missing keys (${missing.size})</strong><br>${[...missing].join("<br>")}`;
}
