import { expect, test } from '@jupyterlab/galata';

/**
 * Don't load JupyterLab webpage before running the tests.
 * This is required to ensure we capture all log messages.
 */
test.use({ autoGoto: false });

test('should emit an activation console message', async ({ page }) => {
  const logs: string[] = [];

  page.on('console', message => {
    logs.push(message.text());
  });

  await page.goto();

  expect(
    logs.filter(
      s =>
        s ===
        'JupyterLab extension jupyterlab_edit_markdown_at_content_extension is activated!'
    )
  ).toHaveLength(1);
});

// Source whose rendered blocks are: h1 (line 0), p (line 2), h2 (line 4), p (line 6).
const MD = [
  '# Edit Markdown Test', // 0
  '', // 1
  'First paragraph here.', // 2
  '', // 3
  '## Second Section', // 4
  '', // 5
  'Final paragraph here.' // 6
].join('\n');

const FILE = 'edit-md-content.md';

// One markdown cell, kernelspec named so opening does not prompt for a kernel.
const FILE_NOTEBOOK = 'edit-md-content.ipynb';
const NOTEBOOK = JSON.stringify({
  cells: [
    {
      cell_type: 'markdown',
      metadata: {},
      source: ['# Not a preview']
    }
  ],
  metadata: {
    kernelspec: {
      display_name: 'Python 3',
      language: 'python',
      name: 'python3'
    }
  },
  nbformat: 4,
  nbformat_minor: 5
});

async function writeAndOpen(
  page: any,
  factory: 'Markdown Preview' | 'Editor'
): Promise<void> {
  await page.contents.uploadContent(MD, 'text', FILE);
  await page.evaluate(
    async (args: { path: string; factory: string }) => {
      await (window as any).jupyterapp.commands.execute(
        'docmanager:open',
        args
      );
    },
    { path: FILE, factory }
  );
}

test.describe('edit-at-content flows', () => {
  test.afterEach(async ({ page }) => {
    await page.contents.deleteFile(FILE).catch(() => undefined);
    await page.contents.deleteFile(FILE_NOTEBOOK).catch(() => undefined);
  });

  test('Flow 1: Preview -> Editor lands the cursor on the clicked block', async ({
    page
  }) => {
    await page.goto();
    await writeAndOpen(page, 'Markdown Preview');

    const para = page.locator(
      '.jp-MarkdownViewer .jp-RenderedMarkdown p:has-text("Final paragraph here.")'
    );
    await para.waitFor();
    await para.click({ button: 'right' });
    await page
      .locator('.lm-Menu-itemLabel:has-text("Show Markdown Editor")')
      .click();

    // ACC-PTOE-2: the editor opens.
    await page.locator('.jp-FileEditor').waitFor({ timeout: 30000 });

    // ACC-PTOE-3: the cursor lands on the clicked block's source line (line 6,
    // 0-based: "Final paragraph here."). Read it from the editor API rather
    // than a focus-dependent DOM class.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const w = (window as any).jupyterapp.shell.currentWidget;
            const ed = w && w.content && w.content.editor;
            return ed && ed.getCursorPosition
              ? ed.getCursorPosition().line
              : -1;
          }),
        { timeout: 15000 }
      )
      .toBe(6);
  });

  test('Flow 2: Editor -> Preview scrolls the matching block into view', async ({
    page
  }) => {
    await page.goto();
    await writeAndOpen(page, 'Editor');

    // Place the cursor on the final paragraph (source line 6).
    const line = page.locator(
      '.jp-FileEditor .cm-line:has-text("Final paragraph here.")'
    );
    await line.waitFor();
    await line.click();

    await page.locator('.jp-FileEditor').click({ button: 'right' });
    await page
      .locator('.lm-Menu-itemLabel:has-text("Reveal in Markdown Preview")')
      .click();

    const para = page.locator(
      '.jp-MarkdownViewer .jp-RenderedMarkdown p:has-text("Final paragraph here.")'
    );
    await para.waitFor();
    await expect(para).toBeInViewport();
  });

  test('negative: no "Show Markdown Editor" on a rendered notebook markdown cell', async ({
    page
  }) => {
    await page.goto();
    // Written and opened rather than built with page.notebook.createNew():
    // that helper always waits for the kernel-selection dialog, which never
    // appears where `autoStartDefaultKernel` is true (a prefix-level
    // overrides.json can set it, and JUPYTER_CONFIG_DIR does not mask that).
    // A markdown cell in a saved notebook opens already rendered, so this
    // needs neither a dialog nor a running kernel.
    await page.contents.uploadContent(NOTEBOOK, 'text', FILE_NOTEBOOK);
    await page.evaluate(async (path: string) => {
      await (window as any).jupyterapp.commands.execute('docmanager:open', {
        path,
        factory: 'Notebook'
      });
    }, FILE_NOTEBOOK);

    const rendered = page.locator(
      '.jp-MarkdownCell .jp-RenderedMarkdown:has-text("Not a preview")'
    );
    await rendered.waitFor();
    await rendered.click({ button: 'right' });

    // toBeHidden, not toHaveCount(0): Lumino renders every context-menu item
    // it was given and marks the ones whose command reports isVisible false
    // with `lm-mod-hidden`, so core's entry is in the DOM either way. What
    // must hold is that it is not offered.
    await expect(
      page.locator('.lm-Menu-itemLabel:has-text("Show Markdown Editor")')
    ).toBeHidden();
    await page.keyboard.press('Escape');
  });

  test('does not warn that the markdownviewer:edit menu entry is duplicated', async ({
    page
  }) => {
    // The extension no longer declares a schema context entry for
    // markdownviewer:edit, so core's menu reconcile must not warn that the
    // entry is duplicated. Capture warnings across load and the first context
    // menu open (the reconcile is lazy in some builds).
    const warnings: string[] = [];
    page.on('console', message => {
      if (message.type() === 'warning' || message.type() === 'error') {
        warnings.push(message.text());
      }
    });

    await page.goto();
    await writeAndOpen(page, 'Markdown Preview');

    const para = page.locator(
      '.jp-MarkdownViewer .jp-RenderedMarkdown p:has-text("Final paragraph here.")'
    );
    await para.waitFor();
    await para.click({ button: 'right' });
    await page.locator('.lm-Menu').first().waitFor();
    await page.keyboard.press('Escape');

    expect(
      warnings.filter(
        w => w.includes('markdownviewer:edit') && w.includes('duplicated')
      )
    ).toHaveLength(0);
  });
});

