'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkStaleness, resolveClaudeBin } = require('./cli.js');

const REPO_SLUG = 'Invoker-Software/ai-dev';
const SHA = 'a'.repeat(40);

/**
 * @param {unknown} err
 * @returns {string}
 */
function errMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Build a fake `fetch` Response shaped like the response bodies RESEARCH.md
 * captured against the real GitHub API.
 * @param {{ status: number, json: any, headers?: Record<string, string> }} opts
 */
function fakeResponse(opts) {
  const { status, json, headers = {} } = opts;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
    headers: {
      /** @param {string} name */
      get: (name) => {
        const lower = String(name).toLowerCase();
        for (const [k, v] of Object.entries(headers)) {
          if (k.toLowerCase() === lower) return v;
        }
        return null;
      },
    },
  };
}

/**
 * @param {import('node:test').TestContext} t
 * @param {(...args: any[]) => Promise<any>} impl
 */
function stubFetch(t, impl) {
  const original = globalThis.fetch;
  globalThis.fetch = /** @type {typeof fetch} */ (impl);
  t.after(() => {
    globalThis.fetch = original;
  });
}

test('an ahead comparison reports the exact commit count', async (t) => {
  stubFetch(t, async (/** @type {string} */ url) => {
    if (String(url).endsWith(`/repos/${REPO_SLUG}`)) {
      return fakeResponse({ status: 200, json: { default_branch: 'main' } });
    }
    return fakeResponse({
      status: 200,
      json: { status: 'ahead', ahead_by: 2, behind_by: 0 },
    });
  });

  const result = await checkStaleness(REPO_SLUG, SHA);
  assert.strictEqual(result.ahead_by, 2);
  assert.strictEqual(result.status, 'ahead');
});

test('an identical comparison reports up to date (ahead_by 0)', async (t) => {
  stubFetch(t, async (/** @type {string} */ url) => {
    if (String(url).endsWith(`/repos/${REPO_SLUG}`)) {
      return fakeResponse({ status: 200, json: { default_branch: 'main' } });
    }
    return fakeResponse({
      status: 200,
      json: { status: 'identical', ahead_by: 0, behind_by: 0 },
    });
  });

  const result = await checkStaleness(REPO_SLUG, SHA);
  assert.strictEqual(result.ahead_by, 0);
  assert.strictEqual(result.status, 'identical');
});

test('a diverged comparison reports both the count and the diverged status', async (t) => {
  stubFetch(t, async (/** @type {string} */ url) => {
    if (String(url).endsWith(`/repos/${REPO_SLUG}`)) {
      return fakeResponse({ status: 200, json: { default_branch: 'main' } });
    }
    return fakeResponse({
      status: 200,
      json: { status: 'diverged', ahead_by: 3, behind_by: 1 },
    });
  });

  const result = await checkStaleness(REPO_SLUG, SHA);
  assert.strictEqual(result.ahead_by, 3);
  assert.strictEqual(result.status, 'diverged');
});

test('a 404 from the compare endpoint reports a not-found-upstream condition, never a zero count', async (t) => {
  stubFetch(t, async (/** @type {string} */ url) => {
    if (String(url).endsWith(`/repos/${REPO_SLUG}`)) {
      return fakeResponse({ status: 200, json: { default_branch: 'main' } });
    }
    return fakeResponse({ status: 404, json: { message: 'Not Found' } });
  });

  await assert.rejects(
    () => checkStaleness(REPO_SLUG, SHA),
    (/** @type {unknown} */ err) => {
      const message = errMessage(err);
      assert.match(message, /not found/i);
      assert.match(message, /rewritten history|history rewrite/i);
      assert.doesNotMatch(message, /0 commit/i);
      return true;
    }
  );
});

test('a 403 from the repo endpoint reports a rate limit, distinct from the 404 message', async (t) => {
  stubFetch(t, async (/** @type {string} */ url) => {
    if (String(url).endsWith(`/repos/${REPO_SLUG}`)) {
      return fakeResponse({
        status: 403,
        json: { message: 'rate limit exceeded' },
        headers: { 'x-ratelimit-reset': '1700000000' },
      });
    }
    throw new Error('compare endpoint should not be reached when the repo lookup is rate-limited');
  });

  await assert.rejects(
    () => checkStaleness(REPO_SLUG, SHA),
    (/** @type {unknown} */ err) => {
      const message = errMessage(err);
      assert.match(message, /rate limit/i);
      assert.doesNotMatch(message, /not found on GitHub/i);
      assert.doesNotMatch(message, /0 commit/i);
      return true;
    }
  );
});

