import type { Signal, Store } from "@deijose/nix-js";

export type Primitive = string | number | boolean | null | undefined;

export type MessageValue = string | { [key: string]: MessageValue };

export type Messages = Record<string, MessageValue>;

export type InterpolationValue = Primitive | Signal<Primitive> | (() => Primitive);

export type InterpolationMap = Record<string, InterpolationValue>;

export type I18nBackend<TMessages extends Messages = Messages> = {
  load(locale: string, namespace: string): Promise<Partial<TMessages>> | Partial<TMessages>;
  supportsNamespaces?: boolean;
};

export type I18nOptions<TMessages extends Messages = Messages> = {
  locale: string;
  fallbackLocale?: string;
  messages?: Record<string, NoInfer<Partial<TMessages>>>;
  backend?: I18nBackend<TMessages>;
  namespaces?: string[];
  persist?: boolean | PersistOptions;
  detect?: boolean | DetectOptions;
  nestedFallback?: boolean;
};

export type PersistOptions = {
  key?: string;
  storage?: Storage;
};

export type DetectOptions = {
  order?: Array<"localStorage" | "sessionStorage" | "navigator" | "url" | "path" | "fallback">;
  storageKey?: string;
  urlParam?: string;
  pathPrefix?: boolean | string;
};

export type I18nStoreState<TMessages extends Messages = Messages> = {
  locale: string;
  messages: Record<string, Partial<TMessages>>;
  loadedNamespaces: string[];
  isLoading: boolean;
};

export type I18nStore<TMessages extends Messages = Messages> = Store<
  I18nStoreState<TMessages>,
  {
    setLocale(locale: string): void;
    setMessages(locale: string, messages: Partial<TMessages>): void;
    loadNamespace(namespace: string): Promise<void>;
  },
  {
    currentMessages: Signal<Partial<TMessages>>;
    fallbackMessages: Signal<Partial<TMessages>>;
  }
>;

export type I18nInstance<TMessages extends Messages = Messages> = I18nStore<TMessages> & {
  readonly fallbackLocale: string;
  readonly nestedFallback: boolean;
  t: TranslateFn<TMessages>;
  n: PluralFn<TMessages>;
  d: DateFormatterFn;
  nFormat: NumberFormatterFn;
  c: CurrencyFormatterFn;
  rt: RelativeTimeFormatterFn;
  list: ListFormatterFn;
  useNamespace: (namespace: string) => NamespaceApi<TMessages>;
  /**
   * Registers a translate middleware that wraps the base `t` function.
   * Middleware are composed in registration order and cleaned up in LIFO order.
   * Returns a cleanup function that removes the middleware.
   */
  useTranslateMiddleware?: (middleware: TranslateMiddleware) => () => void;
};

/**
 * A translate middleware wraps the base translate function.
 * It receives the next function in the chain and returns a new translate function.
 */
export type TranslateMiddleware = (
  next: (key: string, params?: InterpolationMap, options?: { context?: string }) => string,
) => (key: string, params?: InterpolationMap, options?: { context?: string }) => string;

export type TranslateFn<TMessages extends Messages = MessageSchema> = <
  K extends MessagePath<TMessages>,
>(
  key: K,
  params?: InterpolationParamsForPath<TMessages, K>,
  options?: { context?: string },
) => string;

export type PluralFn<TMessages extends Messages = MessageSchema> = <
  K extends MessagePath<TMessages>,
>(
  count: number,
  key: K,
  params?: InterpolationParamsForPath<TMessages, K>,
) => string;

export type NamespaceApi<TMessages extends Messages = MessageSchema> = {
  t: <K extends MessagePath<TMessages>>(
    key: K,
    params?: InterpolationParamsForPath<TMessages, K>,
    options?: { context?: string },
  ) => string;
  n: <K extends MessagePath<TMessages>>(
    count: number,
    key: K,
    params?: InterpolationParamsForPath<TMessages, K>,
  ) => string;
};

export type DateFormatterFn = (
  value: Date | number,
  options?: Intl.DateTimeFormatOptions,
) => string;

export type NumberFormatterFn = (
  value: number,
  options?: Intl.NumberFormatOptions,
) => string;

export type CurrencyFormatterFn = (
  value: number,
  currency: string,
  options?: Omit<Intl.NumberFormatOptions, "style" | "currency">,
) => string;

export type RelativeTimeFormatterFn = (
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options?: Intl.RelativeTimeFormatOptions,
) => string;

export type ListFormatterFn = (
  values: string[],
  options?: Intl.ListFormatOptions,
) => string;

export interface MessageSchema {
  [key: string]: MessageValue;
}

type Counter = [never, 0, 1, 2, 3, 4, 5];

type DeepPaths<T, Depth extends number = 5> = Depth extends never
  ? string
  : T extends string
  ? ""
  : T extends object
  ? {
    [K in keyof T & string]: K | `${K}.${DeepPaths<T[K], Counter[Depth]>}`;
  }[keyof T & string]
  : "";

export type MessagePath<TMessages extends Messages = MessageSchema> =
  DeepPaths<TMessages> | string;

type ExtractInterpolationKeys<S extends string> =
  S extends `${infer _Start}{${infer Key}}${infer Rest}`
  ? Key extends `${infer Param}:${infer _Format}`
  ? Param | ExtractInterpolationKeys<Rest>
  : Key | ExtractInterpolationKeys<Rest>
  : never;

export type InterpolationParams<S extends string> = [ExtractInterpolationKeys<S>] extends [never]
  ? InterpolationMap | undefined
  : { [P in ExtractInterpolationKeys<S>]: InterpolationValue };

type ResolveMessageType<T, K extends string> = K extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
  ? ResolveMessageType<T[Head], Rest>
  : string
  : K extends keyof T
  ? T[K] extends string
  ? T[K]
  : string
  : string;

export type InterpolationParamsForPath<
  TMessages extends Messages,
  K extends MessagePath<TMessages>,
> = K extends string
  ? InterpolationParams<ResolveMessageType<TMessages, K>>
  : InterpolationMap | undefined;

