import { expect, test } from '@playwright/test';
import { signInAs, waitForKpis } from './helpers';

test('mobile: dashboard renders without horizontal scrolling and navigation works', async ({ page }) => {
  await signInAs(page, 'admin');
  await waitForKpis(page);
  for (const path of ['/', '/departments', '/faculty', '/targets', '/about']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
  await page.getByTestId('open-menu').click();
  await page.getByRole('dialog').getByRole('link', { name: 'Department scorecard' }).click();
  await expect(page).toHaveURL(/\/departments/);
  await expect(page.getByTestId('scorecard')).toBeVisible();
});
