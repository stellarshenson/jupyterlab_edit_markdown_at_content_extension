# Acceptance Criteria - Edit Markdown at Content

`jupyterlab_edit_markdown_at_content_extension` moves the user between the rendered Markdown Preview
and the text editor without losing their place, in both directions, and keeps the two panes on the
same location once they are paired. All mapping is computed in the browser from the source text the
open document already holds, so no server round-trip is involved.

- log: 2026-11-13T07:01:15Z @kj upgraded

## Authors

- `@kj` Konrad Jelen

## Preview to Editor `PTOE`

Show Markdown Editor from the preview opens the editor on the clicked block

- log: 2026-11-13T07:01:16Z @kj description added "Show Markdown Editor from the preview opens the editor on the clicked block"

- [x] `ACC-PTOE-1` **Entry point is core's command** - HIGH; the extension registers no edit menu item of its own; it repositions after JupyterLab core's `markdownviewer:edit` ("Show Markdown Editor") runs
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata edit-at-content flows green
  - log: 2026-11-13T07:01:17Z @kj edited importance added "HIGH"
- [x] `ACC-PTOE-2` **Editor opens split-right** - HIGH; the file opens with the `Editor` factory in a split-right pane, revealing the existing editor tab if one is already open
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata edit-at-content flows green
  - log: 2026-11-13T07:01:18Z @kj edited importance added "HIGH"
- [x] `ACC-PTOE-3` **Cursor on the mapped line** - CRITICAL; the editor cursor is placed on the source line that produced the right-clicked rendered element
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata edit-at-content flows green
  - log: 2026-11-13T07:01:17Z @kj edited importance added "CRITICAL"
- [x] `ACC-PTOE-4` **Mapped line top-aligned** - HIGH; the mapped line is scrolled to the top of the editor viewport, not merely into view
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata edit-at-content flows green
  - log: 2026-11-13T07:01:18Z @kj edited importance added "HIGH"
- [x] `ACC-PTOE-5` **Correct block on well-formed input** - CRITICAL; for markdown with no duplicate adjacent text the cursor lands within the line range of the clicked block
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata edit-at-content flows green
  - log: 2026-11-13T07:01:17Z @kj edited importance added "CRITICAL"
- [x] `ACC-PTOE-6` **Edge: unmappable content** - MEDIUM; content with no source counterpart is a no-op with a console warning and no error dialog
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata edit-at-content flows green
  - log: 2026-11-13T07:01:20Z @kj edited importance added "MEDIUM"
- [x] `ACC-PTOE-7` **Edge: right-click on empty space** - MEDIUM; a click landing between or beside blocks resolves to the block nearest by vertical distance
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata edit-at-content flows green
  - log: 2026-11-13T07:01:21Z @kj edited importance added "MEDIUM"
- [x] `ACC-PTOE-8` **Edge: command fired with no preceding right-click** - MEDIUM; invocation from the palette or a keyboard shortcut leaves core's behaviour untouched and performs no repositioning
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata edit-at-content flows green
  - log: 2026-11-13T07:01:21Z @kj edited importance added "MEDIUM"
- [x] `ACC-PTOE-9` **Edge: stale preview** - MEDIUM; a right-click in a preview that is not the current widget performs no repositioning
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata edit-at-content flows green
  - log: 2026-11-13T07:01:21Z @kj edited importance added "MEDIUM"
- [x] `ACC-PTOE-31-ITEM-ROW` **List item and table row precision** - MEDIUM; a right-click on a list item or a table row puts the cursor on the source line of that item or row
  - evidence: build_test 2026-11-13: Jest 'list items and table rows' 3 cases and Galata 'DEF-MAP-2' green
  - test: Jest 'list items and table rows', Galata 'DEF-MAP-2'
  - test-tags: UNIT, E2E
  - log: 2026-11-13T07:06:01Z @kj added
  - log: 2026-11-13T07:06:06Z @kj closed

## Editor to Preview `ETOP`

Reveal in Markdown Preview scrolls the preview to the editor cursor

