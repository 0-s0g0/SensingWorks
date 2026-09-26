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
  await page
    .getByRole('table', { name: '月末精算一覧' })
    .getByRole('button', { name: new RegExp(state.users.find((u) => u.id === 'demo-aoki')!.name) })
    .click();
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
  await page
    .getByRole('table', { name: '月末精算一覧' })
    .getByRole('button', { name: new RegExp(state.users.find((u) => u.id === 'demo-aoki')!.name) })
    .click();
  await page.getByLabel('保存済みの対象期間').selectOption('demo-aoki_2026-09-01_2026-09-30');
  await expect(page.getByLabel('AI利用料（定額・円）')).toHaveValue('3000');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存してWord出力' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/\.docx$/);
  await file.saveAs('/tmp/sensingworks-payment-qa.docx');
});

test('manual work amounts preserve the point calculation, audit revisions and role defaults', async ({
  page,
}) => {
  const state = createSeed();
  const owner = state.users.find((u) => u.role === 'OWNER')!;
  const team = state.users.find((u) => u.id === 'demo-aoki')!;
  state.pointAwards = [
    {
      id: 'award',
      userId: team.id,
      missionId: 'mission-2-2',
      points: 300,
      awardedAt: '2026-09-10T00:00:00Z',
      approvedBy: owner.id,
    },
  ];
  await page.addInitScript(
    ({ state, userId }) => {
      if (!localStorage.getItem('sensingworks-firebase-demo-v2'))
        localStorage.setItem('sensingworks-firebase-demo-v2', JSON.stringify({ state, userId }));
    },
    { state, userId: owner.id },
  );
  await page.goto('/admin');
  await page.getByLabel('管理の対象月').fill('2026-09');
  const table = page.getByRole('table', { name: '月末精算一覧' });
  await table.getByRole('button', { name: new RegExp(team.name) }).click();
  await expect(page.getByRole('radio', { name: 'ポイントから自動計算' })).toBeChecked();
  await page.getByLabel('ポイント単価（円 / pt）').fill('100');
  await page.getByLabel('変動費の上限（円）').fill('100000');
  await page.getByLabel('AI利用料（定額・円）').fill('3000');
  await page.getByLabel('交通費（円）', { exact: true }).fill('1000');
  await expect(page.getByLabel('支払明細プレビュー')).toContainText('¥34,000');
  await page.getByRole('button', { name: '明細を保存', exact: true }).click();
  await expect(page.getByText(/第1版/)).toBeVisible();
  await page.getByRole('radio', { name: '手動で金額を設定' }).check();
  await page.getByLabel('手動設定する作業報酬（円）').fill('40000');
  await expect(page.getByRole('button', { name: '明細を保存', exact: true })).toBeDisabled();
  await page.getByLabel('変更理由', { exact: true }).fill('リーダー業務を含めて調整');
  await expect(page.getByLabel('支払明細プレビュー')).toContainText('ポイント計算額：¥30,000');
  await expect(page.getByLabel('支払明細プレビュー')).toContainText('支払合計：¥44,000');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存してWord出力' }).click();
  await (await download).saveAs('/tmp/sensingworks-manual-payment.docx');
  await page.getByText(/第2版/).click();
  await expect(page.locator('.payment-history')).toContainText(owner.name);
  await expect(page.locator('.payment-history')).toContainText('変更前の明細');
  await expect(page.locator('.payment-history')).toContainText('支払合計 ¥34,000');
  await page.screenshot({ path: '/tmp/sensingworks-manual-payment.png' });
  await page.reload();
  await page.getByLabel('管理の対象月').fill('2026-09');
  const row = table.getByRole('row').filter({ hasText: team.name });
  await expect(row).toContainText('¥44,000');
  await expect(row).toContainText('手動設定');
  await row.getByRole('button').click();
  await expect(page.getByLabel('手動設定する作業報酬（円）')).toHaveValue('40000');
  await page.getByLabel('手動設定する作業報酬（円）').fill('0');
  await page.getByLabel('変更理由', { exact: true }).fill('今月は作業報酬を支給しない');
  await expect(page.getByLabel('支払明細プレビュー')).toContainText('支払合計：¥4,000');
  await page.getByRole('button', { name: '明細を保存', exact: true }).click();
  await expect(page.getByText(/第3版/)).toBeVisible();
  await page.getByRole('radio', { name: 'ポイントから自動計算' }).check();
  await expect(page.getByLabel('手動設定する作業報酬（円）')).toHaveCount(0);
  await page.getByLabel('変更理由', { exact: true }).fill('通常のポイント計算に戻す');
  await page.getByRole('button', { name: '明細を保存', exact: true }).click();
  await expect(page.getByText(/第4版/)).toBeVisible();
  await expect(page.getByLabel('支払明細プレビュー')).toContainText('支払合計：¥34,000');
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByLabel('管理の対象月').fill('2026-10');
  await table.getByRole('button', { name: new RegExp(team.name) }).click();
  await expect(page.getByRole('radio', { name: 'ポイントから自動計算' })).toBeChecked();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByLabel('精算の表示対象').selectOption('ALL');
  await table.getByRole('button', { name: new RegExp(owner.name) }).click();
  await expect(page.getByRole('radio', { name: '手動で金額を設定' })).toBeChecked();
  await expect(page.getByLabel('手動設定する作業報酬（円）')).toHaveValue('');
});

test('LEADER has fixed pay and is excluded from the TEAM point total', async ({ page }) => {
  const state = createSeed();
  const leader = state.users[0];
  leader.role = 'LEADER';
  const owner = state.users.find((u) => u.role === 'OWNER')!;
  state.pointAwards = [
    {
      id: 'leader',
      userId: leader.id,
      missionId: 'm',
      points: 900,
      awardedAt: '2026-09-10T00:00:00Z',
      approvedBy: owner.id,
    },
    {
      id: 'team',
      userId: state.users[1].id,
      missionId: 'm',
      points: 1500,
      awardedAt: '2026-09-10T00:00:00Z',
      approvedBy: owner.id,
    },
  ];
  await page.addInitScript(
    ({ state, userId }) => {
      if (!localStorage.getItem('sensingworks-firebase-demo-v2'))
        localStorage.setItem('sensingworks-firebase-demo-v2', JSON.stringify({ state, userId }));
    },
    { state, userId: owner.id },
  );
  await page.goto('/admin');
  await page.getByLabel('管理の対象月').fill('2026-09');
  await expect(page.getByLabel('TEAMの獲得ポイント', { exact: true })).toContainText('1,500 pt');
  await expect(page.getByLabel('TEAMの獲得ポイント', { exact: true })).toContainText(
    '残り 6,000 pt',
  );
  await page.getByLabel('精算の表示対象').selectOption('LEADER');
  await page
    .getByRole('table', { name: '月末精算一覧' })
    .getByRole('button', { name: new RegExp(leader.name) })
    .click();
  await expect(page.getByRole('radio', { name: 'ポイントから自動計算' })).toBeDisabled();
  await page.getByLabel('定額作業報酬（円）').fill('40000');
  await page.getByRole('button', { name: '明細を保存', exact: true }).click();
  await expect(page.getByLabel('保存済みの対象期間')).toHaveValue(
    `${leader.id}_2026-09-01_2026-09-30`,
  );
  await expect(page.getByLabel('支払明細プレビュー')).toContainText('40,000');
});
