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
    const logs: string[] = [];
    page.on('console', m => logs.push(m.text()));

    await page.goto();
    await writeAndOpen(page, 'Markdown Preview');

    const para = page.locator(
      '.jp-MarkdownViewer .jp-RenderedMarkdown p:has-text("Final paragraph here.")'
    );
    await para.waitFor();
    await para.click({ button: 'right' });
    await page
      .locator('.lm-Menu-itemLabel:has-text("Edit at this location")')
      .click();

    // Diagnose: did the editor open at all?
    try {
      await page.locator('.jp-FileEditor').waitFor({ timeout: 20000 });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(
        'EXT_LOGS:\n' +
          logs.filter(s => s.includes('edit-markdown-at-content')).join('\n')
      );
      throw e;
    }

    // The editor opened; assert the cursor line via the rendered active line.
    const activeLine = page.locator('.jp-FileEditor .cm-activeLine');
    await activeLine.waitFor({ timeout: 20000 });
    await expect(activeLine).toHaveText('Final paragraph here.');
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

  test('negative: no "Edit at this location" on a rendered notebook markdown cell', async ({
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
      page.locator('.lm-Menu-itemLabel:has-text("Edit at this location")')
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
  });
});
