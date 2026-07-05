# Claude Code 引き継ぎ（dist 同期）

Design 側が `src/Gantt Viewer.dc.html` を更新したあと、Code 側で `dist/GanttViewer.html`（`file://` 単体動作の配布物）を同期するための手順。背景は [`BUNDLE.md`](BUNDLE.md)。

## 何を渡しているか

- **`scripts/sync-dist.mjs`** — BUNDLE.md「方式A」の実装。`src` の変更を `dist` に反映する Node スクリプト（依存ゼロ、標準ライブラリのみ）。

## 実行

```bash
node scripts/sync-dist.mjs
```

成功すると `dist/GanttViewer.html` が書き換わる。

## このスクリプトが同期する範囲

`dist` は Design 環境がバンドルした完成品で、`support.js` とフォントを base64+gzip でインライン化し、DC ソースを `<script type="__bundler/template">` 内の **JSON 文字列**として保持している。よって単純な文字列置換では壊れる。本スクリプトはその JSON を parse し、**日常的に変わる2領域だけ**を `src` から差し替えて re-stringify する:

| 領域 | 中身 | 変更頻度 |
|---|---|---|
| (A) `<script data-dc-script>…</script>` | `class Component` ロジック本体 ＋ `data-props`（インラインスタイル含む） | 高 |
| (B) `</helmet>` 〜 `</x-dc>` | `{{ app }}` ラッパー div | 低 |

日々の変更（描画ロジック・配色・インラインスタイル・props・尺度切替など）はすべて (A) に閉じるので、これで足りる。

## このスクリプトでは同期できないもの（＝ Design 環境で再バンドルが必要）

- `<helmet>` の中身: `@font-face` / `@keyframes` / スクロールバー等の `<style>`、フォント `<link>`
- `support.js` 本体（DC ランタイム）
- 新しい画像・CSS・フォント等のローカル依存追加

これらを変更した場合、スクリプトは helmet の `@keyframes` 消失を検知して**警告を出して中断**する。その時は Design 環境で再バンドルした `dist` を受け取って push すること（変換の正しさが保証される）。

## 実行後の検証（必須）

1. `dist/GanttViewer.html` を `file://` で開く。
2. コンソールにエラーが出ないこと。
3. 「ファイルを開く」→ `examples/sample-data.json` が描画されること。
4. 尺度切替（日/週/月）・配色・表示レイヤー・バー注記・「初期値に戻す」が動くこと。
5. 設定を変えて再読込 → localStorage から復元されること。

## 注意

- `dist/` は生成物。手で編集しない（変更は必ず `src/` 側で行い、本スクリプトで反映）。
- `src/support.js` は自動生成物。手で編集しない。
