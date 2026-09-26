import { test, expect } from '@playwright/test';
import { createSeed } from '../../src/lib/seed';
test('Team saves a route, reuses it across days, and management applies submitted costs', async ({
  page,
}) => {
  const state = createSeed();
  await page.addInitScript((state) => {
    if (!localStorage.getItem('sensingworks-firebase-demo-v2'))
      localStorage.setItem(
        'sensingworks-firebase-demo-v2',
        JSON.stringify({ state, userId: 'demo-aoki' }),
      );
  }, state);
  await page.goto('/travel');
  await page.getByLabel('利用日', { exact: true }).fill('2026-09-24');
  await page.getByLabel('出発地', { exact: true }).fill('自宅');
  await page.getByLabel('到着地', { exact: true }).fill('研究室');
  await page.getByLabel('バス代（片道・円）').fill('220');
  await page.getByLabel('電車代（片道・円）').fill('350');
  await page.getByLabel('駐車場代（1日分・円）').fill('500');
  await expect(page.getByLabel('交通費合計')).toContainText('1,640');
  await page.getByLabel('よく使う経路の名前').fill('いつもの経路');
  await page.getByRole('button', { name: 'この経路を保存' }).click();
  await page.getByRole('button', { name: '交通費を申請', exact: true }).click();
  await expect(page.getByText('保存状態：申請済み')).toBeVisible();
  await page.getByLabel('利用日', { exact: true }).fill('2026-09-25');
  await page.getByLabel('保存した経路を呼び出す').selectOption({ label: 'いつもの経路' });
  await expect(page.getByLabel('出発地', { exact: true })).toHaveValue('自宅');
  await page.getByLabel('片道・往復').selectOption('ONE_WAY');
  await expect(page.getByLabel('交通費合計')).toContainText('1,070');
  await page.getByRole('button', { name: '下書き保存', exact: true }).click();
  await expect(page.getByText('保存状態：下書き')).toBeVisible();
  await page.reload();
  await page.getByLabel('利用日', { exact: true }).fill('2026-09-25');
  await expect(page.getByLabel('出発地', { exact: true })).toHaveValue('自宅');
  await page.evaluate(
    (ownerId) => {
      const v = JSON.parse(localStorage.getItem('sensingworks-firebase-demo-v2')!);
      v.userId = ownerId;
      localStorage.setItem('sensingworks-firebase-demo-v2', JSON.stringify(v));
    },
    state.users.find((u) => u.role === 'OWNER')!.id,
  );
  await page.goto('/admin');
  await page.getByLabel('明細の対象者').selectOption('demo-aoki');
  await page.getByLabel('対象期間の開始日').fill('2026-09-01');
  await page.getByLabel('対象期間の終了日').fill('2026-09-30');
  await page.getByRole('button', { name: '申請済み交通費を明細に反映' }).click();
  await expect(page.getByLabel('交通費（円）', { exact: true })).toHaveValue('1640');
});
