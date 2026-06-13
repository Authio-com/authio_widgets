/**
 * ICU-lite MessageFormat for `@useauthio/widgets`.
 *
 * The embeddable widgets cannot afford to ship a full MessageFormat
 * library (intl-messageformat + its CLDR pluralisation tables would
 * blow the per-widget ≤10 KB gzipped bundle budget). Instead we parse
 * the small subset of ICU the catalog actually uses —
 *
 *   - simple interpolation:  `{name}`
 *   - `plural`:              `{count, plural, one {# item} other {# items}}`
 *   - `select`:              `{kind, select, sso {SSO} other {SCIM}}`
 *
 * — and delegate the *plural-category* decision to the runtime's own
 * `Intl.PluralRules`, so we get correct CLDR rules for de/fr/es/ja/pt-BR
 * for free with zero bundled data. This keeps the whole formatter under
 * ~1 KB while remaining wire-compatible with the nested-JSON + ICU
 * catalog contract used across Authio's UIs.
 *
 * Anything more exotic (rich-text `<tag>` callbacks, `selectordinal`,
 * `number`/`date` skeletons) is intentionally NOT supported here — the
 * widget surfaces don't use it. Unknown placeholders are left as the
 * raw `{name}` token rather than throwing, so a catalog typo degrades
 * gracefully instead of blanking the UI.
 */

export type FormatValues = Record<string, string | number | boolean | null | undefined>;

/**
 * Format an ICU-lite `pattern` against `values` for `locale`.
 */
export function formatMessage(
  pattern: string,
  values: FormatValues,
  locale: string,
): string {
  if (pattern.indexOf("{") === -1) return pattern;
  const parser = new Parser(pattern, values, locale);
  return parser.parse(false);
}

class Parser {
  private i = 0;
  constructor(
    private readonly src: string,
    private readonly values: FormatValues,
    private readonly locale: string,
    /** Value substituted for `#` inside the current plural branch. */
    private readonly pound: string | null = null,
  ) {}

  /** Parse until end-of-input, or (when `nested`) a top-level `}`. */
  parse(nested: boolean): string {
    let out = "";
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (ch === "}" && nested) break;
      if (ch === "{") {
        out += this.parseArgument();
      } else if (ch === "#" && this.pound !== null) {
        out += this.pound;
        this.i++;
      } else {
        out += ch;
        this.i++;
      }
    }
    return out;
  }

  /** `this.i` points at `{`. Consumes through the matching `}`. */
  private parseArgument(): string {
    this.i++; // consume "{"
    const name = this.readUntil([",", "}"]).trim();
    if (this.src[this.i] === "}") {
      this.i++; // consume "}"
      return interpolate(this.values[name]);
    }
    this.i++; // consume ","
    const type = this.readUntil([","]).trim();
    this.i++; // consume ","
    if (type === "plural") {
      return this.parsePluralOrSelect(name, true);
    }
    if (type === "select") {
      return this.parsePluralOrSelect(name, false);
    }
    // Unknown argument type — skip to the closing brace and emit nothing.
    this.skipToClose();
    return "";
  }

  private parsePluralOrSelect(name: string, plural: boolean): string {
    const raw = this.values[name];
    const branches = new Map<string, { start: number; end: number }>();
    // Read `<key> { ... }` pairs until the closing `}` of the argument.
    while (this.i < this.src.length && this.src[this.i] !== "}") {
      this.skipSpaces();
      if (this.src[this.i] === "}") break;
      const key = this.readUntil(["{"]).trim();
      // `this.i` now at "{" of the branch body.
      const start = this.i + 1;
      const end = this.findMatchingBrace(this.i);
      branches.set(key, { start, end });
      this.i = end + 1; // move past this branch's "}"
    }
    this.i++; // consume the argument's closing "}"

    const chosenKey = plural
      ? selectPluralKey(raw, this.locale, branches)
      : selectExactKey(raw, branches);
    const branch = branches.get(chosenKey) ?? branches.get("other");
    if (!branch) return "";
    const body = this.src.slice(branch.start, branch.end);
    const pound = plural ? interpolate(raw) : null;
    return new Parser(body, this.values, this.locale, pound).parse(false);
  }

  private readUntil(stops: string[]): string {
    let out = "";
    while (this.i < this.src.length && !stops.includes(this.src[this.i]!)) {
      out += this.src[this.i];
      this.i++;
    }
    return out;
  }

  private skipSpaces(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i]!)) this.i++;
  }

  /** Given an index at `{`, return the index of the matching `}`. */
  private findMatchingBrace(open: number): number {
    let depth = 0;
    let j = open;
    while (j < this.src.length) {
      const c = this.src[j];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return j;
      }
      j++;
    }
    return this.src.length - 1;
  }

  private skipToClose(): void {
    let depth = 1;
    while (this.i < this.src.length && depth > 0) {
      const c = this.src[this.i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      this.i++;
    }
  }
}

function interpolate(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function selectExactKey(
  raw: unknown,
  branches: Map<string, unknown>,
): string {
  const key = interpolate(raw);
  return branches.has(key) ? key : "other";
}

function selectPluralKey(
  raw: unknown,
  locale: string,
  branches: Map<string, unknown>,
): string {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(n)) return "other";
  // Exact `=N` matches win over CLDR categories (ICU semantics).
  const exact = `=${n}`;
  if (branches.has(exact)) return exact;
  try {
    return new Intl.PluralRules(locale).select(n);
  } catch {
    return new Intl.PluralRules("en").select(n);
  }
}
