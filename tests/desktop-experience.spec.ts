import { test, expect } from '@playwright/test';

test('history owns a scroll viewport and reaches additional commits', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const list = page.getByRole('list', { name: 'Commit history' });
  await expect(page.getByRole('listitem').first()).toBeVisible();
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Load more commits' })).toBeVisible();
  await page.getByRole('button', { name: 'Load more commits' }).click();
  await expect(page.getByRole('button', { name: 'Load more commits' })).not.toBeVisible();
});
test('branch picker opens in place, filters branches, and restores focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Switch branch/ }).click();
  await expect(page.getByRole('heading', { name: 'Changes', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Find a branch' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Find a branch' }).fill('dev');
  await expect(page.getByRole('button', { name: 'Switch to dev', exact: true })).toBeVisible();
  const option = page.getByRole('button', { name: 'Switch to dev', exact: true });
  expect(
    await option.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return el.contains(
        document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
      );
    }),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Switch branch/ })).toBeFocused();
});
test('file groups collapse and expand without losing their controls', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /^Unstaged \d+ files$/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect
    .poll(() =>
      page
        .locator('.file-group-body')
        .first()
        .evaluate((element) => element.getBoundingClientRect().height),
    )
    .toBe(0);
  await expect(page.locator('.file-group-body').first()).toHaveAttribute('aria-hidden', 'true');
  await toggle.click();
  await expect(page.getByText('RepositorySidebar.tsx', { exact: true })).toBeVisible();
});
test('palette focuses its input and backdrop dismissal returns focus', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open command palette', exact: true });
  await trigger.focus();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('combobox', { name: 'Search commands' })).toBeFocused();
  await page.mouse.click(10, 120);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test('fullscreen hides integrated window chrome and motion can be disabled persistently', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Minimize window' })).toBeVisible();
  await page.keyboard.press('F11');
  await expect(page.locator('.app-toolbar')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Changes', exact: true })).toBeVisible();
  expect((await page.locator('.workspace').boundingBox())!.height).toBeGreaterThan(750);
  await page.keyboard.press('F11');
  await expect(page.getByRole('button', { name: 'Minimize window' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const motion = page.getByRole('checkbox', { name: 'Interface motion' });
  await expect(motion).toBeChecked();
  await motion.uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
});

test('collapsed chrome keeps the brand and bottom controls centered', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  const settings = (await page
    .getByRole('button', { name: 'Settings', exact: true })
    .boundingBox())!;
  const expand = (await page.getByRole('button', { name: 'Expand sidebar' }).boundingBox())!;
  expect(Math.abs(settings.x + settings.width / 2 - expand.x - expand.width / 2)).toBeLessThan(1);
  await page.screenshot({ path: '.impeccable/review/collapsed.png' });
});

test('system reduced motion overrides the default preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Interface motion' })).toBeChecked();
  expect(await page.getByRole('dialog').evaluate((el) => el.getAnimations().length)).toBe(0);
});
