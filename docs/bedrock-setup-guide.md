# Bedrock セットアップガイド

最終更新: 2026-04-16
目的: AWS Bedrock（Claude 系モデル）を使ったプロジェクトの初期構築で
踏みやすいハマりポイントと対処法をまとめる。
kojimaya_poc プロジェクトでの実体験に基づく。

---

## 1. 前提知識: モデル ID とインファレンスプロファイル

### モデル ID の種類

Bedrock には 3 種類の ID 体系がある。

| 種類 | 例 | 用途 |
|------|-----|------|
| **Foundation Model ID** | `anthropic.claude-sonnet-4-5-20250929-v1:0` | モデルの基底 ID。一覧取得用。**新世代モデルでは直接 invoke できない** |
| **Inference Profile ID** | `jp.anthropic.claude-sonnet-4-5-20250929-v1:0` | リージョン固定のプロファイル。invoke にはこれを使う |
| **Inference Profile ID (Global)** | `global.anthropic.claude-sonnet-4-6` | リージョン跨ぎのプロファイル。invoke にはこれを使う |

### 新世代モデルの制約（Claude 4 系以降）

Claude 4 系（Sonnet 4.5 / 4.6、Opus 4.5 / 4.6、Haiku 4.5）は
**オンデマンドの直接呼び出し（Foundation Model ID を指定した invoke）をサポートしていない**。
必ずインファレンスプロファイル経由で呼ぶ必要がある。

```
❌ anthropic.claude-sonnet-4-6         ← Foundation Model ID → invoke 不可
✅ global.anthropic.claude-sonnet-4-6  ← Inference Profile ID → invoke 可
✅ jp.anthropic.claude-sonnet-4-5-...  ← Inference Profile ID → invoke 可
```

旧世代モデル（Claude 3.5 Sonnet 等）はこの制約がなく、
Foundation Model ID でそのまま invoke できる。

### プロファイルのリージョンプレフィックス

| プレフィックス | ルーティング | データ所在 |
|---------------|------------|-----------|
| `jp.*` | 日本国内のみ | 日本国内に留まる |
| `apac.*` | APAC リージョン群 | アジア太平洋内 |
| `us.*` | 米国東西 | 米国内 |
| `eu.*` | ヨーロッパ | EU 内 |
| `global.*` | 全リージョンから最適を選択 | **どのリージョンに行くか不定** |

**データ所在要件がある場合**（食品製造、医療、金融など）は
`jp.*` や国別プロファイルを選ぶこと。POC なら `global.*` で問題ない。

すべてのモデルに全プレフィックスが存在するわけではない。
例: Sonnet 4.6 は `global.*` のみ、Sonnet 4.5 は `jp.*` と `global.*` の両方が存在（2026-04 時点）。

---

## 2. セットアップ手順

### 2.1 利用可能なモデルの確認

```bash
# Foundation Model（基底モデル）の一覧
aws bedrock list-foundation-models \
  --region ap-northeast-1 \
  --query "modelSummaries[?contains(modelId, 'claude')].[modelId]" \
  --output text

# Inference Profile（実際に invoke に使う ID）の一覧
aws bedrock list-inference-profiles \
  --region ap-northeast-1 \
  --query "inferenceProfileSummaries[?contains(inferenceProfileId, 'claude')].[inferenceProfileId,inferenceProfileName,status]" \
  --output table
```

**確認するポイント**:
- 使いたいモデルが `status: ACTIVE` であること
- プレフィックス（`jp.*` / `global.*` 等）がどれか

### 2.2 モデルサブスクリプション（初回のみ）

Bedrock のモデルは **AWS アカウント単位で 1 回サブスクライブが必要** になる場合がある。
2026 年 4 月時点では「モデルアクセスページ」は廃止され、
**初回 invoke 時に自動サブスクライブ** される仕組みに変わった。

ただし自動サブスクライブには **AWS Marketplace 権限が必要**:

```
aws-marketplace:ViewSubscriptions
aws-marketplace:Subscribe
```

Lambda の実行ロールや制限付き IAM ユーザーはこの権限を持っていないことが多い。
その場合、以下のエラーが出る:

```
Model access is denied due to IAM user or service role is not authorized to perform
the required AWS Marketplace actions (aws-marketplace:ViewSubscriptions,
aws-marketplace:Subscribe) to enable access to this model.
```

**対処**: Marketplace 権限を持つ管理者ユーザーが **1 回だけ** 手動で呼び出す。

#### 方法 A: Bedrock Playground（推奨）

1. 管理者ユーザーで AWS コンソールにサインイン
2. Bedrock → Chat / Text playground を開く
3. 使いたいモデルを選択
4. Anthropic の場合、初回はユースケース記入フォームが出るので記入して同意
5. 適当にメッセージを送信（例: 「Hello」）
6. 返答が返ればアカウント全体で有効化完了

