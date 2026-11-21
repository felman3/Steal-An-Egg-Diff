import { expect, test } from '@playwright/test';
import { signInAs, waitForKpis } from './helpers';

test('mobile: the SPECTRA header, filters, charts and tooltips fit the viewport', async ({ page }) => {
  await signInAs(page, 'admin');
  await waitForKpis(page);
  const masthead = page.getByTestId('spectra-masthead');
  await expect(masthead.getByTestId('spectra-brand')).toBeVisible();
  await expect(masthead).toHaveCSS('height', '76px');
  await expect(page.getByTestId('filter-bar')).toBeHidden();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByTestId('filter-bar')).toBeVisible();
  const definition = page.getByRole('button', { name: 'About Faculty Meeting SETE Standard', exact: true });
  await definition.click();
  await expect(page.getByTestId('kpi-tooltip-faculty_standard_rate')).toContainText('or higher after rounding to two decimal places');
  await expect(page.getByTestId('card-faculty-rating').getByRole('list', { name: 'Legend' })).toContainText('4.50–5.00');
  await expect(page.getByTestId('sete-coverage-chart')).toBeVisible();
  await expect(page.getByTestId('department-matrix').getByRole('table')).toBeVisible();
  const viewportWidth = page.viewportSize()!.width;
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewportWidth + 1);
  const matrix = page.getByRole('region', { name: 'Scrollable department KPI matrix' });
  const matrixOffset = await matrix.evaluate((element) => {
    element.scrollLeft = 100;
    return element.scrollLeft;
  });
  expect(matrixOffset).toBeGreaterThan(0);
});
