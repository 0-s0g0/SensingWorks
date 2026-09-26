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
  await expect(page.getByRole('heading', { name: '管理専用ワークスペース' })).toBeVisible();
  await page.getByRole('link', { name: '管理', exact: true }).click();
  await page.getByRole('tab', { name: 'アカウント設定' }).click();
  await expect(page.getByRole('heading', { name: 'セッション管理・ログイン履歴' })).toBeVisible();
  await page.getByRole('tab', { name: /申請・レビュー/ }).click();
  await expect(
    page.getByRole('region', { name: '週報マトリックス（横スクロール）' }),
  ).not.toContainText('管理専用ユーザー');
  await page.getByRole('link', { name: 'MID.予定', exact: true }).click();
  await expect(page.getByRole('button', { name: '予定を入力', exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel('表示する予定').getByRole('option', { name: /管理専用/ }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'WBS', exact: true }).click();
  await page.getByRole('button', { name: 'すべて展開', exact: true }).click();
  await page.getByRole('button', { name: '2.2 担当者を変更', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toContainText('管理専用ユーザー');
});
