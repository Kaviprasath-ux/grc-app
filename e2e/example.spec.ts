import { test, expect } from '@playwright/test';

test.describe('App', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/GRC/i);
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');

    // Check if login page or redirect to login
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Authentication', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/login');

    // Check for username input
    const usernameInput = page.locator('#username');
    await expect(usernameInput).toBeVisible();

    // Check for password input
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();

    // Check for submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });
});
