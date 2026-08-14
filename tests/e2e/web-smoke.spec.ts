import { expect, test } from '@playwright/test';

test('loads the Version 1 product shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/EduTrack Africa/);
  await expect(page.getByRole('heading', { name: 'EduTrack Africa', exact: true })).toBeVisible();
  await expect(page.getByText('EduTrack Africa • v1.0.0')).toBeVisible();
});