#### 方法 B: CLI

```bash
aws bedrock-runtime invoke-model \
  --region ap-northeast-1 \
  --model-id "global.anthropic.claude-sonnet-4-6" \
  --content-type application/json \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":50,"messages":[{"role":"user","content":"hello"}]}' \
  output.json
```

管理者プロファイルで実行すること。

#### サブスクリプション状況の確認

AWS Marketplace コンソール → サブスクリプションの管理:
https://console.aws.amazon.com/marketplace/home#/subscriptions

「アクティブなサブスクリプション」に対象モデルが表示されていれば OK。

**注意**: サブスクリプションがアクティブでも、反映に **数分〜10 分** かかることがある。
エラーメッセージに「try again after 2 minutes」と出ている場合は待つ。

---

## 3. よくあるエラーと対処

### エラー 1: `The security token included in the request is invalid`

**段階**: AWS API 呼び出し全般（Bedrock に限らない）

**原因**: AWS 認証情報が無効。以下のいずれか:
- SSO セッション期限切れ（デフォルト 8 時間で切れる）
- 環境変数に古い/無効なアクセスキーが残っている
- `AWS_PROFILE` 環境変数が未設定で、`~/.aws/credentials` の `[default]` に無効なキーがある

**診断**:

```bash
# 今の認証状態を確認
aws sts get-caller-identity

# どの認証情報ソースを使っているか確認
aws configure list
```

`aws configure list` の出力で **Type 列** を見る:

| Type | 意味 | よくある問題 |
|------|------|------------|
| `sso` | SSO 経由 → 正常 | セッション切れ → `aws sso login` |
| `shared-credentials-file` | `~/.aws/credentials` ファイル | 古いキーが残っている |
| `env` | 環境変数 | 無効な値がセットされている |
| `not set` | 認証情報なし | 設定が必要 |

**対処**:

```bash
# SSO の場合: 再ログイン
aws sso login --profile <profile名>

# 環境変数にゴミが残っている場合（PowerShell）:
Remove-Item Env:AWS_ACCESS_KEY_ID
Remove-Item Env:AWS_SECRET_ACCESS_KEY
Remove-Item Env:AWS_SESSION_TOKEN

# プロファイルが設定されていない場合（PowerShell）:
$env:AWS_PROFILE = "<profile名>"
```

**注意**: `$env:AWS_PROFILE` は **そのターミナルセッション限定**。
別のターミナルを開いたら再度設定が必要。
恒久的にしたい場合は PowerShell の `$PROFILE` に記載するか、
`~/.aws/credentials` の `[default]` に古いキーが残っていれば削除する。

### エラー 2: `The provided model identifier is invalid`

**段階**: Bedrock InvokeModel 呼び出し時

**原因**: 指定したモデル ID がこのアカウント/リージョンで認識できない。

**よくあるパターン**:
- Foundation Model ID を直接使っている（前述の通り、新世代モデルでは不可）
- プレフィックス（`apac.*` / `jp.*` / `global.*`）が間違っている
- そのリージョンにインファレンスプロファイルが存在しない
- モデル ID のタイポ（バージョン部分 `20250929-v1:0` など）

**診断**:

```bash
# 使えるインファレンスプロファイルを一覧
aws bedrock list-inference-profiles \
  --region ap-northeast-1 \
  --query "inferenceProfileSummaries[?contains(inferenceProfileId, 'sonnet')].[inferenceProfileId,status]" \
  --output table
```

出力された ID を **そのままコピペ** してコードに使う。

### エラー 3: `Invocation of model ID ... with on-demand throughput isn't supported`

**段階**: Bedrock InvokeModel 呼び出し時

**原因**: 新世代モデルの Foundation Model ID を直接指定している。

```
❌ anthropic.claude-sonnet-4-5-20250929-v1:0        ← Foundation Model ID
✅ jp.anthropic.claude-sonnet-4-5-20250929-v1:0     ← Inference Profile ID
✅ global.anthropic.claude-sonnet-4-6               ← Inference Profile ID
```

**対処**: `list-inference-profiles` で正しいプロファイル ID を取得し、
そちらに差し替える。§1 参照。

### エラー 4: `Model access is denied due to IAM user or service role is not authorized to perform the required AWS Marketplace actions`

**段階**: Bedrock InvokeModel 呼び出し時（初回サブスクライブ前）

**原因**: このモデルのアカウント全体でのサブスクリプションが完了していない。
かつ、呼び出し元のロール/ユーザーに Marketplace の権限がない。

**対処**: §2.2 の手順で管理者が 1 回だけ手動でサブスクライブする。
Lambda から呼ぶ場合でも、Lambda のロールに Marketplace 権限を付けるのではなく、
**管理者が Playground か CLI で 1 回呼び出す** のが正しい手順。

