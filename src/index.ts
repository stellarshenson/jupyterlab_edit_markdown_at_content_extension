import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { IEditorTracker } from '@jupyterlab/fileeditor';

import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';

import {
  buildBlockMap,
  blockToLine,
  lineToBlock,
  headingSlug
} from './mapping';

const PLUGIN_ID = 'jupyterlab_edit_markdown_at_content_extension:plugin';
const CMD_EDIT_AT = 'editmarkdownatcontent:edit-at-location';
const CMD_REVEAL_IN = 'editmarkdownatcontent:reveal-in-preview';

const PREVIEW_SELECTOR = '.jp-MarkdownViewer .jp-RenderedMarkdown';
const EDITOR_SELECTOR = '.jp-FileEditor';
const EDITOR_FACTORY = 'Editor';
const PREVIEW_FACTORY = 'Markdown Preview';

const LOG = '[edit-markdown-at-content]';

/**
 * Initialization data for the jupyterlab_edit_markdown_at_content_extension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description:
    'Jupyterlab extension to save you the scrolling time from when you are at markdown file location and open editor and need to scroll to the exact place in the file where the content is. This extension opens the editor at the place where the content is',
  autoStart: true,
  requires: [IDocumentManager, IEditorTracker, IMarkdownViewerTracker],
  activate: (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    editorTracker: IEditorTracker,
    markdownTracker: IMarkdownViewerTracker
  ) => {
    console.log(
      'JupyterLab extension jupyterlab_edit_markdown_at_content_extension is activated!'
    );

    // Lumino commands receive no DOM target, so a single capture-phase
    // listener stashes the right-clicked node for both directions.
    let lastPreviewTarget: Element | null = null;
    let lastEditorTarget: Element | null = null;

    document.addEventListener(
      'contextmenu',
      (event: MouseEvent) => {
        const target = event.target as Element | null;
        lastPreviewTarget = target?.closest?.(PREVIEW_SELECTOR) ? target : null;
        lastEditorTarget = target?.closest?.(EDITOR_SELECTOR) ? target : null;
      },
      true
    );

    /** The MarkdownDocument widget whose rendered host contains `target`. */
    const findPreviewWidget = (target: Element): any | null => {
      let found: any | null = null;
      markdownTracker.forEach(widget => {
        if (!found && widget.node.contains(target)) {
          found = widget;
        }
      });
      return found;
    };

    /** The FileEditor document widget whose node contains `target`. */
    const findEditorWidget = (target: Element): any | null => {
      let found: any | null = null;
      editorTracker.forEach(widget => {
        if (!found && widget.node.contains(target)) {
          found = widget;
        }
      });
      return found ?? editorTracker.currentWidget;
    };

    /** The `.jp-RenderedMarkdown` host element inside a preview/editor widget. */
    const renderedHost = (widget: any): HTMLElement | null =>
      widget?.node?.querySelector('.jp-RenderedMarkdown') ?? null;

    // ---- Preview -> Editor -------------------------------------------------
    app.commands.addCommand(CMD_EDIT_AT, {
      label: 'Edit at this location',
      execute: async () => {
        const target = lastPreviewTarget;
        if (!target) {
          console.warn(`${LOG} no markdown preview target under the cursor`);
          return;
        }
        const widget = findPreviewWidget(target);
        if (!widget) {
          console.warn(`${LOG} could not resolve the owning Markdown Preview`);
          return;
        }
        const host = renderedHost(widget);
        if (!host) {
          console.warn(`${LOG} rendered host not found`);
          return;
        }

        // Walk up to the top-level block (direct child of the host).
        let block: Element | null = target;
        while (block && block.parentElement !== host) {
          block = block.parentElement;
        }
        if (!block) {
          console.warn(`${LOG} clicked content is not a rendered block`);
          return;
        }
        const ordinal = Array.from(host.children).indexOf(block);
        const source: string = widget.context.model.toString();
        const line = blockToLine(source, ordinal);
        if (line < 0) {
          console.warn(`${LOG} block ordinal ${ordinal} is not mappable`);
          return;
        }

        const editorWidget: any = docManager.openOrReveal(
          widget.context.path,
          EDITOR_FACTORY
        );
        if (!editorWidget) {
          return;
        }
        await editorWidget.context.ready;
        await editorWidget.revealed;
        const editor = editorWidget.content.editor;
        const clamped = Math.min(line, editor.lineCount - 1);
        editor.setCursorPosition({ line: clamped, column: 0 });
        editor.revealPosition({ line: clamped, column: 0 });
      }
    });
    app.contextMenu.addItem({
      command: CMD_EDIT_AT,
      selector: PREVIEW_SELECTOR,
      rank: 0
    });

    // ---- Editor -> Preview -------------------------------------------------
    app.commands.addCommand(CMD_REVEAL_IN, {
      label: 'Reveal in Markdown Preview',
      execute: async () => {
        const target = lastEditorTarget;
        if (!target) {
          console.warn(`${LOG} no editor target under the cursor`);
          return;
        }
        const widget = findEditorWidget(target);
        if (!widget) {
          console.warn(`${LOG} could not resolve the owning file editor`);
          return;
        }
        const editor = widget.content.editor;
        const line = editor.getCursorPosition().line;
        const source: string = widget.context.model.toString();
        const {
          ordinal,
          headingSlug: slug,
          headingNth
        } = lineToBlock(source, line);

        const previewWidget: any = docManager.openOrReveal(
          widget.context.path,
          PREVIEW_FACTORY
        );
        if (!previewWidget) {
          return;
        }
        await previewWidget.context.ready;
        await previewWidget.revealed;
        const host = renderedHost(previewWidget);
        if (!host) {
          console.warn(`${LOG} rendered preview host not found`);
          return;
        }

        const children = Array.from(host.children);
        const expected = buildBlockMap(source).blocks.length;
        if (children.length === expected && ordinal >= 0) {
          children[ordinal].scrollIntoView({ block: 'start' });
          return;
        }

        // Fallback (AC #8): ordinal alignment is unreliable (math, sanitizer,
        // injected nodes). Re-derive heading ids from the live headings and
        // scroll to the headingNth-th match.
        if (slug) {
          const headings = Array.from(
            host.querySelectorAll('h1, h2, h3, h4, h5, h6')
          );
          let seen = 0;
          for (const h of headings) {
            // rendermime stores createHeaderId in `id` (trusted) or
            // `data-jupyter-id` (untrusted); the live textContent also contains
            // the appended '¶' anchor, so prefer the stored attribute.
            const id =
              (h as HTMLElement).id ||
              h.getAttribute('data-jupyter-id') ||
              headingSlug(h.textContent ?? '');
            if (id === slug) {
              seen += 1;
              if (seen === (headingNth ?? 1)) {
                h.scrollIntoView({ block: 'start' });
                return;
              }
            }
          }
        }
        console.warn(`${LOG} could not align preview to line ${line}`);
      }
    });
    app.contextMenu.addItem({
      command: CMD_REVEAL_IN,
      selector: EDITOR_SELECTOR,
      rank: 0
    });
  }
};

export default plugin;