// A document long enough to require scrolling in both panes. Block 0 is the
// "Heading 1" h2 at source line 0; the last heading is "Heading 30".
const MD_LONG = Array.from(
  { length: 30 },
  (_, i) =>
    `## Heading ${i + 1}\n\nBody paragraph ${i + 1} with padding so the document scrolls in both panes.\n`
).join('\n');

const FILE_LONG = 'edit-md-content-long.md';

async function writeAndOpenContent(
  page: any,
  content: string,
  path: string,
  factory: 'Markdown Preview' | 'Editor'
): Promise<void> {
  await page.contents.uploadContent(content, 'text', path);
  await page.evaluate(
    async (args: { path: string; factory: string }) => {
      await (window as any).jupyterapp.commands.execute(
        'docmanager:open',
        args
      );
    },
    { path, factory }
  );
}

/** Right-click the rendered block and invoke "Show Markdown Editor". */
async function showEditorFor(page: any, blockSelector: string): Promise<void> {
  const block = page.locator(blockSelector);
  await block.waitFor();
  await block.click({ button: 'right' });
  await page
    .locator('.lm-Menu-itemLabel:has-text("Show Markdown Editor")')
    .click();
  await page.locator('.jp-FileEditor').waitFor({ timeout: 30000 });
}

/** 0-based index of the first preview block whose bottom is below the host top. */
function previewTopBlockText(): string {
  const pv = Array.from(document.querySelectorAll('.jp-MarkdownViewer')).find(
    (v: any) => v.offsetParent !== null
  ) as HTMLElement;
  const host = pv.querySelector('.jp-RenderedMarkdown') as HTMLElement;
  const top = host.getBoundingClientRect().top;
  const kids = Array.from(host.children);
  const i = kids.findIndex(k => k.getBoundingClientRect().bottom > top + 4);
  return (kids[i]?.textContent ?? '').replace('¶', '').trim();
}