サブスクライブ後は全 IAM ユーザー/ロールがアカウント全体で invoke 可能になる。

### エラー 5: `Bedrock response did not contain tool_use output`

**段階**: Bedrock のレスポンスパース時

**原因**: モデルが tool_use ブロックを返さなかった。以下のいずれか:
- プロンプトが不適切で、モデルがツールを呼ばずにテキストで返した
- `tool_choice` の指定が漏れている（`tool_choice: { type: 'tool', name: '...' }` が必要）
- 画像が大きすぎて/壊れていて、モデルが処理できなかった

**対処**: `tool_choice` を強制指定しているか確認。レスポンスの `content` を
ログに出して、何が返ってきたかを確認する。

---

## 4. IAM 権限の設計

### Lambda（Bedrock 呼び出し側）に必要な権限

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/*",
        "arn:aws:bedrock:*:*:inference-profile/*"
      ]
    }
  ]
}
```

**Marketplace 権限は不要**（管理者が事前にサブスクライブ済みであれば）。
Amplify Gen2 の場合は `defineFunction` の中でリソースポリシーを設定する。

### 管理者（初回サブスクライブ担当）に必要な権限

```json
{
  "Effect": "Allow",
  "Action": [
    "aws-marketplace:ViewSubscriptions",
    "aws-marketplace:Subscribe",
    "bedrock:InvokeModel"
  ],
  "Resource": "*"
}
```

この権限は **初回サブスクライブ時だけ** 必要。
済んだら剥がしてもよい（`bedrock:InvokeModel` は通常の操作用に残す）。

---

## 5. チェックリスト（新プロジェクト用）

新しいプロジェクトで Bedrock + Claude を使う場合の手順:

- [ ] **リージョン決定**: Bedrock が使えるリージョンを選ぶ（`ap-northeast-1` 推奨）
- [ ] **使用モデルの決定**: `list-foundation-models` と `list-inference-profiles` で
      確認し、インファレンスプロファイル ID を特定
- [ ] **データ所在要件の確認**: `jp.*` / `global.*` のどちらを使うか判断
- [ ] **モデルサブスクライブ**: 管理者が Playground で 1 回実行。
      Anthropic の利用規約同意が含まれる場合あり
- [ ] **サブスクリプション確認**: Marketplace コンソールで「アクティブ」を確認。
      反映に数分かかる場合あり
- [ ] **Lambda の IAM 設定**: `bedrock:InvokeModel` を
      Foundation Model と Inference Profile の両方の ARN に対して許可
- [ ] **コードのモデル ID 確認**: Foundation Model ID ではなく
      **Inference Profile ID** を指定していること
- [ ] **SSO プロファイル設定**: 開発者のローカル環境で `AWS_PROFILE` と
      `aws sso login` が通ること
- [ ] **疎通テスト**: Playground → CLI → Lambda の順で invoke が通ることを確認

---

## 6. 参考リンク

- [Bedrock Inference Profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html)
- [Bedrock Model Access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)
- [Anthropic on Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages.html)
- [Bedrock IAM Policies](https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html)

---

## 7. 本プロジェクト(kojimaya_poc)で遭遇したエラー経緯

時系列でどのエラーに遭い、どう解決したかの記録。
同じ構成で始める場合の参考として残す。

| # | エラー | 原因 | 対処 |
|---|--------|------|------|
| 1 | `The security token included in the request is invalid` | SSO セッション切れ + `~/.aws/credentials` に無効な IAM キーが残存。`AWS_PROFILE` 未設定で default の無効キーが使われた | `aws sso login --profile kojimaya_test` + `$env:AWS_PROFILE = "kojimaya_test"` |
| 2 | `The provided model identifier is invalid` | `apac.anthropic.claude-sonnet-4-5-20250929-v1:0` がこのアカウントに存在しなかった | `list-inference-profiles` で実在する ID を確認 |
| 3 | `Invocation of model ID ... with on-demand throughput isn't supported` | Foundation Model ID(`anthropic.claude-sonnet-4-5-...`)を直接指定していた | Inference Profile ID(`jp.*` / `global.*`)に変更 |
| 4 | `Model access is denied ... AWS Marketplace actions` | Sonnet 4.5 のサブスクリプション未完了 + Lambda ロールに Marketplace 権限なし | サブスクリプション済みの **Sonnet 4.6**(`global.anthropic.claude-sonnet-4-6`)に切り替え |

最終的に採用した設定:
- モデル: `global.anthropic.claude-sonnet-4-6`
- リージョン: `ap-northeast-1`
- 設定箇所: `amplify/functions/ocr-handler/resource.ts`(`BEDROCK_MODEL_ID` 環境変数)
