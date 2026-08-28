# @elurjs/i18n

Internationalization library for [Elur](https://elur.dev) built on signals and stores.

## Features

- Reactive translations powered by Elur signals.
- Zero runtime dependencies (uses native `Intl` API).
- Small bundle size (~4-5 KB typical).
- Type-safe keys and interpolation parameters.
- Multiple backends: inline objects, JSON files, API.
- Lazy-loaded namespaces with error-safe caching (retries on failure).
- Pluralization, contexts, and namespaces.
- Full ICU MessageFormat support: `plural`, `select`, `selectordinal`, nested messages.
- Date, number, currency, relative time, and list formatting.
- Composable plugin pipeline (no more mutation conflicts).
- Optional plugins for persistence, locale detection (URL, path, navigator, storage), router integration, form validation, head tags (with orphan cleanup), cross-tab sync, ICU MessageFormat, and dev overlay for missing keys.
- Optional `provide/inject` support for sub-trees and tenants.
- CLI with AST-based key extraction (Babel parser) for reliable TypeScript/JSX support.

## Installation

```bash
npm install @elurjs/i18n
```

Peer dependency:

```bash
npm install @elurjs/core
```

## Quick start

```ts
import { createI18n } from "@elurjs/i18n";
import { html } from "@elurjs/core";

const i18n = createI18n({
  locale: "es",
  fallbackLocale: "en",
  messages: {
    es: { hello: "Hola {name}" },
    en: { hello: "Hello {name}" },
  },
});

function App() {
  return html`
    <h1>${i18n.t("hello", { name: "Deiver" })}</h1>
    <button @click=${() => i18n.setLocale("en")}>English</button>
  `;
}
```

## Pluralization

Use the pipe syntax for plural forms:

```json
{
  "items": "No items | One item | {count} items"
}
```

```ts
i18n.t("items", { count: 5 }); // "5 items"
```

## Nested fallback

```ts
const i18n = createI18n({
  locale: "es",
  nestedFallback: true,
  messages: {
    es: {
      auth: { login: "Acceder" },
    },
  },
});

i18n.t("auth.login.title"); // "Acceder" fallback desde "auth.login"
```

## Namespaces

```ts
const auth = i18n.useNamespace("auth");
auth.t("login.title"); // resolves "auth:login.title"
```

Or use the key directly:

```ts
i18n.t("auth:login.title");
```

## Backends

### JSON backend

```ts
import { jsonBackend } from "@elurjs/i18n/backends/json";

const i18n = createI18n({
  locale: "es",
  backend: jsonBackend({
    baseUrl: "/locales",
    namespaces: ["common", "auth"],
    cacheTtl: 60000, // optional: re-fetch after 60s (default: cache forever)
  }),
});
```

Loads `/locales/es/common.json`, `/locales/en/common.json`, etc.

**Error handling (v1.3):** Failed requests (network errors, HTTP 4xx/5xx) are **not cached**. Subsequent calls to `load()` will retry automatically. Successful results are cached for single-flight deduplication.

### API backend

```ts
import { apiBackend } from "@elurjs/i18n/backends/api";

const i18n = createI18n({
  locale: "es",
  backend: apiBackend({
    url: "/api/translations",
    headers: { Authorization: "Bearer ..." },
    cacheTtl: 30000, // optional: re-fetch after 30s
  }),
});
```

**Error handling (v1.3):** Same retry behavior as `jsonBackend` — errors are not cached, allowing automatic retries.

## Formatters

All formatters use the `Intl` API and react to locale changes.

```ts
i18n.d(new Date(), { dateStyle: "long" });
i18n.nFormat(1234.5, { maximumFractionDigits: 2 });
i18n.c(99.9, "USD");
i18n.rt(-1, "day");
i18n.list(["a", "b", "c"], { type: "conjunction" });
```

## Plugins

### Persist locale

```ts
import { persistLocalePlugin } from "@elurjs/i18n/plugins/persist";

persistLocalePlugin(i18n, { key: "app-locale" });
```

### Detect locale

```ts
import { detectLocalePlugin } from "@elurjs/i18n/plugins/detect";

// Returns { reDetect } — call reDetect() to re-run detection after URL/storage changes.
const { reDetect } = detectLocalePlugin(i18n, {
  order: ["localStorage", "navigator", "fallback"],
});

// Or use via createI18n options — exposes i18n.reDetect():
const i18n = createI18n({
  locale: "en",
  detect: { order: ["url", "navigator", "fallback"] },
});

// Later, after URL changes:
i18n.reDetect?.();
```

### Router integration

```ts
import { routerLocalePlugin } from "@elurjs/i18n/plugins/router";

routerLocalePlugin(i18n, router, { mode: "query" });
```

### Head tags

```ts
import { headPlugin } from "@elurjs/i18n/plugins/head";

const cleanup = headPlugin(i18n, {
  lang: true,
  dir: "auto",
  meta: [{ name: "description", content: (locale) => descriptions[locale] }],
});

// Call cleanup() to remove all injected meta tags
```

**v1.3:** Meta tags injected by the plugin are marked with `data-elur-i18n-head` and automatically removed on locale change (no more orphan tags from previous locales) and on cleanup.

### Cross-tab sync

```ts
import { syncLocalePlugin } from "@elurjs/i18n/plugins/sync";

syncLocalePlugin(i18n);
```

### Form validation

```ts
import { formValidationPlugin } from "@elurjs/i18n/plugins/forms";

const validators = formValidationPlugin(i18n, {
  required: () => (value) => value ? undefined : "required",
  minLength: (n) => (value) => String(value).length < n ? "minLength" : undefined,
}, { keyPrefix: "errors" });
```

### ICU MessageFormat

```ts
import { icuPluralizePlugin } from "@elurjs/i18n/plugins/icuPluralize";

icuPluralizePlugin(i18n);

// Plural
const messages = {
  en: { items: "{count, plural, one {# item} other {# items}}" },
};
i18n.t("items", { count: 5 }); // "5 items"

// Select (gender)
{
  greeting: "{gender, select, male {Sir} female {Madam} other {Friend}}",
}
i18n.t("greeting", { gender: "male" }); // "Sir"

// Selectordinal
{
  place: "{count, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}",
}
i18n.t("place", { count: 1 }); // "1st"

// Nested
{
  items: "{gender, select, male {{count, plural, one {He has # item} other {He has # items}}} other {{count, plural, one {They have # item} other {They have # items}}}}",
}

// Exact match (=N)
{
  items: "{count, plural, =0 {no items} one {# item} other {# items}}",
}
i18n.t("items", { count: 0 }); // "no items"
```

**v1.3:** Full ICU MessageFormat support via a lightweight built-in parser. Supports `plural`, `select`, `selectordinal`, nested messages, `=N` exact match, and `{{` escaped braces. No external ICU library required.

### Dev overlay

```ts
import { devOverlayPlugin } from "@elurjs/i18n/plugins/devOverlay";

devOverlayPlugin(i18n, { log: true, overlay: true });
```

### Translate middleware pipeline (v1.3)

Plugins like `devOverlayPlugin` and `icuPluralizePlugin` now use a composable middleware pipeline instead of mutating `i18n.t` directly. This means multiple plugins compose correctly and cleanup works in any order.

You can also add your own middleware:

```ts
// Custom middleware — e.g. logging all translations
const cleanup = i18n.useTranslateMiddleware?.((next) => (key, params, opts) => {
  console.log(`[i18n] translating: ${key}`);
  return next(key, params, opts);
});

// Remove when done
cleanup();
```

## CLI

Extract translation keys from source files using AST parsing (Babel parser):

```bash
npx elur-i18n-extract src --output extracted-keys.json
```

**v1.3:** The extractor now uses `@babel/parser` instead of regex, providing reliable extraction in TypeScript/JSX/TSX code. It correctly handles:
- String literals: `t("key")`, `t('key')`
- Template literals: `` t(`key`) ``
- Member expressions: `i18n.t("key")`, `this.t("key")`
- Skips dynamic keys: `t(variable)` (not statically extractable)
- Skips comments: `// t("not_a_key")`
- Falls back to regex for Vue/Svelte templates

Generate a JSON translation file with empty values for multiple locales:

```bash
npx elur-i18n-generate src --locales es,en --output translations.json
```

## TypeScript

```ts
const i18n = createI18n({
  locale: "es",
  messages: {
    es: { hello: "Hola {name}" },
  },
});

i18n.t("hello", { name: "Deiver" }); // OK
i18n.t("helo"); // Type error
i18n.t("hello"); // Type error: missing `name`
```

## License

MIT
