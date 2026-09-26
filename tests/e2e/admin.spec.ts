import { test, expect } from '@playwright/test';
import { createSeed } from '../../src/lib/seed';
test('Admin can manage without appearing among participants', async ({ page }) => {
  const state = createSeed();
  state.users.push({ id: 'admin', name: '管理専用ユーザー', role: 'ADMIN', active: true });
  await page.addInitScript(
    (state) =>
      localStorage.setItem(
        'sensingworks-firebase-demo-v2',
        JSON.stringify({ state, userId: 'admin' }),
      ),
    state,
  );
  await page.goto('/');
  await expect(page).toHaveURL(/\/admin\/?$/);
  await expect(
    page.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('link'),
  ).toHaveCount(2);
  await page.getByRole('link', { name: '管理', exact: true }).click();
  await page.getByRole('tab', { name: 'アカウント設定' }).click();
  await expect(page.getByRole('heading', { name: 'セッション管理・ログイン履歴' })).toBeVisible();
  await page.getByRole('tab', { name: /申請・レビュー/ }).click();
  await expect(
    page.getByRole('region', { name: '週報マトリックス（横スクロール）' }),
  ).not.toContainText('管理専用ユーザー');
  for (const path of ['/wbs', '/reports', '/travel', '/profile']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.getByRole('heading', { name: '管理', exact: true })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('link'),
    ).toHaveCount(2);
  }
  await page.getByRole('link', { name: 'MID.予定', exact: true }).click();
  await expect(page).toHaveURL(/\/availability\/?$/);
  await expect(page.getByRole('grid', { name: 'チーム参加状況' })).toBeVisible();
  await expect(page.getByRole('button', { name: '予定を入力', exact: true })).toHaveCount(0);
  await page.getByRole('gridcell').filter({ hasText: '○' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('表示する予定').selectOption('demo-aoki');
  await expect(page.getByRole('button', { name: '表示中の予定を編集', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('gridcell').first()).toBeDisabled();
  await expect(page.getByText('ADMINは閲覧専用です')).toBeVisible();
  await page.getByRole('link', { name: '管理', exact: true }).click();
  await page.getByRole('tab', { name: /申請・レビュー/ }).click();
  await page.getByRole('button', { name: /2.2 / }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/?$/);
});

test('existing ADMIN assignments are hidden from WBS and its assignee picker', async ({ page }) => {
  const state = createSeed();
  state.users.push({ id: 'admin', name: '管理専用ユーザー', role: 'ADMIN', active: true });
  const mission = state.wbsItems.find((m) => m.id === 'mission-2-2')!;
  mission.assigneeIds.push('admin');
  await page.addInitScript(
    (state) =>
      localStorage.setItem(
        'sensingworks-firebase-demo-v2',
        JSON.stringify({ state, userId: 'demo-owner' }),
      ),
    state,
  );
  await page.goto('/wbs');
  await page.getByRole('button', { name: 'すべて展開', exact: true }).click();
  await expect(page.getByRole('img', { name: '管理専用ユーザー' })).toHaveCount(0);
  await page.getByRole('button', { name: '2.2 担当者を変更', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toContainText('管理専用ユーザー');
});

test('user numbers persist and order management tables and MID selectors', async ({ page }) => {
  const state = createSeed();
  state.users.push({ id: 'admin', name: '管理専用ユーザー', role: 'ADMIN', active: true });
  await page.addInitScript((state) => {
    if (!localStorage.getItem('sensingworks-firebase-demo-v2'))
      localStorage.setItem(
        'sensingworks-firebase-demo-v2',
        JSON.stringify({ state, userId: 'admin' }),
      );
  }, state);
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'アカウント設定' }).click();
  await page.getByLabel('田中 美咲 ユーザー番号').fill('2');
  await page.getByRole('button', { name: '田中 美咲の番号を保存', exact: true }).click();
  await page.getByLabel('青木 海斗 ユーザー番号').fill('10');
  await page.getByRole('button', { name: '青木 海斗の番号を保存', exact: true }).click();
  await page.reload();
  await page.getByRole('tab', { name: 'アカウント設定' }).click();
  await expect(page.getByLabel('田中 美咲 ユーザー番号')).toHaveValue('2');
  await page.getByRole('tab', { name: '月末精算' }).click();
  await expect(
    page.getByRole('table', { name: '月末精算一覧' }).getByRole('button').first(),
  ).toContainText('田中 美咲');
  await page.getByRole('link', { name: 'MID.予定', exact: true }).click();
  const options = page.getByLabel('表示する予定').locator('option');
  await expect(options.nth(1)).toHaveText('田中 美咲');
  await expect(options.nth(2)).toHaveText('青木 海斗');
});
