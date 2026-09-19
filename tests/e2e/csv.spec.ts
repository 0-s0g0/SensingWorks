import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('WBS and MID CSV download includes expected data and preserves scope', async ({ page }) => {
  await page.goto('/wbs');
  await page.getByLabel('WBSを検索').fill('存在しない工程');
  const wbsDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '全WBSをCSV出力', exact: true }).click();
  const wbs = await wbsDownload;
  expect(wbs.suggestedFilename()).toMatch(/^SensingWorks-WBS-.*\.csv$/);
  const contents = await readFile((await wbs.path())!, 'utf8');
  expect(contents.charCodeAt(0)).toBe(0xfeff);
  expect(contents).toContain('"小工程","2.2.2"');
  expect(contents).toContain('青木 海斗');
  expect(contents).not.toContain('報酬');
  await page.goto('/availability');
  const midDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'この週をCSV出力', exact: true }).click();
  const mid = await midDownload;
  const midCsv = await readFile((await mid.path())!, 'utf8');
  expect(midCsv).toContain('青木 海斗');
  expect(midCsv).toContain('田中 美咲');
  expect(midCsv).toContain('Asia/Tokyo');
  await page.getByRole('button', { name: '予定を入力', exact: true }).click();
  await page.getByRole('gridcell').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'この週をCSV出力', exact: true })).toBeDisabled();
});

test('weekly CSV downloads the saved report and the Owner matrix exports everyone', async ({
  page,
}) => {
  await page.goto('/reports');
  await page.getByLabel('今週うまくいったこと', { exact: true }).fill('CSV週報検証');
  await page.getByRole('button', { name: '下書き保存', exact: true }).click();
  await expect(page.getByText('下書きを保存しました。')).toBeVisible();
  const onePending = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存済み週報をCSV出力', exact: true }).click();
  const one = await onePending;
  const csv = await readFile((await one.path())!, 'utf8');
  expect(csv).toContain('CSV週報検証');
  expect(csv).not.toContain('田中 美咲');
  await page.getByLabel('デモユーザー切替').selectOption({ label: '高橋 直樹 / Owner' });
  await page.getByRole('link', { name: '管理', exact: true }).click();
  const allPending = page.waitForEvent('download');
  await page.getByRole('button', { name: '全員の週報をCSV出力', exact: true }).click();
  const all = await allPending;
  const allCsv = await readFile((await all.path())!, 'utf8');
  expect(allCsv).toContain('CSV週報検証');
  expect(allCsv).toContain('田中 美咲');
  expect(allCsv).toContain('2027-03-29');
});
