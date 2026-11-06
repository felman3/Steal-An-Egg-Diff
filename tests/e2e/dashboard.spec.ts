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
    await page.getByLabel('Email').fill('demo.viewer@example.com');
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toContainText('Incorrect email or password');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sign out returns to login', async ({ page }) => {
    await signInAs(page, 'viewer');
    await page.getByTestId('sign-out').first().click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('dashboard (admin)', () => {
  test('shows five database-backed KPIs, alerts and three charts', async ({ page }) => {
    await signInAs(page, 'admin');
    await waitForKpis(page);
    for (const code of ['sete_mean', 'sete_response_rate', 'pass_rate', 'mean_gwa', 'faculty_standard_rate']) {
      await expect(page.getByTestId(`kpi-${code}`)).toBeVisible();
    }
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
    await page.getByTestId('filter-college').selectOption({ label: 'CCIS · Computing and Information Sciences' });
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

test.describe('role-based authorization', () => {
  test('viewer sees aggregates but faculty-level results are restricted', async ({ page }) => {
    await signInAs(page, 'viewer');
    await waitForKpis(page);
    await page.goto('/faculty');
    await expect(page.getByTestId('restricted-state')).toContainText('confidential');
    await page.goto('/targets');
    await expect(page.getByTestId('targets-readonly')).toBeVisible();
    await expect(page.getByTestId('save-target')).toHaveCount(0);
    await expect(page.getByTestId('audit-trail')).toContainText('administrators only');
  });

  test('dean is locked to their college', async ({ page }) => {
    await signInAs(page, 'dean');
    await waitForKpis(page);
    await expect(page.getByTestId('filter-college')).toBeDisabled();
    await expect(page.getByTestId('filter-college')).toHaveValue(/\d+/);
    await expect(page.getByTestId('scope-description')).toContainText('College of Computing and Information Sciences');
    // A hand-edited URL for another college is ignored; the scope stays CCIS.
    await page.goto('/?college=2');
    await waitForKpis(page);
    await expect(page.getByTestId('scope-description')).toContainText('College of Computing and Information Sciences');
    await page.goto('/faculty');
    await expect(page.getByTestId('faculty-table')).toBeVisible();
  });

  test('department chair is locked to their department', async ({ page }) => {
    await signInAs(page, 'chair');
    await waitForKpis(page);
    await expect(page.getByTestId('filter-department')).toBeDisabled();
    await expect(page.getByTestId('scope-description')).toContainText('Mathematics');
    await page.goto('/departments');
    await expect(page.getByTestId('scorecard-row-MATH')).toBeVisible();
    await expect(page.locator('[data-testid^="scorecard-row-"]')).toHaveCount(1);
  });
});
