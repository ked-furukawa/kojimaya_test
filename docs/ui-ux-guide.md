# UI/UX ガイドライン

最終更新: 2026-04-17
対象アプリ: `apps/tablet`（そば粉計量チェック タブレットPWA）
関連: [requirements.md](./requirements.md) / [design.md](./design.md) / [implementation-plan.md](./implementation-plan.md)

---

## 1. 設計原則

| # | 原則 | 説明 |
|---|------|------|
| P1 | **現場ファースト** | 粉塵環境・濡れ手・手袋操作を前提。タッチターゲットは大きく、誤タップを防ぐ |
| P2 | **一目で分かる** | 計量値・OK/NG判定は画面の最も目立つ位置に最大フォントで表示 |
| P3 | **誤操作防止** | 破壊的操作（削除・上書き）は必ず確認ダイアログを挟む |
| P4 | **最小ステップ** | 撮影→OCR→確認→保存を最短タップ数で完了できる導線 |
| P5 | **即時フィードバック** | 操作結果は色・アイコン・テキストで即座にユーザーに伝える |

---

## 2. 技術スタック（UI関連）

| カテゴリ | ライブラリ | バージョン | 用途 |
|---------|-----------|-----------|------|
| スタイリング | **Tailwind CSS** | ^3.4 | ユーティリティファーストCSS |
| アイコン | **Heroicons** (`@heroicons/react`) | ^2.2 | Tailwind公式チーム製SVGアイコン |
| UIコンポーネント | **Base UI** (`@base-ui/react`) | ^1.0.0 | ヘッドレスUIコンポーネント（数値入力等） |
| 認証UI | **Amplify UI React** | ^6.5 | Cognito認証画面のみ |

### 2.1 Heroicons 使用規約

- **スタイル**: `outline`（24px）を標準とする。強調が必要な箇所のみ `solid`（20px）を使用
- **サイズ**: Tailwind の `h-6 w-6`（24px）を基本、小さいコンテキストでは `h-5 w-5`（20px）
- **インポート形式**:
  ```tsx
  // outline（標準）
  import { HomeIcon, ScaleIcon } from '@heroicons/react/24/outline';
  // solid（強調・アクティブ状態）
  import { HomeIcon as HomeIconSolid } from '@heroicons/react/24/solid';
  ```

### 2.2 Base UI 使用規約

- **用途**: 数値入力（NumberField）など、ブラウザ標準では不十分なフォームコントロールに限定して使用
- **スタイリング**: Base UI はヘッドレス（スタイルなし）のため、すべて Tailwind クラスで装飾する
- **カスタムコンポーネント**: `src/components/ui/` 配下に Base UI をラップした共通コンポーネントを作成し、各ページから利用する

---

## 3. ターゲットデバイス・画面仕様

| 項目 | 仕様 |
|------|------|
| 対象端末 | iPad（10.2〜12.9インチ）/ Android タブレット（10〜11インチ） |
| 最小対応幅 | **768px**（タブレット縦持ち） |
| 推奨利用向き | **横持ち**（サイドバーナビゲーションとの相性を考慮） |
| タッチターゲット | 最小 **48×48px**（手袋操作を考慮し通常の44pxより拡大） |
| PWA | ホーム画面に追加して利用。フルスクリーンモード |

---

## 4. レイアウト構造

### 4.1 全体構成

```
┌──────────────────────────────────────────────┐
│ サイドバー │ ヘッダー                          │
│ (開閉可能) │──────────────────────────────────│
│            │                                  │
│  アイコン  │  メインコンテンツ                  │
│  + ラベル  │                                  │
│            │                                  │
│            │                                  │
│ ────────── │                                  │
│ ログアウト │                                  │
└──────────────────────────────────────────────┘
```

### 4.2 サイドバー

| 状態 | 幅 | 表示内容 |
|------|-----|---------|
| **開** | `w-56`（224px） | アイコン + テキストラベル |
| **閉** | `w-16`（64px） | アイコンのみ |

