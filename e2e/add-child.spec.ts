import { test, expect } from '@playwright/test';

test.describe('Add Child Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Generate unique email for each test run
    const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

    // Register a new user for each test
    await page.goto('/register');

    await page.getByLabel('Name').fill('Test User');
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
    await page.getByLabel('Confirm Password').fill('TestPassword123!');

    await page.getByRole('button', { name: 'Create account' }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 15000 });
  });

  test('should show welcome message when no children exist', async ({ page }) => {
    // Should see the welcome card
    await expect(page.getByText('Welcome to DreamTime!')).toBeVisible();
    await expect(page.getByText('Add your child to start tracking')).toBeVisible();
  });

  test('should show Add Child button on dashboard', async ({ page }) => {
    // Look for the Add Your Child button in the welcome card (the larger primary button)
    const addButton = page.getByRole('button', { name: 'Add Your Child' });
    await expect(addButton).toBeVisible();

    // Take a screenshot before clicking
    await page.screenshot({ path: 'e2e/screenshots/before-click.png' });
  });

  test('should open dialog when clicking Add Child button', async ({ page }) => {
    // Find the Add Your Child button (the larger primary button in the welcome card)
    const addButton = page.getByRole('button', { name: 'Add Your Child' });
    await expect(addButton).toBeVisible();

    // Log button state
    const buttonText = await addButton.textContent();
    console.log('Button text:', buttonText);

    // Try to click
    await addButton.click();

    // Take screenshot after click
    await page.screenshot({ path: 'e2e/screenshots/after-click.png' });

    // Wait a moment for dialog to appear
    await page.waitForTimeout(500);

    // Check if dialog opened
    const dialogTitle = page.getByRole('heading', { name: 'Add Child' });
    const dialogVisible = await dialogTitle.isVisible().catch(() => false);
    console.log('Dialog visible:', dialogVisible);

    // Take another screenshot
    await page.screenshot({ path: 'e2e/screenshots/dialog-state.png' });

    // Assert dialog is visible
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });
  });

  test('should be able to add a child through the dialog', async ({ page }) => {
    // Set up console listener early
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    // Click Add Child button
    const addButton = page.getByRole('button', { name: /Add Your Child/i });
    await addButton.click();

    // Wait for dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Add Child' })).toBeVisible();

    // Fill in child details using specific input locators
    const nameInput = dialog.locator('input#name');
    const birthDateInput = dialog.locator('input#birthDate');

    await nameInput.fill('Baby Oliver');
    await birthDateInput.fill('2024-06-15');

    // Wait for React state to update
    await page.waitForTimeout(200);

    // Take screenshot before submit
    await page.screenshot({ path: 'e2e/screenshots/before-submit.png' });

    // Find and click the submit button
    const submitButton = dialog.locator('button[type="submit"]');

    // Check button state
    const isDisabled = await submitButton.isDisabled();
    console.log('Submit button disabled:', isDisabled);

    // Log form values
    const nameValue = await nameInput.inputValue();
    const birthDateValue = await birthDateInput.inputValue();
    console.log('Name value:', nameValue);
    console.log('Birth date value:', birthDateValue);

    await expect(submitButton).toBeEnabled({ timeout: 5000 });

    // Debug: Log HTML of button and form
    const buttonHtml = await submitButton.evaluate(el => el.outerHTML);
    console.log('Submit button HTML:', buttonHtml);

    // Try multiple click methods
    console.log('Attempting click...');

    // Method 1: Regular click
    await submitButton.click();
    await page.waitForTimeout(500);

    // Check if dialog closed
    let dialogVisible = await dialog.isVisible();
    console.log('Dialog still visible after click:', dialogVisible);

    if (dialogVisible) {
      // Method 2: Force click with evaluate
      console.log('Trying JavaScript click...');
      await submitButton.evaluate((btn) => (btn as HTMLButtonElement).click());
      await page.waitForTimeout(500);
      dialogVisible = await dialog.isVisible();
      console.log('Dialog still visible after JS click:', dialogVisible);
    }

    if (dialogVisible) {
      // Method 3: Submit form directly
      console.log('Trying form submit...');
      await dialog.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());
      await page.waitForTimeout(500);
    }

    // Wait for console logs
    await page.waitForTimeout(1000);

    // Wait for API call and response
    await page.waitForResponse(
      (response) => response.url().includes('/api/children') && response.status() === 201,
      { timeout: 10000 }
    ).catch(() => console.log('No children API response received'));

    // Take screenshot after submit attempt
    await page.screenshot({ path: 'e2e/screenshots/after-submit.png' });

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Should show child selector with Baby Oliver
    await expect(page.getByText('Baby Oliver')).toBeVisible({ timeout: 10000 });
  });

  test('debug - inspect Add Child button HTML', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Get the specific "Add Your Child" button (the main one in the welcome card)
    const addButton = page.getByRole('button', { name: 'Add Your Child' });

    if (await addButton.isVisible()) {
      const html = await addButton.evaluate(el => el.outerHTML);
      console.log('Button HTML:', html);

      // Check parent elements
      const parentHTML = await addButton.evaluate(el => el.parentElement?.outerHTML || 'No parent');
      console.log('Parent HTML:', parentHTML);

      // Try force click
      await addButton.click({ force: true });

      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/screenshots/force-click.png' });

      // Check dialog state
      const dialogs = await page.locator('[role="dialog"]').count();
      console.log('Number of dialogs:', dialogs);
    } else {
      console.log('Button not visible');
      await page.screenshot({ path: 'e2e/screenshots/button-not-visible.png' });
    }
  });
});
