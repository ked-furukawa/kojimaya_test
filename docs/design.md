# 設計書(OCR先行フェーズ)

最終更新: 2026-04-14
スコープ: **OCR機能を中心とした PoC 第一弾** の設計

関連: [requirements.md](./requirements.md) / [questions.md](./questions.md)

---

## 0. このフェーズのゴール

> **「タブレットで ISHIDA ITB の表示部を撮影 → 質量値を自動抽出 → 画面に表示・記録できる」** 状態をまず作る。

判定機能・指示重量計算・Excel取込は後続フェーズに送る。
ただし将来拡張を見越して、**マスタや履歴を入れる箱(データモデル)は最初から用意** しておく。

### 第一弾で「やること」
- [x] 撮影UI(PWA / タブレット)
- [x] S3への画像アップロード
- [x] Lambda経由でBedrockによるOCR(7セグLED対応)
- [x] OCR結果の表示と手動補正
- [x] 計量履歴の保存(最低限のメタデータ)
- [x] 容器(風袋)マスタの登録・更新画面
- [x] 認証(Amplify Auth)

### 第一弾で「やらないこと」
- 指示重量の自動計算(乾麺/生麺の式)
- 加水率調整による再計算
- Excel生産計画の取込
- 自動判定(OK/NG)→ ただし「指示重量を手入力すれば判定可能」程度は実装する想定
- オフライン対応

---

## 1. システム構成

```
┌──────────────────────────────┐
│  タブレット (iPad / Android)   │
│  ┌────────────────────────┐  │
│  │  PWA (React + Vite)    │  │
│  │  ・撮影/プレビュー       │  │
│  │  ・容器マスタ管理        │  │
│  │  ・履歴閲覧              │  │
│  └────────────────────────┘  │
└──────────────┬───────────────┘
               │ HTTPS
               ▼
┌──────────────────────────────────────┐
│        AWS (Amplify Gen2)             │
│  ┌────────────┐   ┌──────────────┐  │
│  │ Cognito    │   │ AppSync      │  │
│  │ (Auth)     │   │ + DynamoDB   │  │
│  └────────────┘   │ (Data)       │  │
│                   └──────┬───────┘  │
│  ┌──────────┐            │           │
│  │   S3     │◄───署名URL─┘           │
│  │ 画像保存  │                        │
│  └────┬─────┘                        │
│       │ ObjectCreated / 同期呼び出し   │
│       ▼                              │
│  ┌──────────────────┐                │
│  │  Lambda          │                │
│  │  (ocr-handler)   │                │
│  └────────┬─────────┘                │
│           │ InvokeModel               │
│           ▼                           │
│  ┌──────────────────┐                │
│  │  Bedrock         │                │
│  │  Claude Sonnet   │                │
│  │  (Vision)        │                │
│  └──────────────────┘                │
└──────────────────────────────────────┘
```

### 構成ポイント
- **Bedrock 直叩きはサーバ側のみ**:クライアントから直接呼ばない(認証情報・コスト管理)
- **画像は S3 に直接アップロード**(Amplify Storage):Lambda には S3キー だけ渡す
- **OCR は同期処理**:撮影 → 結果表示まで体感3〜5秒を目標
- **PWA で配布**:アプリストア審査不要、現場展開が早い

---

## 2. OCR 処理シーケンス

```
作業者         PWA           S3        Lambda      Bedrock     AppSync
  │             │             │            │           │           │
  │ 撮影         │             │            │           │           │
  ├────────────►│             │            │           │           │
  │             │ uploadFile  │            │           │           │
  │             ├────────────►│            │           │           │
  │             │   200 OK    │            │           │           │
  │             │◄────────────┤            │           │           │
  │             │ invokeOcr(s3Key)         │           │           │
  │             ├──────────────────────────►           │           │
  │             │             │  GetObject │           │           │
  │             │             │◄───────────┤           │           │
  │             │             │            │ Invoke    │           │
  │             │             │            ├──────────►│           │
  │             │             │            │  {value,  │           │
  │             │             │            │  conf}    │           │
  │             │             │            │◄──────────┤           │
  │             │  {value, confidence, raw}            │           │
  │             │◄──────────────────────────           │           │
  │  値を表示    │             │            │           │           │
  │◄────────────┤             │            │           │           │
  │ 確定         │             │            │           │           │
  ├────────────►│ create Measurement                   │           │
  │             ├────────────────────────────────────────────────►│
  │             │                                                  │
```

