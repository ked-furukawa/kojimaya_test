# 実装計画書

最終更新: 2026-04-15
スコープ: OCR先行フェーズ(第一弾)の実装手順
関連: [requirements.md](./requirements.md) / [design.md](./design.md) / [questions.md](./questions.md)

---

## 0. 全体方針

- **段階的に動くものを作る**:大きな実装をまとめてやらず、各ステップで動作確認できる粒度に分割
- **OCR精度検証を最初に行う**:Bedrockで7セグが読めなかった場合、ここで方針転換できるようにする
- **将来拡張の足場は最初から用意**:データモデルは「最小だが拡張可能」な形で導入
- **ドキュメント駆動**:ヒアリングで判明した事項は都度 [questions.md](./questions.md) → [requirements.md](./requirements.md) に反映

---

## 1. マイルストーン

| M | 名称 | 状態 | ゴール | 主要成果物 |
|---|------|------|--------|------------|
| **M0** | OCR精度検証 | ⏸ 画像収集待ち | Bedrock Vision で実機表示部の数値を安定して読めることを確認 | 検証レポート |
| **M1** | バックエンド基盤 | ✅ 完了 | Amplify Data/Storage/Function が立ち上がる | `amplify/` 更新 |
| **M2** | OCR Lambda | ✅ 完了 | S3キーを渡すと数値JSONが返る | `ocr-handler` |
| **M3** | フロント雛形 | ✅ 完了 | ログインしてホーム画面が出る | `apps/tablet` モノレポ雛形 |
| **M4** | 計量画面MVP | ✅ 完了 | 撮影→OCR→結果表示→保存ができる | `apps/tablet/src/pages/Measure.tsx` |
| **M5** | 容器マスタ | ✅ 完了 | 容器の登録・更新・既定設定 | `apps/tablet/src/pages/Containers.tsx` |
| **M6** | 履歴閲覧 | 🔜 次 | 過去の計量を一覧/詳細で見られる | `apps/tablet/src/pages/History.tsx` |
| **M7** | 現場検証 | ⬜ | タブレット実機でPilot運用 | フィードバック |

各 M は前の M に依存。M0 はコード実装と並行可能(画像が揃い次第いつでも検証可)。

---

## 2. ステップ詳細

### M0. OCR精度検証(コード前)

**目的**: Bedrock Vision が ISHIDA ITB の7セグメント表示を読めるかを早期に確認する。読めなければ前処理追加 or 別案を検討。

**手順**:
1. 実機の表示部画像を **10〜20枚** 収集
   - 距離: 近(30cm)/ 中(60cm)/ 遠(1m)
   - 角度: 正面 / 斜め30度
   - 照明: 蛍光灯下 / 反射あり / 暗め
   - 表示値: 0.00 / 小さい値 / 大きい値 / 安定マークOFF も含む
2. Bedrock Console(または簡易スクリプト)で `claude-sonnet-4-6` に画像を投入
3. 採点表を作成
   - 正解率(完全一致 / ±目量以内)
   - 信頼度の付き方
   - 失敗パターン
4. **判定基準**:
   - ✅ 正解率 95% 以上 → そのまま M1 へ
   - ⚠️ 80–95% → 前処理(コントラスト強調・トリミングUI)を追加して再評価
   - ❌ 80% 未満 → 方針見直し(専用OCR、計量機シリアル直結、ハイブリッド等)

**完了条件**: 検証レポートを `docs/ocr-validation.md` に追加し、M1 着手の可否を判断

---

### M1. バックエンド基盤整備

**作業項目**:
1. `amplify/data/resource.ts` にモデル追加
   - `Container`
   - `Measurement`
   - `AuditLog`
2. `amplify/storage/resource.ts` を新規作成
   - 画像用バケット(`photos/{user_id}/*` のような owner ベースのアクセス制御)
3. `amplify/auth/resource.ts` の確認(現状の雛形でOKか)
4. `amplify/backend.ts` で storage / function を統合
5. `npx ampx sandbox` でローカル起動確認