test('a 403 from the compare endpoint reports a rate limit, distinct from the 404 message', async (t) => {
  stubFetch(t, async (/** @type {string} */ url) => {
    if (String(url).endsWith(`/repos/${REPO_SLUG}`)) {
      return fakeResponse({ status: 200, json: { default_branch: 'main' } });
    }
    return fakeResponse({ status: 403, json: { message: 'rate limit exceeded' } });
  });

  await assert.rejects(
    () => checkStaleness(REPO_SLUG, SHA),
    (/** @type {unknown} */ err) => {
      const message = errMessage(err);
      assert.match(message, /rate limit/i);
      assert.doesNotMatch(message, /not found on GitHub/i);
      return true;
    }
  );
});

test('a rejected fetch reports the unreachable host, distinct from the 404 and 403 messages', async (t) => {
  stubFetch(t, async () => {
    throw new Error('getaddrinfo ENOTFOUND api.github.com');
  });

  await assert.rejects(
    () => checkStaleness(REPO_SLUG, SHA),
    (/** @type {unknown} */ err) => {
      const message = errMessage(err);
      assert.match(message, /api\.github\.com/);
      assert.doesNotMatch(message, /rate limit/i);
      assert.doesNotMatch(message, /not found on GitHub/i);
      return true;
    }
  );
});

test('ADHOC_CLAUDE_BIN set to a non-executable path and AI_DEV_CLAUDE_BIN unset prints a deprecation warning naming the new variable and still resolves through a later tier', (t) => {
  const savedAdhoc = process.env.ADHOC_CLAUDE_BIN;
  const savedNew = process.env.AI_DEV_CLAUDE_BIN;
  delete process.env.AI_DEV_CLAUDE_BIN;
  process.env.ADHOC_CLAUDE_BIN = '/nonexistent/claude-binary';
  t.after(() => {
    if (savedAdhoc === undefined) delete process.env.ADHOC_CLAUDE_BIN;
    else process.env.ADHOC_CLAUDE_BIN = savedAdhoc;
    if (savedNew === undefined) delete process.env.AI_DEV_CLAUDE_BIN;
    else process.env.AI_DEV_CLAUDE_BIN = savedNew;
  });

  /** @type {string[]} */
  const stderrChunks = [];
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = /** @type {typeof process.stderr.write} */ (
    (/** @type {any} */ chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    }
  );
  let resolved;
  let threw = null;
  try {
    resolved = resolveClaudeBin();
  } catch (err) {
    threw = err;
  } finally {
    process.stderr.write = originalWrite;
  }

  const stderrOutput = stderrChunks.join('');
  assert.match(stderrOutput, /AI_DEV_CLAUDE_BIN/);
  assert.strictEqual(threw, null, 'resolution should still succeed through a later tier');
  assert.notStrictEqual(resolved, '/nonexistent/claude-binary');
});

test('neither variable set prints no deprecation warning', (t) => {
  const savedAdhoc = process.env.ADHOC_CLAUDE_BIN;
  const savedNew = process.env.AI_DEV_CLAUDE_BIN;
  delete process.env.ADHOC_CLAUDE_BIN;
  delete process.env.AI_DEV_CLAUDE_BIN;
  t.after(() => {
    if (savedAdhoc === undefined) delete process.env.ADHOC_CLAUDE_BIN;
    else process.env.ADHOC_CLAUDE_BIN = savedAdhoc;
    if (savedNew === undefined) delete process.env.AI_DEV_CLAUDE_BIN;
    else process.env.AI_DEV_CLAUDE_BIN = savedNew;
  });

  /** @type {string[]} */
  const stderrChunks = [];
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = /** @type {typeof process.stderr.write} */ (
    (/** @type {any} */ chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    }
  );
  try {
    resolveClaudeBin();
  } catch {
    // may or may not resolve in this environment — irrelevant to this assertion
  } finally {
    process.stderr.write = originalWrite;
  }

  assert.strictEqual(stderrChunks.join(''), '');
});