- log: 2026-11-13T07:01:17Z @kj description added "Reveal in Markdown Preview scrolls the preview to the editor cursor"

- [x] `ACC-ETOP-10` **Reveal menu item** - HIGH; right-clicking inside the markdown editor shows "Reveal in Markdown Preview"
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata editor-to-preview flow green
  - log: 2026-11-13T07:01:18Z @kj edited importance added "HIGH"
- [x] `ACC-ETOP-11` **Scrolls an open preview** - HIGH; selecting it scrolls an open preview of the same file to the block corresponding to the cursor line
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata editor-to-preview flow green
  - log: 2026-11-13T07:01:18Z @kj edited importance added "HIGH"
- [x] `ACC-ETOP-12` **Opens a preview when none is open** - HIGH; with no preview open the command opens one with the `Markdown Preview` factory and then scrolls to the block
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata editor-to-preview flow green
  - log: 2026-11-13T07:01:19Z @kj edited importance added "HIGH"
  - log: 2026-11-13T07:06:01Z @kj now proven on a long file by Galata 'ACC-ETOP-12: Reveal scrolls a preview it has just opened' (DEF-ETOP-11-FRESH-PREVIEW)
- [x] `ACC-ETOP-13` **Heading anchor fallback** - MEDIUM; the nearest preceding heading anchor is the alignment target when an exact block match is unavailable
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata editor-to-preview flow green
  - log: 2026-11-13T07:01:21Z @kj edited importance added "MEDIUM"

## Scroll Sync `SYNC`

Paired panes scroll together

- log: 2026-11-13T07:01:17Z @kj description added "Paired panes scroll together"

- [x] `ACC-SYNC-14` **Pairing happens on the preview flow only** - HIGH; the two panes are wired together when the editor is opened through "Show Markdown Editor" from the preview, not when they are opened independently
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata focused-pane sync tests green
  - log: 2026-11-13T07:01:19Z @kj edited importance added "HIGH"
- [x] `ACC-SYNC-15` **trackEditor setting gates pairing** - HIGH; the boolean setting `trackEditor` defaults to true; set false, no pairing is wired and neither pane moves the other
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata focused-pane sync tests green
  - log: 2026-11-13T07:01:19Z @kj edited importance added "HIGH"
- [x] `ACC-SYNC-16` **Focused pane drives** - HIGH; the pane that last received pointerdown, wheel or focusin is the sole driver; the other follows
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata focused-pane sync tests green
  - log: 2026-11-13T07:01:19Z @kj edited importance added "HIGH"
- [x] `ACC-SYNC-17` **Editor scroll drives the preview** - HIGH; scrolling the focused editor reveals the preview block produced by the editor's top visible line
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata focused-pane sync tests green
  - log: 2026-11-13T07:01:20Z @kj edited importance added "HIGH"
- [x] `ACC-SYNC-18` **Preview scroll drives the editor** - HIGH; scrolling the focused preview top-aligns the editor on the source line of the preview's top visible block
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata focused-pane sync tests green
  - log: 2026-11-13T07:01:20Z @kj edited importance added "HIGH"
- [x] `ACC-SYNC-19` **Non-driver pane does not drive** - MEDIUM; a programmatic scroll of the follower never moves the driver back
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata focused-pane sync tests green
  - log: 2026-11-13T07:01:21Z @kj edited importance added "MEDIUM"
- [x] `ACC-SYNC-20` **Edits hold the preview location** - HIGH; typing, adding or deleting text in the editor leaves the preview showing the block being edited; the preview does not jump to the top or to a stale offset
  - related: DEF-SYNC-1 - the reported desync this criterion closes
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met: Galata 'editing the source holds the preview on the edited block' passes; preview stays on Heading 15 through an edit
  - log: 2026-11-13T07:01:20Z @kj edited importance added "HIGH"
