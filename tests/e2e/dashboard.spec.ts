import { expect, test } from '@playwright/test';
import { kpiValues, signInAs, waitForKpis } from './helpers';

test.describe('authentication', () => {
  test('protected pages redirect to login, which labels the prototype and demo accounts', async ({ page }) => {
    await page.goto('/departments');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('prototype-notice')).toContainText('synthetic demonstration data');
    await expect(page.getByTestId('demo-accounts')).toContainText('Synthetic data only');
  });

  test('wrong password shows an error and stays on login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo.academic.admin@example.com');
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toContainText('Incorrect email or password');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sign out returns to login', async ({ page }) => {
    await signInAs(page, 'admin');
    await page.getByTestId('sign-out').first().click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('academic administrator dashboard', () => {
  test('shows five database-backed KPI cards, alerts with actions and three charts', async ({ page }) => {
    await signInAs(page, 'admin');
    await waitForKpis(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Academic Administrator Dashboard');
    for (const code of ['sete_mean', 'sete_response_rate', 'pass_rate', 'mean_gwa', 'faculty_standard_rate']) {
      await expect(page.getByTestId(`kpi-${code}`)).toBeVisible();
    }
    // KPIs cover both academic operations and teaching effectiveness (case study, Part II).
    await expect(page.getByTestId('kpi-category-pass_rate')).toHaveText(/Academic operations/i);
    await expect(page.getByTestId('kpi-category-sete_mean')).toHaveText(/Teaching effectiveness/i);
    await expect(page.getByTestId('alert-action').first()).toContainText('Action:');
    await expect(page.getByTestId('alerts-panel')).toBeVisible();
    await expect(page.getByTestId('alert-count')).toContainText(/\d+ alerts? · \d+ critical/);
    await expect(page.getByTestId('trend-chart').locator('.recharts-line')).toBeVisible();
    await expect(page.getByTestId('department-chart').locator('.recharts-bar-rectangle').first()).toBeVisible();
    await expect(page.getByTestId('criteria-chart').locator('.recharts-bar-rectangle').first()).toBeVisible();
  });

  test('academic year, semester, college and department filters change the results', async ({ page }) => {
    await signInAs(page, 'admin');
    await waitForKpis(page);
    const latest = await kpiValues(page);

    await page.getByTestId('filter-ay').selectOption({ label: 'AY 2022-2023' });
    await expect(page).toHaveURL(/ay=\d+/);
    await expect.poll(async () => (await kpiValues(page)).sete_response_rate).not.toBe(latest.sete_response_rate);
    const ay2022 = await kpiValues(page);

    await page.getByTestId('filter-semester').selectOption({ label: '1st Semester' });
    await expect(page).toHaveURL(/sem=1/);
    await expect.poll(async () => (await kpiValues(page)).sete_mean + (await kpiValues(page)).pass_rate).not.toBe(ay2022.sete_mean + ay2022.pass_rate);

    await page.getByTestId('filter-college').selectOption({ label: 'CAS · Arts and Sciences' });
    await expect(page.getByTestId('scope-description')).toContainText('College of Arts and Sciences');
    // Department options are narrowed to the selected college.
    await expect(page.getByTestId('filter-department').locator('option')).toHaveText(['All departments in college', 'COMM · Communication', 'MATH · Mathematics', 'PSY · Psychology']);

    await page.getByTestId('filter-department').selectOption({ label: 'MATH · Mathematics' });
    await expect(page.getByTestId('scope-description')).toContainText('Mathematics');
    // Only one department remains on the comparison chart's category axis.
    await expect(page.getByTestId('department-chart').locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')).toHaveText(['MATH']);
  });

  test('a scope with no records shows an empty state', async ({ page }) => {
    await signInAs(page, 'admin');
    await waitForKpis(page);
    // Data Science was established in 2024, so AY 2022-2023 has no records.
    await page.getByTestId('filter-ay').selectOption({ label: 'AY 2022-2023' });
    await page.getByTestId('filter-college').selectOption({ label: 'CICS · Informatics and Computing Sciences' });
    await page.getByTestId('filter-department').selectOption({ label: 'DS · Data Science' });
    await expect(page.getByTestId('empty-state').first()).toContainText('No academic or SETE records');
  });

  test('choosing a KPI updates the trend and department charts; table view works', async ({ page }) => {
    await signInAs(page, 'admin');
    await waitForKpis(page);
    await page.getByTestId('kpi-mean_gwa').click();
    await expect(page.getByTestId('card-trend')).toContainText('Mean General Weighted Average by term');
    await expect(page.getByTestId('card-departments')).toContainText('lower is better');
    await page.getByTestId('card-departments').getByRole('button', { name: 'Table' }).click();
    await expect(page.getByTestId('card-departments').getByRole('table')).toContainText('Mathematics');
  });

  test('admin can see faculty results and the target audit trail', async ({ page }) => {
    await signInAs(page, 'admin');
    await page.goto('/faculty');
    await expect(page.getByTestId('faculty-table')).toBeVisible();
    await expect(page.getByTestId('faculty-table')).toContainText('Faculty ');
    await page.goto('/targets');
    await expect(page.getByTestId('targets-sete_mean')).toBeVisible();
    await expect(page.getByTestId('audit-trail').getByRole('table')).toBeVisible();
    await expect(page.getByTestId('reset-targets')).toBeVisible();
  });
});

test('clicking a department bar drills the whole dashboard down to that department', async ({ page }) => {
  await signInAs(page, 'admin');
  await waitForKpis(page);
  const before = await kpiValues(page);
  await page.getByTestId('department-chart').locator('.recharts-bar-rectangle').first().click();
  await expect(page).toHaveURL(/dept=\d+/);
  await expect(page.getByTestId('scope-description')).not.toContainText('All colleges');
  await expect.poll(async () => (await kpiValues(page)).pass_rate).not.toBe(before.pass_rate);
  // Only the selected department remains on the chart's category axis.
  await expect(page.getByTestId('department-chart').locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')).toHaveCount(1);
});

test('faculty SETE results carry the responsible-use notice', async ({ page }) => {
  await signInAs(page, 'admin');
  await page.goto('/faculty');
  await expect(page.getByTestId('responsible-use')).toContainText('must not be the sole basis');
  await expect(page.getByTestId('faculty-table')).toBeVisible();
});

test.describe('access control (only authorized academic administrators)', () => {
  test('an unauthorized account can sign in but is denied all data', async ({ page }) => {
    await signInAs(page, 'unauthorized');
    await expect(page.getByTestId('access-denied')).toContainText('authorized academic administrators');
    await page.goto('/faculty');
    await expect(page.getByTestId('access-denied')).toBeVisible();
    await expect(page.getByTestId('faculty-table')).toHaveCount(0);
  });
});

test('the sidebar collapses to icons and the choice is remembered', async ({ page }) => {
  await signInAs(page, 'admin');
  await waitForKpis(page);
  await expect(page.getByTestId('page-header')).toContainText('Academic Administrator Dashboard');
  await page.getByTestId('toggle-sidebar').click();
  await expect(page.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true');
  await page.reload();
  await expect(page.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true');
  await page.getByTestId('toggle-sidebar').click();
  await expect(page.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'false');
});