### OCR Lambda の入出力(契約)

AppSync の Custom Mutation `invokeOcr(s3Key, bucket)` 経由で呼び出す。

**GraphQL**:
```graphql
mutation InvokeOcr($s3Key: String!, $bucket: String!) {
  invokeOcr(s3Key: $s3Key, bucket: $bucket) {
    value
    unit
    confidence
    stable
    rawText
    warnings
  }
}
```

**Output 例**:
```json
{
  "value": 42.10,
  "unit": "kg",
  "confidence": 0.92,
  "stable": true,
  "rawText": "42.10 kg",
  "warnings": []
}
```

### Bedrock へのプロンプト方針

- モデル: `BEDROCK_MODEL_ID` 環境変数で指定(既定: `global.anthropic.claude-sonnet-4-6`)。新世代 Claude はオンデマンド呼び出しがサポートされないため、必ずインファレンスプロファイル(`global.*` / `jp.*` 等)経由で呼ぶ必要がある。Sonnet 4.6 は現状 `global.*` のみ存在するため、データを国内で完結させたい場合は 4.5 の `jp.*` を選ぶ選択肢がある。
- システムプロンプト:
  - 「画像は工業用デジタル計量機(ISHIDA ITB)の7セグメントLED表示」
  - 「単位は kg のみ。小数点を正確に読む。安定マークの有無も判定」
  - 「読み取れない場合は value=null, warnings に理由を入れる」
- レスポンスは **Tool use(`extract_weight`)で構造化**:`tool_choice` で必ずツール呼び出しを強制し JSON パース失敗を排除
- 信頼度が低い / 安定マーク無し の場合は PWA 側で **再撮影を促す**

### IAM・権限設計

- Lambda → Bedrock: `bedrock:InvokeModel` を `anthropic.*` foundation model + inference profile に限定
- Lambda → S3: Storage の `allow.resource(ocrHandler).to(['read'])` で `photos/*` のみ読取可
- フロント → AppSync: Cognito ユーザープール認証(`userPool` モード)

---

## 3. データモデル(第一弾の最小セット)

Amplify Data (`amplify/data/resource.ts`) で以下を定義する。

```ts
// 容器(風袋)マスタ
Container {
  id: ID
  name: string                  // 例: "標準ステンレスバット"
  tareWeightKg: float           // 風袋重量
  isDefault: boolean            // デフォルト容器(1件のみtrue想定)
  isActive: boolean             // 廃止用フラグ
  note: string?                 // 用途メモ
  createdAt / updatedAt / owner
}

// 計量1件
Measurement {
  id: ID
  imageS3Key: string            // S3上の画像
  ocrValueKg: float?            // OCR抽出値(風袋引き前)
  ocrConfidence: float?         // 0.0-1.0
  ocrStable: boolean?           // 安定マーク検出
  ocrRawText: string?           // モデルの生レスポンス(デバッグ用)
  manualValueKg: float?         // 手動補正後の値
  containerId: ID?              // 使った容器
  containerTareSnapshot: float? // 使用時点の風袋重量(履歴保護)
  netWeightKg: float?           // 正味重量 = (manual ?? ocr) - tare
  targetWeightKg: float?        // 任意:指示重量(手入力でもよい)
  judgment: enum?               // OK / OVER / UNDER / UNJUDGED
  ingredientLabel: string?      // 材料名(自由記述)※マスタ化は後続
  operator: string              // Cognitoユーザー
  measuredAt: AWSDateTime
  note: string?
}

// マスタ変更履歴(容器の値変更を記録)
AuditLog {
  id: ID
  entity: string                // "Container"
  entityId: ID
  action: string                // "create"|"update"|"deactivate"
  before: AWSJSON?
  after: AWSJSON?
  actor: string
  at: AWSDateTime
}
```

