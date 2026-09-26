import { test, expect } from '@playwright/test';
import { createSeed } from '../../src/lib/seed';
test('save individual payment, reload and download Word', async ({ page }) => {
  const state = createSeed();
  const owner = state.users.find((u) => u.role === 'OWNER')!;
  await page.addInitScript(
    ({ state, userId }) => {
      if (!localStorage.getItem('sensingworks-firebase-demo-v2'))
        localStorage.setItem('sensingworks-firebase-demo-v2', JSON.stringify({ state, userId }));
    },
    { state, userId: owner.id },
  );
  await page.goto('/admin');
  await page.getByLabel('明細の対象者').selectOption('demo-aoki');
  await page.getByLabel('対象期間の開始日').fill('2026-09-01');
  await page.getByLabel('対象期間の終了日').fill('2026-09-30');
  await page.getByLabel('AI利用料（定額・円）').fill('3000');
  await page.getByLabel('交通費（円）').fill('1200');
  await page.getByLabel('ポイント単価（円 / pt）').fill('100');
  await page.getByLabel('変動費の上限（円）').fill('5000');
  await page.getByRole('button', { name: '明細を保存', exact: true }).click();
  await expect(page.getByLabel('保存済みの対象期間')).toHaveValue(
    'demo-aoki_2026-09-01_2026-09-30',
  );
  await page.reload();
  await page.getByLabel('明細の対象者').selectOption('demo-aoki');
  await page.getByLabel('保存済みの対象期間').selectOption('demo-aoki_2026-09-01_2026-09-30');
  await expect(page.getByLabel('AI利用料（定額・円）')).toHaveValue('3000');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存してWord出力' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/\.docx$/);
  await file.saveAs('/tmp/sensingworks-payment-qa.docx');
});
