import type { I18nInstance, Messages, TranslateMiddleware } from "../core/types";

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/**
 * Lightweight ICU MessageFormat parser. Supports plural, select,
 * selectordinal, and nested messages — the most common ICU features,
 * without requiring a full ICU library dependency.
 */
type IcuNode =
  | { type: "text"; value: string }
  | { type: "argument"; name: string }
  | { type: "plural"; name: string; ordinal: boolean; options: Record<string, IcuNode[]> }
  | { type: "select"; name: string; options: Record<string, IcuNode[]> };

export function icuFormat(
  template: string,
  params: Record<string, unknown>,
  locale: string,
): string {
  try {
    const ast = parseIcu(template);
    // If the parser didn't consume the entire template, it's malformed.
    // Return the original template as fallback.
    const result = renderNodes(ast, params, locale);
    return result;
  } catch {
    // If parsing fails, return the template as-is.
    return template;
  }
}

function parseIcu(text: string): IcuNode[] {
  const parser = createIcuParser(text);
  return parser.parseNodes(0);
}

function renderNodes(nodes: IcuNode[], params: Record<string, unknown>, locale: string): string {
  return nodes.map((node) => renderNode(node, params, locale)).join("");
}

function renderNode(node: IcuNode, params: Record<string, unknown>, locale: string): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "argument":
      return String(params[node.name] ?? "");
    case "plural": {
      const count = Number(params[node.name] ?? 0);
      const category = node.ordinal
        ? new Intl.PluralRules(locale, { type: "ordinal" }).select(count) as PluralCategory
        : selectPluralCategory(count, locale, node.options);
      // Try exact match (=N form), then numeric, then category, then other.
      const nodes =
        node.options[`=${count}`] ??
        node.options[String(count)] ??
        node.options[category] ??
        node.options.other;
      if (!nodes) return "";
      const rendered = renderNodes(nodes, params, locale);
      // Replace # with the count value.
      return rendered.replace(/#/g, String(count));
    }
    case "select": {
      const value = String(params[node.name] ?? "");
      const nodes = node.options[value] ?? node.options.other;
      if (!nodes) return "";
      return renderNodes(nodes, params, locale);
    }
  }
}

function selectPluralCategory(
  count: number,
  locale: string,
  options: Record<string, IcuNode[]>,
): PluralCategory {
  const categories = Object.keys(options) as PluralCategory[];
  if (categories.includes("one") && count === 1) return "one";
  if (categories.includes("zero") && count === 0) return "zero";
  if (categories.includes("two") && count === 2) return "two";
  const intlCategory = new Intl.PluralRules(locale).select(count) as PluralCategory;
  if (categories.includes(intlCategory)) return intlCategory;
  return "other";
}

function createIcuParser(text: string) {
  let pos = 0;

  function skipWhitespace(): void {
    while (pos < text.length && /\s/.test(text[pos])) pos++;
  }

  function readIdentifier(): string {
    let id = "";
    while (pos < text.length && /[\w.]/.test(text[pos])) {
      id += text[pos];
      pos++;
    }
    return id;
  }

  function parseNodes(depth: number): IcuNode[] {
    const nodes: IcuNode[] = [];
    let buf = "";

    while (pos < text.length) {
      const ch = text[pos];

      if (ch === "{" && text[pos + 1] === "{") {
        if (buf) { nodes.push({ type: "text", value: buf }); buf = ""; }
        nodes.push({ type: "text", value: "{" });
        pos += 2;
        continue;
      }

      if (ch === "{") {
        if (buf) { nodes.push({ type: "text", value: buf }); buf = ""; }
        pos++;
        nodes.push(parseArgument(depth));
        continue;
      }

      if (ch === "}" && depth > 0) {
        break;
      }

      buf += ch;
      pos++;
    }

    if (buf) nodes.push({ type: "text", value: buf });
    return nodes;
  }

  function parseArgument(depth: number): IcuNode {
    skipWhitespace();
    const name = readIdentifier();
    skipWhitespace();

    if (text[pos] === ",") {
      pos++;
      skipWhitespace();
    }

    if (text[pos] === "}") {
      pos++;
      return { type: "argument", name };
    }

    const funcName = readIdentifier();
    skipWhitespace();

    if (text[pos] === ",") {
      pos++;
      skipWhitespace();
    }

    if (funcName === "plural" || funcName === "selectordinal") {
      return parsePlural(name, funcName === "selectordinal", depth);
    }

    if (funcName === "select") {
      return parseSelect(name, depth);
    }

    // Unknown function or unclosed argument — throw so icuFormat falls back.
    if (pos >= text.length) {
      throw new Error("[elur-i18n] Unclosed ICU argument");
    }
    while (pos < text.length && text[pos] !== "}") pos++;
    if (text[pos] === "}") pos++;
    return { type: "argument", name };
  }

  function parsePlural(name: string, ordinal: boolean, depth: number): IcuNode {
    const options: Record<string, IcuNode[]> = {};
    skipWhitespace();

    while (pos < text.length && text[pos] !== "}") {
      skipWhitespace();
      let selector = "";
      while (pos < text.length && text[pos] !== "{") {
        selector += text[pos];
        pos++;
      }
      selector = selector.replace(/,\s*$/, "").trim();
      skipWhitespace();

      if (text[pos] === "{") {
        pos++;
        const nodes = parseNodes(depth + 1);
        if (text[pos] === "}") pos++;
        options[selector] = nodes;
      }

      skipWhitespace();
    }

    if (text[pos] === "}") pos++;
    return { type: "plural", name, ordinal, options };
  }

  function parseSelect(name: string, depth: number): IcuNode {
    const options: Record<string, IcuNode[]> = {};
    skipWhitespace();

    while (pos < text.length && text[pos] !== "}") {
      skipWhitespace();
      let selector = "";
      while (pos < text.length && text[pos] !== "{") {
        selector += text[pos];
        pos++;
      }
      selector = selector.replace(/,\s*$/, "").trim();
      skipWhitespace();

      if (text[pos] === "{") {
        pos++;
        const nodes = parseNodes(depth + 1);
        if (text[pos] === "}") pos++;
        options[selector] = nodes;
      }

      skipWhitespace();
    }

    if (text[pos] === "}") pos++;
    return { type: "select", name, options };
  }

  return { parseNodes };
}

export function icuPluralize(
  template: string,
  count: number,
  locale: string,
): string {
  return icuFormat(template, { count }, locale);
}

export function icuPluralizePlugin<TMessages extends Messages>(
  i18n: I18nInstance<TMessages>,
  options: { useMiddleware?: boolean } = {},
): () => void {
  const { useMiddleware = true } = options;

  const middleware: TranslateMiddleware = (next) => {
    return (key, params, tOptions) => {
      const result = next(key, params, tOptions);
      if (params && result.includes("{") && /\{\w+,\s*(plural|select|selectordinal)/.test(result)) {
        return icuFormat(result, params as Record<string, unknown>, i18n.locale.value);
      }
      return result;
    };
  };

  if (useMiddleware && i18n.useTranslateMiddleware) {
    return i18n.useTranslateMiddleware(middleware);
  }

  // Legacy mutation pattern (backward compatible).
  const originalT = i18n.t;
  i18n.t = ((key: string, params?: Record<string, unknown>, opts?: { context?: string }) => {
    const result = originalT(key as never, params as never, opts);
    if (params && result.includes("{") && /\{\w+,\s*(plural|select|selectordinal)/.test(result)) {
      return icuFormat(result, params, i18n.locale.value);
    }
    return result;
  }) as I18nInstance<TMessages>["t"];

  return () => {
    i18n.t = originalT;
  };
}