- 背景色: `bg-white` + `border-r border-slate-200`（右端にボーダーで境界を明示）
- テキスト: `text-slate-700`
- アクティブ項目: `bg-slate-900 font-semibold text-white`（強い反転で現在地を明示）
- ホバー: `bg-slate-100`
- 下部区切り線: `border-t border-slate-200`
- 開閉アニメーション: `transition-[width] duration-200`
- 下部にユーザーID表示（`text-slate-500`）とログアウトボタンを配置

### 4.3 ヘッダー

- 高さ: `h-14`（56px）
- 背景: `bg-white` + 下線 `border-b border-slate-200`
- 左: アプリタイトル「そば粉計量チェック」
- 右: ログインユーザーID

### 4.4 メインコンテンツ

- パディング: `px-6 py-8`
- スクロール: `overflow-y-auto`（コンテンツ領域のみスクロール、サイドバー・ヘッダーは固定）

---

## 5. カラーシステム

### 5.1 ベースカラー

| 用途 | カラー | Tailwind クラス |
|------|--------|----------------|
| 背景（メイン） | ライトグレー | `bg-slate-50` |
| 背景（カード） | 白 | `bg-white` |
| 背景（サイドバー） | 白 | `bg-white`（右端に `border-slate-200` のボーダー） |
| テキスト（通常） | ダークグレー | `text-slate-900` |
| テキスト（補助） | ミディアムグレー | `text-slate-500` |
| ボーダー | ライトグレー | `border-slate-200` |

### 5.2 セマンティックカラー（状態表示）

| 状態 | 用途 | 背景 | テキスト/ボーダー |
|------|------|------|------------------|
| **OK / 成功** | 判定OK、保存完了 | `bg-emerald-50` | `text-emerald-700` / `border-emerald-300` |
| **NG / エラー** | 判定NG、入力エラー | `bg-red-50` | `text-red-700` / `border-red-300` |
| **警告** | 信頼度低、再撮影推奨 | `bg-amber-50` | `text-amber-700` / `border-amber-300` |
| **情報** | ヒント、補足説明 | `bg-sky-50` | `text-sky-700` / `border-sky-300` |

### 5.3 アクセントカラー（ナビゲーション・ボタン）

| 項目 | カラー | Tailwind クラス |
|------|--------|----------------|
| 計量する | エメラルド | `bg-emerald-600` |
| 履歴 | スカイブルー | `bg-sky-600` |
| 容器マスタ | アンバー | `bg-amber-600` |
| プライマリアクション | スレートダーク | `bg-slate-800` |

### 5.4 コントラスト要件

- テキストと背景のコントラスト比: **WCAG AA 以上（4.5:1）**
- 工場の蛍光灯下でも判読可能な濃度を確保
- OK/NGの判定は色だけに頼らず、テキスト・アイコンを併用

---

## 6. タイポグラフィ

### 6.1 フォントファミリー

