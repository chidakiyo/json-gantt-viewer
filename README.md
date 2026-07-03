# json-gantt-viewer

スキーマに沿った **JSON を渡すだけ** で表示できる、単一ファイルのガントチャート・ビューアー。
サーバー・ビルド不要。ブラウザで `file://` のまま開き、上部の「ファイルを開く」から JSON を読み込みます。

想定ワークフロー: **スキーマを AI に渡す → AI が JSON を生成 → このビューアーで即閲覧**。

---

## クイックスタート

**インストール不要** — ブラウザでそのまま使えます: **https://chidakiyo.github.io/json-gantt-viewer/**
（読み込んだ JSON はブラウザ内でのみ処理され、どこにも送信されません）

ローカルで使う場合:

1. `dist/GanttViewer.html` をブラウザで開く（ダブルクリックで可）。
2. ツールバーの「ファイルを開く」で `examples/sample-data.json` を選択。
3. 尺度（日/週/月）、表示レイヤー、バー注記、配色などを切り替えて閲覧。

データ形式は [`docs/DATA-SCHEMA.md`](docs/DATA-SCHEMA.md) を参照。AI にこのスキーマを渡せば、そのまま読み込める JSON を生成できます。

---

## AI にデータを生成させる

このビューアーの中心的な使い方です。**JSON を作らせたい AI には [`docs/DATA-SCHEMA.md`](docs/DATA-SCHEMA.md) を渡してください**（`CLAUDE.md` は Design/Code の協業ルールなので、生成 AI 向けではありません）。

下のプロンプトをコピーし、`docs/DATA-SCHEMA.md` の内容を貼り付け（または添付）て使います。

```text
あなたはガントチャート用の JSON を生成するアシスタントです。
添付のスキーマ（DATA-SCHEMA.md）に厳密に従い、JSON を1つだけ出力してください。

制約:
- 出力は JSON のみ。前後の説明文やコードフェンス外のテキストは書かない。
- 日付はすべて YYYY-MM-DD 形式。
- 各タスクは plan（予定期間）を必須で持つ。未着手のタスクは actual を {"start": null, "end": null} とする。
- progress は 0〜1 の数値。工程・プロジェクトのバー/工数/進捗は書かない（配下タスクから自動集計されるため）。
- 任意フィールドは、値が無ければ省略してよい（無理に埋めない）。

作りたい内容:
<ここに計画の中身を書く。例: 新規Webサービスの開発計画。企画→設計→開発→テスト→リリースの5工程、期間は2026年8月〜12月、担当は3名。>
```

出力された JSON をファイルに保存し、ビューアーの「ファイルを開く」から読み込めば即表示されます。

---

## ディレクトリ構成

```
.
├── README.md                 # このファイル（プロジェクト入口）
├── CLAUDE.md                 # ★AI が最初に読む運用ルール（役割分担・原則・ビルド）
├── docs/
│   ├── DATA-SCHEMA.md         # ★データ契約（スキーマ仕様）。AI/実装/表示の共通取り決め
│   ├── schema.json            # 機械可読な JSON Schema（生成JSONの検証用）
│   ├── DESIGN-SYSTEM.md       # デザイントークン（配色2軸・タイポ・寸法・ステータス色）
│   ├── ARCHITECTURE.md        # コードの地図（主要メソッドの責務・データフロー・状態）
│   └── DECISIONS.md           # 設計判断の記録（なぜ今の形か）
├── src/
│   ├── Gantt Viewer.dc.html   # ★デザインの源泉（描画ロジック＋ビュー、フレームワーク非依存の素のJS）
│   └── support.js             # ランタイム（自動生成。手で編集しない）
├── examples/
│   ├── sample-data.json       # 最小～標準サンプル（2プロジェクト。稼働日カレンダー付き）
│   └── roadmap-2026.json      # 大きめサンプル（4プロジェクト・65タスク）
└── dist/
    └── GanttViewer.html       # 配布用の単一HTML（src をバンドルした成果物）
```

## ドキュメント索引

| 目的 | 読むファイル |
|---|---|
| まず全体像・運用ルールを知る | [`CLAUDE.md`](CLAUDE.md) |
| データ形式を知る（AI にデータ生成させる） | [`docs/DATA-SCHEMA.md`](docs/DATA-SCHEMA.md) |
| 生成した JSON を機械的に検証する | [`docs/schema.json`](docs/schema.json)（JSON Schema） |
| 色・寸法・タイポの規約を知る | [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) |
| コードの構造・拡張点を知る | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| なぜ今の設計かを知る | [`docs/DECISIONS.md`](docs/DECISIONS.md) |

---

## 役割分担（Claude Design ↔ Claude Code）

このリポジトリは 2 つの担当が同じフォルダを共有して往復する前提で構成しています。

| 領域 | 担当 | 触るファイル |
|---|---|---|
| 見た目・レイアウト・配色・バー表現・凡例・ツールバー UI | **Claude Design** | `src/Gantt Viewer.dc.html`（＝デザインの一次ソース。修正依頼はこのファイルへ） |
| データ入出力・保存・ルーティング・テスト・周辺機能 | **Claude Code** | 新規モジュール、ビルド設定、`examples/` の生成など |
| データ形式（両者の契約） | 合意で更新 | `docs/DATA-SCHEMA.md` |

**原則**: 同じ箇所を同時に触らない。スタイルは `src/` のインライン、ロジックは素の JS。`docs/DATA-SCHEMA.md` を「契約」として、データ生成・実装・表示を独立に進められる。

---

## src/Gantt Viewer.dc.html の構造（実装者向け）

単一ファイル内に、描画に必要なロジックがすべて素の JavaScript クラスとして入っています。主な責務:

- **データ取り込み** — `normalizeDoc()` が JSON を内部モデルに正規化（`plan`/`actual`、担当者、稼働日カレンダーなど）。外部 JSON 未読込時は内蔵サンプルを表示。
- **時間軸ジオメトリ** — `geo()` が全日付（マイルストーン含む）から描画範囲を算出。`timeCols()` が 日/週/月 スケールの目盛りを生成。
- **行モデル** — `buildRows()` が プロジェクト→工程→タスク の階層と折りたたみを展開。工程・プロジェクトのバー/工数/進捗は配下から自動集計。
- **状態判定** — `statusOf()` が予定・実績・進捗・本日から 順調/要注意/遅延/完了 を判定。
- **描画要素** — 予実オーバーレイ、進捗%、マイルストーン(◇)、依存矢印、クリティカルパス、イナズマ線、本日線、稼働日カレンダー網掛け。すべて表示レイヤーで個別 on/off。

> `src/` を編集したら、配布用の `dist/GanttViewer.html` を作り直して同期します（Design 側で再バンドル）。

---

## データ契約（要点）

トップレベル: `meta` / `calendar` / `assignees` / `projects`。詳細と全フィールドは [`docs/DATA-SCHEMA.md`](docs/DATA-SCHEMA.md)。

- 日付は `YYYY-MM-DD`。ラベルは `ja` / `en` の 2 言語。
- タスクは `plan`（予定）と `actual`（実績）の 2 期間。`actual.start=null`=未着手、`actual.end=null`=進行中。
- 期間(日数)はビューアーが自動計算。工数(`personDays`)はデータ側の値。
- 担当者の `color`/`abbr` は省略可（省略時は自動割り当て）。`who` には会社コード等も使用可。
