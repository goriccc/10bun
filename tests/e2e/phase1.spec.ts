import { expect, test } from '@playwright/test';

test('게임 1 공식 도전을 멈추면 결과가 나온다', async ({ page }) => {
  await page.goto('/10sec');
  await page.getByRole('button', { name: '시작' }).click();
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: '멈춤' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByRole('button', { name: /다시 도전|연습으로 다시/ })).toBeVisible();
});

test('게임 3 원을 그리면 점수가 나온다', async ({ page }) => {
  await page.goto('/shape');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas missing');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radius = box.width * 0.32;
  await page.mouse.move(cx + radius, cy);
  await page.mouse.down();
  for (let i = 1; i <= 72; i += 1) {
    const angle = (i / 72) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  await page.mouse.up();
  await expect(page.locator('.panel[role="status"]')).toContainText('점', { timeout: 15000 });
});
