# Bedrock OCR 検証ログ

最終更新: 2026-04-16
関連: [implementation-plan.md](./implementation-plan.md) / [design.md](./design.md) / [requirements.md](./requirements.md)

このドキュメントは Bedrock による ISHIDA ITB 計量機 7 セグ表示の OCR 検証を
**時系列で蓄積** していく生きたログです。画面(PWA)→ S3 → Lambda → Bedrock の
本番経路を実際に通しながら、精度・挙動・改善点を記録していきます。

検証は **画面経由(E2E)で一本化** しており、プロンプトやモデルを変えたくなった場合は
[amplify/functions/ocr-handler/handler.ts](../amplify/functions/ocr-handler/handler.ts) を
編集して `npx ampx sandbox` で再デプロイします。

---

## 1. 目的と判定基準

### 目的
1. Bedrock の Claude 系モデルが ISHIDA ITB の 7 セグ LED を安定して読めるかを確認する
2. 画面(PWA)→ S3 → Lambda → Bedrock の本番パイプラインが疎通することを確認する
3. プロンプトと Tool use 定義を現場画像に合わせて調整する
4. 現場運用時の操作性(撮影しやすさ・結果の見やすさ・誤読時の補正)をレビューする

### 判定基準(実装計画書より)
- ✅ **正解率 95% 以上** → 本実装決定、現行プロンプトを確定版として固定
- ⚠️ **80–95%** → 前処理(コントラスト強調・トリミング UI)を追加して再評価
- ❌ **80% 未満** → 方針見直し(専用 OCR / 計量機シリアル直結 / ハイブリッド)

正解率は「完全一致」と「±目量以内(例: 0.05 kg)」の 2 基準で算出する。
集計は手作業(スプレッドシート等)で行う。

### 判定に必要なサンプル数の目安
| 段階 | 枚数 | できる判断 |
|------|------|----------|
| 初期 | 3 枚 | モデル傾向差、プロンプト感度、Tool use 構造化の安定性、経路の疎通 |
| 中期 | 10 枚 | プロンプトの優劣比較(粗い精度判定) |
| 本検証 | 20 枚以上 | 正解率の統計的判定(95%/80% の判定基準に耐える) |

---

## 2. 検証方法(画面経由 E2E)

本番経路([Measure.tsx](../apps/tablet/src/pages/Measure.tsx) → S3 → AppSync Mutation
`invokeOcr` → Lambda → Bedrock)を実際に通す方式です。精度評価と
本番パイプラインの疎通確認を同時に行います。

### 前提
- `npx ampx sandbox` が稼働していること(Lambda・AppSync・Storage が立っている)
- Cognito テストユーザーが 1 人以上登録済み
- Bedrock のモデルアクセスが有効化済み(`claude-sonnet-4-5` など)
- [Measure.tsx](../apps/tablet/src/pages/Measure.tsx) が動くこと(既に M4 で実装済み)

### 手順
1. `npm run dev:tablet` でタブレットアプリをローカル起動(または PC のブラウザで開く)
2. Cognito ユーザーでログイン
3. `/containers` で検証用の仮容器を 1 件登録(まだ無ければ)
   - 名前・風袋重量は検証中は仮でよい(正味重量の計算は評価対象外)
4. `/measure` で画像を 1 枚ずつ投入
   - タブレット実機の場合はカメラ撮影
   - PC の場合はファイル選択(`samples/initials/*.JPG` を指定)
5. 結果パネルを確認し、以下を実験ログに記録:
   - OCR 値(`value`)
   - 信頼度バッジ(`confidence`)
   - 安定マーク(`stable`)
   - 警告(`warnings`)
   - `rawText`(Bedrock が画面から読んだ生テキスト)
6. 画像ごとの期待値と照らし合わせ、完全一致/±目量以内で採点
7. 1 セット(3 枚 or 10 枚 or 20 枚)の結果を §4 実験ログに追記

### プロンプト/モデルを変更する場合
検証の途中でプロンプトやモデルを変えたい場合:
1. [amplify/functions/ocr-handler/handler.ts](../amplify/functions/ocr-handler/handler.ts) の
   `SYSTEM_PROMPT` または `MODEL_ID` を編集
2. `npx ampx sandbox` 稼働中ならホットリロードで反映される
3. 何版目かを §4 の実験ログに記録(例: `prompt v2`)

---

## 3. サンプル台帳

`samples/` 配下の画像セットを管理するインデックスです。
画像ファイル自体はリポジトリに含めず([.gitignore](../.gitignore))、
構成とメタ情報のみをこちらに記録します。

### 現在のセット

| セット名 | パス | 枚数 | 提供日 | 提供者 | 備考 |
|---------|------|-----|--------|-------|------|
| initials | `samples/initials/` | 4 | 2026-04-15 | — | 初回検証用。ファイル名に正解値が埋め込まれている(`42.10_YORI.JPG` など) |

### initials の画像と想定正解値

| ファイル名 | 想定 kg | 備考 |
|-----------|--------|------|
| 42.10_YORI.JPG | 42.10 | — |
| 55.50_YORI.JPG | 55.50 | — |
| 64.70_HIKI .JPG | 64.70 | ファイル名に半角スペースあり(リネーム推奨) |
| 64.70_YORI.JPG | 64.70 | — |

---

## 4. 実験ログ

各検証実行の結果を **新しい順** で追記します。テンプレートは §6 を参照。

*未記録*

### テンプレート(コピーして使用)

```markdown
### YYYY-MM-DD Exp#N: prompt <version> / samples:<set>

- 実施者:
- モデル ID([handler.ts](../amplify/functions/ocr-handler/handler.ts)):
- プロンプト版([handler.ts](../amplify/functions/ocr-handler/handler.ts) の `SYSTEM_PROMPT`):
- サンプルセット: <path> (<n> 枚)
- Lambda デプロイ状態: 最新 / 古い(差分は…)

**結果一覧**:

| # | ファイル | 期待値 | OCR値 | 信頼度 | stable | 完全一致 | ±目量以内 | rawText | warnings |
|---|---------|-------|------|--------|--------|---------|---------|---------|---------|
| 1 |  |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |  |

**サマリ**:
- 完全一致: x/n (z%)
- ±目量以内: x/n (z%)

**所見**:
- (読み取り成功した画像の傾向)
- (失敗した画像の傾向)
- (信頼度の付き方)
- (画面操作で気づいた点)

**次のアクション**:
- [ ] プロンプト v+1 で再検証
- [ ] 画像追加後に再実行
```

---

## 5. 現時点の結論

*未検証*

実験ログが蓄積されたらここに暫定結論を書く。
最終的に以下を確定させる:

- 採用モデル:
- 確定プロンプト版:
- 本番運用可否の判断(✅/⚠️/❌):

---

## 6. 未解決の課題

*検証を進める中で発見した課題をここに追記する*

---

## 7. 次の一手

1. **Lambda を最新モデル ID(`anthropic.claude-sonnet-4-5-20250929-v1:0`)で再デプロイ**
   - `npx ampx sandbox` 稼働中なら保存すると自動反映
2. **Cognito テストユーザーを 1 人作成**(まだの場合)
3. **`/containers` で仮容器を 1 件登録**
4. **`samples/initials/*.JPG` 4 枚を画面から 1 枚ずつ投入** → Exp#1 として記録
5. **結果を §4 に書き込む**
6. **本番画像 10〜20 枚が揃ったら `samples/batch-YYYYMMDD/` に配置** → 正式判定
