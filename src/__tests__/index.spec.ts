declare const require: (module: string) => any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

/** index.ts source with comments stripped, for static regression checks. */
function indexSourceNoComments(): string {
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'index.ts'),
    'utf-8'
  );
  return source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('index - registry hygiene (AC #10)', () => {
  it('does not call docRegistry.addFileType (must not override icons)', () => {
    expect(indexSourceNoComments()).not.toMatch(/addFileType\s*\(/);
  });

  it('does not depend on IDocumentRegistry', () => {
    expect(indexSourceNoComments()).not.toMatch(/IDocumentRegistry/);
  });
});

describe('index - activation message (AC #9)', () => {
  it('logs the exact activation message the UI test expects', () => {
    expect(indexSourceNoComments()).toContain(
      'JupyterLab extension jupyterlab_edit_markdown_at_content_extension is activated!'
    );
  });
});