- [x] `ACC-SYNC-21` **Re-render recomputes the mapping** - MEDIUM; after the preview re-renders following an edit, the next reveal uses a block map built from the current source, not the pre-edit one
  - related: DEF-SYNC-1 - the reported desync this criterion closes
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met: buildBlockMap is rebuilt from the post-edit source on each rendered signal; front-matter and memoization unit tests cover the recompute
  - log: 2026-11-13T07:01:21Z @kj edited importance added "MEDIUM"
- [x] `ACC-SYNC-22` **Edge: pane disposed** - MEDIUM; closing either pane removes both panes' listeners and raises no console error
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; Galata focused-pane sync tests green
  - log: 2026-11-13T07:01:22Z @kj edited importance added "MEDIUM"

## Non-functional `NFR`

Activation, install, registry and cost

- log: 2026-11-13T07:01:17Z @kj description added "Activation, install, registry and cost"

- [x] `ACC-NFR-23` **Activation message** - LOW; the extension logs exactly `JupyterLab extension @stellarshenson/jupyterlab-edit-markdown-at-content-extension is activated!` on activation
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; asserted by the activation Galata test
  - log: 2026-11-13T07:01:22Z @kj edited importance added "LOW"
  - log: 2026-11-13T07:06:01Z @kj amended text "the extension logs exactly `JupyterLab extension jupyterlab_edit_markdown_at_content_extension is activated!` on activation" -> "LOW; the extension logs exactly `JupyterLab extension @stellarshenson/jupyterlab-edit-markdown-at-content-extension is activated!` on activation"
- [x] `ACC-NFR-24` **No file type registration** - MEDIUM; no `docRegistry.addFileType()` call, so the extension does not compete with icon extensions
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; no addFileType call in src
  - log: 2026-11-13T07:01:22Z @kj edited importance added "MEDIUM"
- [x] `ACC-NFR-25` **Mapping cost** - MEDIUM; mapping a document under about 2000 lines completes with no perceptible delay on the trigger action
  - evidence: Jest 'mapping - cost (ACC-NFR-25)': a 2000-line document maps under the 500 ms bound, measured about 15 ms
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj no measurement taken; criterion is unverified, not met
  - log: 2026-11-13T07:01:22Z @kj edited importance added "MEDIUM"
  - log: 2026-11-13T07:06:01Z @kj closed
- [x] `ACC-NFR-26` **Install is clean** - HIGH; `make install` succeeds and `jupyter labextension list` reports the extension as OK
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.17; make install clean, labextension list OK
  - log: 2026-11-13T07:01:20Z @kj edited importance added "HIGH"
- [x] `ACC-NFR-27` **No duplicate menu warning** - MEDIUM; loading the extension and opening the preview context menu produces no console warning that a `markdownviewer:edit` menu entry is duplicated
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: met in v1.0.15; commandExecuted hook replaced the schema-disabled menu entry, asserted by a Galata console-warning test
  - log: 2026-11-13T07:01:22Z @kj edited importance added "MEDIUM"

## Known Limitations `LIMS`

Accepted limits of the mapping

- log: 2026-11-13T07:01:17Z @kj description added "Accepted limits of the mapping"

- [x] `ACC-LIMS-28` **Block-level precision only** - LOW; the unit of mapping is the block; a specific word inside a paragraph is not addressable
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: accepted limitation, decided not open
  - log: 2026-11-13T07:01:22Z @kj edited importance added "LOW"
- [x] `ACC-LIMS-29` **Degraded mapping is accepted** - LOW; accuracy degrades on duplicate adjacent text, deeply nested lists and raw HTML blocks, falling back to the nearest preceding heading
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: accepted limitation, decided not open
  - log: 2026-11-13T07:01:22Z @kj edited importance added "LOW"
- [x] `ACC-LIMS-30` **Independent panes stay unlinked** - LOW; an editor and a preview opened separately are not scroll-synced; pairing requires the preview flow
  - log: 2026-08-27T00:00:00Z @kj added
  - log: 2026-08-27T00:00:00Z @kj closed: accepted limitation, decided not open
  - log: 2026-11-13T07:01:22Z @kj edited importance added "LOW"
