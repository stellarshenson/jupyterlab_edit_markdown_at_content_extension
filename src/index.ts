import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { IEditorTracker } from '@jupyterlab/fileeditor';

import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { EditorView } from '@codemirror/view';

import { buildBlockMap, blockToLine, lineToBlock } from './mapping';

const PLUGIN_ID = 'jupyterlab_edit_markdown_at_content_extension:plugin';
const CORE_EDIT_COMMAND = 'markdownviewer:edit';
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
    // Direct children only: `lineToBlock` counts TOP-LEVEL heading tokens, so a
    // heading nested in a blockquote or list must not consume an occurrence
    // here or `headingNth` selects the wrong one. Rendermime always sets `id`
    // or `data-jupyter-id`, so there is no third fallback to try - and a
    // textContent-derived slug could not match anyway, since `headerAnchors`
    // appends its own anchor mark inside the heading.
    const headings = Array.from(
      host.querySelectorAll(
        ':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6'
      )
    );
    let seen = 0;
    for (const h of headings) {
      const id =
        (h as HTMLElement).id || h.getAttribute('data-jupyter-id') || '';
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
      // No `currentWidget` fallback. This command is driven by the element the
      // user right-clicked, so resolving to "some other editor" is never the
      // right answer - CodeMirror recycles `.cm-line` nodes, and a detached
      // target would silently preview a different file. Bail instead, matching
      // the preview direction's policy.
      return found;
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

      // The source the preview's DOM was actually built from. Ordinals are DOM
      // indices, so they are only meaningful against THIS string - the live
      // model runs ahead of the render by the viewer's debounce, and reading it
      // instead is what made the block counts diverge on every keystroke.
      let renderedSource: string = editorWidget.context.model.toString();

      const claimEditor = () => {
        driver = 'editor';
      };
      const claimPreview = () => {
        driver = 'preview';
      };

      const onEditorScroll = () => {
        if (!trackEnabled || driver !== 'editor') {
          return;
        }
        const host = renderedHost(previewWidget);
        if (!host || previewWidget.isDisposed || editorWidget.isDisposed) {
          return;
        }
        revealLineInPreview(host, renderedSource, editorTopLine(editor));
      };

      const onPreviewScroll = () => {
        if (!trackEnabled || driver !== 'preview') {
          return;
        }
        const host = renderedHost(previewWidget);
        if (!host || previewWidget.isDisposed || editorWidget.isDisposed) {
          return;
        }
        const line = blockToLine(renderedSource, previewTopOrdinal(host));
        if (line >= 0) {
          scrollEditorToTop(editor, line);
        }
      };

      // Typing fires no scroll event, but the viewer re-renders on its own
      // debounce and replaces every child of the rendered host - which throws
      // away the preview's scroll offset with nothing to restore it. That is
      // the desync (DEF-SYNC-1). Re-align the preview to the line the editor is
      // showing as soon as the new DOM exists, so an edit holds position
      // instead of jumping (ACC-SYNC-20), against a block map rebuilt from the
      // source that DOM was just built from (ACC-SYNC-21).
      const onPreviewRendered = () => {
        if (previewWidget.isDisposed || editorWidget.isDisposed) {
          return;
        }
        renderedSource = editorWidget.context.model.toString();
        if (!trackEnabled || driver !== 'editor') {
          return;
        }
        const host = renderedHost(previewWidget);
        if (!host) {
          return;
        }
        revealLineInPreview(host, renderedSource, editorTopLine(editor));
      };
      previewWidget.content.rendered.connect(onPreviewRendered);

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
        previewWidget.content.rendered.disconnect(onPreviewRendered);
        // Disconnect from both signals, not just the one that fired. Closing
        // only the preview leaves this closure - and the detached preview DOM
        // it captures - alive on the surviving editor's `disposed` signal, and
        // re-pairing adds another. Lumino's disconnect is idempotent, so a
        // second run of cleanup is harmless.
        editorWidget.disposed.disconnect(cleanup);
        previewWidget.disposed.disconnect(cleanup);
        editorWidget.__emacSynced = false;
      };
      editorWidget.disposed.connect(cleanup);
      previewWidget.disposed.connect(cleanup);
    };

    // ---- Preview -> Editor -------------------------------------------------
    // JupyterLab core already contributes "Show Markdown Editor"
    // (`markdownviewer:edit`) to the rendered-preview context menu, but it
    // always opens the editor at line 0. Rather than add a second, identically
    // labelled item and disable core's - which makes core's menu reconcile warn
    // that the entry is duplicated - we let core's single item open the editor
    // and, right after it runs, reposition that editor to the clicked line and
    // wire up the scroll sync. This is a no-op unless the command was invoked
    // from a right-click on a rendered preview, so core's plain line-0
    // behaviour still stands for palette or toolbar invocations.
    const editAtClickedLocation = async (): Promise<void> => {
      const target = lastPreviewTarget;
      lastPreviewTarget = null; // single-use: consume this right-click
      if (!target || !target.isConnected) {
        return;
      }
      const widget = findPreviewWidget(target);
      if (!widget) {
        return;
      }
      // Only reposition for the preview core actually edited - the markdown
      // viewer tracker's current widget. Right-clicking a preview activates it,
      // so the genuine flow always matches; a stale or divergent target then
      // degrades to core's plain line-0 open instead of repositioning the wrong
      // editor or opening a second one for a different file.
      if (widget !== markdownTracker.currentWidget) {
        return;
      }
      // Resolve the host from the target's own rendered ancestor (closest
      // includes the target itself), so a click on the host element resolves
      // the same host rather than the widget's first matching node.
      const host =
        (target.closest('.jp-RenderedMarkdown') as HTMLElement | null) ??
        renderedHost(widget);
      if (!host) {
        return;
      }

      // Walk up to the top-level block (direct child of the host). When the
      // click landed on the host itself (empty space between or beside blocks),
      // fall back to the block nearest the click Y.
      let block: Element | null = target;
      while (block && block.parentElement !== host) {
        block = block.parentElement;
      }
      const ordinal = block
        ? Array.from(host.children).indexOf(block)
        : nearestChildOrdinal(host, lastPreviewY);
      if (ordinal < 0) {
        return;
      }
      const source: string = widget.context.model.toString();
      // The ordinal is a DOM child index; it means nothing unless the lexed
      // block list has the same length. The two diverge when one token renders
      // as several elements (consecutive raw HTML), when the sanitizer drops a
      // token whole (`<script>`, `<style>`), or mid-edit while the viewer still
      // owes us a re-render. Repositioning on a divergent count lands the
      // cursor on a confidently wrong line, so degrade to core's plain line-0
      // open - the same choice this command already makes above when the
      // preview is not the tracker's current widget.
      const renderedCount = buildBlockMap(source).blocks.length;
      if (renderedCount !== host.children.length) {
        console.warn(
          `${LOG} rendered ${host.children.length} blocks but the source lexes to ${renderedCount}; left the editor at the top`
        );
        return;
      }
      const line = blockToLine(source, ordinal);
      if (line < 0) {
        console.warn(
          `${LOG} block ${ordinal} is out of range; left the editor at the top`
        );
        return;
      }

      // Core opened the editor split-right; openOrReveal returns that same
      // widget (idempotent by path + factory) and reveals it if side-by-side.
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
    };

    // Fire after core's "Show Markdown Editor" opens the editor.
    app.commands.commandExecuted.connect((_registry, executed) => {
      if (executed.id === CORE_EDIT_COMMAND) {
        // `context.ready` and `revealed` both reject when the document fails to
        // open (a file deleted server-side, say). Unhandled, that surfaces as an
        // "Uncaught (in promise)" with nothing naming this extension.
        void editAtClickedLocation().catch(err =>
          console.warn(`${LOG} could not reposition the editor`, err)
        );
      }
    });

    // ---- Editor -> Preview -------------------------------------------------
    app.commands.addCommand(CMD_REVEAL_IN, {
      label: 'Reveal in Markdown Preview',
      // `.jp-FileEditor` is on every file editor, and `openOrReveal` with an
      // explicit factory performs no file-type check - without this gate the
      // item appears in a .py or .json editor and renders that source as
      // markdown. Mirrors core's own gate on `fileeditor:markdown-preview`.
      isVisible: () => {
        const path = editorTracker.currentWidget?.context?.path;
        return typeof path === 'string' && path.toLowerCase().endsWith('.md');
      },
      execute: async () => {
        const target = lastEditorTarget;
        lastEditorTarget = null; // single-use: consume this right-click
        if (!target || !target.isConnected) {
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
    // Rank 12 seats this directly under core's "Show Markdown Preview" (rank
    // 11) instead of above Undo/Redo/Cut/Copy/Paste, which run 1-6.
    app.contextMenu.addItem({
      command: CMD_REVEAL_IN,
      selector: EDITOR_SELECTOR,
      rank: 12
    });
  }
};

export default plugin;
