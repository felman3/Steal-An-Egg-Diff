import { expect, test } from '@playwright/test';
import { kpiValues, signInAs, waitForKpis } from './helpers';

test.describe('authentication', () => {
  test('protected pages redirect to login, which labels the prototype and demo accounts', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
    await page.goto('/departments');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('prototype-notice')).toContainText('synthetic demonstration data');
    await expect(page.getByTestId('demo-accounts')).toContainText('Demonstration Access');
    await expect(page.getByLabel('Email')).toHaveValue('demo.academic.admin@example.com');
    await expect(page.getByLabel('Password', { exact: true })).not.toHaveValue('');
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Academic Analytics' })).toBeVisible();
    await page.goto('/');
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Continue to dashboard' }).click();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByTestId('scorecard')).toHaveCount(0);
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
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('academic administrator dashboard', () => {
  test('shows five database-backed KPI cards, alerts and all seven analytics visuals', async ({ page }) => {
    await signInAs(page, 'admin');
    await waitForKpis(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Academic Analytics');
    await expect(page.getByTestId('spectra-masthead')).toContainText('Authorized Academic Administrator');
    const brand = page.getByTestId('spectra-brand');
    await expect(brand).toContainText('Insight Beyond Numbers');
    await expect.poll(() => brand.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1309);
    await expect(page.locator('[data-testid="kpi-grid"] button[aria-pressed="true"]')).toHaveCount(0);
    await expect(page.getByTestId('page-header').getByTestId('scope-description')).toContainText('Institution-wide');
    await expect(page.getByRole('heading', { name: 'Key indicators', exact: true })).toHaveCount(0);
    for (const code of ['sete_mean', 'sete_response_rate', 'pass_rate', 'mean_gwa', 'faculty_standard_rate']) {
      await expect(page.getByTestId(`kpi-${code}`)).toBeVisible();
    }
    // KPIs cover both academic operations and teaching effectiveness (case study, Part II).
    await expect(page.getByRole('region', { name: 'Academic Operations' }).getByTestId('kpi-pass_rate')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Teaching Effectiveness' }).getByTestId('kpi-sete_mean')).toBeVisible();
    await expect(page.getByTestId('alert-action').first()).toContainText('Recommended Action');
    await expect(page.getByTestId('alerts-panel')).toBeVisible();
    await expect(page.getByTestId('alert-count')).toContainText(/\d+ alerts? · \d+ critical/);
    await expect(page.getByTestId('trend-chart').locator('.recharts-line')).toBeVisible();
    await expect(page.getByTestId('department-chart').locator('.recharts-bar-rectangle').first()).toBeVisible();
    await expect(page.getByTestId('criteria-chart').getByTestId('criterion-score')).toHaveCount(4);
    await expect(page.getByTestId('overview-responsible-use')).toContainText('of eligible enrolments');
    await page.getByTestId('kpi-pass_rate').hover();
    await expect(page.getByTestId('kpi-tooltip-pass_rate')).toBeVisible();
    await expect(page.getByTestId('kpi-tooltip-pass_rate')).toContainText('Formula');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('kpi-tooltip-pass_rate')).toBeHidden();
    await expect(page.getByTestId('rating-donut').locator('.recharts-pie-sector').first()).toBeVisible();
    await expect(page.getByTestId('grade-chart')).toBeVisible();
    await expect(page.getByTestId('department-matrix')).toBeVisible();
    await expect(page.getByTestId('sete-coverage-chart')).toBeVisible();
  });

  test('academic year, semester, college and department filters change the results', async ({ page }) => {
    await signInAs(page, 'admin');
    await waitForKpis(page);
    const latest = await kpiValues(page);

    await expect(page.getByTestId('filter-bar')).toBeVisible();
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
    await expect(page.getByTestId('filter-department').locator('option')).toHaveText(['All departments', 'COMM · Communication', 'MATH · Mathematics', 'PSY · Psychology']);

    await page.getByTestId('filter-department').selectOption({ label: 'MATH · Mathematics' });
    await expect(page.getByTestId('scope-description')).toContainText('Mathematics');
    // Only one department remains on the comparison chart's category axis.
    await expect(page.getByTestId('department-chart').locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')).toHaveText(['MATH']);
    await page.getByRole('button', { name: 'Reset filters' }).click();
    await expect(page.getByTestId('scope-description')).toContainText('Institution-wide');
    await expect.poll(() => kpiValues(page)).toEqual(latest);
  });

  test('a scope with no records shows an empty state', async ({ page }) => {
    await signInAs(page, 'admin');
    await waitForKpis(page);
    // Nutrition and Dietetics was established in 2024, so AY 2022-2023 has no records.
    await page.getByTestId('filter-ay').selectOption({ label: 'AY 2022-2023' });
    await page.getByTestId('filter-college').selectOption({ label: 'CHS · Health Sciences' });
    await page.getByTestId('filter-department').selectOption({ label: 'ND · Nutrition and Dietetics' });
    await expect(page.getByTestId('empty-state').first()).toContainText('No Academic or SETE Records');
  });

  test('KPI selection updates the charts and department sort order is shared by the chart and table', async ({ page }) => {
    await signInAs(page, 'admin');
    await waitForKpis(page);
    await page.getByTestId('kpi-mean_gwa').click();
    await expect(page.getByTestId('card-trend')).toContainText('Mean General Weighted Average by Term');
    const comparison = page.getByTestId('card-departments');
    await expect(comparison).toContainText('lower is better');
    await page.getByLabel('Measure', { exact: true }).selectOption('pass_rate');
    await expect(page.getByTestId('kpi-pass_rate')).toHaveAttribute('aria-pressed', 'true');
    await comparison.getByLabel('Sort', { exact: true }).selectOption('name');
    await expect(comparison.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').first()).toHaveText('ACC');
    await comparison.getByRole('button', { name: 'Table' }).click();
    const table = comparison.getByRole('table');
    await expect(table.getByRole('row').nth(1)).toContainText('Accountancy');
    await expect(table).toContainText('Mathematics');
  });

  test('the department matrix drills into the same SETE values shown in the KPI cards', async ({ page }) => {
    await signInAs(page, 'admin');
    const matrix = page.getByTestId('department-matrix');
    await page.getByLabel('Order', { exact: true }).selectOption('priority');
    const criticalCounts = await matrix.locator('tbody tr').evaluateAll(
      (rows) => rows.map((row) => row.querySelectorAll('[data-status="critical"]').length),
    );
    expect(criticalCounts[0]).toBeGreaterThan(0);
    expect(criticalCounts).toEqual([...criticalCounts].sort((a, b) => b - a));
    await matrix.getByRole('button', { name: 'Mathematics', exact: true }).click();
    await expect(page.getByTestId('scope-description')).toContainText('Mathematics');
    await waitForKpis(page);
    await expect(matrix.getByRole('row')).toHaveCount(2);
    const kpis = await kpiValues(page);
    const coverage = page.getByTestId('card-sete-coverage');
    await coverage.getByRole('button', { name: 'Table', exact: true }).click();
    const row = coverage.getByRole('row', { name: /^Mathematics/ });
    await expect(row).toContainText(kpis.sete_mean);
    await expect(row).toContainText(kpis.sete_response_rate);
  });

  test('participation filter limits SETE chart and table to the selected status', async ({ page }) => {
    await signInAs(page, 'admin');
    const coverage = page.getByTestId('card-sete-coverage');
    await coverage.getByRole('button', { name: 'Table', exact: true }).click();
    const rows = coverage.getByRole('table').locator('tbody tr');
    const allCount = await rows.count();
    const filter = coverage.getByLabel('Filter by participation status');
    await filter.selectOption('low');
    await expect.poll(() => rows.count()).toBeLessThan(allCount);
    expect(await rows.count()).toBeGreaterThan(0);
    const statuses = await rows.locator('td:last-child').allTextContents();
    expect(statuses.every((status) => status === 'Warning' || status === 'Critical')).toBe(true);
    await coverage.getByRole('button', { name: 'Chart', exact: true }).click();
    await expect(coverage.getByRole('img', { name: /SETE score and participation/ })).toBeVisible();
  });
});

test('clicking a department bar drills the whole dashboard down to that department', async ({ page }) => {
  await signInAs(page, 'admin');
  await waitForKpis(page);
  const before = await kpiValues(page);
  await page.getByTestId('department-chart').locator('.recharts-bar-rectangle').first().click();
  await expect(page).toHaveURL(/dept=\d+/);
  await expect(page.getByTestId('scope-description')).not.toContainText('Institution-wide');
  await expect.poll(async () => (await kpiValues(page)).pass_rate).not.toBe(before.pass_rate);
  // Only the selected department remains on the chart's category axis.
  await expect(page.getByTestId('department-chart').locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')).toHaveCount(1);
  await page.getByRole('button', { name: 'Back to department comparison' }).click();
  await expect(page).not.toHaveURL(/dept=/);
  await expect(page.getByTestId('scope-description')).toContainText('Institution-wide');
});

test('reviewing a department alert applies its department and focuses the relevant KPI', async ({ page }) => {
  await signInAs(page, 'admin');
  await waitForKpis(page);
  const alerts = page.getByTestId('alerts-panel');
  const expand = alerts.getByRole('button', { name: /Show all \d+ alerts/ });
  await expand.click();
  await expect.poll(() => alerts.getByRole('listitem').count()).toBeGreaterThan(3);
  const review = alerts.getByRole('button', { name: /^Review .+ for [A-Z]+ · / }).first();
  const selectedKpi = page.locator('[data-testid="kpi-grid"] button[aria-pressed="true"]');
  await expect(selectedKpi).toHaveCount(0);
  await review.click();
  await expect(page).toHaveURL(/dept=\d+/);
  await expect(page.getByRole('region', { name: 'Key performance indicators' })).toBeFocused();
  await expect(selectedKpi).toHaveCount(1);
  await expect(page.getByTestId('card-trend')).toBeVisible();
});

test('the dashboard keeps responsible interpretation beside the SETE visuals', async ({ page }) => {
  const [facultyResponse] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/rpc/get_faculty_performance')),
    signInAs(page, 'admin'),
  ]);
  expect(facultyResponse.ok()).toBe(true);
  const facultyBands = await facultyResponse.json() as Array<Record<string, unknown>>;
  expect(facultyBands.length).toBeGreaterThan(0);
  expect(facultyBands.every((row) => Object.keys(row).length === 1 && 'rating_band' in row)).toBe(true);

  const interpretation = page.getByTestId('overview-responsible-use');
  await expect(interpretation).toContainText('course context and peer observations');
  await expect(interpretation).toContainText(/at least \d+ SETE responses in this scope/);
  const ratings = page.getByTestId('card-faculty-rating');
  await ratings.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(ratings.getByRole('table')).toContainText('Outstanding');
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

test('theme and account controls sit inside the compact SPECTRA header', async ({ page }) => {
  await signInAs(page, 'admin');
  const masthead = page.getByTestId('spectra-masthead');
  await expect(masthead).toHaveCSS('height', '112px');
  await expect(masthead.getByRole('combobox')).toHaveCount(0);
  await expect(masthead.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  const theme = masthead.getByRole('button', { name: /Change theme/ });
  await theme.click();
  await expect(theme).toHaveAccessibleName(/Current theme dark/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await theme.click();
  await expect(theme).toHaveAccessibleName(/Current theme light/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('heading', { name: 'Supporting reports' })).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
});