test.describe('override and synced scrolling', () => {
  test.afterEach(async ({ page }) => {
    await page.contents.deleteFile(FILE).catch(() => undefined);
    await page.contents.deleteFile(FILE_LONG).catch(() => undefined);
  });

  test('override: a single "Show Markdown Editor" opens the editor split-right', async ({
    page
  }) => {
    await page.goto();
    await writeAndOpen(page, 'Markdown Preview');

    const para = page.locator(
      '.jp-MarkdownViewer .jp-RenderedMarkdown p:has-text("Final paragraph here.")'
    );
    await para.waitFor();
    await para.click({ button: 'right' });

    // Core contributes the only "Show Markdown Editor" item; the extension no
    // longer adds a second one, so exactly one remains.
    await expect(
      page.locator('.lm-Menu-itemLabel:has-text("Show Markdown Editor")')
    ).toHaveCount(1);

    await page
      .locator('.lm-Menu-itemLabel:has-text("Show Markdown Editor")')
      .click();
    await page.locator('.jp-FileEditor').waitFor({ timeout: 30000 });

    // Both panes visible, editor to the right of the preview (split-right).
    const layout = await page.evaluate(() => {
      const ed = Array.from(document.querySelectorAll('.jp-FileEditor')).find(
        (f: any) => f.offsetParent !== null
      ) as HTMLElement;
      const pv = Array.from(
        document.querySelectorAll('.jp-MarkdownViewer')
      ).find((v: any) => v.offsetParent !== null) as HTMLElement;
      return {
        both: !!ed && !!pv,
        editorRightOfPreview:
          ed.getBoundingClientRect().left > pv.getBoundingClientRect().left
      };
    });
    expect(layout.both).toBe(true);
    expect(layout.editorRightOfPreview).toBe(true);
  });

  test('opening from a mid-document block puts that line near the top of the editor', async ({
    page
  }) => {
    await page.goto();
    await writeAndOpenContent(page, MD_LONG, FILE_LONG, 'Markdown Preview');
    await showEditorFor(
      page,
      '.jp-MarkdownViewer .jp-RenderedMarkdown h2:has-text("Heading 15")'
    );

    // Key assumption: the clicked heading lands near the TOP of the editor
    // viewport (not at the bottom). Allow a small offset - the blank separator
    // line can occupy the first row - by asserting the heading sits within the
    // top quarter of the viewport. Returns a large number if it is not visible
    // so the assertion fails rather than passing vacuously.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const ed = Array.from(
              document.querySelectorAll('.jp-FileEditor')
            ).find((f: any) => f.offsetParent !== null) as HTMLElement;
            const sc = ed.querySelector('.cm-scroller') as HTMLElement;
            const scRect = sc.getBoundingClientRect();
            const heading = Array.from(ed.querySelectorAll('.cm-line')).find(
              l => l.textContent?.trim() === '## Heading 15'
            );
            if (!heading) {
              return 999;
            }
            const r = heading.getBoundingClientRect();
            // Fraction of the viewport height between the top and the heading.
            return (r.top - scRect.top) / scRect.height;
          }),
        { timeout: 15000 }
      )
      .toBeLessThan(0.25);
  });

  test('opening from empty space resolves to the nearest block', async ({
    page
  }) => {
    await page.goto();
    await writeAndOpenContent(page, MD_LONG, FILE_LONG, 'Markdown Preview');

    const heading = page.locator(
      '.jp-MarkdownViewer .jp-RenderedMarkdown h2:has-text("Heading 15")'
    );
    await heading.waitFor();

    // A right-click on empty space resolves to the host element itself, not a
    // child block; the extension must still resolve it to the nearest block by
    // Y rather than open at line 0. Synthesise that condition directly: dispatch
    // a contextmenu whose target IS the host (the extension's capture-phase
    // listener stashes the host + clientY) with the click Y inside the Heading
    // 15 band, then run core's `markdownviewer:edit` - the command whose
    // execution the extension hooks to reposition the editor. This avoids
    // depending on rendered margin sizes to manufacture an empty-space pixel,
    // which collapses to near-zero in some environments.
    const found = await page.evaluate(async () => {
      const pv = Array.from(
        document.querySelectorAll('.jp-MarkdownViewer')
      ).find((v: any) => v.offsetParent !== null) as HTMLElement;
      const host = pv.querySelector('.jp-RenderedMarkdown') as HTMLElement;
      const h = Array.from(host.children).find(
        k => k.tagName === 'H2' && k.textContent?.includes('Heading 15')
      ) as HTMLElement;
      if (!h) {
        return false;
      }
      const r = h.getBoundingClientRect();
      host.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          clientX: Math.round(r.left + r.width / 2),
          clientY: Math.round(r.top + r.height / 2)
        })
      );
      await (window as any).jupyterapp.commands.execute('markdownviewer:edit');
      return true;
    });
    expect(found).toBe(true);
    await page.locator('.jp-FileEditor').waitFor({ timeout: 30000 });

    // The editor opened and the cursor landed on the nearest block (the heading).
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const w = (window as any).jupyterapp.shell.currentWidget;
            const ed = w && w.content && w.content.editor;
            if (!ed) {
              return '';
            }
            return ed.getLine(ed.getCursorPosition().line) ?? '';
          }),
        { timeout: 15000 }
      )
      .toBe('## Heading 15');
  });

  test('sync: scrolling the focused editor drives the preview', async ({
    page
  }) => {
    await page.goto();
    await writeAndOpenContent(page, MD_LONG, FILE_LONG, 'Markdown Preview');
    await showEditorFor(
      page,
      '.jp-MarkdownViewer .jp-RenderedMarkdown h2:has-text("Heading 30")'
    );

    // Claim the editor (wheel) and scroll it to the top.
    await page.evaluate(() => {
      const ed = Array.from(document.querySelectorAll('.jp-FileEditor')).find(
        (f: any) => f.offsetParent !== null
      ) as HTMLElement;
      ed.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
      const sc = ed.querySelector('.cm-scroller') as HTMLElement;
      sc.scrollTop = 0;
      sc.dispatchEvent(new Event('scroll'));
    });

    // The preview follows to the top of the document.
    await expect
      .poll(async () => page.evaluate(previewTopBlockText), { timeout: 15000 })
      .toBe('Heading 1');
  });

  test('sync: a pane that is not focused does not drive the other', async ({
    page
  }) => {
    await page.goto();
    await writeAndOpenContent(page, MD_LONG, FILE_LONG, 'Markdown Preview');
    await showEditorFor(
      page,
      '.jp-MarkdownViewer .jp-RenderedMarkdown h2:has-text("Heading 30")'
    );

    // Editor is the driver (just opened + focused); scroll it to a known spot.
    await page.evaluate(() => {
      const ed = Array.from(document.querySelectorAll('.jp-FileEditor')).find(
        (f: any) => f.offsetParent !== null
      ) as HTMLElement;
      ed.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
      const sc = ed.querySelector('.cm-scroller') as HTMLElement;
      sc.scrollTop = Math.round(sc.scrollHeight / 2);
      sc.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(500);
    const editorScrollTop = await page.evaluate(() => {
      const ed = Array.from(document.querySelectorAll('.jp-FileEditor')).find(
        (f: any) => f.offsetParent !== null
      ) as HTMLElement;
      return Math.round(
        (ed.querySelector('.cm-scroller') as HTMLElement).scrollTop
      );
    });

    // Scroll the preview WITHOUT claiming it (no wheel/pointer): the editor
    // must not move, because only the focused pane drives.
    await page.evaluate(() => {
      const pv = Array.from(
        document.querySelectorAll('.jp-MarkdownViewer')
      ).find((v: any) => v.offsetParent !== null) as HTMLElement;
      const host = pv.querySelector('.jp-RenderedMarkdown') as HTMLElement;
      let el: HTMLElement | null = host;
      while (el && el.scrollHeight <= el.clientHeight + 2) {
        el = el.parentElement;
      }
      if (el) {
        el.scrollTop = 0;
        el.dispatchEvent(new Event('scroll'));
      }
    });
    await page.waitForTimeout(700);

    const editorScrollTopAfter = await page.evaluate(() => {
      const ed = Array.from(document.querySelectorAll('.jp-FileEditor')).find(
        (f: any) => f.offsetParent !== null
      ) as HTMLElement;
      return Math.round(
        (ed.querySelector('.cm-scroller') as HTMLElement).scrollTop
      );
    });
    expect(editorScrollTopAfter).toBe(editorScrollTop);
  });
});

