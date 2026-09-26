import { test, expect } from '@playwright/test';
test('WBS hierarchy, filters, shared reference progress and point display', async ({ page }) => {
  await page.goto('/wbs');
  await page.getByRole('button', { name: 'すべて展開', exact: true }).click();
  await expect(page.getByTestId('mission-2.2')).toContainText('100pt');
  await expect(
    page.getByTestId('mission-2.2').getByRole('img', { name: '田中 美咲' }),
  ).toBeVisible();
  await expect(page.getByTestId('mission-4.1')).toContainText('ロック中');
  await page.getByLabel('2.2.2 ステータス', { exact: true }).selectOption('COMPLETED');
  await expect(page.getByTestId('mission-2.2')).toContainText('小工程 2 / 3');
  await page.getByLabel('WBSを検索').fill('2.2.2');
  await expect(page.getByTestId('phase-2')).toBeVisible();
  await expect(page.getByTestId('mission-2.1')).toHaveCount(0);
  await page.getByLabel('WBSを検索').fill('');
  await page.getByLabel('担当者', { exact: true }).selectOption('demo-sato');
  await expect(page.getByTestId('mission-2.2')).toBeVisible();
  await expect(page.getByTestId('mission-2.1')).toHaveCount(0);
  await page.getByRole('button', { name: 'ESP32複数台同時取得', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('checkbox', { name: '実装・計測を行う', exact: true }),
  ).toBeChecked();
});
test('Owner assigns six people maximum and edits phase and WBS without a mission route', async ({
  page,
}) => {
  await page.goto('/wbs');
  await page.getByLabel('デモユーザー切替').selectOption({ label: '高橋 直樹 / Owner' });
  await page.getByRole('button', { name: '1 大工程名を編集' }).click();
  await page.getByLabel('大工程名', { exact: true }).fill('PoC設計・準備');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('phase-1')).toContainText('PoC設計・準備');
  await page.getByRole('button', { name: '中工程を追加', exact: true }).click();
  await page.getByLabel('WBS番号', { exact: true }).fill('1.4');
  await page.getByLabel('工程名', { exact: true }).fill('追加実験');
  await page.getByLabel('総ポイント', { exact: true }).fill('60');
  await page.getByLabel('内部総報酬（円・Owner専用）').fill('7000');
  await page.getByRole('checkbox', { name: '青木 海斗', exact: true }).check();
  await page.getByRole('checkbox', { name: '田中 美咲', exact: true }).check();
  await page.getByRole('button', { name: '中工程を保存', exact: true }).click();
  await page.getByRole('button', { name: 'すべて展開', exact: true }).click();
  await expect(page.getByTestId('mission-1.4')).toContainText('60pt');
  await expect(
    page.getByTestId('mission-1.4').getByRole('img', { name: '田中 美咲' }),
  ).toBeVisible();
});
test('desktop and phone screenshots keep hierarchy with no overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/wbs');
  await page.getByRole('button', { name: 'すべて展開', exact: true }).click();
  await page.getByLabel('大工程', { exact: true }).selectOption('phase-2');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({ path: 'docs/screenshots/firebase-wbs-desktop.png', fullPage: true });
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(await page.locator('.wbs-tree').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/firebase-wbs-mobile.png', fullPage: true });
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/firebase-home-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('Team changes another mission assignees through avatars and Owner sees session management', async ({
  page,
}) => {
  await page.goto('/wbs');
  await page.getByRole('button', { name: 'すべて展開', exact: true }).click();
  await page.getByRole('button', { name: '2.3 担当者を変更', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: '青木 海斗', exact: true }).uncheck();
  await dialog.getByRole('checkbox', { name: '佐藤 蓮', exact: true }).check();
  await dialog.getByRole('button', { name: '担当者を保存' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('mission-2.3').getByRole('img', { name: '佐藤 蓮' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'すべて展開', exact: true }).click();
  await expect(page.getByTestId('mission-2.3').getByRole('img', { name: '佐藤 蓮' })).toBeVisible();
  await page.getByLabel('デモユーザー切替').selectOption({ label: '高橋 直樹 / Owner' });
  await page.getByRole('link', { name: '管理', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'セッション管理・ログイン履歴' })).toBeVisible();
});

test('assigned Team can rename, add and delete reference steps without losing other progress', async ({ page }) => {
  await page.goto('/wbs');
  await page.getByRole('button', { name: 'すべて展開', exact: true }).click();
  await page.getByRole('button', { name: '2.2.2 小工程を編集', exact: true }).click();
  await page.getByLabel('小工程名', { exact: true }).fill('計測条件を調整する');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('step-2.2.2')).toContainText('計測条件を調整する');
  await page.getByRole('button', { name: 'ESP32複数台同時取得', exact: true }).first().click();
  await page.getByPlaceholder('新しい小工程を追加...').fill('追加の検証');
  await page.getByRole('dialog').getByRole('button', { name: '追加', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: '追加の検証', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '削除', exact: true }).last().click();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: '追加の検証', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: '環境・機材を確認する', exact: true })).toBeChecked();
});

test('start date saves from WBS and remains after reload', async ({ page }) => {
  await page.goto('/wbs');
  await page.getByRole('button', { name: 'すべて展開', exact: true }).click();
  await page.getByRole('button', { name: '2.2 開始日を編集', exact: true }).click();
  await page.getByLabel('開始日（任意）', { exact: true }).fill('2026-09-21');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('mission-2.2')).toContainText('2026-09-21');
  await page.reload();
  await page.getByRole('button', { name: 'すべて展開', exact: true }).click();
  await expect(page.getByTestId('mission-2.2')).toContainText('2026-09-21');
});

test('Team cannot open creation by URL or see amounts in an assigned mission editor', async ({ page }) => {
  await page.goto('/wbs/#new');
  await expect(page.getByRole('heading', { name: 'プロジェクトWBS' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '中工程を追加', exact: true })).toHaveCount(0);
  await page.goto('/wbs/#mission-2-2');
  await page.getByRole('button', { name: '中工程を編集', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toContainText('内部総報酬');
  await expect(page.getByRole('dialog').locator('input[name=totalAmount]')).toHaveCount(0);
  await expect(page.getByRole('dialog')).not.toContainText('¥');
});
