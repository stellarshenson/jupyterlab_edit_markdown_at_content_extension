/**
 * Pure, DOM-free source<->rendered-block mapping for Markdown.
 *
 * The Markdown Preview renders with `marked` and emits no source-line
 * attributes, so we re-lex the source ourselves and correlate rendered
 * top-level blocks to source lines by ORDINAL INDEX: the nth rendered
 * top-level child corresponds to the nth non-space/def/comment block token.
 *
 * The line accumulator replicates JupyterLab core's `getHeadingTokens`
 * walk (`@jupyterlab/markedparser-extension`): `currentLine` is a cumulative
 * newline count advanced by EVERY top-level token, recorded BEFORE advancing.
 *
 * This module imports only `marked` - no `@jupyterlab` / `@lumino` / DOM - so
 * it is unit-testable offline with Jest.
 */
import { marked } from 'marked';

/** One rendered top-level block, ordinal-aligned to the rendered host's children. */
export interface IBlockDescriptor {
  /** Index into the DOM-correlated block list == rendered host child index. */
  ordinal: number;
  /** 0-based first source line of the block. */
  startLine: number;
  /** 0-based last source line of the block (inclusive of trailing blanks). */
  endLine: number;
  /** marked token type (heading, paragraph, code, list, table, ...). */
  type: string;
  /** Present only for heading tokens: createHeaderId form of the heading text. */
  headingSlug?: string;
}

export interface IBlockMap {
  /** Rendered (non-space/def/comment) tokens, in DOM order. */
  blocks: IBlockDescriptor[];
  /** Heading blocks, for the nearest-preceding-heading fallback. */
  headings: { line: number; slug: string; ordinal: number }[];
}

/** marked token types that are NOT rendered as a top-level DOM child. */
const NON_DOM_TYPES = new Set(['space', 'def']);

/** True for an html token that renders nothing (HTML comment only). */
function isCommentOnlyHtml(token: { type: string; raw?: string }): boolean {
  if (token.type !== 'html') {
    return false;
  }
  const raw = (token.raw ?? '').trim();
  return /^<!--[\s\S]*-->$/.test(raw);
}

/** Reproduce rendermime `createHeaderId`: spaces -> hyphens on the plain text. */
export function headingSlug(headingText: string): string {
  return plainText(headingText).replace(/ /g, '-');
}

/** Best-effort strip of inline markdown so a heading token's text matches the
 *  rendered element's textContent (used only for the heading fallback). */
function plainText(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> label
    .replace(/[*_~`]/g, '') // emphasis / code markers
    .trim();
}

/**
 * Core's own front-matter regex, copied verbatim from MarkdownViewer's
 * `Private.removeFrontMatter`. The viewer renders with `hideFrontMatter: true`
 * by default, so it strips this before rendering while we lex the raw model -
 * mirroring the regex is what keeps our block count equal to the rendered
 * child count. Any divergence here silently misaligns every ordinal.
 */
const FRONT_MATTER = /^---\n[^]*?\n(---|...)\n/;

/** Last `buildBlockMap` result, keyed by source identity (the function is pure). */
let cachedSource: string | null = null;
let cachedMap: IBlockMap | null = null;

/**
 * Re-lex `source` and build the ordinal<->line map.
 *
 * Uses `marked.lexer(source, { gfm: true })` to match core's parser config.
 * The line walk includes EVERY top-level token (space/def advance the
 * counter); the DOM-aligned block list excludes space, def and comment-only
 * html tokens. YAML front matter is stripped first, matching the viewer, and
 * the lines it occupied are added back so every `startLine` still points into
 * the ORIGINAL source the editor holds.
 *
 * Memoized on the source string: scroll sync calls this on every event with
 * an unchanged document, and a full lex is milliseconds on a large file. The
 * returned map is shared by identity - callers must treat it as read-only.
 */
export function buildBlockMap(source: string): IBlockMap {
  if (cachedSource === source && cachedMap !== null) {
    return cachedMap;
  }

  const frontMatter = source.match(FRONT_MATTER);
  const body = frontMatter ? source.slice(frontMatter[0].length) : source;
  const lineOffset = frontMatter ? frontMatter[0].split('\n').length - 1 : 0;

  const tokens = marked.lexer(body, { gfm: true }) as Array<{
    type: string;
    raw: string;
    text?: string;
    depth?: number;
  }>;

  const blocks: IBlockDescriptor[] = [];
  const headings: { line: number; slug: string; ordinal: number }[] = [];

  let currentLine = lineOffset;
  for (const token of tokens) {
    const startLine = currentLine;
    const spanned = token.raw.split('\n').length - 1;
    currentLine += spanned;

    if (NON_DOM_TYPES.has(token.type) || isCommentOnlyHtml(token)) {
      continue;
    }

    const ordinal = blocks.length;
    const descriptor: IBlockDescriptor = {
      ordinal,
      startLine,
      endLine: startLine + Math.max(spanned - 1, 0),
      type: token.type
    };

    if (token.type === 'heading') {
      descriptor.headingSlug = headingSlug(token.text ?? '');
      headings.push({
        line: startLine,
        slug: descriptor.headingSlug,
        ordinal
      });
    }

    blocks.push(descriptor);
  }

  const map: IBlockMap = { blocks, headings };
  cachedSource = source;
  cachedMap = map;
  return map;
}

/**
 * Preview -> Editor. Returns the 0-based start line for the block at DOM
 * ordinal `ordinal`, or -1 when the ordinal is out of range.
 *
 * A block with no text still has a source line: an `<hr>` came from a real
 * `---`, and an empty fence from a real ``` pair. Only an ordinal outside the
 * block list is a failure, so -1 means exactly one thing (ACC-PTOE-6).
 */
export function blockToLine(source: string, ordinal: number): number {
  const { blocks } = buildBlockMap(source);
  if (ordinal < 0 || ordinal >= blocks.length) {
    return -1;
  }
  return blocks[ordinal].startLine;
}

/**
 * Editor -> Preview. Returns the DOM ordinal of the block containing `line`
 * (the last block whose startLine <= line), plus the nearest-preceding
 * heading slug and its 1-based occurrence index for the fallback.
 * `ordinal` is -1 when no block precedes the line.
 */
export function lineToBlock(
  source: string,
  line: number
): { ordinal: number; headingSlug?: string; headingNth?: number } {
  const { blocks } = buildBlockMap(source);

  let ordinal = -1;
  for (const block of blocks) {
    if (block.startLine <= line) {
      ordinal = block.ordinal;
    } else {
      break;
    }
  }

  // Nearest preceding heading + its occurrence index among same-slug headings.
  let headingSlugValue: string | undefined;
  let headingNth: number | undefined;
  const slugCounts = new Map<string, number>();
  for (const block of blocks) {
    if (block.type !== 'heading' || block.headingSlug === undefined) {
      continue;
    }
    const nth = (slugCounts.get(block.headingSlug) ?? 0) + 1;
    slugCounts.set(block.headingSlug, nth);
    if (block.startLine <= line) {
      headingSlugValue = block.headingSlug;
      headingNth = nth;
    } else {
      break;
    }
  }

  return { ordinal, headingSlug: headingSlugValue, headingNth };
}