// A front-mattered document. MarkdownViewer renders with hideFrontMatter:true,
// so the rendered host has NO child for the front matter - lexing the raw
// source would count four extra blocks and shift every ordinal.
// Lines: 0 ---, 1 title, 2 author, 3 ---, 4 blank, 5 ## Alpha, 6 blank,
// 7 Body alpha., 8 blank, 9 ## Beta, 10 blank, 11 Body beta.
const MD_FRONT = [
  '---', // 0
  'title: Test', // 1
  'author: me', // 2
  '---', // 3
  '', // 4
  '## Alpha', // 5
  '', // 6
  'Body alpha.', // 7
  '', // 8
  '## Beta', // 9
  '', // 10
  'Body beta.' // 11
].join('\n');

const FILE_FRONT = 'edit-md-content-front.md';

// One `html` token, two rendered children - the source-vs-rendered divergence
// that makes a DOM ordinal meaningless.
const MD_DIVERGENT = [
  '# Divergent', // 0
  '', // 1
  '<div>alpha</div>', // 2
  '<div>beta</div>', // 3
  '', // 4
  'Trailing paragraph.' // 5
].join('\n');

const FILE_DIVERGENT = 'edit-md-content-divergent.md';

/** 0-based cursor line of the shell's current widget, or -1. */
function currentCursorLine(): number {
  const w = (window as any).jupyterapp.shell.currentWidget;
  const ed = w && w.content && w.content.editor;
  return ed && ed.getCursorPosition ? ed.getCursorPosition().line : -1;
}

