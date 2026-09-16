import { extractJsonText } from './json-extract.util';

describe('extractJsonText', () => {
  it('returns the input unchanged when it is already bare JSON', () => {
    expect(extractJsonText('{"a": 1}')).toBe('{"a": 1}');
  });

  it('strips a ```json fenced block', () => {
    expect(extractJsonText('```json\n{"a": 1}\n```')).toBe('{"a": 1}');
  });

  it('strips a bare ``` fenced block with no language tag', () => {
    expect(extractJsonText('```\n[1, 2, 3]\n```')).toBe('[1, 2, 3]');
  });

  it('trims surrounding whitespace', () => {
    expect(extractJsonText('  \n{"a": 1}\n  ')).toBe('{"a": 1}');
  });
});
