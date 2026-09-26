# SensingWorks

WBSを中心に、チームで研究開発を進めるNext.js + Firebaseのプロジェクト管理ツールです。

## ローカル起動

Node.js 22以降で `npm ci` → `npm run dev`。`http://localhost:3100` を開きます。Firebase未設定時は架空データのデモです。ヘッダーでTeam / Ownerを切り替え、共同終了報告・承認を試せます。デモは `sensingworks-firebase-demo-v2` に保存します。旧デモの保存内容は削除せず別キーのまま残します。本番へのデモデータ自動送信はしません。

## 構成と無料運用

- Next.js App Routerを `output: 'export'` で静的出力し、Firebase Hostingから配信します。
- Google Sign-In / Firebase Authentication、Cloud Firestore、Security Rulesを使用します。
- SSR、API Route、Cloud Functions、Cloud Run、App Hosting、課金アカウントを必要としません。
- FirebaseのSparkプランを前提とし、無料クォータを超えれば利用が制限される運用です。無制限の利用は保証しません。
- Firestoreはリスナーで変更分を受信します。定期ポーリングは行いません。予定は表示週から14日間、操作履歴は最新100件に絞って購読します。小規模チーム向けの単一プロジェクト構成です。

**Storageの制約：** 現在のCloud Storage for FirebaseはSparkプランでは利用できず、Blazeが必要です。無料運用を優先し、本番の添付はGoogle Drive等の共有URLとして保存します。ファイルをFirestoreへ埋め込む回避策は使いません。Storage SDK・Rules・アップロード/認証付きダウンロードはローカルエミュレーターで利用・検証できます。本番のStorageは初期化・デプロイしません。課金プランへの変更は行いません。