test.describe('edit-time sync and mapping fidelity', () => {
  test.afterEach(async ({ page }) => {
    await page.contents.deleteFile(FILE_LONG).catch(() => undefined);
    await page.contents.deleteFile(FILE_FRONT).catch(() => undefined);
    await page.contents.deleteFile(FILE_DIVERGENT).catch(() => undefined);
  });

  test('ACC-SYNC-20/21: editing the source holds the preview on the edited block', async ({
    page
  }) => {
    await page.goto();
    await writeAndOpenContent(page, MD_LONG, FILE_LONG, 'Markdown Preview');
    await showEditorFor(
      page,
      '.jp-MarkdownViewer .jp-RenderedMarkdown h2:has-text("Heading 15")'
    );

    // Wait for the reposition to land before typing - showEditorFor returns at
    // widget attach, while the extension repositions after `revealed`.
    await expect
      .poll(async () => page.evaluate(previewTopBlockText), { timeout: 15000 })
      .toBe('Heading 15');

    // Type at the caret, which sits on the "## Heading 15" line. The viewer
    // re-renders on its own debounce and replaces every child of the rendered
    // host; before the fix nothing re-aligned the preview afterwards and it
    // jumped away. The preview must still be showing the block being edited.
    await page.keyboard.press('End');
    await page.keyboard.type(' EDITED');

    await expect
      .poll(async () => page.evaluate(previewTopBlockText), { timeout: 20000 })
      .toBe('Heading 15 EDITED');
  });

  test('ACC-PTOE-6: a source/rendered mismatch warns and leaves the editor at the top', async ({
    page
  }) => {
    const warnings: string[] = [];
    page.on('console', message => {
      if (message.type() === 'warning') {
        warnings.push(message.text());
      }
    });

    await page.goto();
    await writeAndOpenContent(
      page,
      MD_DIVERGENT,
      FILE_DIVERGENT,
      'Markdown Preview'
    );

    // Two <div> children come from ONE html token, so the DOM child count
    // exceeds the lexed block count and no ordinal can be trusted.
    await showEditorFor(
      page,
      '.jp-MarkdownViewer .jp-RenderedMarkdown div:has-text("beta")'
    );

    await expect
      .poll(
        async () =>
          warnings.filter(w => w.includes('the source lexes to')).length,
        { timeout: 15000 }
      )
      .toBeGreaterThan(0);

    // Core's plain open stands: line 0, not a confidently wrong line.
    expect(await page.evaluate(currentCursorLine)).toBe(0);
  });

  test('front matter: the cursor lands on the clicked heading, not inside the YAML', async ({
    page
  }) => {
    await page.goto();
    await writeAndOpenContent(page, MD_FRONT, FILE_FRONT, 'Markdown Preview');
    await showEditorFor(
      page,
      '.jp-MarkdownViewer .jp-RenderedMarkdown h2:has-text("Beta")'
    );

    await expect
      .poll(async () => page.evaluate(currentCursorLine), { timeout: 15000 })
      .toBe(9);
  });
});
