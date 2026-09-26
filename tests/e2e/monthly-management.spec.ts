import { test, expect } from '@playwright/test';
import { createSeed } from '../../src/lib/seed';

test('monthly matrix, TEAM points, recurring AI fees and saved payment amounts', async ({
  page,
}) => {
  const state = createSeed();
  const owner = state.users.find((u) => u.role === 'OWNER')!;
  const team = state.users.find((u) => u.id === 'demo-aoki')!;
  state.pointAwards = [
    {
      id: 'team',
      missionId: 'm',
      userId: team.id,
      points: 20,
      awardedAt: '2026-09-30T14:59:59Z',
      approvedBy: owner.id,
    },
    {
      id: 'next',
      missionId: 'm',
      userId: team.id,
      points: 99,
      awardedAt: '2026-09-30T15:00:00Z',
      approvedBy: owner.id,
    },
    {
      id: 'owner',
      missionId: 'm',
      userId: owner.id,
      points: 80,
      awardedAt: '2026-09-01',
      approvedBy: owner.id,
    },
  ];
  const route = {
    departure: '自宅',
    arrival: '研究室',
    trip: 'ROUND_TRIP' as const,
    busFare: 100,
    trainFare: 200,
    parkingFee: 500,
  };
  state.travelClaims = [
    {
      ...route,
      id: `${team.id}_2026-09-01`,
      userId: team.id,
      date: '2026-09-01',
      status: 'SUBMITTED',
    },
    { ...route, id: `${team.id}_2026-09-02`, userId: team.id, date: '2026-09-02', status: 'DRAFT' },
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
  const summary = page.getByRole('table', { name: '月末精算一覧' });
  const row = summary.getByRole('row').filter({ hasText: team.name });
  await expect(row).toContainText('20 pt');
  await expect(row).toContainText('¥1,100');
  await expect(summary).not.toContainText(owner.name);
  const cell = page.getByRole('button', { name: `${team.name} 2026-09-01 申請済み`, exact: true });
  await expect(cell).toHaveClass(/weekly-submitted/);
  await cell.click();
  await expect(page.getByRole('dialog')).toContainText('¥1,100');
  await page.getByRole('dialog').getByRole('button', { name: '閉じる' }).click();
  await row.getByRole('button', { name: new RegExp(team.name) }).click();
  await page.getByLabel(`${team.name}の月額AI利用料（円）`).fill('3000');
  await page.getByRole('button', { name: '月額を保存' }).click();
  await page.getByRole('button', { name: '月額AI利用料を明細に反映' }).click();
  await expect(page.getByLabel('AI利用料（定額・円）')).toHaveValue('3000');
  await expect(page.getByLabel('交通費（円）')).toHaveValue('1100');
  await page.getByRole('button', { name: '明細を保存', exact: true }).click();
  await expect(page.getByLabel('支払明細プレビュー')).toContainText('¥4,100');
  await page.getByLabel(`${team.name}の月額AI利用料（円）`).fill('5000');
  await page.getByRole('button', { name: '月額を保存' }).click();
  await expect(page.getByLabel('AI利用料（定額・円）')).toHaveValue('3000');
  await page.reload();
  await page.getByLabel('管理の対象月').fill('2026-10');
  await row.getByRole('button', { name: new RegExp(team.name) }).click();
  await expect(page.getByLabel('AI利用料（定額・円）')).toHaveValue('5000');
  await expect(page.getByLabel('対象期間の終了日')).toHaveValue('2026-10-31');
});

test('tabs, attention filter, pinned totals and a no-travel declaration survive reload', async ({
  page,
}) => {
  const state = createSeed();
  const team = state.users.find((u) => u.id === 'demo-aoki')!;
  const owner = state.users.find((u) => u.role === 'OWNER')!;
  state.pointAwards = [];
  state.paymentStatements = [
    {
      id: `${team.id}_2026-09-01_2026-09-30`,
      userId: team.id,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      aiFee: 3000,
      travelCost: 0,
      pointRate: 0,
      variableCap: 0,
    },
  ];
  await page.addInitScript(
    ({ state, userId }) => {
      if (!localStorage.getItem('sensingworks-firebase-demo-v2'))
        localStorage.setItem('sensingworks-firebase-demo-v2', JSON.stringify({ state, userId }));
    },
    { state, userId: team.id },
  );
  await page.goto('/travel');
  await page.getByLabel('表示月').fill('2026-09');
  await page.getByRole('button', { name: 'この月は交通費なしと申告' }).click();
  await expect(page.getByText('2026-09の交通費：なし・申告済み')).toBeVisible();
  await page.reload();
  await page.getByLabel('表示月').fill('2026-09');
  await expect(page.getByRole('button', { name: '交通費なしの申告を取り消す' })).toBeVisible();
  await page.evaluate((id) => {
    const saved = JSON.parse(localStorage.getItem('sensingworks-firebase-demo-v2')!);
    saved.userId = id;
    localStorage.setItem('sensingworks-firebase-demo-v2', JSON.stringify(saved));
  }, owner.id);
  await page.goto('/admin');
  await page.getByLabel('管理の対象月').fill('2026-09');
  await expect(page.getByRole('tab', { name: '月末精算' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const summary = page.getByRole('table', { name: '月末精算一覧' });
  const row = summary.getByRole('row').filter({ hasText: team.name });
  await expect(row).toContainText('明細作成済み・差額なし');
  await expect(row).toContainText('交通費なし申告済み');
  await page.getByLabel('確認が必要な人だけ').check();
  await expect(row).toHaveCount(0);
  await page.getByLabel('確認が必要な人だけ').uncheck();
  const matrix = page.getByRole('region', { name: '交通費マトリックス（横スクロール）' });
  const fixed = matrix.locator('tbody .travel-month-total').first();
  const before = await fixed.boundingBox();
  await matrix.evaluate((el) => {
    el.scrollLeft = 800;
  });
  expect((await fixed.boundingBox())!.x).toBeCloseTo(before!.x, 0);
  await page.screenshot({ path: '/tmp/sensing-management-desktop.png', fullPage: true });
  await row.getByRole('button', { name: new RegExp(team.name) }).click();
  await expect(page.getByRole('dialog')).toContainText('本人がこの月の「交通費なし」を申告済み');
  await page.keyboard.press('Escape');
  await expect(row.getByRole('button')).toBeFocused();
  await page.getByRole('tab', { name: /申請・レビュー/ }).click();
  await expect(page.getByRole('heading', { name: '週報の提出一覧' })).toBeVisible();
  await expect(page.getByRole('table', { name: '月末精算一覧' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'アカウント設定' }).click();
  await expect(page.getByRole('heading', { name: 'セッション管理・ログイン履歴' })).toBeVisible();
  await page.getByRole('tab', { name: '月末精算' }).click();
  await expect(page.getByLabel('管理の対象月')).toHaveValue('2026-09');
  await page.setViewportSize({ width: 390, height: 844 });
  await row.getByRole('button', { name: new RegExp(team.name) }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/tmp/sensing-management-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  // Return to the member and enter a cost: the previous declaration must be cancelled.
  await page.evaluate((id) => {
    const saved = JSON.parse(localStorage.getItem('sensingworks-firebase-demo-v2')!);
    saved.userId = id;
    localStorage.setItem('sensingworks-firebase-demo-v2', JSON.stringify(saved));
  }, team.id);
  await page.goto('/travel');
  await page.getByLabel('表示月').fill('2026-09');
  await page.getByLabel('利用日', { exact: true }).fill('2026-09-24');
  await page.getByLabel('出発地', { exact: true }).fill('自宅');
  await page.getByLabel('到着地', { exact: true }).fill('研究室');
  await page.getByLabel('バス代（片道・円）').fill('200');
  await page.getByRole('button', { name: '交通費を申請', exact: true }).click();
  await expect(page.getByText('2026-09の交通費：記録あり')).toBeVisible();
  await expect(page.getByRole('button', { name: 'この月は交通費なしと申告' })).toBeDisabled();
});
