# PWA assets

PWA の manifest は [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) が
[../vite.config.ts](../vite.config.ts) の設定からビルド時に生成する。
現状は `favicon.svg` のみを暫定アイコンとして登録している。

正式ロゴが用意でき次第:

- `favicon.svg` を本番ロゴで上書き、または `icon-192.png` / `icon-512.png` を追加
- [../vite.config.ts](../vite.config.ts) の `VitePWA.manifest.icons` を新ファイルに合わせて更新
- 必要なら `apple-touch-icon` も PNG 版に切り替え([../index.html](../index.html))
