import { expect, type Page } from '@playwright/test';

export type DemoRole = 'admin' | 'dean' | 'chair' | 'viewer';

/** Sign in through the real login page using a demo-account button. */
export async function signInAs(page: Page, role: DemoRole) {
  await page.goto('/login');
  await expect(page.getByTestId('demo-accounts')).toBeVisible();
  await page.getByTestId(`demo-${role}`).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  // The user card lives in the sidebar (hidden on phones), so wait for the page heading.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Wait until the five KPI tiles show database values. */
export async function waitForKpis(page: Page) {
  await expect(page.getByTestId('kpi-grid')).toBeVisible();
  await expect(page.getByTestId('kpi-value-sete_mean')).not.toHaveText('—');
}

export async function kpiValues(page: Page) {
  const codes = ['sete_mean', 'sete_response_rate', 'pass_rate', 'mean_gwa', 'faculty_standard_rate'];
  const out: Record<string, string> = {};
  for (const c of codes) out[c] = (await page.getByTestId(`kpi-value-${c}`).innerText()).trim();
  return out;
}
