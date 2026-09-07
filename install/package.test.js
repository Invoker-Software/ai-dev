'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

test('no npm lifecycle script that would run for a git-sourced install is declared', () => {
  const scripts = pkg.scripts || {};
  for (const name of ['prepare', 'build', 'preinstall', 'install', 'postinstall']) {
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(scripts, name),
      false,
      `scripts.${name} must not be declared`
    );
  }
});

test('dependencies is an empty object', () => {
  assert.deepStrictEqual(pkg.dependencies, {});
});

test('files is the two-entry allowlist', () => {
  assert.deepStrictEqual(pkg.files, ['claude/', 'install/']);
});

test('bin maps the package name to the CLI path', () => {
  assert.ok(pkg.bin, 'package.json must declare a bin field');
  assert.strictEqual(pkg.bin[pkg.name], 'install/cli.js');
});

test('engines.node is present', () => {
  assert.ok(pkg.engines && typeof pkg.engines.node === 'string' && pkg.engines.node.length > 0);
});

test('test and typecheck scripts exist', () => {
  assert.ok(typeof pkg.scripts.test === 'string' && pkg.scripts.test.length > 0);
  assert.ok(typeof pkg.scripts.typecheck === 'string' && pkg.scripts.typecheck.length > 0);
});

test('the CLI file named by bin exists on disk and starts with the node shebang', () => {
  const binRel = pkg.bin[pkg.name];
  const binAbs = path.join(__dirname, '..', binRel);
  assert.ok(fs.existsSync(binAbs), `${binAbs} must exist`);
  const firstLine = fs.readFileSync(binAbs, 'utf8').split('\n')[0];
  assert.strictEqual(firstLine, '#!/usr/bin/env node');
});
