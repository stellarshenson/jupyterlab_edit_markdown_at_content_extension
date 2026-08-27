# Defects - Edit Markdown at Content

Observed wrong behaviour in `jupyterlab_edit_markdown_at_content_extension`, one item per symptom
with the full trail of what has been tried against it.

## Scroll Sync `SYNC`

- [x] `DEF-SYNC-1` **editing the source desynchronises the preview** - HIGH; editing the markdown in the editor pane (adding text, changing a line) makes the preview jump away from the location being edited; cause: pane sync is driven by `scroll` events alone and typing fires none, while the MarkdownViewer re-renders on its own debounce and replaces the rendered host's children, invalidating the preview's scroll offset with nothing to re-reveal it; fix: re-run the driver's reveal on the viewer's `rendered` signal; `src/index.ts`
  - related: ACC-SYNC-20, ACC-SYNC-21 - the criteria this defect violates
  - log: 2026-08-27 added
  - log: 2026-08-27 reported: "when markdown is getting edited (something is added, line is edited etc), currently the markdown and editor go out of sync, viewer jumps away; they must be location synced then"
  - log: 2026-08-27 cause found by reading: establishSync wires only 'scroll' listeners, so the preview is re-aligned only when a pane is scrolled; typing fires no scroll event, while the MarkdownViewer re-renders on its own debounce and replaces every child of the rendered host, invalidating the preview's scroll offset - nothing re-reveals afterwards; src/index.ts:230-302
  - log: 2026-08-27 planned fix: connect previewWidget.content.rendered (ISignal, emitted after each re-render) and re-run the editor-driven reveal when the editor is the driver; revealLineInPreview already rebuilds the block map from current source, so no mapping cache to invalidate
  - log: 2026-08-27 edited text
  - log: 2026-08-27 review finding (ux lens, UNVERIFIED, needs repro): a second contributing cause may be revealLineInPreview's exact-match guard at src/index.ts:48 - source is read from the editor's live model while the preview DOM lags the render debounce, so children.length != expected during typing, ordinal alignment is abandoned and the heading fallback jumps the preview to the nearest preceding heading
  - log: 2026-08-27 second cause CONFIRMED by adjudication and reproduced: MarkdownViewer.hideFrontMatter defaults true, so the viewer renders removeFrontMatter(source) while buildBlockMap lexed the raw model - on any front-mattered file the count guard failed permanently, clicking the h1 was a silent no-op and clicking the first paragraph put the cursor inside the YAML
  - log: 2026-08-27 fix applied: establishSync keeps a renderedSource snapshot and connects previewWidget.content.rendered, re-revealing the preview at the editor's top line after each re-render; buildBlockMap strips front matter with core's own regex and re-adds the line offset; buildBlockMap memoized on the source string so a scroll burst lexes once per render, not once per event; cleanup now disconnects the rendered signal and both disposed connections
  - log: 2026-08-27 verification so far: jest 21/21 (was 14/14, 7 new), eslint 0, tsc 0; three new Galata cases written; awaiting a Galata run to close
  - log: 2026-08-27 closed: fixed: MarkdownViewer.rendered now refreshes the cached source and re-reveals while the editor drives; verified by Galata ACC-SYNC-20/21 (13/13 green)

## Source Mapping `MAP`

- [ ] `DEF-MAP-2` **a list or table maps to its first line only** - MEDIUM; clicking item 40 of a 60-item list or row 12 of a table puts the caret on the list's or table's first line; cause: marked emits one top-level token per list and per table and `buildBlockMap` records one startLine per token; fix deferred - descending into items would add blocks with no top-level host child and break the ordinal/child-count equality on every document containing a list; a safe version is an additive itemLineOffset() used only at the click site; `src/mapping.ts`
  - log: 2026-08-27 added

## Lifecycle `LIFE`

- [ ] `DEF-LIFE-3` **context.ready can never settle on a failed open** - LOW; a failed context initialisation leaves the async frame in editAtClickedLocation pending forever, retaining its captured widgets; cause: Context.ready resolves `_populatedPromise` which is never rejected; fix deferred - needs a signal-to-promise race helper, more machinery than the defect; UNPROVEN whether a real deletion takes this branch; `src/index.ts`
  - log: 2026-08-27 added
- [ ] `DEF-LIFE-4` **a dismissed right-click still repositions a later keyboard-fired edit** - LOW; with a user-configured shortcut bound to markdownviewer:edit, right-clicking then pressing Escape then firing the shortcut repositions to the stale block; cause: lastPreviewTarget survives a dismissed context menu; fix deferred - core registers no default shortcut or palette entry for that command, and a timestamp window adds surface for a path almost nobody has; `src/index.ts`
  - log: 2026-08-27 added
- [ ] `DEF-LIFE-5` **a hidden preview host resolves to the last block** - LOW; previewTopOrdinal on a display:none host returns kids.length-1 because every getBoundingClientRect is zero; fix deferred - reachable only if a hidden pane fires a scroll event while it is the driver; one-line guard when touched next; `src/index.ts`
  - log: 2026-08-27 added
- [ ] `DEF-LIFE-8` **listener teardown is hand-mirrored and the sync flag is a foreign property** - LOW; establishSync adds eight listeners and removes them one by one, so a ninth with a forgotten remover leaks silently; editorWidget.\_\_emacSynced writes an undeclared property onto a JupyterLab-owned widget; fix deferred deliberately - AbortController plus a WeakSet is the right shape but rewriting the listener mechanism in the same pass as the sync fix is how a review loop generates its own round-2 findings; `src/index.ts`
  - log: 2026-08-27 added

## Dependencies `DEPS`

- [ ] `DEF-DEPS-6` **lib0 pinned for yarn but not for npm** - LOW; package.json pins lib0 0.2.111 in `resolutions` but not in `overrides`, while the Makefile runs both npm install and jlpm install and both lockfiles are committed; exposure is latent because the committed lock already resolves 0.2.111; fix deferred - the edit forces a lockfile regeneration, which means a build, which bumps the version; do it in the same pass as an approved version change; `package.json`
  - log: 2026-08-27 added
- [ ] `DEF-DEPS-7` **four unused manifest entries and one unread interface field** - LOW; @jupyterlab/codeeditor, @jupyterlab/docregistry, mkdirp and @types/react-addons-linked-state-mixin have zero references in src/; IBlockMap.headings has zero readers; fix deferred - same lockfile-regeneration cost as the lib0 pin; `package.json`, `src/mapping.ts`
  - log: 2026-08-27 added

## Comments `DOCS`

- [ ] `DEF-DOCS-9` **the openOrReveal comment asserts an ordering Lumino disproves** - LOW; the comment claims core opened the editor and openOrReveal returns that same widget; lumino emits commandExecuted synchronously after execute() returns, before core's docmanager:open settles, so this extension may be the widget's creator and its { mode: 'split-right' } is an independent duplicate of core's literal, not a mirror; fix deferred - zero behaviour, and a comment rewrite is new prose for the next review round to flag; `src/index.ts`
  - log: 2026-08-27 added

## Test Suite `TEST`

- [ ] `DEF-TEST-10` **the two original sync tests may race the post-revealed reposition** - LOW; showEditorFor returns at widget attach while the extension repositions after `await editorWidget.revealed`, so a late reposition could re-claim driver and time out the poll; UNPROVEN - no flake observed; the new edit-time test polls for the reposition before acting, which is the pattern to backport if a flake appears; `ui-tests/tests/jupyterlab_edit_markdown_at_content_extension.spec.ts`
  - log: 2026-08-27 added
