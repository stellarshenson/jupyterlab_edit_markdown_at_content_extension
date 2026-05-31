import {
  buildBlockMap,
  blockToLine,
  lineToBlock,
  headingSlug
} from '../mapping';

/** Return the 0-based source line, for content-based assertions. */
function lineAt(src: string, n: number): string {
  return src.split('\n')[n];
}

describe('mapping - buildBlockMap', () => {
  it('orders blocks and starts the first block at line 0', () => {
    const src = '# Title\n\nFirst paragraph.\n';
    const { blocks } = buildBlockMap(src);
    expect(blocks[0].ordinal).toBe(0);
    expect(blocks[0].startLine).toBe(0);
    expect(blocks.map(b => b.ordinal)).toEqual([0, 1]);
  });
});

describe('mapping - cumulative line arithmetic across a fenced code block', () => {
  const src = [
    '# Title', // 0
    '', // 1
    'First paragraph.', // 2
    '', // 3
    '## Section', // 4
    '', // 5
    '```js', // 6
    'const a = 1;', // 7
    'const b = 2;', // 8
    '```', // 9
    '', // 10
    'After code paragraph.' // 11
  ].join('\n');

  it('lands each block on its true source line (verifies the accumulator)', () => {
    const { blocks } = buildBlockMap(src);
    const byType = (t: string) => blocks.filter(b => b.type === t);

    expect(blocks[0].startLine).toBe(0); // heading
    expect(lineAt(src, blockToLine(src, 1))).toBe('First paragraph.');
    // The paragraph AFTER the 4-line code fence must resolve to line 11,
    // not be off-by-N from naive +1-per-token counting.
    const lastPara = byType('paragraph').slice(-1)[0];
    expect(blockToLine(src, lastPara.ordinal)).toBe(11);
    expect(lineAt(src, 11)).toBe('After code paragraph.');
  });

  it('round-trips line -> block -> line for the trailing paragraph', () => {
    const { blocks } = buildBlockMap(src);
    const lastPara = blocks.filter(b => b.type === 'paragraph').slice(-1)[0];
    const { ordinal } = lineToBlock(src, 11);
    expect(ordinal).toBe(lastPara.ordinal);
  });

  it('maps a line inside the code fence to the code block + preceding heading', () => {
    const { blocks } = buildBlockMap(src);
    const code = blocks.find(b => b.type === 'code')!;
    const res = lineToBlock(src, 8); // 'const b = 2;'
    expect(res.ordinal).toBe(code.ordinal);
    expect(res.headingSlug).toBe('Section');
    expect(res.headingNth).toBe(1);
  });
});

describe('mapping - duplicate adjacent paragraphs (position, not content)', () => {
  const src = 'Repeat me.\n\nRepeat me.\n';
  it('resolves identical paragraphs to distinct ordinals and lines', () => {
    const { blocks } = buildBlockMap(src);
    expect(blocks).toHaveLength(2);
    expect(blockToLine(src, 0)).toBe(0);
    expect(blockToLine(src, 1)).toBe(2);
    expect(lineAt(src, 2)).toBe('Repeat me.');
  });
});

describe('mapping - empty/marker-only blocks guard (AC #5)', () => {
  it('returns -1 for a horizontal rule block', () => {
    const src = 'Text\n\n---\n\nMore\n';
    const { blocks } = buildBlockMap(src);
    const hr = blocks.find(b => b.type === 'hr')!;
    expect(hr).toBeDefined();
    expect(blockToLine(src, hr.ordinal)).toBe(-1);
  });

  it('returns -1 for an out-of-range ordinal', () => {
    expect(blockToLine('# Only\n', 999)).toBe(-1);
    expect(blockToLine('# Only\n', -1)).toBe(-1);
  });
});

describe('mapping - nested list is a single top-level block', () => {
  const src = '- a\n  - b\n- c\n';
  it('treats the whole list as one ordinal', () => {
    const { blocks } = buildBlockMap(src);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('list');
    expect(lineToBlock(src, 1).ordinal).toBe(0);
    expect(blockToLine(src, 0)).toBe(0);
  });
});

describe('mapping - GFM table is a single top-level block', () => {
  const src = '| H | I |\n|---|---|\n| 1 | 2 |\n';
  it('treats the table as one ordinal at line 0', () => {
    const { blocks } = buildBlockMap(src);
    expect(blocks[0].type).toBe('table');
    expect(blockToLine(src, 0)).toBe(0);
  });
});

describe('mapping - headingSlug', () => {
  it('replaces spaces with hyphens on plain text', () => {
    expect(headingSlug('Hello World')).toBe('Hello-World');
  });
  it('strips inline markdown before slugging', () => {
    expect(headingSlug('A **bold** title')).toBe('A-bold-title');
  });
});
