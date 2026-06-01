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

    // AC #2: the editor opens.
    await page.locator('.jp-FileEditor').waitFor({ timeout: 30000 });

    // AC #3: the cursor lands on the clicked block's source line (line 6,
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
    await page.notebook.createNew();
    await page.notebook.setCell(0, 'markdown', '# Not a preview');
    await page.notebook.runCell(0);

    const rendered = page.locator(
      '.jp-MarkdownCell .jp-RenderedMarkdown:has-text("Not a preview")'
    );
    await rendered.waitFor();
    await rendered.click({ button: 'right' });

    await expect(
      page.locator('.lm-Menu-itemLabel:has-text("Show Markdown Editor")')
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
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

    // Core's identically named item is disabled, so exactly one remains.
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

    // Right-click the empty margin just below the heading - the host element
    // itself, not a child block. Before the fix the command bailed here
    // ("clicked content is not a rendered block") and nothing opened.
    const pt = await page.evaluate(() => {
      const pv = Array.from(
        document.querySelectorAll('.jp-MarkdownViewer')
      ).find((v: any) => v.offsetParent !== null) as HTMLElement;
      const host = pv.querySelector('.jp-RenderedMarkdown') as HTMLElement;
      const h = Array.from(host.children).find(
        k => k.tagName === 'H2' && k.textContent?.includes('Heading 15')
      ) as HTMLElement;
      const r = h.getBoundingClientRect();
      const next = (
        h.nextElementSibling as HTMLElement
      ).getBoundingClientRect();
      const hostR = host.getBoundingClientRect();
      const x = Math.round(hostR.left + hostR.width / 2);
      // First third of the inter-block gap: in the host, closest to the heading.
      const y = Math.round(r.bottom + Math.max(2, (next.top - r.bottom) / 3));
      return { x, y, onHost: document.elementFromPoint(x, y) === host };
    });
    // Precondition: the click really lands on the host, exercising the fallback.
    expect(pt.onHost).toBe(true);

    await page.mouse.click(pt.x, pt.y, { button: 'right' });
    await page
      .locator('.lm-Menu-itemLabel:has-text("Show Markdown Editor")')
      .click();
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
