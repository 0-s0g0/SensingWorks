import { test, expect } from '@playwright/test';
const team = '青木 海斗 / Team',
  owner = '高橋 直樹 / Owner';
test('collaborative report → independent Owner point and cash allocation → cumulative results', async ({
  page,
}) => {
  await page.goto('/wbs/#mission-2-2');
  await page.getByRole('button', { name: '終了報告を作成', exact: true }).click();
  await page.getByLabel('実施内容').fill('CSI同時計測を実装しました');
  await page.getByLabel('結果').fill('3台の同期を検証しました');
  await page.getByLabel('青木 海斗 申告貢献割合').fill('40');
  await page.getByLabel('田中 美咲 申告貢献割合').fill('30');
  await page.getByLabel('佐藤 蓮 申告貢献割合').fill('20');
  await expect(page.getByRole('button', { name: '終了報告を提出', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '共同下書きを保存', exact: true }).click();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByLabel('デモユーザー切替').selectOption({ label: '田中 美咲 / Team' });
  await page.goto('/wbs/#mission-2-2');
  await page.getByRole('button', { name: '終了報告を編集', exact: true }).click();
  await expect(page.getByLabel('実施内容')).toHaveValue('CSI同時計測を実装しました');
  await page.getByLabel('佐藤 蓮 申告貢献割合').fill('30');
  await page.getByRole('button', { name: '終了報告を提出', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('終了報告済');
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByLabel('デモユーザー切替').selectOption({ label: owner });
  await page.goto('/wbs/#mission-2-2');
  await page.getByLabel('青木 海斗 最終ポイント').fill('50');
  await expect(page.getByText('10pt超過')).toBeVisible();
  await expect(page.getByRole('button', { name: '承認して完了' })).toBeDisabled();
  await page.getByLabel('佐藤 蓮 最終ポイント').fill('20');
  await page.getByRole('button', { name: '承認して完了' }).click();
  await expect(page.getByRole('dialog')).toContainText('確定ポイント');
  await expect(page.getByRole('dialog')).toContainText('¥4,000');
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByLabel('デモユーザー切替').selectOption({ label: team });
  await page.goto('/profile');
  await expect(page.getByRole('row').filter({ hasText: '青木 海斗' })).toContainText('280pt');
  await expect(page.getByRole('row').filter({ hasText: '田中 美咲' })).toContainText('30pt');
});
test('final navigation, no legacy pages or money for Team; all current work on home', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('link'),
  ).toHaveCount(5);
  await expect(
    page.getByRole('heading', { name: '自分の担当ミッション', exact: true }),
  ).toBeVisible();
  await expect(page.locator('main')).toContainText('ESP32複数台同時取得');
  for (const path of ['/', '/wbs', '/reports', '/availability', '/profile']) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(
      /[¥￥]|GOLD|SILVER|BRONZE|おすすめミッション|新しいミッションに挑戦/,
    );
  }
  await page.goto('/missions');
  await expect(page.getByText('404', { exact: true })).toBeVisible();
  await page.goto('/');
  await page.getByLabel('デモユーザー切替').selectOption({ label: owner });
  await expect(
    page.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('link'),
  ).toHaveCount(6);
  await page.getByRole('link', { name: '管理', exact: true }).click();
  await expect(page.locator('main')).toContainText('¥10,000');
});
test('weekly reports shared with Team, own draft persists, other members read only', async ({
  page,
}) => {
  await page.goto('/reports');
  await page.getByRole('button', { name: '週報を提出', exact: true }).click();
  await expect(page.getByText('必須の3項目を入力してください。')).toBeVisible();
  await expect(page.getByLabel('今週うまくいったこと', { exact: true })).toBeFocused();
  await expect(page.locator('textarea[aria-invalid=true]')).toHaveCount(3);
  await expect(page.locator('.required-mark')).toHaveCount(3);
  await page.getByLabel('今週うまくいったこと').fill('計測基盤を整備');
  await page.getByRole('button', { name: '下書き保存', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('今週うまくいったこと')).toHaveValue('計測基盤を整備');
  await page.getByLabel('週報のメンバー').selectOption('demo-tanaka');
  await expect(page.getByText('この週の週報はまだありません。')).toBeVisible();
  await expect(page.getByRole('button', { name: '週報を提出', exact: true })).toHaveCount(0);
});
test('MID partial range deletion, day/week deletion, team read and Owner edit', async ({
  page,
}) => {
  await page.goto('/availability');
  await expect(page.getByRole('grid', { name: 'チーム参加状況' })).toBeVisible();
  await page.getByRole('button', { name: '予定を入力', exact: true }).click();
  const cells = page.getByRole('gridcell');
  await cells.nth(28).hover();
  await page.mouse.down();
  await cells.nth(49).hover();
  await page.mouse.up();
  await page.getByRole('button', { name: /予定を保存/ }).click();
  await expect(page.getByText('予定を保存しました。')).toBeVisible();
  await page.getByRole('button', { name: '未入力に戻す', exact: true }).click();
  await cells.nth(42).hover();
  await page.mouse.down();
  await cells.nth(49).hover();
  await page.mouse.up();
  await page.getByRole('button', { name: /予定を保存/ }).click();
  await expect(cells.nth(28)).toContainText('○');
  await expect(cells.nth(42)).not.toContainText('○');
  await page
    .getByRole('button', { name: /この日の予定を全削除/ })
    .first()
    .click();
  await page.getByRole('button', { name: /予定を保存/ }).click();
  await expect(cells.nth(28)).not.toContainText('○');
  await page.getByLabel('表示する予定').selectOption('demo-tanaka');
  await expect(cells.nth(28)).toBeDisabled();
  await page.getByLabel('表示する予定').selectOption('team');
  await expect(page.getByRole('grid', { name: 'チーム参加状況' })).toBeVisible();
  await page.getByLabel('デモユーザー切替').selectOption({ label: owner });
  await page.getByLabel('表示する予定').selectOption('demo-tanaka');
  await page.getByRole('button', { name: '表示中の予定を編集', exact: true }).click();
  await expect(cells.nth(28)).toBeEnabled();
  await page.getByRole('button', { name: 'この週を全削除', exact: true }).click();
  await page.getByRole('button', { name: /予定を保存/ }).click();
});

test('MID starts with everyone, opens member answers, and returns to overview after personal input', async ({
  page,
}) => {
  await page.goto('/availability');
  await expect(page.getByLabel('表示する予定')).toHaveValue('team');
  await expect(page.getByRole('button', { name: /予定を保存/ })).toHaveCount(0);
  await page.getByRole('gridcell').first().click();
  await expect(page.getByRole('dialog')).toContainText('青木 海斗');
  await expect(page.getByRole('dialog')).toContainText('田中 美咲');
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: '予定を入力', exact: true }).click();
  await expect(page.getByLabel('表示する予定')).toHaveValue('demo-aoki');
  await page.getByRole('gridcell').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '入力を終了', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /予定を保存/ }).click();
  await expect(page.getByText('予定を保存しました。')).toBeVisible();
  await page.getByRole('button', { name: '入力を終了', exact: true }).click();
  await expect(page.getByLabel('表示する予定')).toHaveValue('team');
  await page.screenshot({ path: 'docs/screenshots/mid-overview.png', fullPage: true });
  await page.reload();
  await expect(page.getByLabel('表示する予定')).toHaveValue('team');
});
