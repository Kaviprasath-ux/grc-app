import { test, expect } from '@playwright/test';

test('login with superadmin and open framework page', async ({ page }) => {
  // Go to login page
  await page.goto('/login');

  // Fill in superadmin credentials
  await page.fill('#username', 'superadmin');
  await page.fill('#password', '1');

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for successful navigation away from login
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });

  // Navigate to framework page
  await page.goto('/compliance/framework');

  // Verify we're on the framework page
  await expect(page).toHaveURL(/\/compliance\/framework/);

  // Wait for page content to load
  await page.waitForLoadState('networkidle');
});
