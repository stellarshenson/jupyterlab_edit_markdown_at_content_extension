# Acceptance Criteria - Edit Markdown at Content

`jupyterlab_edit_markdown_at_content_extension` moves the user between the rendered Markdown Preview
and the text editor without losing their place, in both directions, and keeps the two panes on the
same location once they are paired. All mapping is computed in the browser from the source text the
open document already holds, so no server round-trip is involved.

## Preview to Editor `PTOE`

- [x] `ACC-PTOE-1` **Entry point is core's command** - the extension registers no edit menu item of its own; it repositions after JupyterLab core's `markdownviewer:edit` ("Show Markdown Editor") runs
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata edit-at-content flows green
- [x] `ACC-PTOE-2` **Editor opens split-right** - the file opens with the `Editor` factory in a split-right pane, revealing the existing editor tab if one is already open
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata edit-at-content flows green
- [x] `ACC-PTOE-3` **Cursor on the mapped line** - the editor cursor is placed on the source line that produced the right-clicked rendered element
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata edit-at-content flows green
- [x] `ACC-PTOE-4` **Mapped line top-aligned** - the mapped line is scrolled to the top of the editor viewport, not merely into view
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata edit-at-content flows green
- [x] `ACC-PTOE-5` **Correct block on well-formed input** - for markdown with no duplicate adjacent text the cursor lands within the line range of the clicked block
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata edit-at-content flows green
- [x] `ACC-PTOE-6` **Edge: unmappable content** - content with no source counterpart is a no-op with a console warning and no error dialog
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata edit-at-content flows green
- [x] `ACC-PTOE-7` **Edge: right-click on empty space** - a click landing between or beside blocks resolves to the block nearest by vertical distance
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata edit-at-content flows green
- [x] `ACC-PTOE-8` **Edge: command fired with no preceding right-click** - invocation from the palette or a keyboard shortcut leaves core's behaviour untouched and performs no repositioning
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata edit-at-content flows green
- [x] `ACC-PTOE-9` **Edge: stale preview** - a right-click in a preview that is not the current widget performs no repositioning
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata edit-at-content flows green

## Editor to Preview `ETOP`

- [x] `ACC-ETOP-10` **Reveal menu item** - right-clicking inside the markdown editor shows "Reveal in Markdown Preview"
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata editor-to-preview flow green
- [x] `ACC-ETOP-11` **Scrolls an open preview** - selecting it scrolls an open preview of the same file to the block corresponding to the cursor line
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata editor-to-preview flow green
- [x] `ACC-ETOP-12` **Opens a preview when none is open** - with no preview open the command opens one with the `Markdown Preview` factory and then scrolls to the block
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata editor-to-preview flow green
- [x] `ACC-ETOP-13` **Heading anchor fallback** - the nearest preceding heading anchor is the alignment target when an exact block match is unavailable
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata editor-to-preview flow green

## Scroll Sync `SYNC`

- [x] `ACC-SYNC-14` **Pairing happens on the preview flow only** - the two panes are wired together when the editor is opened through "Show Markdown Editor" from the preview, not when they are opened independently
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata focused-pane sync tests green
- [x] `ACC-SYNC-15` **trackEditor setting gates pairing** - the boolean setting `trackEditor` defaults to true; set false, no pairing is wired and neither pane moves the other
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata focused-pane sync tests green
- [x] `ACC-SYNC-16` **Focused pane drives** - the pane that last received pointerdown, wheel or focusin is the sole driver; the other follows
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata focused-pane sync tests green
- [x] `ACC-SYNC-17` **Editor scroll drives the preview** - scrolling the focused editor reveals the preview block produced by the editor's top visible line
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata focused-pane sync tests green
- [x] `ACC-SYNC-18` **Preview scroll drives the editor** - scrolling the focused preview top-aligns the editor on the source line of the preview's top visible block
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata focused-pane sync tests green
- [x] `ACC-SYNC-19` **Non-driver pane does not drive** - a programmatic scroll of the follower never moves the driver back
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata focused-pane sync tests green
- [x] `ACC-SYNC-20` **Edits hold the preview location** - typing, adding or deleting text in the editor leaves the preview showing the block being edited; the preview does not jump to the top or to a stale offset
  - related: DEF-SYNC-1 - the reported desync this criterion closes
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met: Galata 'editing the source holds the preview on the edited block' passes; preview stays on Heading 15 through an edit
- [x] `ACC-SYNC-21` **Re-render recomputes the mapping** - after the preview re-renders following an edit, the next reveal uses a block map built from the current source, not the pre-edit one
  - related: DEF-SYNC-1 - the reported desync this criterion closes
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met: buildBlockMap is rebuilt from the post-edit source on each rendered signal; front-matter and memoization unit tests cover the recompute
- [x] `ACC-SYNC-22` **Edge: pane disposed** - closing either pane removes both panes' listeners and raises no console error
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; Galata focused-pane sync tests green

## Non-functional `NFR`

- [x] `ACC-NFR-23` **Activation message** - the extension logs exactly `JupyterLab extension jupyterlab_edit_markdown_at_content_extension is activated!` on activation
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; asserted by the activation Galata test
- [x] `ACC-NFR-24` **No file type registration** - no `docRegistry.addFileType()` call, so the extension does not compete with icon extensions
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; no addFileType call in src
- [ ] `ACC-NFR-25` **Mapping cost** - mapping a document under about 2000 lines completes with no perceptible delay on the trigger action
  - log: 2026-08-27 added
  - log: 2026-08-27 no measurement taken; criterion is unverified, not met
- [x] `ACC-NFR-26` **Install is clean** - `make install` succeeds and `jupyter labextension list` reports the extension as OK
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.17; make install clean, labextension list OK
- [x] `ACC-NFR-27` **No duplicate menu warning** - loading the extension and opening the preview context menu produces no console warning that a `markdownviewer:edit` menu entry is duplicated
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: met in v1.0.15; commandExecuted hook replaced the schema-disabled menu entry, asserted by a Galata console-warning test

## Known Limitations `LIMS`

- [x] `ACC-LIMS-28` **Block-level precision only** - the unit of mapping is the block; a specific word inside a paragraph is not addressable
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: accepted limitation, decided not open
- [x] `ACC-LIMS-29` **Degraded mapping is accepted** - accuracy degrades on duplicate adjacent text, deeply nested lists and raw HTML blocks, falling back to the nearest preceding heading
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: accepted limitation, decided not open
- [x] `ACC-LIMS-30` **Independent panes stay unlinked** - an editor and a preview opened separately are not scroll-synced; pairing requires the preview flow
  - log: 2026-08-27 added
  - log: 2026-08-27 closed: accepted limitation, decided not open
