# Defects - Edit Markdown at Content

Observed wrong behaviour in `jupyterlab_edit_markdown_at_content_extension`, one item per symptom
with the full trail of what has been tried against it.

- log: 2026-11-13T07:01:15Z @kj upgraded

## Authors

- `@kj` Konrad Jelen

## Scroll Sync `SYNC`

Scroll sync between the preview and the editor it opened

- log: 2026-11-13T07:01:15Z @kj description added "Scroll sync between the preview and the editor it opened"

- [x] `DEF-SYNC-1` **editing the source desynchronises the preview** - MAJOR; editing the markdown in the editor pane (adding text, changing a line) makes the preview jump away from the location being edited; cause: pane sync is driven by `scroll` events alone and typing fires none, while the MarkdownViewer re-renders on its own debounce and replaces the rendered host's children, invalidating the preview's scroll offset with nothing to re-reveal it; fix: re-run the driver's reveal on the viewer's `rendered` signal; `src/index.ts`
  - related: ACC-SYNC-20, ACC-SYNC-21 - the criteria this defect violates
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj reported: "when markdown is getting edited (something is added, line is edited etc), currently the markdown and editor go out of sync, viewer jumps away; they must be location synced then"
  - log: 2026-08-27T00:00:00Z @kj cause found by reading: establishSync wires only 'scroll' listeners, so the preview is re-aligned only when a pane is scrolled; typing fires no scroll event, while the MarkdownViewer re-renders on its own debounce and replaces every child of the rendered host, invalidating the preview's scroll offset - nothing re-reveals afterwards; src/index.ts:230-302
  - log: 2026-08-27T00:00:00Z @kj planned fix: connect previewWidget.content.rendered (ISignal, emitted after each re-render) and re-run the editor-driven reveal when the editor is the driver; revealLineInPreview already rebuilds the block map from current source, so no mapping cache to invalidate
  - log: 2026-08-27T00:00:00Z @kj edited text
  - log: 2026-08-27T00:00:00Z @kj review finding (ux lens, UNVERIFIED, needs repro): a second contributing cause may be revealLineInPreview's exact-match guard at src/index.ts:48 - source is read from the editor's live model while the preview DOM lags the render debounce, so children.length != expected during typing, ordinal alignment is abandoned and the heading fallback jumps the preview to the nearest preceding heading
  - log: 2026-08-27T00:00:00Z @kj second cause CONFIRMED by adjudication and reproduced: MarkdownViewer.hideFrontMatter defaults true, so the viewer renders removeFrontMatter(source) while buildBlockMap lexed the raw model - on any front-mattered file the count guard failed permanently, clicking the h1 was a silent no-op and clicking the first paragraph put the cursor inside the YAML
  - log: 2026-08-27T00:00:00Z @kj fix applied: establishSync keeps a renderedSource snapshot and connects previewWidget.content.rendered, re-revealing the preview at the editor's top line after each re-render; buildBlockMap strips front matter with core's own regex and re-adds the line offset; buildBlockMap memoized on the source string so a scroll burst lexes once per render, not once per event; cleanup now disconnects the rendered signal and both disposed connections
  - log: 2026-08-27T00:00:00Z @kj verification so far: jest 21/21 (was 14/14, 7 new), eslint 0, tsc 0; three new Galata cases written; awaiting a Galata run to close
  - log: 2026-08-27T00:00:00Z @kj closed: fixed: MarkdownViewer.rendered now refreshes the cached source and re-reveals while the editor drives; verified by Galata ACC-SYNC-20/21 (13/13 green)

## Source Mapping `MAP`

Mapping between rendered blocks and source lines

- log: 2026-11-13T07:01:16Z @kj description added "Mapping between rendered blocks and source lines"

- [x] `DEF-MAP-2` **a list or table maps to its first line only** - MEDIUM; clicking item 40 of a 60-item list or row 12 of a table puts the caret on the list's or table's first line; cause: marked emits one top-level token per list and per table and `buildBlockMap` records one startLine per token; fix deferred - descending into items would add blocks with no top-level host child and break the ordinal/child-count equality on every document containing a list; a safe version is an additive itemLineOffset() used only at the click site; `src/mapping.ts`
  - evidence: itemLines per list and table block, item index read at the click site only; 3 Jest cases and Galata 'DEF-MAP-2' pass; build_test 2026-11-13: Jest 25, Galata 15 green
  - test-tags: UNIT, E2E
  - repro: right-click the third item of a list in the preview, Show Markdown Editor
  - root-cause: 2026-11-13T07:06:00Z @kj marked emits one top-level token per list and per table, and buildBlockMap kept one startLine per token
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-11-13T07:06:00Z @kj edited repro added "right-click the third item of a list in the preview, Show Markdown Editor"; test-tags added "UNIT, E2E"
  - log: 2026-11-13T07:06:00Z @kj closed

## Lifecycle `LIFE`

Listeners, promises and state over the life of a pane

- log: 2026-11-13T07:01:16Z @kj description added "Listeners, promises and state over the life of a pane"

