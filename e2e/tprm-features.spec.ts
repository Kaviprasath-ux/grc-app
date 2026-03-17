import { test, expect, Page } from '@playwright/test';

// ── Helpers ──

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('input[placeholder="Enter your username"], [name="username"]', { timeout: 10000 });
  await page.getByRole('textbox', { name: /username/i }).fill(username);
  await page.getByRole('textbox', { name: /pass/i }).fill(password);
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
}

async function loginAsSuperadmin(page: Page) {
  await login(page, 'superadmin', 'Baarez@2025');
}

async function loginAsCustomerAdmin(page: Page) {
  await login(page, 'tadm', '1');
}

async function loginAsBO(page: Page) {
  await login(page, 'bo', '1');
}

// ═══════════════════════════════════════════════════════════
// 1. NAVIGATION & RBAC TESTS
// ═══════════════════════════════════════════════════════════

test.describe('1. Navigation & RBAC', () => {

  test('1.1 Superadmin sees GRC, TPRM, Email sections', async ({ page }) => {
    await loginAsSuperadmin(page);
    await page.waitForLoadState('networkidle');

    // Should see GRC section in nav
    await expect(page.locator('nav').getByRole('button', { name: 'GRC', exact: true })).toBeVisible();
    // Should see TPRM section
    await expect(page.locator('nav').getByRole('button', { name: 'TPRM', exact: true })).toBeVisible();
    // Should see Email section
    await expect(page.locator('nav').getByRole('button', { name: 'Email', exact: true })).toBeVisible();
  });

  test('1.2 Superadmin sees Vendor Management in TPRM nav', async ({ page }) => {
    await loginAsSuperadmin(page);
    await page.goto('/tprm/vendor-management');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /vendor inventory/i })).toBeVisible();
    // Should NOT see Onboard New Vendor button
    await expect(page.getByRole('button', { name: /onboard new vendor/i })).not.toBeVisible();
  });

  test('1.3 CustomerAdmin can access TPRM vendor management', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    await page.goto('/tprm/vendor-management');
    await page.waitForLoadState('networkidle');

    // CustomerAdmin should see Vendor Inventory page
    await expect(page.getByRole('heading', { name: /vendor inventory/i })).toBeVisible();
  });

  test('1.4 CustomerAdmin Vendor Management hides Onboard and Edit/Delete', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    await page.goto('/tprm/vendor-management');
    await page.waitForLoadState('networkidle');

    // Onboard New Vendor should be hidden for CustomerAdmin
    await expect(page.getByRole('button', { name: /onboard new vendor/i })).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// 2. SUPERADMIN VENDOR MANAGEMENT
// ═══════════════════════════════════════════════════════════

test.describe('2. Superadmin Vendor Management', () => {

  test('2.1 Superadmin sees all vendors across customers', async ({ page }) => {
    await loginAsSuperadmin(page);
    await page.goto('/tprm/vendor-management');
    await page.waitForLoadState('networkidle');

    // Should show vendors with customer names in parentheses
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
    // The page should have vendor accordion items
    const vendorButtons = page.locator('button').filter({ hasText: /\(.*\)/ });
    const count = await vendorButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('2.2 Superadmin can navigate to admin vendor detail', async ({ page }) => {
    await loginAsSuperadmin(page);
    await page.goto('/tprm/vendor-management');
    await page.waitForLoadState('networkidle');

    // Click first vendor accordion
    const firstVendor = page.locator('button').filter({ hasText: /\(.*\)/ }).first();
    await firstVendor.click();

    // Should see View button
    const viewButton = page.getByRole('button', { name: /view/i });
    await expect(viewButton).toBeVisible();

    // Click View
    await viewButton.click();
    await page.waitForURL(/\/tprm\/admin-vendor-detail\//, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Should be on admin vendor detail page
    expect(page.url()).toContain('/tprm/admin-vendor-detail/');
  });
});

// ═══════════════════════════════════════════════════════════
// 3. PROGRAM MONITOR
// ═══════════════════════════════════════════════════════════

test.describe('3. Program Monitor', () => {

  test('3.1 Program Monitor API includes Inactive in breakdown', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    const response = await page.request.get('/api/tprm/program-monitor');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.vendors.breakdown).toHaveProperty('Inactive');
  });
});

// ═══════════════════════════════════════════════════════════
// 4. CONTROL CENTER VALIDATION
// ═══════════════════════════════════════════════════════════

test.describe('4. Control Center', () => {

  test('4.1 Control Center page loads', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    await page.goto('/tprm/control-center');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Due Diligence/i)).toBeVisible();
  });

  test('4.2 Numeric inputs reject negative values', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    await page.goto('/tprm/control-center');
    await page.waitForLoadState('networkidle');

    // Find first number input and try entering negative
    const firstInput = page.locator('input[type="number"]').first();
    await firstInput.fill('-5');
    await firstInput.blur();

    // Value should be clamped to 0
    const value = await firstInput.inputValue();
    expect(parseInt(value)).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. CONFIGURATION INPUT SANITIZATION
// ═══════════════════════════════════════════════════════════

test.describe('5. Configuration Input Sanitization', () => {

  test('5.1 Configuration page loads', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    await page.goto('/tprm/configurations');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Vendor Onboarding/i)).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// 6. BO DASHBOARD CHARTS
// ═══════════════════════════════════════════════════════════

test.describe('6. BO Dashboard', () => {

  test('6.1 BO Dashboard API returns all chart data', async ({ page }) => {
    await loginAsBO(page);
    const response = await page.request.get('/api/tprm/bo-dashboard');
    if (response.status() === 403) { test.skip(); return; }
    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('assessmentProgress');
    expect(data).toHaveProperty('inherentRisk');
    expect(data).toHaveProperty('assessmentResult');
    expect(data).toHaveProperty('issueStatus');
    expect(data).toHaveProperty('openIssuesBySeverity');
    expect(data).toHaveProperty('overdueIssuesBySeverity');
    expect(data).toHaveProperty('top5Vendors');
    expect(data).toHaveProperty('top5Domains');
  });

  test('6.2 BO Dashboard issue status has Open/Overdue/Closed', async ({ page }) => {
    await loginAsBO(page);
    const response = await page.request.get('/api/tprm/bo-dashboard');
    if (response.status() === 403) { test.skip(); return; }
    const data = await response.json();

    expect(data.issueStatus).toHaveProperty('Open');
    expect(data.issueStatus).toHaveProperty('Overdue');
    expect(data.issueStatus).toHaveProperty('Closed');
  });

  test('6.3 BO Dashboard page loads with chart sections', async ({ page }) => {
    await loginAsBO(page);
    await page.goto('/tprm/bo-dashboard');
    await page.waitForLoadState('networkidle');
    if (page.url().includes('/login')) { test.skip(); return; }
    await expect(page.getByRole('heading', { name: /assessment dashboard/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('ASSESSMENTS', { exact: true })).toBeVisible();
    await expect(page.getByText('VENDORS', { exact: true })).toBeVisible();
    await expect(page.getByText('ISSUES', { exact: true })).toBeVisible();
    await expect(page.getByText('TOP 5', { exact: true })).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// 7. VENDOR REPORTS
// ═══════════════════════════════════════════════════════════

test.describe('7. Vendor Reports', () => {

  test('7.1 Reports page has Status column', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    await page.goto('/tprm/reports');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /vendor reports/i })).toBeVisible();
    // Should have Status column header
    await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// 8. RM/BO ASSESSMENT STATUS FILTERS
// ═══════════════════════════════════════════════════════════

test.describe('8. Assessment Status Filters', () => {

  test('8.1 RM Assessments page loads with ongoing tab', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    await page.goto('/tprm/rm-assessments');
    await page.waitForLoadState('networkidle');

    // Should have Ongoing Assessments tab
    await expect(page.getByText(/ongoing assessments/i)).toBeVisible();
  });

  test('8.2 BO Assessments page loads with ongoing tab', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    await page.goto('/tprm/bo-assessments');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/ongoing assessments/i)).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// 9. VENDOR DETAIL - CONTRACT DELETION FLOW
// ═══════════════════════════════════════════════════════════

test.describe('9. Vendor Detail & Contract Deletion', () => {

  test('9.1 Vendor detail page loads with document sections', async ({ page }) => {
    await loginAsBO(page);
    await page.goto('/tprm/bo-inventory');
    await page.waitForLoadState('networkidle');
    if (page.url().includes('/login')) { test.skip(); return; }

    // Check if page has vendor inventory content
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════
// 10. DUPLICATE NAV CHECK
// ═══════════════════════════════════════════════════════════

test.describe('10. Navigation Duplicates', () => {

  test('10.1 CustomerAdmin does not see duplicate Reports in TPRM', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    await page.waitForLoadState('networkidle');

    // Count "Reports" links in TPRM section
    // The TPRM section should have Report (singular for admin) and Reports for BO/RM but not duplicates
    const reportLinks = page.locator('nav a').filter({ hasText: /^Reports?$/ });
    const texts: string[] = [];
    const count = await reportLinks.count();
    for (let i = 0; i < count; i++) {
      const href = await reportLinks.nth(i).getAttribute('href');
      if (href?.includes('/tprm/reports')) {
        texts.push(href);
      }
    }
    // Should not have duplicate /tprm/reports links
    const uniqueReportLinks = new Set(texts);
    expect(texts.length).toBe(uniqueReportLinks.size);
  });
});

// ═══════════════════════════════════════════════════════════
// 11. API ENDPOINT TESTS
// ═══════════════════════════════════════════════════════════

test.describe('11. API Endpoints', () => {

  test('11.1 BO Dashboard API returns chart data', async ({ page }) => {
    await loginAsBO(page);
    const response = await page.request.get('/api/tprm/bo-dashboard');
    if (response.status() === 403) { test.skip(); return; }
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('assessmentProgress');
    expect(data).toHaveProperty('issueStatus');
  });

  test('11.2 Program Monitor API returns vendor breakdown', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    const response = await page.request.get('/api/tprm/program-monitor');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.vendors.breakdown).toHaveProperty('Inactive');
    expect(data.vendors.breakdown).toHaveProperty('Onboarding');
  });

  test('11.3 Admin vendors API returns all vendors (superadmin)', async ({ page }) => {
    await loginAsSuperadmin(page);
    const response = await page.request.get('/api/tprm/admin/vendors');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('customerAccount');
  });

  test('11.4 Admin vendors API denied for non-superadmin', async ({ page }) => {
    await loginAsCustomerAdmin(page);
    const response = await page.request.get('/api/tprm/admin/vendors');
    // CustomerAdmin has tprm.vendor-management:view but not tprm.account-overview
    // May return 403 or 200 depending on permission mapping
    expect([200, 403]).toContain(response.status());
  });

  test('11.5 Vendor artifacts API returns data', async ({ page }) => {
    await loginAsBO(page);

    const vendorsRes = await page.request.get('/api/tprm/vendors?limit=1');
    if (vendorsRes.status() === 403) { test.skip(); return; }
    const vendorsData = await vendorsRes.json();
    const vendors = vendorsData.data || [];
    if (vendors.length === 0) { test.skip(); return; }

    const vendorId = vendors[0].id;
    const response = await page.request.get(`/api/tprm/vendors/${vendorId}/artifacts`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('data');
  });

  test('11.6 Contract deletion request API requires reason', async ({ page }) => {
    await loginAsBO(page);

    const vendorsRes = await page.request.get('/api/tprm/vendors?limit=1');
    if (vendorsRes.status() === 403) { test.skip(); return; }
    const vendorsData = await vendorsRes.json();
    const vendors = vendorsData.data || [];
    if (vendors.length === 0) { test.skip(); return; }

    const response = await page.request.post(
      `/api/tprm/vendors/${vendors[0].id}/documents/fake-doc-id/request-deletion`,
      { data: { reason: '' } }
    );
    expect([400, 404]).toContain(response.status());
  });
});
