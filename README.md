# json-gantt-viewer

スキーマに沿った **JSON を渡すだけ** で表示できる、単一ファイルのガントチャート・ビューアー＆エディター。
サーバー・ビルド不要。ブラウザで `file://` のまま開き、上部の「ファイルを開く」から JSON を読み込みます。

想定ワークフロー: **スキーマを AI に渡す → AI が JSON を生成 → このビューアーで即閲覧・編集**。

v2 で**編集モード**を搭載: セルのインライン編集、行の追加/削除/並替、階層の上下（Tab/Shift+Tab）、バーのドラッグ移動/伸縮、Undo/Redo（Ctrl+Z）、元の JSON への上書き保存（Ctrl+S、File System Access API・Chrome/Edge 系）。階層は `children` の再帰で**任意の深さ**に対応。

開いた JSON が外部で書き換わると**自動で再読込**します（Chrome/Edge 系・「ファイルを開く」または D&D で開いた場合）。AI に JSON を修正させて保存すれば、ビューアーに即反映されます。未保存の編集中は上書きせず通知だけ出します。

---

## クイックスタート

**インストール不要** — ブラウザでそのまま使えます: **https://chidakiyo.github.io/json-gantt-viewer/**
（読み込んだ JSON はブラウザ内でのみ処理され、どこにも送信されません）

ローカルで使う場合:

1. `dist/GanttViewer.html` をブラウザで開く（ダブルクリックで可）。
2. ツールバーの「ファイルを開く」で `examples/sample-data.json` を選択。
3. 尺度（日/週/月）、表示レイヤー、バー注記、配色などを切り替えて閲覧。
4. 編集モードに切り替えると、セル編集・バーのドラッグ・行操作ができ、Ctrl+S で JSON に上書き保存できます。

データ形式は [`docs/DATA-SCHEMA.md`](docs/DATA-SCHEMA.md) を参照。AI にこのスキーマを渡せば、そのまま読み込める JSON を生成できます。

---

## AI にデータを生成させる

このビューアーの中心的な使い方です。**JSON を作らせたい AI には [`docs/schema.json`](docs/schema.json)（機械可読・これが正） と [`examples/sample-data.json`](examples/sample-data.json)（お手本） を渡してください**。人間向けの解説は [`docs/DATA-SCHEMA.md`](docs/DATA-SCHEMA.md) にあります（`CLAUDE.md` は Design/Code の協業ルールなので、生成 AI 向けではありません）。

下のプロンプトをコピーし、上記2ファイルを貼り付け（または添付）て使います。

```text
あなたはガントチャート用の JSON を生成するアシスタントです。
添付の JSON Schema（schema.json）に厳密に従い、JSON を1つだけ出力してください。
サンプル（sample-data.json）の作り方を参考にしてください。

制約:
- 出力は JSON のみ。前後の説明文やコードフェンス外のテキストは書かない。
- 日付はすべて YYYY-MM-DD 形式。
- 階層は children の再帰（任意の深さ）。children を持つ行はグループで、
  バー・工数・進捗は配下から自動集計されるため plan 等を書かない。
- children の無い行はタスクで、plan（予定期間）が必須。
  未着手のタスクは actual を {"start": null, "end": null} とする。
- progress は 0〜1 の小数（% ではない）。actual.end に日付を入れた完了タスクは
  progress を必ず 1 にする（矛盾させない）。
- deps には実在するタスク id のみを書く（依存は FS: 先行の終了→自分の開始 のみ）。
- critical: true を付けるタスクは deps で連結した一続きの鎖にする。
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
│   ├── DATA-SCHEMA.md         # ★データ契約 v2 の解説（人間向け）
│   ├── schema.json            # ★機械可読な JSON Schema v2（AI 生成・検証はこれが正）
│   ├── DESIGN-SYSTEM.md       # デザイントークン（配色2軸・タイポ・寸法・ステータス色）
│   ├── ARCHITECTURE.md        # コードの地図（主要メソッドの責務・データフロー・状態）
│   ├── DECISIONS.md           # 設計判断の記録（なぜ今の形か）
│   ├── BUNDLE.md              # src → dist バンドル仕様
│   ├── CC-HANDOFF.md          # dist 同期の運用手順
│   └── proposals/             # UI 検討時の提案アーカイブ
├── src/
│   ├── Gantt Viewer.dc.html   # ★デザインの源泉（描画ロジック＋ビュー、フレームワーク非依存の素のJS）
│   └── support.js             # ランタイム（自動生成。手で編集しない）
├── scripts/
│   └── sync-dist.mjs          # src → dist 同期スクリプト（node scripts/sync-dist.mjs）
├── examples/
│   ├── sample-data.json       # 標準サンプル（v2。稼働日カレンダー・予実・依存の網羅お手本）
│   ├── roadmap-2026.json      # 大きめサンプル（v2。4プロジェクト・65タスク）
│   └── portfolio-2026.json    # 大規模サンプル（v2。4プロジェクト・70タスク・4階層・祝日カレンダー）
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
- **行モデル** — `buildRows()` が `children` の再帰階層（任意の深さ）と折りたたみを展開。グループ行のバー/工数/進捗は配下から自動集計。
- **状態判定** — `statusOf()` が予定・実績・進捗・本日から 順調/要注意/遅延/完了 を判定。
- **描画要素** — 予実オーバーレイ、進捗%、マイルストーン(◇)、依存矢印、クリティカルパス、イナズマ線、本日線、稼働日カレンダー網掛け。すべて表示レイヤーで個別 on/off。

> `src/` を編集したら `node scripts/sync-dist.mjs` で `dist/GanttViewer.html` に同期します（フォントやランタイム変更時のみ Design 側で再バンドル）。

---

## データ契約（要点）

トップレベル: `meta` / `calendar` / `assignees` / `projects`。詳細と全フィールドは [`docs/DATA-SCHEMA.md`](docs/DATA-SCHEMA.md)。

- 日付は `YYYY-MM-DD`。ラベルは `ja` / `en` の 2 言語。
- 階層は `children` の再帰（v2）。グループは自動集計、タスク（`children` なし）は `plan` 必須。旧 v1（`phases`/`tasks`）も読み込み可。
- タスクは `plan`（予定）と `actual`（実績）の 2 期間。`actual.start=null`=未着手、`actual.end=null`=進行中。
- 期間(日数)はビューアーが自動計算。工数(`personDays`)はデータ側の値。
- 担当者の `color`/`abbr` は省略可（省略時は自動割り当て）。`who` には会社コード等も使用可。
