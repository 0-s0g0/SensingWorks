import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  savedPaymentResult,
  hasManualAmount,
  type PaymentStatement,
  validPaymentDate,
} from './payment';
import { type PointAward, yen } from './domain';
export async function paymentDocx(
  p: PaymentStatement,
  name: string,
  outputDate: string,
  awards: PointAward[],
) {
  if (!validPaymentDate(outputDate)) throw Error('出力日を確認してください。');
  const c = savedPaymentResult(p, awards);
  const rows = [
    ['項目', '金額'],
    ['AI利用料（定額）', yen(p.aiFee)],
    ['交通費', yen(p.travelCost)],
    [hasManualAmount(p) ? '作業報酬（手動設定）' : '作業報酬（ポイント計算）', yen(c.workAmount)],
    ['支払合計', yen(c.total)],
  ];
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' };
  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Yu Gothic', size: 22, color: '000000' },
          paragraph: { spacing: { after: 160 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [
              new TextRun({ text: '電磁波PJ 支払明細書', color: '000000', size: 36, bold: true }),
            ],
          }),
          ...[
            `出力日：${outputDate}`,
            `氏名：${name}`,
            `支払い対象期間：${p.periodStart} ～ ${p.periodEnd}`,
          ].map((text) => new Paragraph(text)),
          new Table({
            width: { size: 9638, type: WidthType.DXA },
            columnWidths: [6000, 3638],
            borders: {
              top: border,
              bottom: border,
              left: border,
              right: border,
              insideHorizontal: border,
              insideVertical: border,
            },
            rows: rows.map(
              (row, i) =>
                new TableRow({
                  children: row.map(
                    (text, j) =>
                      new TableCell({
                        width: { size: j ? 3638 : 6000, type: WidthType.DXA },
                        margins: { top: 160, bottom: 160, left: 180, right: 180 },
                        shading: i === 0 ? { fill: 'E8EEF3' } : undefined,
                        children: [
                          new Paragraph({
                            alignment: j ? AlignmentType.RIGHT : AlignmentType.LEFT,
                            children: [new TextRun({ text, bold: i === 0 || i === 4 })],
                          }),
                        ],
                      }),
                  ),
                }),
            ),
          }),
          new Paragraph({ text: '作業報酬の計算・調整', spacing: { before: 320, after: 160 } }),
          new Paragraph(`対象期間の承認済みポイント：${c.points.toLocaleString('ja-JP')} pt`),
          new Paragraph(
            `計算額：${c.points.toLocaleString('ja-JP')} pt × ${yen(p.pointRate)} / pt ＝ ${yen(c.rawVariable)}`,
          ),
          new Paragraph(
            `上限額：${yen(p.variableCap)}　ポイント計算額（上限適用後）：${yen(c.variable)}`,
          ),
          new Paragraph(
            `採用する作業報酬：${yen(c.workAmount)}（${hasManualAmount(p) ? '手動設定' : 'ポイント計算'}）`,
          ),
          ...(p.changeReason ? [new Paragraph(`変更理由：${p.changeReason}`)] : []),
          new Paragraph(
            p.calculation
              ? 'ポイント・金額は明細の保存時点の記録です。'
              : '旧形式の明細のため、現在のポイントから計算しています。',
          ),
          new Paragraph('ポイントは承認日を日本時間で集計し、対象期間の開始日・終了日を含みます。'),
        ],
      },
    ],
  });
  return Packer.toBlob(document);
}