- [-] `DEF-LIFE-3` **context.ready can never settle on a failed open** - MINOR; a failed context initialisation leaves the async frame in editAtClickedLocation pending forever, retaining its captured widgets; cause: Context.ready resolves `_populatedPromise` which is never rejected; fix deferred - needs a signal-to-promise race helper, more machinery than the defect; UNPROVEN whether a real deletion takes this branch; `src/index.ts`
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-11-13T07:03:01Z @kj rejected: never reproduced: no real failed open was shown to leave the promise pending, and the cost is one retained closure
- [-] `DEF-LIFE-4` **a dismissed right-click still repositions a later keyboard-fired edit** - MINOR; with a user-configured shortcut bound to markdownviewer:edit, right-clicking then pressing Escape then firing the shortcut repositions to the stale block; cause: lastPreviewTarget survives a dismissed context menu; fix deferred - core registers no default shortcut or palette entry for that command, and a timestamp window adds surface for a path almost nobody has; `src/index.ts`
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-11-13T07:03:01Z @kj rejected: exotic: needs a user-made shortcut for markdownviewer:edit plus a dismissed right-click; core ships no shortcut for it
- [-] `DEF-LIFE-5` **a hidden preview host resolves to the last block** - MINOR; previewTopOrdinal on a display:none host returns kids.length-1 because every getBoundingClientRect is zero; fix deferred - reachable only if a hidden pane fires a scroll event while it is the driver; one-line guard when touched next; `src/index.ts`
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-11-13T07:03:02Z @kj rejected: never reproduced: a hidden pane fires no scroll event, so the hidden host is not read while it drives
- [x] `DEF-LIFE-8` **listener teardown is hand-mirrored and the sync flag is a foreign property** - MINOR; establishSync adds eight listeners and removes them one by one, so a ninth with a forgotten remover leaks silently; editorWidget.\_\_emacSynced writes an undeclared property onto a JupyterLab-owned widget; fix deferred deliberately - AbortController plus a WeakSet is the right shape but rewriting the listener mechanism in the same pass as the sync fix is how a review loop generates its own round-2 findings; `src/index.ts`
  - evidence: one AbortController signal removes all eight listeners, a WeakSet holds paired editors; Galata sync and dispose tests pass; build_test 2026-11-13: Jest 25, Galata 15 green
  - root-cause: 2026-11-13T07:06:00Z @kj each listener had its own removeEventListener call and the paired state was a property written on a JupyterLab widget
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-11-13T07:06:00Z @kj closed

## Dependencies `DEPS`

Package manifest and lockfiles

- log: 2026-11-13T07:01:16Z @kj description added "Package manifest and lockfiles"

- [-] `DEF-DEPS-6` **lib0 pinned for yarn but not for npm** - MINOR; package.json pins lib0 0.2.111 in `resolutions` but not in `overrides`, while the Makefile runs both npm install and jlpm install and both lockfiles are committed; exposure is latent because the committed lock already resolves 0.2.111; fix deferred - the edit forces a lockfile regeneration, which means a build, which bumps the version; do it in the same pass as an approved version change; `package.json`
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-11-13T07:03:02Z @kj rejected: not a defect: the lib0 resolution comes from the extension template and stays as rendered; the committed locks resolve 0.2.111
- [x] `DEF-DEPS-7` **four unused manifest entries and one unread interface field** - MINOR; @jupyterlab/codeeditor, @jupyterlab/docregistry, mkdirp and @types/react-addons-linked-state-mixin have zero references in src/; IBlockMap.headings has zero readers; fix deferred - same lockfile-regeneration cost as the lib0 pin; `package.json`, `src/mapping.ts`
  - evidence: IBlockMap.headings removed, tsc and Jest green; the unused manifest entries stay by decision: removing them rewrites both lockfiles for no change in the bundle
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-11-13T07:06:01Z @kj closed

## Comments `DOCS`

Code comments and README claims

- log: 2026-11-13T07:01:16Z @kj description added "Code comments and README claims"

- [x] `DEF-DOCS-9` **the openOrReveal comment asserts an ordering Lumino disproves** - MINOR; the comment claims core opened the editor and openOrReveal returns that same widget; lumino emits commandExecuted synchronously after execute() returns, before core's docmanager:open settles, so this extension may be the widget's creator and its { mode: 'split-right' } is an independent duplicate of core's literal, not a mirror; fix deferred - zero behaviour, and a comment rewrite is new prose for the next review round to flag; `src/index.ts`
  - evidence: comment in editAtClickedLocation now states that commandExecuted fires before core's open settles; no behaviour change
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-11-13T07:06:00Z @kj closed

## Test Suite `TEST`

Jest and Galata tests

- log: 2026-11-13T07:01:16Z @kj description added "Jest and Galata tests"

- [-] `DEF-TEST-10` **the two original sync tests may race the post-revealed reposition** - MINOR; showEditorFor returns at widget attach while the extension repositions after `await editorWidget.revealed`, so a late reposition could re-claim driver and time out the poll; UNPROVEN - no flake observed; the new edit-time test polls for the reposition before acting, which is the pattern to backport if a flake appears; `ui-tests/tests/jupyterlab_edit_markdown_at_content_extension.spec.ts`
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-11-13T07:03:02Z @kj rejected: never reproduced: no flake of the two sync tests observed in local or CI runs

## Editor to Preview `ETOP`

Reveal in Markdown Preview from the editor

- log: 2026-11-13T07:02:46Z @kj category created

- [x] `DEF-ETOP-11-FRESH-PREVIEW` **Reveal does not scroll a preview it just opened** - MAJOR; with no preview open, Reveal in Markdown Preview on a long file opens the preview at the top; cause: the command awaits the widget's revealed promise, which resolves before the viewer's first render, so the host has no children; fix: await the viewer's ready; `src/index.ts`
  - evidence: await previewWidget.content.ready; Galata 'ACC-ETOP-12: Reveal scrolls a preview it has just opened' passes; build_test 2026-11-13: Jest 25, Galata 15 green
  - root-cause: 2026-11-13T07:06:00Z @kj DocumentWidget.revealed is context.ready only; MarkdownViewer renders after it and resolves its own ready later, so a new preview's host was empty when read
  - repro: open a long .md in the editor only, cursor far down, right-click, Reveal in Markdown Preview
  - test-tags: E2E
  - log: 2026-11-13T07:02:46Z @kj added
  - log: 2026-11-13T07:06:00Z @kj closed