```
font-family: "Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic Medium", Meiryo, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

各OSに標準搭載されている日本語フォントを優先指定し、外部CDNに依存せず高速に表示できるようにする。Android は Noto Sans JP、iOS / macOS は Hiragino Sans、Windows は Yu Gothic Medium（旧環境では Meiryo）がそれぞれ適用される。英数字は Segoe UI / Roboto / Helvetica Neue など各OS標準フォントにフォールバックする。

### 6.2 フォントサイズ階層

| レベル | 用途 | Tailwind | サイズ目安 |
|--------|------|----------|-----------|
| **特大** | OCR読取値、判定結果 | `text-5xl` 〜 `text-6xl` | 48〜60px |
| **大** | ホームメニューボタン | `text-3xl` | 30px |
| **見出し1** | ページタイトル | `text-2xl font-bold` | 24px |
| **見出し2** | セクション見出し | `text-xl font-semibold` | 20px |
| **本文** | 通常テキスト | `text-base` | 16px |
| **補足** | ラベル、キャプション | `text-sm` | 14px |
| **極小** | タイムスタンプ、メタ情報 | `text-xs` | 12px |

### 6.3 数値表示

- 計量値・OCR結果は **等幅フォント風に表示**（桁ズレ防止）
- `tabular-nums` を適用: `className="tabular-nums"`
- 単位（kg）は数値より小さいサイズで右寄せ

---

## 7. コンポーネント仕様

### 7.1 ボタン

| 種類 | 用途 | スタイル |
|------|------|---------|
| **プライマリ** | 保存、検出実行、確定 | `bg-slate-800 text-white` / 大きめパディング |
| **セカンダリ** | キャンセル、戻る | `border border-slate-300 bg-white text-slate-700` |
| **成功** | OK確定 | `bg-emerald-600 text-white` |
| **危険** | 削除、無効化 | `bg-red-600 text-white` |
| **ゴースト** | 補助的な操作 | `text-slate-600 hover:bg-slate-100` |

共通:
- 最小高さ: `min-h-[48px]`（タッチターゲット確保）
- 角丸: `rounded-lg`
- フォーカスリング: `focus:ring-2 focus:ring-slate-400 focus:ring-offset-2`
- disabled: `opacity-50 cursor-not-allowed`

### 7.2 カード

```
bg-white rounded-xl shadow-sm border border-slate-200 p-6
```

- 情報グループの区切りに使用
- ホーム画面のメニューカードは `shadow-lg rounded-2xl` で強調

### 7.3 入力フォーム

- テキスト/数値入力: `h-12 rounded-lg border border-slate-300 px-4`
- **数値入力（Base UI NumberField）**: 計量値の手動補正、風袋重量入力に使用
  - ステッパー（+/-ボタン）付き
  - 小数点対応（`step={0.01}`）
  - 最小値 `0`
- ラベル: 入力フィールドの上に配置、`text-sm font-medium text-slate-700`

### 7.4 バッジ・ステータス表示

| バッジ | スタイル例 |
|--------|-----------|
| OK | `bg-emerald-100 text-emerald-800 text-sm font-semibold px-3 py-1 rounded-full` |
| NG | `bg-red-100 text-red-800 ...` |
| 信頼度 HIGH | `bg-emerald-100 text-emerald-700` |
| 信頼度 LOW | `bg-amber-100 text-amber-700` |

### 7.5 モーダル / ダイアログ

- オーバーレイ: `bg-black/50`
- パネル: `bg-white rounded-2xl shadow-xl max-w-lg mx-auto`
- 閉じるボタン: 右上に `XMarkIcon`
- 破壊的操作の確認: タイトルに警告アイコン + 赤いアクションボタン

### 7.6 テーブル / リスト

- ヘッダー行: `bg-slate-50 text-sm font-semibold text-slate-600`
- データ行: `border-b border-slate-100` + ホバー `hover:bg-slate-50`
- 行高さ: 最小 `48px`（タッチ操作対応）

### 7.7 ローディング

- スピナー: `animate-spin` + Heroicons `ArrowPathIcon`
- スケルトン: `bg-slate-200 animate-pulse rounded`
- OCR処理中: スピナー + 「読み取り中...」テキスト

---

## 8. 画面別ガイドライン

### 8.1 ホーム画面 (`/`)

- 3つの大きなメニューカード（計量する / 履歴 / 容器マスタ）
- 各カードにアクセントカラー + Heroicons アイコン + 説明テキスト
- カードサイズ: `h-48` 以上、タップしやすい面積を確保

### 8.2 計量画面 (`/measure`)

**最重要画面** — 操作フローに沿った縦方向のステップ構成:

1. **容器選択**: ドロップダウン + デフォルト容器の自動選択
2. **撮影エリア**: カメラ入力 + プレビュー表示（画面の目立つ位置）
3. **OCR結果パネル**:
   - 読取値: `text-5xl font-bold tabular-nums` で最大表示
   - 信頼度バッジ + 安定マーク表示
   - 手動補正入力（Base UI NumberField）
4. **計算結果**: 正味重量 = 計量値 − 風袋重量
5. **アクションボタン**: 「保存」（プライマリ）/「撮り直し」（セカンダリ）

### 8.3 容器マスタ画面 (`/containers`)

- 上部: 「容器を追加」ボタン
- 一覧: カード or テーブル形式（名前 / 風袋重量 / 既定 / 状態）
- 既定容器: 星アイコン（`StarIcon`）で視覚的に区別
- 編集: インラインまたはモーダルで風袋重量を変更
- 無効化: 確認ダイアログ付き

### 8.4 履歴画面 (`/history`)

- フィルタバー: 日付範囲 / 操作者 / 判定結果
- 一覧: テーブル形式（日時 / 操作者 / 計量値 / 判定 / サムネイル）
- 詳細: モーダルで画像拡大 + 全項目表示
- エクスポート: CSV ダウンロードボタン

---

## 9. フィードバック・状態表示

### 9.1 OK/NG 判定の表現

| 判定 | 色 | アイコン | テキスト |
|------|-----|---------|---------|
| OK | 緑 `emerald` | `CheckCircleIcon` | 「OK」 |
| 過多 | 赤 `red` | `ExclamationTriangleIcon` | 「過多: −X.XX kg 減らしてください」 |
| 不足 | 赤 `red` | `ExclamationTriangleIcon` | 「不足: +X.XX kg 足してください」 |

- 判定結果は **色 + アイコン + テキスト** の3要素で伝達（色覚多様性対応）

### 9.2 OCR 信頼度

| レベル | 表示 | 推奨アクション |
|--------|------|---------------|
| HIGH (≥0.9) | 緑バッジ | そのまま使用可 |
| MEDIUM (0.7–0.9) | 黄バッジ | 目視確認を推奨 |
| LOW (<0.7) | 赤バッジ + 警告 | 再撮影 or 手動補正を促す |

### 9.3 トースト / メッセージ

- 成功: 画面上部にスライドイン、3秒で自動消去、緑系
- エラー: 画面上部に固定表示、手動で閉じるまで残る、赤系
- 処理中: スピナー + テキスト、操作をブロック

---

## 10. アクセシビリティ・現場適応

| 項目 | 要件 |
|------|------|
| コントラスト比 | WCAG AA（4.5:1）以上 |
| タッチターゲット | 最小 48×48px |
| タッチ間隔 | 隣接するタップ要素間に最低 8px の余白 |
| フォーカス表示 | `focus:ring-2` でキーボード操作時も視認可能 |
| 色に頼らない | OK/NGは色+アイコン+テキストで伝達 |
| aria ラベル | アイコンのみのボタンには `aria-label` を必須とする |

---

## 11. アイコン一覧（Heroicons マッピング）

プロジェクト内で使用するアイコンの標準マッピング:

| 用途 | Heroicons 名 | スタイル |
|------|-------------|---------|
| ホーム | `HomeIcon` | outline |
| 計量 | `ScaleIcon` | outline |
| 履歴 | `ClockIcon` | outline |
| 容器 | `CubeIcon` | outline |
| カメラ/撮影 | `CameraIcon` | outline |
| 保存 | `CheckIcon` | outline |
| 削除/閉じる | `XMarkIcon` | outline |
| 編集 | `PencilSquareIcon` | outline |
| 追加 | `PlusIcon` | outline |
| 警告 | `ExclamationTriangleIcon` | solid |
| 成功 | `CheckCircleIcon` | solid |
| エラー | `XCircleIcon` | solid |
| 情報 | `InformationCircleIcon` | outline |
| フィルタ | `FunnelIcon` | outline |
| ダウンロード | `ArrowDownTrayIcon` | outline |
| ログアウト | `ArrowRightStartOnRectangleIcon` | outline |
| メニュー開閉 | `Bars3Icon` / `ChevronLeftIcon` | outline |
| 既定（星） | `StarIcon` | solid（既定）/ outline（非既定） |
| ローディング | `ArrowPathIcon` + `animate-spin` | outline |
