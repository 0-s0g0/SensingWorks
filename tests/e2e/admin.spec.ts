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
  ).toHaveCount(1);
  await page.getByRole('link', { name: '管理', exact: true }).click();
  await page.getByRole('tab', { name: 'アカウント設定' }).click();
  await expect(page.getByRole('heading', { name: 'セッション管理・ログイン履歴' })).toBeVisible();
  await page.getByRole('tab', { name: /申請・レビュー/ }).click();
  await expect(
    page.getByRole('region', { name: '週報マトリックス（横スクロール）' }),
  ).not.toContainText('管理専用ユーザー');
  for (const path of ['/wbs', '/reports', '/travel', '/availability', '/profile']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.getByRole('heading', { name: '管理', exact: true })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('link'),
    ).toHaveCount(1);
  }
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
