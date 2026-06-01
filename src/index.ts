import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { IEditorTracker } from '@jupyterlab/fileeditor';

import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { EditorView } from '@codemirror/view';

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
 * Scroll a rendered preview `host` so the block that produced source `line` is
 * at the top. Tries ordinal alignment first; falls back to matching the
 * nearest-preceding heading by its createHeaderId slug when the rendered child
 * count diverges from the lexed block count (math, sanitizer, injected nodes).
 */
function revealLineInPreview(
  host: HTMLElement,
  source: string,
  line: number
): void {
  const { ordinal, headingSlug: slug, headingNth } = lineToBlock(source, line);
  const children = Array.from(host.children);
  const expected = buildBlockMap(source).blocks.length;
  if (children.length === expected && ordinal >= 0) {
    children[ordinal].scrollIntoView({ block: 'start' });
    return;
  }
  if (slug) {
    const headings = Array.from(
      host.querySelectorAll('h1, h2, h3, h4, h5, h6')
    );
    let seen = 0;
    for (const h of headings) {
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
}

/**
 * Initialization data for the jupyterlab_edit_markdown_at_content_extension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description:
    'Jupyterlab extension to save you the scrolling time from when you are at markdown file location and open editor and need to scroll to the exact place in the file where the content is. This extension opens the editor at the place where the content is',
  autoStart: true,
  requires: [IDocumentManager, IEditorTracker, IMarkdownViewerTracker],
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    editorTracker: IEditorTracker,
    markdownTracker: IMarkdownViewerTracker,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log(
      'JupyterLab extension jupyterlab_edit_markdown_at_content_extension is activated!'
    );

    // `trackEditor` (default true): keep the editor and preview scrolled
    // together once the editor is opened via the command. Read from settings;
    // defaults to enabled when no setting registry is available.
    let trackEnabled = true;
    if (settingRegistry) {
      settingRegistry
        .load(PLUGIN_ID)
        .then(settings => {
          const refresh = () => {
            trackEnabled = settings.get('trackEditor').composite !== false;
          };
          refresh();
          settings.changed.connect(refresh);
        })
        .catch(err => console.warn(`${LOG} could not load settings`, err));
    }

    // Lumino commands receive no DOM target, so a single capture-phase
    // listener stashes the right-clicked node for both directions. The click Y
    // is kept too, so a click on empty space (the host itself, between blocks
    // or in a line's right-hand whitespace) can resolve to the nearest block.
    let lastPreviewTarget: Element | null = null;
    let lastPreviewY = 0;
    let lastEditorTarget: Element | null = null;

    document.addEventListener(
      'contextmenu',
      (event: MouseEvent) => {
        const target = event.target as Element | null;
        lastPreviewTarget = target?.closest?.(PREVIEW_SELECTOR) ? target : null;
        lastPreviewY = event.clientY;
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

    /**
     * 0-based index of the host child nearest the click `y`. Distance is to the
     * child's vertical band, so a click inside a block returns that block and a
     * click in a gap returns the closer of the two neighbours. Returns -1 when
     * the host has no children.
     */
    const nearestChildOrdinal = (host: HTMLElement, y: number): number => {
      const kids = Array.from(host.children);
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < kids.length; i++) {
        const r = kids[i].getBoundingClientRect();
        const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    };

    /** 0-based index of the first preview block whose bottom is below the host top. */
    const previewTopOrdinal = (host: HTMLElement): number => {
      const top = host.getBoundingClientRect().top;
      const kids = Array.from(host.children);
      for (let i = 0; i < kids.length; i++) {
        if (kids[i].getBoundingClientRect().bottom > top + 4) {
          return i;
        }
      }
      return Math.max(0, kids.length - 1);
    };

    /** 0-based source line at the top of the editor viewport (CodeMirror view). */
    const editorTopLine = (editor: any): number => {
      try {
        const view = editor.editor; // CodeMirror EditorView
        const info = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
        return view.state.doc.lineAt(info.from).number - 1;
      } catch {
        return editor.getCursorPosition().line;
      }
    };

    /**
     * Scroll the editor so 0-based `line` sits at the top of the viewport.
     * Uses CodeMirror's own scrollIntoView effect (y: 'start'), which scrolls
     * on the measure cycle - correct even on a freshly opened editor whose line
     * heights are not yet measured. Near the document end CodeMirror clamps, so
     * the line sits as high as it can.
     */
    const scrollEditorToTop = (editor: any, line: number): void => {
      const clamped = Math.max(0, Math.min(line, editor.lineCount - 1));
      try {
        const view = editor.editor as EditorView;
        const pos = view.state.doc.line(clamped + 1).from;
        view.dispatch({
          effects: EditorView.scrollIntoView(pos, { y: 'start' })
        });
      } catch {
        editor.revealPosition({ line: clamped, column: 0 });
      }
    };

    /**
     * Bidirectional scroll sync between a preview and its editor, established
     * when the editor is opened via the command and `trackEditor` is on.
     *
     * The pane the user is interacting with (last pointer/wheel/focus) is the
     * sole driver; the other pane only follows. This avoids the feedback loop
     * where a follower's programmatic scroll would scroll the driver back, and
     * guarantees the follower is resolved to the driver's exact line rather
     * than nudged by a relative amount.
     */
    const establishSync = (previewWidget: any, editorWidget: any): void => {
      if (editorWidget.__emacSynced) {
        return;
      }
      editorWidget.__emacSynced = true;

      const editor = editorWidget.content.editor;
      // The editor was just focused on open, so it drives first.
      let driver: 'editor' | 'preview' = 'editor';

      const claimEditor = () => {
        driver = 'editor';
      };
      const claimPreview = () => {
        driver = 'preview';
      };

      const onEditorScroll = () => {
        if (driver !== 'editor') {
          return;
        }
        const host = renderedHost(previewWidget);
        if (!host || previewWidget.isDisposed || editorWidget.isDisposed) {
          return;
        }
        const source = editorWidget.context.model.toString();
        revealLineInPreview(host, source, editorTopLine(editor));
      };

      const onPreviewScroll = () => {
        if (driver !== 'preview') {
          return;
        }
        const host = renderedHost(previewWidget);
        if (!host || previewWidget.isDisposed || editorWidget.isDisposed) {
          return;
        }
        const source = editorWidget.context.model.toString();
        const line = blockToLine(source, previewTopOrdinal(host));
        if (line >= 0) {
          scrollEditorToTop(editor, line);
        }
      };

      // Pointer/wheel/focus on a pane (capture phase, before its scroll fires)
      // makes it the driver. Scroll events do not bubble but are seen in
      // capture, so one listener per widget node catches its inner scroller.
      const claimOpts = { capture: true, passive: true } as const;
      const ed = editorWidget.node;
      const pv = previewWidget.node;
      ed.addEventListener('pointerdown', claimEditor, claimOpts);
      ed.addEventListener('wheel', claimEditor, claimOpts);
      ed.addEventListener('focusin', claimEditor, claimOpts);
      pv.addEventListener('pointerdown', claimPreview, claimOpts);
      pv.addEventListener('wheel', claimPreview, claimOpts);
      pv.addEventListener('focusin', claimPreview, claimOpts);
      ed.addEventListener('scroll', onEditorScroll, claimOpts);
      pv.addEventListener('scroll', onPreviewScroll, claimOpts);

      const cleanup = () => {
        ed.removeEventListener('pointerdown', claimEditor, claimOpts as any);
        ed.removeEventListener('wheel', claimEditor, claimOpts as any);
        ed.removeEventListener('focusin', claimEditor, claimOpts as any);
        pv.removeEventListener('pointerdown', claimPreview, claimOpts as any);
        pv.removeEventListener('wheel', claimPreview, claimOpts as any);
        pv.removeEventListener('focusin', claimPreview, claimOpts as any);
        ed.removeEventListener('scroll', onEditorScroll, claimOpts as any);
        pv.removeEventListener('scroll', onPreviewScroll, claimOpts as any);
        editorWidget.__emacSynced = false;
      };
      editorWidget.disposed.connect(cleanup);
      previewWidget.disposed.connect(cleanup);
    };

    // ---- Preview -> Editor -------------------------------------------------
    // Labelled "Show Markdown Editor" to replace JupyterLab core's identically
    // named command (`markdownviewer:edit`), which always opens the editor at
    // line 0. The core context-menu item is disabled in `schema/plugin.json`,
    // so this position-aware command is the only one shown.
    app.commands.addCommand(CMD_EDIT_AT, {
      label: 'Show Markdown Editor',
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
        // Resolve the host from the target's own rendered ancestor (closest
        // includes the target itself), so a click on the host element resolves
        // the same host rather than the widget's first matching node.
        const host =
          (target.closest('.jp-RenderedMarkdown') as HTMLElement | null) ??
          renderedHost(widget);
        if (!host) {
          console.warn(`${LOG} rendered host not found`);
          return;
        }

        // Walk up to the top-level block (direct child of the host). When the
        // click landed on the host itself (empty space between or beside
        // blocks), fall back to the block nearest the click Y.
        let block: Element | null = target;
        while (block && block.parentElement !== host) {
          block = block.parentElement;
        }
        const ordinal = block
          ? Array.from(host.children).indexOf(block)
          : nearestChildOrdinal(host, lastPreviewY);
        if (ordinal < 0) {
          console.warn(`${LOG} clicked content is not a rendered block`);
          return;
        }
        const source: string = widget.context.model.toString();
        const line = blockToLine(source, ordinal);
        if (line < 0) {
          console.warn(`${LOG} block ordinal ${ordinal} is not mappable`);
          return;
        }

        // Match core's `markdownviewer:edit`: open the editor split-right when
        // it is not already open. When it is open (the side-by-side case), this
        // just reveals the existing editor and we scroll it below.
        const editorWidget: any = docManager.openOrReveal(
          widget.context.path,
          EDITOR_FACTORY,
          undefined,
          { mode: 'split-right' }
        );
        if (!editorWidget) {
          return;
        }
        await editorWidget.context.ready;
        await editorWidget.revealed;
        const editor = editorWidget.content.editor;
        const clamped = Math.min(line, editor.lineCount - 1);
        editor.setCursorPosition({ line: clamped, column: 0 });
        // Focus so the cursor is live (you asked to edit here), then scroll the
        // line to the TOP of the viewport. Near the end of the document the
        // browser clamps scrollTop, so the line sits as high as it can.
        editor.focus();
        scrollEditorToTop(editor, clamped);

        // Keep the two panes scrolled together from here on.
        if (trackEnabled) {
          establishSync(widget, editorWidget);
        }
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
        revealLineInPreview(host, source, line);
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