**完了条件**:
- `amplify_outputs.json` が更新され、Data/Storage が利用可能になる
- DynamoDB に `Container` を1件手動で作成できる

---

### M2. OCR Lambda 実装

**作業項目**:
1. `amplify/functions/ocr-handler/` を作成
   - `resource.ts` (Function 定義、Bedrock 呼び出し IAM 付与)
   - `handler.ts` (本体)
2. ハンドラ仕様:
   - 入力: `{ s3Key: string }`
   - 処理: S3 から画像取得 → Bedrock InvokeModel → JSON抽出 → 返却
   - 出力: `{ value, unit, confidence, stable, rawText, warnings }`
3. プロンプト・Tool定義
   - design.md §2 の方針に沿ってプロンプト作成
   - Tool use で構造化(`extract_weight` という関数を1つ持つ)
4. AppSync の Custom Mutation `invokeOcr(s3Key)` から呼び出せるようにする
5. ローカル/Sandbox で疎通確認
6. エラー時の挙動(画像不在、Bedrock失敗、JSON崩れ)を最低限ハンドリング

**完了条件**:
- 任意の画像をS3にアップ → `invokeOcr` 呼び出し → 数値が返る

---

### M3. フロント雛形(モノレポ + apps/tablet)

> 注: 配置は npm workspaces による `apps/` + `packages/` 構成を採用([design.md §5](./design.md#5-ディレクトリ構成案npm-workspaces-によるモノレポ))。

**作業項目**:
1. **モノレポ足場の整備**
   - ルート `package.json` に `"private": true` と `"workspaces": ["apps/*", "packages/*"]` を追加
   - `tsconfig.base.json` を作成(共通コンパイラオプション)
   - 既存の amplify 依存はルート `package.json` のままで OK
2. **`packages/shared` の足場作成**(中身は空でOK)
   - `package.json`(name: `@kojimaya/shared`)
   - `src/index.ts`(空 export)
   - `tsconfig.json`(`tsconfig.base.json` を extends)
3. **`apps/tablet` 作成**
   - Vite + React + TypeScript で初期化
   - `package.json` の name を `@kojimaya/tablet` に
   - 依存追加: `aws-amplify`, `@aws-amplify/ui-react`, `react-router`, Tailwind
   - `vite.config.ts` の base 設定(必要なら)
4. **Amplify 接続**
   - ルートの `amplify_outputs.json` を `apps/tablet/src/lib/amplify.ts` から相対参照
   - `Amplify.configure(outputs)` を初期化エントリで呼ぶ
5. **ルーティング雛形**:`/`(Home)`/measure` `/history` `/containers`
6. **Cognito ログイン画面**(Amplify UI Authenticator)を組み込み
7. **ホーム画面**に3つの大ボタン(計量する/履歴/容器マスタ)
8. **PWAマニフェスト・アイコン仮置き**
9. **動作確認**:ルートから `npm run dev:tablet` で起動

**完了条件**: ログインしてホーム画面が表示される + ルートから workspaces 経由でビルド/起動できる

---

### M4. 計量画面 MVP(最重要)

**作業項目**:
1. `apps/tablet/src/pages/Measure.tsx` 作成
2. カメラ起動: HTML5 `<input type="file" accept="image/*" capture="environment">` から始める(まずシンプル)
3. プレビュー表示
4. 「OCR実行」ボタン押下で:
   - 画像を Amplify Storage に `uploadData()`
   - 完了後、`invokeOcr(s3Key)` を呼ぶ
   - スピナー表示
5. 結果表示パネル
   - OCR値(大文字)
   - 信頼度バッジ
   - 安定マークの有無
   - **手動補正フィールド**
   - デフォルト容器の風袋重量(自動表示)
   - 正味重量(計算結果)
   - 任意:指示重量入力欄(あれば±判定)
6. 「保存」で `Measurement` を作成
   - `containerTareSnapshot` に当時の風袋を **必ずコピー** する
7. 「撮り直し」で初期状態へ

**完了条件**: タブレット実機 or PC で 撮影 → OCR → 補正 → 保存 が一通り動く

---

### M5. 容器マスタ画面

**作業項目**:
1. `apps/tablet/src/pages/Containers.tsx` 作成
2. 一覧表示(名前 / 風袋重量 / 既定 / 有効)
3. 新規追加フォーム(名前・風袋重量・メモ)
4. 編集フォーム
5. 「既定にする」操作
   - 他の `isDefault=true` を false にしてから対象を true に(トランザクション的に)
6. 無効化(物理削除はせず `isActive=false`)
7. 変更時に `AuditLog` レコードを書く(before/after)

**完了条件**: 容器を追加・更新・既定変更でき、Measure画面の風袋自動取得に反映される

---

### M6. 履歴閲覧

**作業項目**:
1. `apps/tablet/src/pages/History.tsx` 一覧
   - 日付・操作者でフィルタ
   - 画像サムネイル(S3署名URL)
2. 詳細モーダル/ページ
   - OCR値・補正値・正味重量・容器情報
   - 画像の拡大表示
3. CSVエクスポート(任意)

**完了条件**: 過去の計量記録を遡って確認できる

---

### M7. 現場検証(Pilot)

**作業項目**:
1. タブレット実機にPWAをインストール
2. 工場Wi-Fi下で接続確認
3. 実際の作業者に試用してもらう
4. 観点:
   - OCR精度(再現性)
   - 撮影しやすさ(ガイド枠の必要性)
   - 操作ステップ数の体感
   - エラー時の挙動
5. フィードバックを [questions.md](./questions.md) に追記
6. 改善 → 次フェーズの優先度判断

**完了条件**: Pilot レポート作成、第二弾の要件確定

---

## 3. 想定スケジュール感(目安)

実工数ではなく **作業の重さの相対感** として記載。要員1〜2名想定。

| M | 規模感 | 備考 |
|---|--------|------|
| M0 | S | 画像が手に入れば1日で可否判定可能 |
| M1 | M | Amplify Gen2 経験次第 |
| M2 | M | Bedrock初回設定+プロンプトチューニング込み |
| M3 | S | 雛形作成 |
| M4 | L | 一番作り込みが必要 |
| M5 | M | |
| M6 | M | |
| M7 | M | 現場調整次第 |

---

## 4. 並走可能な作業

以下はメイン開発と並行して進められる:

- **ヒアリング**(questions.md の解消)
  - 既存Excel入手 / 加水率ルール / 製品ラインナップ
- **AWSアカウント整備**(リージョン・Bedrock有効化・コスト上限)
- **タブレット調達**(機種未確定なら早めに)
- **容器の風袋重量実測**

---

## 5. 完了の定義(第一弾DoD)

- [ ] 計量機の表示をタブレットで撮影 → 数値が画面に出る
- [ ] OCR誤読時に手動補正できる
- [ ] 容器マスタからデフォルト風袋が自動適用される
- [ ] 計量記録がクラウドに保存され、後から閲覧できる
- [ ] Cognito 認証で個人ログインできる
- [ ] 現場タブレット1台でPilot動作する
- [ ] 設計・要件・質問・実装計画ドキュメントが最新化されている

---

## 6. 未確定により凍結されている領域

| 領域 | 凍結理由 | 解凍条件 |
|------|----------|----------|
| 指示重量自動計算 | 計算式未入手 | 既存Excel入手(Q: A-1) |
| 加水率調整 | 運用ルール未確認 | ヒアリング(Q: A-2) |
| Excel取込 | フォーマット未入手 | サンプル入手(Q: B-4) |
| 自動判定(OK/NG)の本格運用 | 許容誤差ルール未確定 | ヒアリング(Q: A-3) |
| オフライン対応 | 不要と判断 | 現場でWi-Fi不安定が判明したら再検討 |

---

## 7. 次の一手

1. **実機表示部の画像 10〜20 枚を収集**(M0 着手のため)
2. **AWSアカウント・リージョン・Bedrock利用可否の確認**(M1 着手のため)
3. 上記2点が揃った時点で M0 開始