### 設計上のキモ
- **`containerTareSnapshot`**: 計量時点の風袋重量を `Measurement` にコピーして保持。後で容器マスタが更新されても、過去履歴の正味重量は変わらない。
- **`Recipe` / `Product` / `Lot` は今フェーズでは作らない**。OCR動作確認が最優先。
- **`ingredientLabel` は文字列**:マスタ化は Excel 取込 or 計算機能フェーズで導入する。

---

## 4. 画面構成(第一弾)

| 画面 | 内容 | 優先度 |
|------|------|------|
| ログイン | Cognito | ★ |
| ホーム | 「計量する」「履歴」「容器マスタ」 | ★ |
| **計量画面** | カメラ起動 → 撮影 → OCR結果表示 → 補正 → 保存 | ★★★ |
| 履歴一覧 | 日付・操作者でフィルタ、画像サムネ表示 | ★★ |
| 履歴詳細 | OCR値・補正値・画像・容器情報 | ★★ |
| 容器マスタ | 一覧・追加・編集・既定設定 | ★★ |

### 計量画面の主要ステップ
1. カメラビュー(ガイド枠表示で表示部を中央に)
2. シャッター → 撮影画像のプレビュー
3. 「OCR実行」ボタン → スピナー
4. 結果表示
   - OCR値(大きく)/ 信頼度バッジ / 安定マーク
   - 風袋重量(デフォルト容器から自動)
   - 正味重量(算出値)
   - **手動補正フィールド**(小さめ)
   - 任意:指示重量入力 → OK/NG即時判定
5. 「保存」 or 「撮り直し」

---

## 5. ディレクトリ構成案(npm workspaces によるモノレポ)

将来 **管理者向けWeb管理画面** や **計算ロジックの共有** を見越し、`apps/` + `packages/` のモノレポ構成を採用する。第一弾では `apps/tablet`(作業者向けPWA)のみを実装する。

```
c:/kojimaya_poc/
├── amplify/                          # バックエンド(全アプリで共有)
│   ├── auth/resource.ts
│   ├── data/resource.ts              # Container, Measurement, AuditLog, invokeOcr
│   ├── storage/resource.ts           # S3バケット定義
│   ├── functions/
│   │   └── ocr-handler/              # Bedrock呼び出し Lambda
│   │       ├── handler.ts
│   │       └── resource.ts
│   └── backend.ts
│
├── apps/
│   └── tablet/                       # 作業者向けPWA(現場タブレット用)
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Measure.tsx       # 計量画面(最重要)
│       │   │   ├── History.tsx       # 履歴
│       │   │   └── Containers.tsx    # 容器マスタ
│       │   ├── components/
│       │   ├── lib/
│       │   │   ├── amplify.ts        # Amplify.configure()
│       │   │   ├── ocr.ts            # invokeOcr クライアント
│       │   │   └── storage.ts        # S3アップロード
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/                         # 共通コード置き場
│   └── shared/                       # (第一弾では空でOK、足場だけ用意)
│       ├── src/
│       │   ├── types.ts              # 将来:共通型
│       │   └── calc/                 # 将来:指示重量計算(乾麺/生麺)
│       ├── package.json
│       └── tsconfig.json
│
├── docs/
│   ├── requirements.md
│   ├── questions.md
│   ├── design.md                     # this file
│   └── implementation-plan.md
│
├── amplify_outputs.json              # `npx ampx sandbox` で生成
├── package.json                      # ルート(workspaces 定義 + amplify 依存)
├── tsconfig.base.json                # 共通 TS 設定
└── tsconfig.json                     # workspaces 参照
```

