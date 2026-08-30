/**
 * @elurjs/i18n/devtools — dev-only entry point.
 *
 * Registers an `i18n` plugin on the elur DevTools backend hook
 * (`window.__ELUR_DEVTOOLS_HOOK__`) exposing the live i18n instances:
 * locale, fallback, loaded namespaces and message key counts. Only loaded
 * when explicitly imported (the Vite plugin injects it in dev mode); never
 * bundled into production apps.
 */
import type { I18nInstance } from "./core/types";

export interface I18nInstanceSnapshot {
    locale: string;
    fallbackLocale: string;
    loadedNamespaces: string[];
    isLoading: boolean;
    locales: string[];
    /** Number of message keys per locale (message contents are not exposed). */
    messageKeyCounts: Record<string, number>;
}

export interface I18nDevtoolsSnapshot {
    instances: I18nInstanceSnapshot[];
}

const _instancesKey = Symbol.for("@elurjs/i18n/instances");

function getInstances(): I18nInstance<any>[] {
    const set = (globalThis as Record<PropertyKey, unknown>)[_instancesKey] as
        | Set<I18nInstance<any>>
        | undefined;
    return set ? Array.from(set) : [];
}

function countKeys(value: unknown): number {
    if (typeof value !== "object" || value === null) return 0;
    let count = 0;
    for (const key of Object.keys(value as Record<string, unknown>)) {
        const child = (value as Record<string, unknown>)[key];
        if (typeof child === "object" && child !== null) count += countKeys(child);
        else count += 1;
    }
    return count;
}

/** Builds a JSON-safe snapshot of all registered i18n instances. */
export function getI18nDevtoolsSnapshot(): I18nDevtoolsSnapshot {
    const instances = getInstances().map((i18n) => {
        const state = i18n.$state;
        const messageKeyCounts: Record<string, number> = {};
        for (const [locale, messages] of Object.entries(state.messages ?? {})) {
            messageKeyCounts[locale] = countKeys(messages);
        }
        return {
            locale: state.locale,
            fallbackLocale: i18n.fallbackLocale,
            loadedNamespaces: [...(state.loadedNamespaces ?? [])],
            isLoading: Boolean(state.isLoading),
            locales: Object.keys(state.messages ?? {}),
            messageKeyCounts,
        };
    });
    return { instances };
}

const descriptor = {
    id: "@elurjs/i18n",
    label: "i18n",
    getSnapshot: getI18nDevtoolsSnapshot,
};

declare global {
    interface Window {
        __ELUR_DEVTOOLS_HOOK__?: {
            version: number;
            registerPlugin(plugin: {
                id: string;
                label?: string;
                getSnapshot?(): unknown;
            }): () => void;
        };
        __ELUR_DEVTOOLS_PENDING_PLUGINS__?: Array<typeof descriptor>;
    }
}

if (typeof window !== "undefined") {
    const hook = window.__ELUR_DEVTOOLS_HOOK__;
    if (hook) hook.registerPlugin(descriptor);
    else (window.__ELUR_DEVTOOLS_PENDING_PLUGINS__ ??= []).push(descriptor);
}
