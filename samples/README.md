# samples/

Bedrock OCR 検証用の画像置き場。

## 方針

**画像ファイル自体は git に commit しません。** 小島屋さんの現場画像が社外秘である可能性、
リポサイズ肥大化を避けるため、[.gitignore](../.gitignore) で `samples/` 配下を除外しています。
この `README.md` と各セットの `README.md` のみ commit します。

サンプル画像は以下の方法でチームに配布:
- 共有ストレージ(Google Drive など)
- 直接ファイル転送

## ディレクトリ構成

```
samples/
├── README.md              ← このファイル(commit)
├── initials/              ← 初回検証用(4 枚程度)
│   ├── 42.10_YORI.JPG     ← 画像(commit しない)
│   ├── 55.50_YORI.JPG
│   └── ...
└── batch-YYYYMMDD/        ← 本番画像バッチ(日付ごと)
    └── *.jpg
```

## 検証の進め方

Bedrock OCR の検証は **画面経由(PWA → S3 → Lambda → Bedrock)** で一本化しています。
詳細は [docs/ocr-validation.md](../docs/ocr-validation.md) を参照。

1. `npm run dev:tablet` でアプリを起動
2. Cognito ユーザーでログインし `/containers` に仮容器を登録
3. `/measure` から画像を 1 枚ずつ投入
4. 画面に表示される OCR 値・信頼度・stable・warnings を記録
5. 正解値と突き合わせて採点(実験ログは [ocr-validation.md §4](../docs/ocr-validation.md#4-実験ログ))

## 正解値の記録

正解値は次のいずれかで管理:
- **ファイル名に埋め込む**(例: `42.10_YORI.JPG` は 42.10 kg)
- [docs/ocr-validation.md §3 サンプル台帳](../docs/ocr-validation.md#3-サンプル台帳) に表形式で記載

## 撮影推奨条件(実装計画書より)

- **距離**: 近(30cm)/ 中(60cm)/ 遠(1m)
- **角度**: 正面 / 斜め 30 度
- **照明**: 蛍光灯下 / 反射あり / 暗め
- **表示値**: 0.00 / 小さい値 / 大きい値 / 安定マーク OFF も含む
