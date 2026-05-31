# Acceptance Criteria - Edit Markdown at Content

This document defines the acceptance criteria for the core capability of
`jupyterlab_edit_markdown_at_content_extension`: moving between the rendered Markdown Preview and
the text editor while preserving your position in the document, in both directions.

## Overview

A reader scrolling the Markdown Preview can jump straight into the editor at the source line that
produced the content under the cursor, and an author editing the source can reveal that same spot in
the preview. The mapping between rendered content and source line is computed entirely in the browser
from the source text already held by the open document, so no server round-trip is involved.

## Scope and decisions

- **Mapping granularity**: line-precise, best-effort - aim for the exact source block (paragraph,
  heading, list item, code fence) under the click, with documented degradation on ambiguous input
- **Trigger**: context menu on rendered content (right-click) - precise click target drives the mapping
- **Architecture**: frontend-only - the boilerplate Python server extension is removed
- **Direction**: both - Preview → Editor and Editor → Preview

## Functional criteria - Preview to Editor

1. Right-clicking inside the rendered Markdown Preview shows an "Edit at this location" item; it is
   absent from the context menu of any non-markdown-preview surface
2. Selecting the item opens the same file with the `Editor` factory (revealing the existing editor
   tab if one is already open, otherwise opening a new one)
3. The editor cursor is placed on the source line that produced the clicked element, and that line is
   scrolled into view
4. For well-formed markdown with no duplicate adjacent text, the cursor lands on the correct source
   block; "correct" means within the line range of that block
5. The command is a no-op with a console warning (no error dialog) when invoked on content that cannot
   be mapped (for example, generated decoration not present in source)

## Functional criteria - Editor to Preview

6. Right-clicking inside the markdown editor shows a "Reveal in Markdown Preview" item; selecting it
   scrolls an open preview of the same file to the rendered block corresponding to the cursor line
7. If no preview of the file is open, the command opens one with the `Markdown Preview` factory and
   then scrolls to the corresponding block
8. The revealed block is brought into the viewport; heading anchors are used as the alignment target
   when an exact block match is unavailable

## Non-functional criteria

9. The extension activates with the exact console message
   `JupyterLab extension jupyterlab_edit_markdown_at_content_extension is activated!` (required by the
   Galata UI test)
10. No `docRegistry.addFileType()` calls - the extension must not compete with icon extensions
11. Mapping computation for a typical document (under ~2000 lines) completes without perceptible delay
    on the trigger action
12. `make install` succeeds and `jupyter labextension list` reports the extension as `OK`

## Known limitations (accepted)

- Line-precise mapping is best-effort. Accuracy degrades on duplicate adjacent text, deeply nested
  lists, and raw HTML blocks; in these cases the result falls back to the nearest preceding heading
- Inline-level precision (a specific word within a paragraph) is out of scope - the unit of mapping is
  the block

## Out of scope

- Live, continuous cursor-follow synchronisation (jump is explicit, on user action)
- Bidirectional scroll-linked panes that stay in sync while scrolling
- Server-side parsing or any server extension endpoint
- Inline (sub-paragraph) position mapping

## Verification approach

- Jest unit tests cover the source-mapping function against fixture markdown (well-formed, duplicate
  text, nested lists, code fences) asserting the resolved line for each case
- Playwright/Galata tests cover the two context-menu flows end to end: right-click preview → editor
  opens at the expected line, and right-click editor → preview scrolls to the expected block
