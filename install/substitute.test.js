'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { substitute } = require('./cli.js');

const PLACEHOLDER = '@@CLAUDE_CONFIG_DIR@@';

test('every occurrence of the placeholder token is replaced with the supplied absolute path', () => {
  const buf = Buffer.from(`before ${PLACEHOLDER} middle ${PLACEHOLDER} after`, 'utf8');
  const result = substitute(buf, '/home/dev/.claude');
  assert.strictEqual(
    result.toString('utf8'),
    'before /home/dev/.claude middle /home/dev/.claude after'
  );
});

test('a buffer with zero occurrences comes back byte-identical', () => {
  const buf = Buffer.from('no placeholder token in here at all', 'utf8');
  const result = substitute(buf, '/home/dev/.claude');
  assert.strictEqual(Buffer.compare(result, buf), 0);
});

test('two adjacent occurrences both substitute with nothing inserted between them', () => {
  const buf = Buffer.from(`${PLACEHOLDER}${PLACEHOLDER}`, 'utf8');
  const result = substitute(buf, '/x');
  assert.strictEqual(result.toString('utf8'), '/x/x');
});

test('a config-directory path containing &, |, and \\ substitutes literally (WR-01 regression)', () => {
  const weirdPath = '/home/dev/config&dir|with\\backslash';
  const buf = Buffer.from(`prefix ${PLACEHOLDER} suffix`, 'utf8');
  const result = substitute(buf, weirdPath).toString('utf8');
  assert.strictEqual(result, `prefix ${weirdPath} suffix`);
  assert.ok(result.includes('&'));
  assert.ok(result.includes('|'));
  assert.ok(result.includes('\\'));
});

test('a config-directory path containing a dollar sign followed by an ampersand substitutes literally (RESEARCH.md Assumptions Log A3)', () => {
  // `$&` is the one string that String.prototype.replaceAll's replacement
  // argument treats specially (it re-inserts the matched substring) — this
  // must not leak through into the substituted output.
  const dollarAmpersandPath = '/home/dev/weird$&path';
  const buf = Buffer.from(`prefix ${PLACEHOLDER} suffix`, 'utf8');
  const result = substitute(buf, dollarAmpersandPath).toString('utf8');
  assert.strictEqual(result, `prefix ${dollarAmpersandPath} suffix`);
  assert.ok(!result.includes(PLACEHOLDER));
});
