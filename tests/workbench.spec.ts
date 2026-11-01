import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('shows real-density read-only changes and navigates repository views', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Changes', exact: true })).toBeVisible();
  await expect(page.getByText('RepositorySidebar.tsx', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Commit history' })).toBeVisible();
  await page.getByRole('button', { name: 'Branches', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Branches', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Recovery', exact: true }).click();
  await expect(page.getByText(/Discarded uncommitted content/)).toBeVisible();
});
test('supports keyboard palette, theme changes, and terminal explanation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Changes', exact: true })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('combobox', { name: 'Search commands' }).fill('tags');
  await page.getByRole('option', { name: /Go to Tags/ }).click();
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Appearance').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle terminal', exact: true }).click();
  await expect(page.getByText(/The browser preview is read-only/)).toBeVisible();
});
test('arrow navigation moves file focus with selection and historical diffs identify themselves', async ({
  page,
}) => {
  await page.goto('/');
  const first = page.getByRole('button', { name: /RepositorySidebar.tsx/ }).first();
  await first.click();
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: /CommitGraph.tsx/ }).first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.diff-toolbar .file-title')).toContainText('CommitGraph.tsx');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('.diff-footer')).toContainText('Commit changes');
});
test('list panes visibly resize by keyboard and pointer and persist at both desktop sizes', async ({
  page,
}) => {
  await page.goto('/');
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ['Changes', 'History']) {
      await page
        .getByRole('button', { name: new RegExp(`^${view}`) })
        .first()
        .click();
      const pane = page.locator(view === 'Changes' ? '.changes-panel' : '.history-list');
      const separator = page.getByRole('separator', { name: 'List pane width' });
      await expect(pane).toBeVisible();
      await separator.focus();
      const before = (await pane.boundingBox())!.width;
      await page.keyboard.press('ArrowLeft');
      await expect
        .poll(async () => Math.round((await pane.boundingBox())!.width))
        .toBe(Math.round(before - 8));
      const handle = (await separator.boundingBox())!;
      await page.mouse.move(handle.x + 3, handle.y + 40);
      await page.mouse.down();
      await page.mouse.move(handle.x - 17, handle.y + 40);
      await page.mouse.up();
      await expect
        .poll(async () => Math.round((await pane.boundingBox())!.width))
        .toBe(Math.round(before - 28));
      await page.reload();
      await expect(pane).toBeVisible();
      await expect
        .poll(async () => Math.round((await pane.boundingBox())!.width))
        .toBe(Math.round(before - 28));
    }
  }
});
test('has no serious accessibility violations in both themes and no window overflow', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Changes', exact: true })).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Appearance').selectOption(theme);
    await page.keyboard.press('Escape');
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => ['serious', 'critical'].includes(v.impact || '')),
    ).toEqual([]);
  }
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
test('captures representative workspace screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Changes', exact: true })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/desktop.png' });
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('listitem').first()).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/history.png' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Appearance').selectOption('dark');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Changes/ }).click();
  await page.screenshot({ path: '.impeccable/review/dark.png' });
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.screenshot({ path: '.impeccable/review/compact.png' });
});