### 配置上の判断

- **`amplify/` はルート直下に維持**:Amplify Gen2 の規約上 `npx ampx sandbox` がルートの `amplify/` を探すため、移動しない。
- **`apps/tablet`**:作業者向けPWA。現場利用の最重要アプリ。
- **`apps/admin` は将来**:管理者向けPC画面(マスタ管理・履歴ダッシュボード)が必要になった時点で追加する。
- **`packages/shared`**:第四弾の **指示重量計算ロジック(乾麺/生麺)** を置く想定。フロント側で即時計算 / Lambda側で検算、両方で再利用するため共通化する価値が高い。第一弾では足場のみ作成。
- **npm workspaces** を使い、依存解決と TS の Project References をルートで一元管理する。

### workspaces 定義(ルート package.json 抜粋)

```json
{
  "name": "kojimaya-poc",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:tablet": "npm run dev -w @kojimaya/tablet",
    "build:tablet": "npm run build -w @kojimaya/tablet",
    "sandbox": "ampx sandbox"
  }
}
```

各サブパッケージは `@kojimaya/tablet` `@kojimaya/shared` のようにスコープ付きで命名する。

---

## 6. 技術選定理由

| 項目 | 採用 | 理由 |
|------|------|------|
| バックエンド | AWS Amplify Gen2 | 既に雛形あり、Auth/Data/Storage/Function が一括管理可能 |
| OCRエンジン | Bedrock Claude Sonnet (Vision) | 7セグLEDは通常OCR(Tesseract/Textract)が苦手。VLMが現状最も精度が出やすい。Tool use で構造化レスポンス可 |
| フロントエンド | React + Vite + PWA | iOS/Android両対応、配布が容易。ネイティブアプリ化は将来検討 |
| プロジェクト構成 | npm workspaces モノレポ(`apps/` + `packages/`) | 将来の管理者用Web追加・計算ロジック共通化に備える |
| 状態管理 | Amplify Data (AppSync) のクライアントを直接利用 | 余計な抽象を入れない |
| スタイル | (未定 → Tailwind 想定) | 現場向けの大きいUI を素早く作れる |

---

## 7. リスク・段階的検証ポイント

| # | リスク | 検証方法 |
|---|--------|----------|
| 1 | Bedrock Vision の **7セグ読み取り精度が出ない** | 早期に手元の画像10〜20枚で精度測定。NG なら前処理(2値化・コントラスト強調)+再評価 |
| 2 | 表示部の反射でOCRが揺れる | 撮影ガイド枠+「光が反射していないか確認」プロンプトで運用カバー |
| 3 | レイテンシが体感5秒を超える | 画像リサイズ(長辺1024px程度)で削減。Lambdaのcold startはProvisioned Concurrencyで対応可 |
| 4 | Bedrock コスト | 1枚あたり試算し[questions.md F-1]に追記。月間ロット数次第 |

---

## 8. 次のアクション

1. **OCR精度の事前検証**(コード書く前)
   - 実機の表示部画像を 10〜20 枚集めて Bedrock Console で精度を見る
   - 採用可否を判断
2. 上記OKなら Amplify Data に `Container` / `Measurement` / `AuditLog` を追加
3. `ocr-handler` Lambda 雛形を作る
4. PWAの計量画面を最小実装

---

## 9. 後続フェーズの予告

| フェーズ | 内容 | 着手条件 |
|----------|------|----------|
| 第二弾 | 指示重量の手入力+判定、容器運用の確認 | 第一弾稼働 |
| 第三弾 | Excel生産計画取込、ロット管理 | 既存Excelフォーマット入手 |
| 第四弾 | 指示重量自動計算(乾麺/生麺)、加水率調整 | 計算式ヒアリング完了 |
| 将来 | 計量機シリアル直結、在庫連携 | 経営判断 |
