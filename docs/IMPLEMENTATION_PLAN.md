# Implementation Plan - Edit Markdown at Content Extension

This plan turns the pure-boilerplate copier scaffold into a frontend-only JupyterLab 4.5.7 extension that jumps bidirectionally between the rendered Markdown Preview and the text Editor while preserving block-level document position. The mapping is computed in-browser via `marked.lexer` block-ordinal correlation with a heading-re-derivation fallback. Everything targets the locally installed JupyterLab 4.5.7; no web fetches except the unavoidable registry resolution for two new singletons during `make install`.

The plan is corrected against three classes of verified defect from review: the context-menu selector over-matches rendered notebook markdown cells (AC #1), the line-accumulation arithmetic and heading-anchor attribute were mis-specified, and three ordinal-drift sources (math pre/post-processing, sanitizer node removal, script-warning node injection) were unenumerated. All are fixed below.

## Task list (dependency-ordered)

1. **De-risking spike** (see "First de-risking spike" below) - prove ordinal correlation in the live app before building anything. Gate: `domBlockList.length === expectedTokenCount` holds on a representative doc AND `host.children[n].scrollIntoView` reveals the right block. The representative doc MUST include headings, paragraphs, fenced code, a list, a GFM table, a `$$`-math block, and an inline `<script>` (untrusted). If the self-check fails on math/script docs, that is expected → confirms the fallback path triggers. If it fails on the plain blocks, escalate before continuing
2. **Strip the server extension** (AREA 4) - delete `routes.py`, `conftest.py`, the `tests/` python dir, `jupyter-config/server-config/`, `src/request.ts`; prune `__init__.py` to keep only `_version` import + `_jupyter_labextension_paths()`
3. **Edit `pyproject.toml`** - remove the server-config shared-data line (line 26) and the `jupyter_server` runtime dependency (line 55); keep the labextension shared-data, hatch jupyter-builder hook, version hooks
4. **Edit `package.json`** - remove `jupyterlab.discovery.server` block; remove `@jupyterlab/services`; add `marked`, `@jupyterlab/markdownviewer`, `@jupyterlab/fileeditor`, `@jupyterlab/docmanager`, `@jupyterlab/codeeditor`, `@jupyterlab/docregistry` (exact versions below). Note: `@jupyterlab/markdownviewer` and `@jupyterlab/fileeditor` are NOT in local `node_modules` and will resolve from the npm registry
5. **`make install`** to resolve the new singletons against 4.5.7 and confirm the prebuilt labextension still builds. Verify resolved versions land on the 4.5.x line: `cat node_modules/@jupyterlab/markdownviewer/package.json | grep '"version"'` and same for `fileeditor`. Confirm their `.d.ts` expose the cited API (`IMarkdownViewerTracker`, `MarkdownDocument`, `IEditorTracker`, `FileEditor`) before writing `index.ts` against them (validates AC #12 early)
6. **Implement `src/mapping.ts`** (AREA 2) - the pure, DOM-free core: token line-walk replicating core's accumulator verbatim, block descriptor list, `buildBlockMap`, `blockToLine`, `lineToBlock`, `headingSlug`. Only imports `marked`. No `@jupyterlab`/`@lumino` imports
7. **Write `src/__tests__/mapping.spec.ts`** (AREA 5 Part A) - fixtures (well-formed, duplicate-adjacent, nested lists, fenced code followed by paragraph, GFM table, math block, unmappable) asserting resolved lines both directions, including an explicit cumulative-newline arithmetic assertion. Run `jlpm test`; iterate on `mapping.ts` until green
8. **Implement `src/index.ts`** (AREAS 1+3) - plugin activation (keep exact console.log), single capture-phase contextmenu listener stashing BOTH the right-clicked preview node and editor node, two commands, two `app.contextMenu.addItem` registrations with tightened selectors, DOM block extraction, `openOrReveal` + cursor/scroll, fallback path
9. **Write `src/__tests__/index.spec.ts`** (AREA 5 Part C) - static-source no-`addFileType` regression test plus assertion that the plugin descriptor does not list `IDocumentRegistry` in `requires`/`optional` (AC #10)
10. **Extend `ui-tests/tests/...spec.ts`** (AREA 5 Part B) - keep the activation test verbatim; add Flow 1 (Preview→Editor), Flow 2 (Editor→Preview), a negative assertion that right-clicking a RENDERED notebook markdown cell shows NO "Edit at this location" item, and a negative assertion on a code editor surface
11. **`make install && jupyter labextension list`** - final verification the extension reports `OK` (AC #12)

Tasks 6 and 7 interleave (TDD). Task 8 depends on 6 (imports the pure core). Tasks 2-4 are independent edits that can land together but must precede task 5.

## File-by-file change map

| Path | Change |
|------|--------|
| `jupyterlab_edit_markdown_at_content_extension/routes.py` | DELETE - only the hello route |
| `jupyterlab_edit_markdown_at_content_extension/__init__.py` | Strip `from .routes import ...`, `_jupyter_server_extension_points()`, `_load_jupyter_server_extension()`. KEEP `_version` import and `_jupyter_labextension_paths()` |
| `jupyter-config/server-config/jupyterlab_edit_markdown_at_content_extension.json` | DELETE; remove parent `jupyter-config/server-config/` dir |
| `conftest.py` | DELETE - only the `jp_server_config` fixture |
| `jupyterlab_edit_markdown_at_content_extension/tests/test_routes.py` | DELETE - hits the removed `/hello` route |
| `jupyterlab_edit_markdown_at_content_extension/tests/__init__.py` | DELETE; remove `tests/` dir (no python tests remain) |
| `src/request.ts` | DELETE - `requestAPI` ServerConnection helper |
| `src/index.ts` | Remove `requestAPI` import + the `requestAPI<any>('hello',...)` block. KEEP exact `console.log('JupyterLab extension jupyterlab_edit_markdown_at_content_extension is activated!')`. Add commands, context-menu items, capture-phase contextmenu listener, DOM block logic, openOrReveal/cursor/scroll |
| `src/mapping.ts` | NEW - pure source-mapping core (no JupyterLab/DOM imports) |
| `src/__tests__/mapping.spec.ts` | NEW - Jest fixtures + resolved-line assertions |
| `src/__tests__/index.spec.ts` | NEW - static-source no-`addFileType` + no-`IDocumentRegistry` regression test |
| `src/__tests__/jupyterlab_edit_markdown_at_content_extension.spec.ts` | DELETE - boilerplate `1+1` placeholder |
| `ui-tests/tests/jupyterlab_edit_markdown_at_content_extension.spec.ts` | EXTEND - keep activation test verbatim; add Flow 1, Flow 2, two negative tests |
| `package.json` | Remove `jupyterlab.discovery.server`; remove `@jupyterlab/services`; add deps (below) |
| `pyproject.toml` | Remove server-config shared-data line (26); remove `jupyter_server` dependency (55) |
| `jest.config.js` | NO CHANGE - `testRegex` already matches new specs |
| `ui-tests/playwright.config.js` | NO CHANGE |

## Source-mapping core - public module breakdown (`src/mapping.ts`)

Pure functions, DOM-free, only imports `marked`. This is the AC #11 hot path and the Jest-testable surface.

The line accumulator MUST replicate core's exact algorithm (`@jupyterlab/markedparser-extension` `getHeadingTokens`): `currentLine` starts at 0; for each top-level token, record `startLine = currentLine` BEFORE advancing, then `currentLine += token.raw.split('\n').length - 1`. This is a cumulative newline count, NOT a +1-per-token increment. `endLine = startLine + (token.raw.split('\n').length - 1)`. The walk includes EVERY top-level token (space/def advance the counter); the DOM-aligned block list excludes `space`, `def`, and comment-only `html` tokens.

```typescript
/** One rendered top-level block, ordinal-aligned to host.children. */
export interface BlockDescriptor {
  ordinal: number;        // index into the DOM-correlated list == host.children index
  startLine: number;      // 0-based first source line of the block
  endLine: number;        // 0-based last source line of the block
  type: string;           // marked token type (heading, paragraph, code, list, table, ...)
  text: string;           // normalized block text, for empty-block guard (AC #5)
  headingSlug?: string;   // present only for heading tokens: createHeaderId form
}

export interface BlockMap {
  blocks: BlockDescriptor[];  // rendered (non-space/def/comment) tokens, in DOM order
  headings: { line: number; slug: string; ordinal: number }[]; // for nearest-preceding fallback
}

/** Re-lex source with explicit options and build the ordinal<->line map.
 *  MUST call marked.lexer(source, { gfm: true }) - matches core's gfm:true config.
 *  Do NOT enable async/walkTokens (block boundaries only). Line walk includes EVERY
 *  top-level token; DOM list excludes space, def, comment-only html. */
export function buildBlockMap(source: string): BlockMap;

/** Preview->Editor. Returns 0-based startLine for the block at DOM ordinal `ordinal`,
 *  or -1 when ordinal is out of range or the block text is empty (caller no-ops + console.warn). */
export function blockToLine(source: string, ordinal: number): number;

/** Editor->Preview. Returns the DOM ordinal whose [startLine,endLine] contains `line`,
 *  plus the nearest-preceding heading slug AND its 1-based occurrence index for the fallback.
 *  ordinal === -1 when no block contains the line. */
export function lineToBlock(
  source: string,
  line: number
): { ordinal: number; headingSlug?: string; headingNth?: number };

/** Reproduce rendermime createHeaderId exactly: text.replace(/ /g, '-'). */
export function headingSlug(headingText: string): string;
```

`blockToLine`/`lineToBlock` accept `source` and rebuild the map internally so tests need only a string and an integer. The command layer may build the map once per trigger and reuse it, but the pure signatures stay source-in/number-out for offline Jest assertions.

## package.json dependency changes

**Remove**:
- `@jupyterlab/services` (only used by `request.ts`)
- the `jupyterlab.discovery.server` metadata block
- `@jupyterlab/coreutils` only if `grep -r 'URLExt\|PathExt' src/` finds no remaining use; otherwise keep

**Add** (pin to the installed 4.5.x line; `marked` to the core-aligned patch):

```
"@jupyterlab/application": "^4.5.0",        // already present - JupyterFrontEnd, commands, contextMenu
"@jupyterlab/markdownviewer": "^4.5.0",     // IMarkdownViewerTracker token, MarkdownDocument (registry fetch)
"@jupyterlab/fileeditor": "^4.5.0",         // IEditorTracker, FileEditor (registry fetch)
"@jupyterlab/docmanager": "^4.5.0",         // IDocumentManager.openOrReveal
"@jupyterlab/codeeditor": "^4.5.0",         // CodeEditor.IPosition, set/reveal/getCursorPosition
"@jupyterlab/docregistry": "^4.5.0",        // IDocumentWidget type
"marked": "^17.0.6"                          // core pins ^17.0.2; installed 17.0.6 - match the installed patch
```

> [!IMPORTANT]
> Verify the installed `marked` version with `cat node_modules/marked/package.json | grep '"version"'` before pinning. Pin the caret to the actually-installed patch (`^17.0.6`) to minimize tokenizer skew between the extension's own bundled `marked` (separate webpack module) and core's parser.

## Commands and context-menu registrations (`src/index.ts`)

Two commands on `app.commands`, two items on `app.contextMenu` scoped by tightened CSS selector. Lumino passes no DOM target into command args, so a single own capture-phase `contextmenu` listener stashes the right-clicked node for BOTH directions.

> [!IMPORTANT]
> The Preview selector MUST be scoped to the MarkdownViewer document, not bare `.jp-RenderedMarkdown` - that class also applies to rendered markdown CELLS inside notebooks and rendered markdown OUTPUTS, which would surface the item on non-preview surfaces and violate AC #1. Confirm the actual MarkdownViewer container class during the spike (`.jp-MarkdownViewer` wraps the preview's rendered host); use `.jp-MarkdownViewer .jp-RenderedMarkdown`.

```typescript
const CMD_EDIT_AT   = 'editmarkdownatcontent:edit-at-location';
const CMD_REVEAL_IN = 'editmarkdownatcontent:reveal-in-preview';

// Preview -> Editor
app.commands.addCommand(CMD_EDIT_AT, {
  label: 'Edit at this location',
  execute: () => { /* use stashed _lastPreviewTarget; resolve owning MarkdownDocument via
                      IMarkdownViewerTracker; ordinal -> blockToLine -> openOrReveal('Editor') */ }
});
app.contextMenu.addItem({
  command: CMD_EDIT_AT,
  selector: '.jp-MarkdownViewer .jp-RenderedMarkdown',   // preview document surface ONLY (AC #1)
  rank: 0
});

// Editor -> Preview
app.commands.addCommand(CMD_REVEAL_IN, {
  label: 'Reveal in Markdown Preview',
  execute: () => { /* resolve owning FileEditor via stashed _lastEditorTarget + IEditorTracker;
                      getCursorPosition -> lineToBlock -> openOrReveal('Markdown Preview') -> scroll */ }
});
app.contextMenu.addItem({
  command: CMD_REVEAL_IN,
  selector: '.jp-FileEditor',         // file editor surface only (AC #6)
  rank: 0
});

// Single capture-phase listener stashing BOTH targets (no DOM target reaches the command)
document.addEventListener('contextmenu', (e) => {
  const t = e.target as Element;
  const prev = t.closest?.('.jp-MarkdownViewer .jp-RenderedMarkdown');
  const edit = t.closest?.('.jp-FileEditor');
  this._lastPreviewTarget = prev ? t : null;
  this._lastEditorTarget  = edit ? t : null;
}, true);
```

Plugin `requires`: `IDocumentManager`, `IEditorTracker`, `IMarkdownViewerTracker`. Factory name strings are exact: `'Editor'` (fileeditor) and `'Markdown Preview'` (markdownviewer).

**Preview→Editor execute flow**: read `_lastPreviewTarget` → resolve owning `MarkdownDocument` by iterating `IMarkdownViewerTracker` and testing `widget.content.node.contains(target)` (NOT `currentWidget` - the right-clicked widget may not be active) → if no widget matches, no-op + console.warn → `host = widget.content.renderer.node` (the `.jp-RenderedMarkdown` node; confirm exact accessor during spike) → walk `target` up until `parentElement === host` to get the top-level block → `ordinal = Array.from(host.children).indexOf(block)` → `source = widget.context.model.toString()` → `blockToLine(source, ordinal)` → if `-1` console.warn + no-op (AC #5) → `docManager.openOrReveal(widget.context.path, 'Editor')` → `await editorWidget.context.ready; await editorWidget.revealed;` → clamp line to `editor.lineCount - 1` → `editor.setCursorPosition({line, column: 0}); editor.revealPosition({line, column: 0});`.

**Editor→Preview execute flow**: read `_lastEditorTarget` → resolve owning `IDocumentWidget<FileEditor>` by iterating `IEditorTracker` and testing `widget.content.node.contains(target)`, falling back to `tracker.currentWidget` only if no node match → `editor = widget.content.editor` → `line = editor.getCursorPosition().line` → `source = widget.context.model.toString()` → `{ ordinal, headingSlug, headingNth } = lineToBlock(source, line)` → `docManager.openOrReveal(widget.context.path, 'Markdown Preview')` → `await previewWidget.context.ready; await previewWidget.revealed;` → `host = previewWidget.content.renderer.node` → build `domBlockList = Array.from(host.children)` (build the same exclusion-aware list as the spike if needed) → if `domBlockList.length === expectedTokenCount && ordinal >= 0`: `host.children[ordinal].scrollIntoView({ block: 'start' })`; else fallback (AC #8): re-derive heading ids in-browser - query `host.querySelectorAll('h1,h2,h3,h4,h5,h6')`, match the `headingNth`-th whose `createHeaderId(textContent)` equals `headingSlug`, and `scrollIntoView`.

> [!IMPORTANT]
> The heading-anchor fallback MUST NOT rely on `#id` alone. With the default (untrusted) sanitizer in the Markdown Preview, rendermime `headerAnchors` sets `data-jupyter-id` rather than `id`, and `marked-gfm-heading-id` may inject its own lowercased/punctuation-stripped `id`. Up to three id schemes can coexist. Re-derive `createHeaderId(textContent) = textContent.replace(/ /g, '-')` from the live `h1`-`h6` elements and select the `headingNth`-th match, rather than trusting any single attribute.

## Ordinal-drift sources and the host-list build

The DOM block list must align 1:1 with the non-space/def/comment marked tokens. Three confirmed sources shift this alignment in the live 4.5.7 render pipeline (`@jupyterlab/rendermime` `renderMarkdown`/`renderHTML`):

- **Math pre/post-processing**: core runs `removeMath()` before parsing and `replaceMath()` after. A re-lex of the RAW source with plain `marked` tokenizes `$$...$$` differently, shifting every later ordinal. Mitigation: the spike MUST include a math fixture; on the resulting length mismatch the self-check routes to the heading fallback. Treat math-bearing docs as fallback-only and note in limitations
- **Sanitizer node removal**: untrusted-content sanitization can remove top-level nodes, shrinking `host.children`
- **Script-warning node injection**: for untrusted markdown containing inline `<script>`, a warning container is prepended at `host.children[0]` (`host.insertBefore(container, firstChild)`), shifting every ordinal by one

The runtime self-check `domBlockList.length === expectedTokenCount` (where `expectedTokenCount` = the non-space/def/comment token count from `buildBlockMap`) catches all three and degrades to the heading fallback rather than producing a wrong jump. The spike validates this degradation explicitly.

## First de-risking spike (do this before anything else)

The single highest-risk assumption is that `Array.from(host.children)` aligns 1:1 with the non-space/def/comment lexer tokens in the live 4.5.7 bundle. Prove it cheaply before stripping scaffold or adding deps:

1. `make install` the untouched boilerplate so a dev JupyterLab runs
2. Open a markdown file with the Markdown Preview factory; open the browser devtools console
3. Paste a probe: re-lex the file's source with a temporary `marked` import, build the non-space/def/comment token list with the cumulative-newline accumulator, and compare its length and per-block start text against `Array.from(document.querySelector('.jp-MarkdownViewer .jp-RenderedMarkdown').children)`
4. Confirm `host.children[n].scrollIntoView()` lands on the expected block for several `n`
5. Confirm the right-click `event.target.closest('.jp-MarkdownViewer .jp-RenderedMarkdown')` resolves and the parent-walk yields the correct top-level child
6. Confirm the exact accessor for the rendered host node from a `MarkdownDocument` widget (`widget.content.renderer.node` vs `widget.content.node` - verify which is the `.jp-RenderedMarkdown` element)
7. Run the probe on the EXOTIC set too: a `$$`-math block, an inline `<script>` (untrusted), a sanitized construct. Confirm these produce a length mismatch and that the heading-fallback path resolves correctly
8. Confirm the heading-anchor scheme on live headings: inspect whether `id` or `data-jupyter-id` is present, validating the re-derivation fallback

Pass = lengths match and scroll targets are correct on the plain set; the exotic set produces a clean length-mismatch that routes to a correct heading fallback. Fail = ordinal model is unreliable on plain docs in this build → escalate to the planner before investing in `mapping.ts`.

## Risks and mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Ordinal drift: space/def/comment tokens shift every later DOM index | high | Exclude `space`/`def`/comment-only `html` from the DOM list but keep them in the line walk; runtime self-check `domBlockList.length === expectedTokenCount`; on mismatch drop to heading fallback |
| Math `removeMath`/`replaceMath` re-tokenizes `$$` differently than plain re-lex, shifting ordinals | medium | Spike includes math fixture; length self-check catches it; math-bearing docs are fallback-only, documented in limitations |
| Sanitizer node removal / script-warning node prepended at index 0 shifts ordinals | medium | Length self-check catches the off-by-N; routes to heading fallback; spike exercises an untrusted `<script>` doc |
| Off-by-one line accumulation (blank lines live in `space`/`raw`) | high | Replicate core accumulator verbatim: `currentLine += token.raw.split('\n').length - 1` per top-level token, record `startLine` before advancing; Jest fixture asserts paragraph startLine after a multi-line fenced code block |
| `marked` version skew vs core's bundled parser for exotic constructs | medium | Pin `marked` caret to installed patch `^17.0.6`; lex with explicit `{ gfm: true }`; spike validates GFM tables + fenced code; exotic tokens fall through to heading fallback |
| Selector `.jp-RenderedMarkdown` over-matches notebook markdown cells/outputs → item on non-preview surface | high | Scope selector to `.jp-MarkdownViewer .jp-RenderedMarkdown`; execute also no-ops if owning widget not found in `IMarkdownViewerTracker`; Galata negative test on a rendered notebook markdown cell |
| Lumino commands receive no DOM target | medium | Single capture-phase `contextmenu` listener stashes `_lastPreviewTarget` and `_lastEditorTarget`; read in execute |
| Editor→Preview resolves wrong widget via `currentWidget` (split/unfocused editors) | medium | Stash right-clicked `.jp-FileEditor` node; resolve owning widget via `IEditorTracker` + `node.contains(target)`; `currentWidget` only as last-resort fallback |
| Heading-anchor fallback uses `#id` but untrusted sanitizer emits `data-jupyter-id` | high | Re-derive `createHeaderId(textContent)` from live `h1`-`h6` elements and select the `headingNth`-th match; do not trust any single id attribute |
| Cursor positioning runs before editor renders (async open) | medium | `await widget.context.ready; await widget.revealed;` before `setCursorPosition`/`revealPosition`; clamp to `editor.lineCount - 1` |
| Removing `_jupyter_labextension_paths()` breaks prebuilt discovery | high | Strip ONLY the server functions; explicitly preserve `_jupyter_labextension_paths` and `_version` import |
| Leaving server-config shared-data line after deleting the JSON breaks the build | high | Remove that shared-data line in the same change as the JSON delete |
| Heading-slug collisions (two `## Notes`) reveal wrong occurrence | medium | `lineToBlock` returns `headingNth`; fallback selects the Nth matching heading in document order, not the first |
| Empty/marker-only block (hr, image-only, empty li) yields a blank-ish jump | low | `BlockDescriptor.text` empty-guard: `blockToLine` returns `-1` for empty normalized text → no-op + console.warn (AC #5) |
| Source edited since last render → containment lookup fails | low | Re-read `context.model.toString()` at trigger time; treat failed lookup as a clean no-op, never a relocated text jump |
| Two new deps absent from `node_modules` → registry fetch | low | Acknowledged in Task 4/5; after `make install` confirm resolved versions on 4.5.x line and `.d.ts` match cited API before coding `index.ts` |
| Galata not installed in `ui-tests/node_modules` | medium | Run `jlpm install` under `ui-tests/` or rely on CI's playwright job; API names verified against installed sibling galata 5.x |

## Acceptance criteria coverage (task → criterion)

| AC | How satisfied | Task(s) |
|----|----------------|---------|
| 1 - "Edit at this location" only on preview surface | `app.contextMenu.addItem` selector `.jp-MarkdownViewer .jp-RenderedMarkdown`; execute no-ops if owning widget not in `IMarkdownViewerTracker`; Galata negative assertion on a RENDERED notebook markdown cell | 8, 10 |
| 2 - opens/reveals file with `Editor` factory | `docManager.openOrReveal(path, 'Editor')` (reveals existing tab or opens new) | 8 |
| 3 - cursor on source line, scrolled into view | `editor.setCursorPosition({line,0})` + `editor.revealPosition` after `ready`/`revealed`, clamped to `lineCount - 1` | 8 |
| 4 - correct block for well-formed markdown | `blockToLine` ordinal map with verbatim core accumulator; line within block `[startLine,endLine]`; Jest well-formed fixture | 6, 7 |
| 5 - no-op + console.warn on unmappable | `blockToLine` returns `-1` for out-of-range ordinal or empty block text; owning-widget no-op; console.warn path | 6, 8 |
| 6 - "Reveal in Markdown Preview" on editor, scrolls preview to cursor block | `.jp-FileEditor` selector; right-clicked editor resolved via stash + `IEditorTracker`; `getCursorPosition` → `lineToBlock` → `host.children[ordinal].scrollIntoView` | 8 |
| 7 - opens a preview if none open, then scrolls | `docManager.openOrReveal(path, 'Markdown Preview')` then await `ready`/`revealed` + scroll | 8 |
| 8 - block in viewport; heading anchors as fallback | `scrollIntoView`; on length-mismatch/no-block, re-derive `createHeaderId` from live `h1`-`h6` and select `headingNth`-th match | 6, 8 |
| 9 - exact activation console message | Preserve verbatim `console.log(...)` in `index.ts`; activation Galata test kept verbatim | 8, 10 |
| 10 - no `addFileType` | Static-source Jest test reading `index.ts` for `addFileType` absence; assert plugin descriptor omits `IDocumentRegistry` | 9 |
| 11 - mapping < ~2000 lines no perceptible delay | Single `marked.lexer(source, {gfm:true})` pass per trigger, pure integer ordinal lookup; no cache invalidation | 6 |
| 12 - `make install` + labextension `OK` | Preserve labextension shared-data + builder hooks in `pyproject.toml`/`__init__.py`; verify after install | 2, 3, 5, 11 |

Files referenced are all under `/home/lab/workspace/private/jupyterlab/jupyterlab_edit_markdown_at_content_extension/`. The mapping core lives at `src/mapping.ts` (NEW), the plugin at `src/index.ts`, tests at `src/__tests__/mapping.spec.ts` (NEW), `src/__tests__/index.spec.ts` (NEW), and `ui-tests/tests/jupyterlab_edit_markdown_at_content_extension.spec.ts` (EXTEND).


## Open questions surfaced during research

- Exact mechanism to map a source line to a CodeMirror cursor position in the 'Editor' factory widget (CodeEditor.IEditor.setCursorPosition / revealPosition) belongs to a separate AREA but is the consumer of this area's computed line -- confirm the editor-side API in the editor investigation.
- Whether to depend on @jupyterlab/markdownviewer for the IMarkdownViewerTracker token or detect purely via DOM + docmanager (avoids extra dependency but loses typed find()).
- Confirm the precise supported way to read the contextmenu originating node in current JupyterLab (own capture listener vs any newer app.contextMenu API) -- the own-listener approach is the safe baseline.
- Does the bundled MarkdownViewer expose its RenderedMarkdown host via a public accessor, or must the extension reach into widget.node.querySelector('.jp-RenderedMarkdown')? (DOM query is reliable but undocumented.)
- Should the extension re-lex on every trigger (cheap for <2000 lines per criterion 11) or cache the block map and invalidate on model.contentChanged? Re-lex-on-trigger is simplest and avoids staleness.
- For editor->preview when ordinal map length mismatches DOM children, is nearest-heading scroll acceptable as the sole fallback, or is a coarse proportional-scroll fallback also wanted? ACCEPTANCE only mandates heading anchors.
- marked is a transitive dep here (via rendermime/mermaid); is importing `marked` directly in the extension acceptable, or should we go through IMarkdownParser.getHeadingTokens only (headings) plus a private re-lex? Direct marked import gives full block tokens but adds an explicit dependency.
- AREA 2/4 ownership: this area assumes the source-line<->block mapper (preview click -> source line, and cursor line -> rendered block/heading anchor) is provided elsewhere; the reverse-direction scroll-to-block inside the Markdown Preview (criterion 8 heading anchors) is AREA 4, not covered here
- Whether to resolve the right-clicked widget via injected IEditorTracker.currentWidget vs app.shell.currentWidget vs contextMenu's event target - both work; planner should pick one (IEditorTracker is the typed, editor-scoped option)
- How the file path of the preview widget is obtained for the Preview->Editor direction: via docManager.contextForWidget(previewWidget)?.path or (previewWidget as IDocumentWidget).context.path - needs the AREA 1 preview widget reference to confirm it carries a context
- Does the source-mapping algorithm need to re-tokenize markdown (requiring a direct marked dependency) or can it map purely from the rendered preview DOM nodes that the MarkdownViewer already produced? This decides whether marked is added at all.
- markdownviewer/fileeditor are not yet in node_modules - confirm `make install` / jlpm pulls them at ^4.5.0 cleanly against the 4.5.7 core, or whether they must be added to package.json before first install.
- Should the now-unused [project.optional-dependencies].test group and tests/ dir be fully removed, or kept as a home for future python-side integration tests (none currently needed for a frontend-only extension)?
- Will AREA 1/3 expose mapping as a pure source-text function (Jest-testable) or only as DOM-coupled logic (Galata-only)? This determines whether the Part A unit suite is viable as specified
- What are the exact command IDs and menu item labels - the AC implies 'Edit at this location' and 'Reveal in Markdown Preview'; the Galata getMenuItemLocatorInMenu label strings must match the registered command labels exactly
- What CSS selector identifies the rendered markdown preview content container in this JupyterLab 4.5.7 build ('.jp-RenderedMarkdown' vs '.jp-MarkdownViewer') for right-click targeting - to be confirmed against the running app
- For tables, is precise cell/row mapping in scope or should the test assert only the heading-fallback line (the AC lists tables as a fixture but 'Known limitations' suggests degradation)?
- How is the editor cursor line read in CI - via a stable CodeMirror state hook exposed by the extension, or via DOM .cm-activeLine? A test hook on window would make Flow 1 assertions far less brittle

## Mapping-design decision

- Winner: Approach A - marked.lexer block-ordinal correlation
- Rationale: Approach C is eliminated by verified fact, not opinion: the apputils Sanitizer global allowedAttributes whitelist in the installed jlab_core bundle is exactly {class, data-jupyter-id, dir, draggable, hidden, id, inert, itemprop, itemref, itemscope, lang, spellcheck, style, title, translate}; `data-source-line` occurs nowhere in the static bundle, and markdown previews render untrusted (MimeModel without trusted:true). So the injected attribute is stripped on the default path and the feature silently no-ops (0% accuracy). The only surviving channel (id/data-jupyter-id) collapses C into B's heading fallback while still requiring a global IMarkdownParser swap (app-wide blast radius onto notebook markdown cells) plus re-implementing the private Private.makeRenderer mermaid/highlight/GFM-heading-id behaviour and tracking marked majors. Highest maintenance, lowest payoff, blocked at the core. Last place. A vs B is the real contest, decided on the v1 priorities (line-precise best-effort, bidirectional, frontend-only, LOW MAINTENANCE). A wins on three grounds. (1) Correctness contract: A's map is a single position-derived integer (ordinal index into host.children), so it is robust to the case the AC explicitly calls out - duplicate adjacent identical paragraphs - because position, not content, drives lookup; B can only handle duplicates via an occurrence-rank that demands byte-identical normalization on both the DOM-read and source-scan sides, and any drift between those two enumerations silently lands on the wrong line. (2) Maintenance surface: A's only fragile contract is the line-walk, which mirrors the exact getHeadingTokens accumulator JupyterLab already ships (verified present: getHeadingTokens, createHeaderId, replace(/ /g,'-')); B's contract is reversing every inline transform marked applies (emphasis/strong/code stripping, link-label-only rendering, image alt, HTML entities, smart quotes) - an unbounded, lossy round-trip that is the dominant silent-wrong-line source and is rated complexity:high vs A's medium. (3) Detectability: A has a clean deterministic self-check (domOrdinalList.length === host.children.length) that fires the heading-anchor fallback exactly when the four enumerated constructs (raw HTML expansion, script re-wrap - I confirmed the getElementsByTagName('script') re-wrap branch and the innerHTML=e one-shot in the bundle - link-ref defs/blank lines, loose top-level text) would mis-map; B's failures are mostly silent confidently-wrong jumps with no comparable runtime guard. Both meet the AC's best-effort bar and both keep the pure mapping (blockToLine/lineToBlock in src/mapping.ts) Jest-testable offline. A's residual risks (adding marked ^17 as a direct dep to match the installed 17.0.6; net-zero opposing-drift evading the length check; block-not-item granularity) are narrower and explicitly within the AC's accepted limitations. B remains the better engine for the one thing A cannot do well - the heading path - which is why it supplies grafts rather than the win.
- Grafted ideas: From B: adopt the deterministic heading-slug match as the PRIMARY fallback channel inside A's failure path. When A's length self-check fails, do not just scroll the nearest-preceding-heading ordinal - recompute the slug with the same createHeaderId logic (textContent.replace(/ /g,'-'), verified in the bundle) and use host.querySelector('#'+CSS.escape(slug)) so the fallback aligns to an id that actually survives sanitization (verified: id is whitelisted).; From B: when A's ordinal lands on a top-level list block, refine within it using B's text/slug match against the list's source line window to recover list-item granularity that A's outermost-block ordinal cannot reach - kept strictly as an opt-in refinement so it never regresses the ordinal happy path.; From B: guard empty/marker-only blocks (hr, image-only, empty li) explicitly - if the resolved descriptor has empty normalized textContent, no-op + console.warn (AC#5) rather than scrolling an arbitrary blank-ish line; this hardens A's Preview->Editor unmappable case.; From B: re-read context.model.toString() at trigger time (A already re-lexes per trigger) and treat a failed containment lookup as a clean no-op, inheriting B's tolerance for source edited since last render without adopting B's risk of jumping to a relocated text match.; From C (the only salvageable idea): the data-jupyter-id channel is the verified sanitizer-surviving custom attribute - reserve it as a future hardening path for heading anchors specifically (not arbitrary lines), should heading-id collisions on duplicate '## Notes' need disambiguation; no parser swap required since core already emits ids.; From C: explicitly pin marked to ^17 matching the installed 17.0.6 and add a startup version-skew note, since C's analysis correctly flags that A's tokenization fidelity for exotic constructs depends on the extension's marked matching core's bundled marked.
