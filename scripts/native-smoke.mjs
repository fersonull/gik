import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const fixture = mkdtempSync(join(tmpdir(), 'gik-native-'));
const git = (args) =>
  execFileSync('git', args, { cwd: fixture, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
let app;
let browser;
try {
  git(['init', '-b', 'dev']);
  git(['config', 'user.name', 'Native Fixture']);
  git(['config', 'user.email', 'fixture@example.test']);
  git(['config', 'core.autocrlf', 'false']);
  git(['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(fixture, 'hello.txt'), 'first\n');
  git(['add', 'hello.txt']);
  git(['commit', '-m', 'Initial native fixture']);
  writeFileSync(join(fixture, 'hello.txt'), 'first\nsecond\n');
  const profile = resolve('.tools/native-webview');
  mkdirSync(profile, { recursive: true });
  app = spawn(resolve(process.env.GIK_EXECUTABLE || 'src-tauri/target/debug/gik.exe'), [], {
    windowsHide: true,
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9223',
      WEBVIEW2_USER_DATA_FOLDER: profile,
    },
  });
  app.on('error', (e) => {
    console.error(e);
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(browser, 'Native WebView2 did not become available');
  let page;
  for (let attempt = 0; attempt < 40; attempt++) {
    page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => /tauri|localhost/.test(p.url()));
    if (page) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(page, 'No Gik window');
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  // Isolated WebView profile, not the user's normal application workspace.
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await page.getByRole('button', { name: 'Initialize repository', exact: true }).click();
  await page.getByLabel('Absolute local folder path').fill(fixture);
  await page.getByRole('button', { name: 'Initialize', exact: true }).click();
  await page.getByRole('button', { name: 'Review trust…' }).click();
  await page.getByRole('button', { name: 'Trust repository', exact: true }).click();
  await page.getByRole('button', { name: 'Stage hello.txt', exact: true }).click();
  await page.getByText('1 file staged', { exact: true }).waitFor();
  await page.getByLabel('Commit message', { exact: true }).fill('Commit from native Gik');
  writeFileSync(
    join(fixture, '.git/hooks/pre-commit'),
    '#!/bin/sh\nanswer=$("$GIT_ASKPASS" "Password for native fixture")\ntest "$answer" = "fixture-only"\n',
  );
  await page.getByRole('button', { name: /Commit changes/ }).click();
  await page.getByLabel('Password for native fixture').fill('fixture-only');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Working tree clean', { exact: true }).waitFor();
  assert.equal(git(['log', '-1', '--format=%s']).trim(), 'Commit from native Gik');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('heading', { name: 'Commit from native Gik', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Toggle terminal', exact: true }).click();
  await page.locator('.xterm-helper-textarea').waitFor({ state: 'attached' });
  await page.locator('.xterm-helper-textarea').focus();
  await page.keyboard.type("$marker = 'GIK_' + 'PTY_WORKS'; Write-Output $marker");
  await page.keyboard.press('Enter');
  await page.waitForFunction(() =>
    document.querySelector('.xterm-accessibility')?.textContent.includes('GIK_PTY_WORKS'),
  );
  const sessions = await page.evaluate(async () => {
    const api = window.__TAURI_INTERNALS__;
    const opened = await api.invoke('open_repository', {
      path: localStorage.getItem('gik:active')
        ? JSON.parse(localStorage.getItem('gik:active'))
        : '',
    });
    const snapshot = await api.invoke('query', {
      request: { repository: opened.id, kind: 'snapshot' },
    });
    return { branch: snapshot.branch, clean: snapshot.changes.length === 0 };
  });
  assert.equal(sessions.branch, 'dev');
  assert.equal(sessions.clean, true);
  await page.getByRole('button', { name: 'Changes', exact: true }).click();
  mkdirSync('.impeccable/review', { recursive: true });
  await page.screenshot({ path: '.impeccable/review/native.png' });
  assert.deepEqual(errors, []);
  console.log(
    'Native smoke passed: real WebView2 → Rust IPC → Git stage/commit/history; authenticated askpass response; PTY output verified.',
  );
} finally {
  await browser?.close().catch(() => {});
  if (app && !app.killed) {
    try {
      execFileSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {}
  }
  // Only the directory returned by mkdtemp is removed.
  assert.ok(fixture.startsWith(join(tmpdir(), 'gik-native-')));
  rmSync(fixture, { recursive: true, force: true });
}
