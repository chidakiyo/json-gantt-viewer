# CLAUDE.md

> このファイルは Claude Code / Claude Design が**最初に読む**運用ルールです。作業前に必ず目を通してください。

## このプロジェクトは何か

スキーマに沿った **JSON を渡すだけ**で表示できる、単一ファイルのガントチャート・ビューアー（`json-gantt-viewer`）。
サーバー・ビルド不要。`file://` で開き、「ファイルを開く」から JSON を読み込む。

**製品思想**: スキーマを AI に渡す → AI が JSON を生成 → このビューアーで即閲覧。閲覧専用（現時点で編集・保存機能は持たない）。

## 触ってよい / だめ

| ファイル | 誰が | 方針 |
|---|---|---|
| `src/Gantt Viewer.dc.html` | Design が主、Code も可 | **一次ソース**。UI・描画ロジックはすべてここ。1ファイル完結。 |
| `src/support.js` | 自動生成 | **手で編集しない**。Design ランタイム。 |
| `dist/GanttViewer.html` | ビルド成果物 | **直接編集しない**。`src/` から再生成する。 |
| `docs/DATA-SCHEMA.md` | 合意で更新 | データ契約。破壊的変更は Design・Code 双方で合意。 |
| `examples/*.json` | Code / AI | サンプルデータ。スキーマ準拠なら自由に追加可。 |

## 原則

- **スタイルはインライン**。CSS ファイル・クラス設計・デザイントークンの外部化はしない（Design ランタイムの制約。理由は `docs/DECISIONS.md`）。値の一覧は `docs/DESIGN-SYSTEM.md`。
- **ロジックは素の JavaScript**。`class Component` 内のメソッド。TypeScript / import / npm 依存なし。
- **データ契約が正**。表示・生成・実装は `docs/DATA-SCHEMA.md` を唯一の取り決めとして独立に進める。
- **同じ箇所を同時に触らない**。Design=見た目、Code=データ入出力・保存・周辺機能。

## ビルド（src → dist）

`src/Gantt Viewer.dc.html` を単一 HTML に束ねたものが `dist/GanttViewer.html`。
このバンドルは Design 環境のツールで生成する。Code 側で純粋な静的配布物が必要な場合は、`src` をブラウザで開いた DOM をそのまま保存するか、Design に再バンドルを依頼する。
**`src/` を変更したら必ず `dist/` を更新して同期する。**

## 動作確認

1. `src/Gantt Viewer.dc.html`（または `dist/GanttViewer.html`）をブラウザで開く。
2. 「ファイルを開く」→ `examples/sample-data.json` を読み込む。
3. 尺度（日/週/月）・表示レイヤー・バー注記・配色・行間・階層を切り替えて確認。

## 用語

- **予実オーバーレイ**: 予定枠（envelope）＋実績バー＋進捗塗り。
- **イナズマ線 (slip line)**: 各タスクの進捗位置を本日線から結ぶ折れ線。左に凸=遅延。
- **クリティカルパス**: `critical:true` のタスク連鎖。赤系で強調。
- **稼働日カレンダー**: `calendar.workweek` / `holidays` / `extraWorkdays`。

## コードの地図

主要メソッドの責務は [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。設計判断の経緯は [`docs/DECISIONS.md`](docs/DECISIONS.md)。