公式資料：[Storageのプラン要件](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)、[Hostingの無料枠](https://firebase.google.com/docs/hosting/usage-quotas-pricing)。

## Firebaseの初期設定

1. SparkプランのFirebaseプロジェクトを用意します。既存の別アプリ用プロジェクトを流用しないでください。
2. AuthenticationでGoogleプロバイダーを有効化し、サポートメールを設定します。認証の承認済みドメインに利用するlocalhost・Hostingドメイン・独自ドメインを登録します。
3. Cloud Firestoreを本番モードで作成します。リージョンはチームに合わせて選びます。
4. `.env.example` を `.env.local` にコピーし、FirebaseのWebアプリ設定を入力します。公開Web設定のみで、サービスアカウント鍵は不要です。
5. Firebase CLIでログインし、対象IDを明示してRulesを適用します。

```sh
firebase deploy --project YOUR_PROJECT_ID --only firestore
```

6. 最初のOwnerは、アプリでGoogleログインした後、Firebase ConsoleでAuthのUIDを確認し、Firestore Consoleで `users/{UID}` を作ります。

```json
{"name":"オーナー名","role":"OWNER","active":true}
```

自己登録時の権限昇格はRulesで拒否するため、初回のOwner設定だけはConsoleによる信頼済み操作が必要です。OwnerのGoogleアカウントはメール確認済みである必要があります。

7. 初期許可ドメインは `0-s0g0.com` です。`info@0-s0g0.com` も対象です（Owner権限は自動付与しません）。再ログインして「管理」を開き、必要に応じて許可ドメイン・個別許可メールを設定します。保存先は `settings/access` です。既存ユーザーの利用停止は管理画面の「無効」で行います（許可リストからの削除は新規参加だけを制御します）。
8. 管理画面の「初期WBSを登録」で9大工程・57中工程・211小工程（添付のペットPoC WBS）を登録します。初期値をOwnerが確認し、担当者・ポイント・期限・依存関係・内部報酬を編集します。架空の完了・ポイント付与は登録しません。

認証に成功しても、許可されていないドメイン・アカウントはFirestoreの自己登録Rulesで拒否され、チームデータを読み取れません。Googleの `hd` パラメータだけに依存したドメイン制限は行いません。

## Hosting・独自ドメイン

```sh
npm run build
firebase deploy --project YOUR_PROJECT_ID --only hosting,firestore
```

`out/` の静的ファイルだけを配信します。Storage・Functionsのデプロイは含みません。旧ミッションURLのSPAフォールバックも設けず、廃止したURLは404になります。

Firebase Console → Hosting → カスタムドメインを追加し、表示された所有権確認TXT / A / CNAMEレコードをDNSに設定します。FirebaseがTLS証明書を発行した後、Authenticationの承認済みドメインにも追加します。ドメイン取得・更新費用はFirebaseの無料枠に含まれません。ドメインの購入、DNS変更、公開先選択をアプリが自動実行することはありません。

## 画面

| URL | 用途 |
| --- | --- |
| `/` | 自分の担当中ミッション全件・週報状態・直近MID.予定・累計ポイント |
| `/wbs` | 3階層の構造、依存関係、担当者、ポイント、参考進捗。中工程を開くと詳細・共同終了報告・Ownerレビュー |
| `/reports` | 全員の週報閲覧、本人の週報編集、週単位の完了ミッション・終了報告 |
| `/availability` | 全員のMID.予定閲覧、本人/Ownerの編集、時間範囲・日・週単位の削除 |
| `/profile` | 全員の累計ポイント・完了件数・主担当件数・共同担当件数、付与履歴 |
| `/admin` | Owner専用。レビュー待ち、内部実報酬、利用許可・ユーザー管理 |

サイドバーはTeamが5項目、Ownerは「管理」を追加した6項目です。

## データと権限

詳細は [仕様書](docs/specification.md) と `firestore.rules` を参照してください。

- `wbsItems`: 全3階層を保存。中工程のみ `pointValue` を持ちます。金額フィールドを追加する書き込みはOwnerでも拒否します。
- `rewardPrivate/{missionId}`: `totalAmount` / 実金額配分 / 支払状態。Ownerだけがread/write可能です。Teamはこのコレクションを購読しません。
- `pointAwards/{missionId}_{userId}`: 確定ポイント履歴。全員が閲覧可能。Ownerの承認バッチで作成し、上書き・削除は禁止します。
- `completionReports/{missionId}`: 担当者全員で1件を共同編集します。versionで競合を検出し、同時編集を無言で上書きしません。提出後は凍結、Ownerが修正依頼すると再編集できます。
- `taskAssignments` / `taskDependencies`: 公開WBSと同一バッチで同期。担当は最大6人、主担当は1人です。
- `weeklyReports`: 全員閲覧・本人のみ編集。Ownerも他人の週報を編集できません。
- `availability`: 全員閲覧。本人とOwnerだけが変更・削除できます。

申告貢献割合は担当者全員で合計100%。1人なら100%固定です。Ownerの最終ポイントは非負の整数で、合計は中工程の総ポイントと一致させます。実報酬配分は独立し、合計は内部総報酬と一致させます。基本換算は1pt=100円相当ですが、公開画面はポイントだけを表示し、配分額を再計算して表示することもありません。

依存関係の循環をRulesでも防ぐため、WBS作成時に固定する順序値より前の中工程を前提として選びます。前提は最大6件です。小工程は30件まで。対応開始後の担当者・総ポイント・依存関係の変更は凍結し、提出/承認の整合性を保ちます。自動解除は前提中工程のCOMPLETEDから計算し、バックグラウンド関数がなくても即座に利用可能状態になります。小工程100%は中工程を自動承認しません。

予定の大量保存は400セルずつの独立したバッチです。一部が通信失敗した場合は画面に未保存内容を残し、同じ内容を再保存できます。状態キーが固定のため二重登録されません。

## 検証

```sh
npm run typecheck
npm test
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

RulesテストにはFirebase CLIとJava 21以降を用意します。

```sh
npm run test:rules
```

`demo-sensingworks` のFirestore / Storageエミュレーターだけを使い、実プロジェクトへアクセスしません。未認証・未許可アカウントの拒否、Teamの金額取得拒否、公開WBSへの金額混入拒否、貢献割合100%、6人の整数配分、ポイント履歴の不変性、週報・予定の権限を確認します。

Firebase接続もローカルで試す場合は `.env.local` にダミーのFirebase Web設定（projectIdは `demo-sensingworks`）と `NEXT_PUBLIC_FIREBASE_EMULATORS=true` を設定し、`firebase emulators:start --only auth,firestore,storage --project demo-sensingworks` を別ターミナルで起動します。本番ビルドでは必ずEMULATORSをfalseに戻します。

### 担当変更とログイン履歴

WBSの担当アバター横の矢印から、有効な全メンバーが担当者（最大6人）と主担当を変更できます。提出済み・レビュー中・完了済みの工程は、承認・配分との整合性を守るため変更できません。下書きがある場合は、変更後の担当者で貢献割合を確認してから提出してください。

Ownerの管理画面には、`loginSessions` の直近100件を日本時間で表示します。GoogleのIDトークンの `auth_time` とUIDで重複を防ぎ、メール・本人・日時をSecurity Rulesで検証します。記録は変更・削除不可、一覧閲覧はOwnerのみです。アプリ接続時に記録するため、導入前の履歴やアプリに接続しなかった認証は含みません。オンライン状態や強制ログアウトの管理ではありません。デモでは実ログイン履歴を作成しません。

### 管理専用Admin

`users/{UID}` の `role: "ADMIN"` は、Ownerと同じ管理権限（内部報酬・ログイン履歴の閲覧、承認、ユーザー管理を含む）を持つ管理専用アカウントです。担当候補、週報の提出対象、MID.参加人数、実績一覧および参加者CSVから除外します。最初の管理者はFirebase Consoleで設定し、以後は管理画面のロール選択から設定できます。Googleアカウント自体を発行する機能ではありません。既存の担当者をAdminへ変更するときは、先に担当を引き継いでください。

ブラウザテストは本番接続済みの開発サーバーを再利用せず、3111番ポート・専用ビルドディレクトリでFirebase未設定のデモとして起動します。

初期WBSは `docs/imports/pet-poc-wbs.csv` を元にしています。開始日・期限・担当は未設定、内部報酬は未確定の0円です。中工程の公開ポイント合計は3,660ptです。本番登録前のバックアップはGit対象外の `.local-backups/` に保管します。
