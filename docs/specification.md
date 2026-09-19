# SensingWorks仕様（Firebase・ポイント版）

今回の追加指示を優先し、WBS中心の研究開発管理に統一する。

## インフラ

Next.js静的エクスポート → Firebase Hosting。Google Sign-In、Firestore、Security Rules。Sparkプランを前提にSSR・Functions・App Hostingは使わない。Storageは現在Sparkで利用できないため、無料運用では添付共有リンクを保存する。Storageの実装とルール検証はローカルエミュレーター専用。

## WBS

- level 1: 大工程（フェーズ）。中工程完了数/件数・割合を表示する。
- level 2: 中工程。公開整数 `pointValue`、最大6人の `assigneeIds`、1人の `primaryId`、最大6件の `dependencyIds`、期限、状態を持つ。
- level 3: 達成の参考小工程。ポイント0、報酬なし。独立した進捗を保存する。
- parentIdで階層を保持し、テーブル/ツリー/モバイルのアコーディオンを使用する。
- 全展開/折りたたみ、番号/タイトル検索、大工程・状態・ポイント・担当者フィルター。
- 中工程詳細はWBS上のダイアログ。ホームや実績からは `/wbs/#中工程ID` で直接開く。
- Ownerが全体を編集し、Teamは自分が担当する中工程の進行と参考小工程を更新する。

## コレクション

| コレクション | ドキュメントID/主要フィールド | 権限 |
| --- | --- | --- |
| users | Auth UID / name, role: TEAM or OWNER, active | メンバー閲覧、Owner管理。自己登録は許可されたGoogleアカウントのみTEAM固定 |
| projects | wifi-poc / name, startDate, endDate | 全員閲覧、Owner編集 |
| wbsItems | ID / projectId, parentId, wbsCode, level, title, description, pointValue, status, deadline, assigneeIds, primaryId, dependencyIds, autoUnlock, order, finalPoints, approvedBy, completedAt | 全員閲覧、構造・条件はOwner。Teamは担当分の許可された進捗のみ |
| taskAssignments | missionId_userId / missionId, userId, isPrimary, assignedAt | 全員閲覧、Owner。WBSの担当と照合 |
| taskDependencies | missionId_dependsOnId / missionId, dependsOnId | 全員閲覧、Owner。WBSと照合 |
| taskApplications | 未使用 | 旧応募フローは廃止。アクセス拒否 |
| completionReports | missionId / 技術記録、contributionShares、status、version | 全員閲覧、担当者が共同編集、Ownerがレビュー |
| weeklyReports | userId_weekStart / 振り返り5項目、status | 全員閲覧、本人のみ編集 |
| availability | userId_date_hour / userId, date, hour, status | 全員閲覧、本人・Owner編集削除 |
| pointAwards | missionId_userId / missionId, userId, points, awardedAt, approvedBy | 全員閲覧、Owner承認時のみ作成、変更/削除不可 |
| rewardPrivate | missionId / totalAmount, allocations, approvedAt, approvedBy, paymentStatus | Ownerのみ。Teamのreadを拒否 |
| activityLogs | ID / userId, action, createdAt | 全員閲覧、自分の操作を記録。報酬値は含めない |
| settings/access | allowedDomains, allowedEmails | Ownerのみ管理。自己登録Rulesが参照 |

IDはドキュメントパスとして保持し、フィールドへの重複保存はしない。前提/担当の配列はRulesが最大6件を検証するための集約表現で、関係ドキュメントと同一バッチで同期する。public/privateの金額分離は必須で、公開WBSのフィールド許可リストから金額を排除する。

## 終了報告・承認

実施内容、結果、うまくいったこと、うまくいかなかったこと、分かったこと、残課題、引き継ぎ、実作業時間、GitHub URL、外部URL、添付、担当者ごとの申告貢献割合を保存。

担当者は共同下書き→提出。実施内容・結果は提出時必須。割合は整数0〜100で、全員分の合計100。単独担当は100。versionを使ったトランザクションで古い下書きからの上書きを拒否する。提出後はOwnerによるレビュー/修正依頼/承認を待つ。修正依頼にはコメントが必須。

Ownerの承認は中工程COMPLETED、終了報告APPROVED、全員のpointAwards作成、private実報酬配分を1トランザクションで確定。公開ポイントは非負の整数で、合計pointValueと一致必須。申告割合に一致する必要はない。内部実報酬も非負の整数で、合計totalAmountと一致必須。ポイント提案値の端数は最大剰余法で整数化し、Ownerが調整できる。

確定ポイントと実報酬は別データ。Teamに通貨表記・実金額の取得経路を提供しない。Ownerによる支払済み記録は送金そのものではない。

## 自動ロックと無料構成

依存は固定順序の小さい中工程だけを指せるので循環できない。自動解除ONのLOCKED中工程は前提が全件COMPLETEDになると、読み取り時にASSIGNED/OPENとして解釈する。Firestore Rulesも開始操作時に同じ前提を検証する。無料構成のため常駐バックエンドを置かず、他ドキュメントへの連鎖書き込みを不要にする。

## 閲覧・実績

Team/Ownerのサイドバーはホーム・WBS・週報・MID.予定・マイ実績。Ownerにだけ管理を追加。ホームは現在担当中の全中工程、今週の週報状態、近い参加可能予定、累計獲得ポイントを表示する。実績はpointAwardsから集計し、他メンバーの累計・完了件数・主担当件数・共同担当件数も見られる。順位で煽る表示はしない。

## MID.予定

2026-09-01〜2027-03-31、9〜23時の1時間枠。横軸日付・縦軸時刻。AVAILABLE / MAYBE / UNAVAILABLE / 未入力。矩形ドラッグ、タップ、期間/曜日入力、部分削除、日/週の全削除、横/縦スクロール。全員の予定を個別または集計で閲覧できる。他人の予定はTeamに読み取り専用、Ownerは対象者を選択して編集できる。未保存変更がある間は編集対象者を切り替えない。
