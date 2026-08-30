# Changelog

## 1.4.0

### Added

- **DevTools plugin entry point** (`@elurjs/i18n/devtools`): dev-only module
  that registers an `i18n` plugin on the elur DevTools backend hook
  (`window.__ELUR_DEVTOOLS_HOOK__`), exposing every live i18n instance
  (locale, fallback locale, loaded namespaces, per-locale message key
  counts). Instances are tracked via a global `Symbol.for` registry
  populated in `createI18n` — negligible cost, no behavior changes. Never
  loaded in production: `@elurjs/vite-plugin-elur` injects it automatically
  in dev mode (`devtools: "auto"`).

## 1.3.0

### Fixed

- **#1 — `apiBackend` no longer caches failed results.** Fetch errors and HTTP errors (e.g. 500, network) are not cached, allowing automatic retry on subsequent calls. Successful results are cached for single-flight deduplication. Optional `cacheTtl` for time-limited caching.
- **#2 — `jsonBackend` no longer caches failed results.** Same fix as `apiBackend`: errors are removed from the cache so retries can happen. Optional `cacheTtl` added.
- **#3 — CLI `nix-i18n-extract` migrated from regex to AST parser (`@babel/parser`).** Now correctly handles template literals (`` t(`key`) ``), skips dynamic keys (`t(variable)`), ignores keys in comments, and supports TypeScript/JSX/TSX syntax. Falls back to regex for Vue/Svelte templates.
- **#4 — Plugin mutation replaced with composition pipeline.** `devOverlayPlugin` and `icuPluralizePlugin` now use `useTranslateMiddleware()` instead of directly reassigning `i18n.t`. Multiple plugins compose correctly with LIFO cleanup. Legacy mutation pattern available via `{ useMiddleware: false }`.
- **#5 — `detectLocalePlugin` now returns `reDetect()`.** Call `reDetect()` to re-run locale detection after URL changes or storage clears. Also exposed on the i18n instance as `i18n.reDetect()` when `detect` option is used.
- **#6 — `stableStringify` replaces `JSON.stringify` in `intlCache`.** Correctly handles `Map` (sorted entries), `Set` (sorted values), `Date` (ISO UTC), and throws on circular references instead of hanging.
- **#7 — `headPlugin` cleans up orphan meta tags.** Injected meta tags are marked with `data-nix-i18n-head` attribute and removed on locale change and on cleanup. No more stale meta tags from previous locales.
- **#8 — ICU MessageFormat full support.** `icuPluralize`/`icuFormat` now supports `select` (gender), `selectordinal`, nested messages, `=N` exact match, and `{{` escaped braces. Lightweight built-in parser — no external ICU library required.

### Added

- `useTranslateMiddleware()` on `I18nInstance` for composable translate pipelines.
- `TranslateMiddleware` type export.
- `stableStringify` export from `format/intlCache`.
- `icuFormat()` export for direct ICU message formatting.
- `cacheTtl` option on `apiBackend` and `jsonBackend`.
- `reDetect()` on `detectLocalePlugin` return value and i18n instance.
- `@babel/parser` dependency for AST-based key extraction.

## 1.2.1

### Performance

- **A** — Cache `Intl` formatters (`NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`, `ListFormat`) by locale + options to avoid expensive re-instantiation on every call.
- **B** — Cache `resolveKey` lookups per messages reference with automatic invalidation when messages or fallback change. Eliminates repeated object traversals for the same keys.
- **C** — Cache `Intl.PluralRules` by locale to avoid creating a new instance on every pluralized translation.

## 1.2.0

### Added

- `nestedFallback` option for `createI18n` to enable fallback chains like `auth.login.title` → `auth.login` → `title`.
- `nix-i18n-generate` CLI to generate JSON translation files with empty values for multiple locales.
- `devOverlayPlugin` to log and optionally display missing translation keys in development.
- Fixed `bin` path format in `package.json` to comply with npm requirements.

## 1.1.0

### Added

- `syncLocalePlugin` to synchronize locale across browser tabs via `BroadcastChannel`.
- `headPlugin` to update `html lang`, `dir`, and meta tags on locale changes.
- `detectLocalePlugin` now supports locale detection from URL path (`/es/about`) and base-locale normalization.
- `formValidationPlugin` improved with key prefix mapping and interpolation parameters for validator arguments.
- `icuPluralizePlugin` and `icuPluralize` utility for ICU plural syntax (`{count, plural, one {...} other {...}}`).
- `nix-i18n-extract` CLI to extract translation keys from source files.
- Type-safe key and interpolation parameter autocompletion via `MessageSchema`.
- Full test coverage for all new plugins and utilities.

## 1.0.0

### Added

- Reactive store-based i18n built on `@deijose/nix-js` signals.
- `createI18n` factory with inline messages and backend support.
- `t("key")` API with interpolation, contexts, and namespaces.
- Pluralization using pipe syntax.
- Formatters: date, number, currency, relative time, list.
- JSON and API backends with lazy namespace loading.
- Plugins: persistence, locale detection, router integration, form validation.
- Optional `provide/inject` support via `useI18n`.
- TypeScript support with autocompletion of keys and interpolation parameters.
- Full test coverage for core, formatters, and backends.
