# バンドル仕様（src → dist）

`src/Gantt Viewer.dc.html`（Design Component 形式）を、`file://` で単体動作する 1 枚の HTML `dist/GanttViewer.html` に変換する処理の仕様。
現状このバンドルは **Design 環境の内蔵機能**で生成している。本書は、その「やっていること」を明文化し、**Claude Code 側でも再現・自動化できる**ようにするためのもの。

---

## バンドルがやっていること（概念）

入力: `src/Gantt Viewer.dc.html` ＋ 同ディレクトリの `src/support.js`（DC ランタイム）
出力: `dist/GanttViewer.html`（依存ゼロ・オフライン動作する単一 HTML）

1. **`.dc.html` の解決** — `src/Gantt Viewer.dc.html` は Design Component 形式。`<script src="./support.js">` で DC ランタイムを読み込み、`support.js` が独自タグ／テンプレートを解釈してブラウザ上で描画する。バンドルは、この「HTML＋support.js」を 1 ファイルに統合する。
2. **依存のインライン化** — 外部参照（`support.js`、画像・CSS・フォント等のローカル参照）をすべてファイル内に埋め込み、外部リンクを無くす。Google Fonts など CDN 参照はそのまま（オフライン時はフォールバック）。
3. **スプラッシュ/フォールバック** — 読み込み中・JS 無効時に表示する簡易サムネイル（`<template id="__bundler_thumbnail">` のインライン SVG）を同梱。
4. **単一化** — 結果を `dist/GanttViewer.html` として書き出す。これをダブルクリックすれば動く。

## 何が嬉しいのか

- **配布がファイル 1 枚**。サーバー・ビルド環境・ネット接続なしで動く（`file://` 可）。
- **リンク切れが起きない**（依存を内包）。
- **GitHub Pages でもそのまま公開できる**（`index.html` から参照 or リネーム）。

---

## Claude Code 側での再現方針

⚠️ 重要: `.dc.html` を**厳密にトランスパイル**する処理は Design 環境内部にあり、コードとして持ち出せない。したがって CC 側は「ゼロから同じトランスパイラを書く」のではなく、次の**実務的な同期方式**を採る。

### 方式A（推奨・確実）: Design が出した dist をテンプレとして再利用 — **実装済み: `scripts/sync-dist.mjs`**

⚠️ 訂正: `dist` は DC ソースを `<script type="__bundler/template">` 内の **JSON エスケープ済み文字列**として保持しているため、素朴な文字列置換では壊れる。正しい手順は「JSON を parse → 変更領域を差し替え → re-stringify」で、これを `scripts/sync-dist.mjs` として実装済み。

```bash
node scripts/sync-dist.mjs
```

差し替える領域は2つ: (A) `<script data-dc-script>`（Component ロジック＋data-props）、(B) `</helmet>`〜`</x-dc>` のラッパー。日々の変更はここに閉じるのでほとんどのケースで足りる。`<helmet>`（フォント/@keyframes）や `support.js` の変更は同期不可 — スクリプトが検知して中断するので、Design 環境で再バンドルする。運用手順は [`CC-HANDOFF.md`](CC-HANDOFF.md)。

### 方式B（将来・完全自立）: 素 HTML 化
`.dc` 依存をやめ、`src` を最初から素の HTML+JS（React を CDN 読み込み等）で書けば、バンドルは「ファイル連結＋インライン化」だけになり、CC 側で `build.js` として完全実装できる。DC のプレビュー利便性は失うが、ビルドが完全に CC 側で完結する。移行はまとまった作業。

---

## 検証（バンドル後に必ず行う）

1. `dist/GanttViewer.html` をブラウザで開く（`file://`）。
2. コンソールにエラーが出ないこと。
3. 「ファイルを開く」→ `examples/sample-data.json` が読み込め、ガントが描画されること。
4. 尺度切替（日/週/月）・配色・表示レイヤー・バー注記・「初期値に戻す」が動くこと。
5. 表示設定を変えて再読込 → 設定が復元されること（localStorage 永続化）。

## 補足

- `dist/` は**生成物**。直接手で編集しない（変更は必ず `src/` 側で行い、再バンドルで反映）。
- `dist/` を Git 管理から外し（`.gitignore`）、CI で生成する運用も可能。その場合も本書の方式A/Bのいずれかで生成する。
- Design 環境で再バンドルした `dist/` を受け取れる場合は、それを push するのが最も確実（変換の正しさが保証される）。
