# アーキテクチャ（コードの地図）

`src/Gantt Viewer.dc.html` は単一ファイル。`class Component` の中に、描画に必要なロジックがすべて素の JavaScript として入っている。UI は `React.createElement`（`e(...)`）で構築。状態は `this.state`、テーマは合成後の `T`。

外部 JSON 未読込時は内蔵サンプル（`_defProjects` 等）を表示。`normalizeDoc()` を通した JSON があればそちらを優先。

## データフロー

```
JSON ファイル
  └─ openFile(ev)                 FileReader で読み、JSON.parse
       └─ normalizeDoc(json)      内部モデルへ正規化（下記）
            └─ this.state.doc     以降 DATA / ASSIGNEES / CAL / META がここを参照
                 └─ buildRows()   階層展開＋集計 → 行配列
                      └─ renderBoard() が行 × 時間軸を描画
```

内部モデル（`normalizeDoc` の出力）:
- タスクは `plan{start,end}`→`ps/pe`、`actual{start,end}`→`as/ae`、`progress`→`prog`、`personDays`→`pd` に正規化。
- `assignees` は `color` 省略時 `autoColor()`、`abbr` は表示時に生成。
- `calendar` は `workweek`（稼働曜日）/`holidays`（休業日 map）/`extra`（特別稼働日 map）へ。

## 主要メソッドの責務

### データ取り込み
- `normalizeDoc(json)` — 生 JSON を内部モデルへ正規化。旧形式（`ps/pe` 直書き）とも後方互換。
- `openFile(ev)` / `resetDoc()` — ファイル読込・サンプルへ戻す。
- getter `DATA` / `ASSIGNEES` / `META` / `CAL` — `state.doc` があればそれ、無ければ内蔵デフォルト。

### 時間軸ジオメトリ
- `geo()` — 全日付（タスクの予実＋**マイルストーン**）から描画範囲 `[cs, ce]` を算出し、尺度ごとの 1 日あたり px を決定。範囲が空なら本日中心の既定幅。
- `dateToX(date, g)` — 日付→X 座標。
- `timeCols(g)` — 日/週/月スケールの 2 段ヘッダー目盛りを生成（`tier1`=月/年、`tier2`=日/週/月）。日スケールでは曜日・週末・祝日フラグも付与。
- 日付ユーティリティ: `pd`（parse）`addD` `dd`（日数差）`sow/som/eom` `fmtMD` など。

### 行モデル
- `buildRows()` — プロジェクト→工程→タスクを、折りたたみ状態 `collapsed` を反映して 1 次元の行配列へ展開。
- `agg(tasks)` — 工程・プロジェクトのバー範囲・工数・進捗を配下タスクから集計（手入力しない）。
- `leafMap()` — 依存線描画用に、タスク id → 行 index / 座標 を索引化。
- `setLevel(lv)` / `outLv` — 階層一括開閉（PJ / 工程 / 全て）。

### 状態判定
- `statusOf(task)` — 予定・実績・進捗・本日から `ontrack/done/risk/delay/future` を判定。
- `statusColor(status, T)` — 状態→色。
- `dayKind(date)` — 稼働日カレンダー判定。優先順位 `extra`（稼働）> `holidays`（休業）> `workweek` 外（週末）。

### テーマ
- `STRUCT` / `RAMPS` / `PALETTES` — 構造軸・地色ランプ・配色軸の定義（値は `docs/DESIGN-SYSTEM.md`）。
- `buildTheme(structKey, paletteKey)` — 2 軸を合成。getter `T` が現在の実効テーマ。
- ヘルパー: `hex(c,a)`（不透明度付与）`mixHex` `lighten` `grad` `autoColor` `initialsFor`。

### 描画（renderVals から下）
- `renderApp` → `renderToolbar` / `renderBoard` / `renderStatusBar` / `renderTip`。
- `renderBoard` — 左固定グリッド（ツリー＋データ列）＋右タイムラインを同一スクロールで同期。
- `renderRow` — 1 行（左セル＋バー）。行背景は半透明（週末/祝日網掛けを透けさせるため）。
- `renderTaskBar` — 予定枠・進捗塗り・オーバーラン・バー注記・ホバーヒット領域。
- `renderSummaryBar` — 工程/プロジェクトの集計バー（キャップ付き）。
- `renderMilestones` — ◇＋チップラベル。
- `renderOverlay` — SVG レイヤー: 依存矢印・イナズマ線・本日線。
- `renderTip` — 自前ホバーカード（標準 title に頼らず即時表示）。
- メニュー: `renderLayersMenu`（表示レイヤー）`renderColsMenu`（データ列）`renderLabelsMenu`（バー注記）`renderPaletteMenu`（配色）。

## 状態（this.state）の主なキー

| キー | 意味 |
|---|---|
| `lang` | `ja` / `en` |
| `variant` | 構造軸 `A`/`B`/`C` |
| `palette` | 配色軸キー |
| `mode` | 尺度 `day`/`week`/`month` |
| `density` | 行間 `compact`/`default`/`spacious` |
| `collapsed` / `outLv` | 折りたたみ状態 / 階層一括レベル |
| `layers` | 表示レイヤー on/off（plan, progress, milestones, deps, critical, inazuma, today, weekend, holidays, grid） |
| `cols` | データ列 on/off（assignee, workload, duration, progress） |
| `barLabels` | バー注記 on/off（dates, name, owner） |
| `sel` / `hover` / `tip` | 選択行 / ホバー行 / ホバーカード |
| `doc` / `fileName` | 読込済みデータ / ファイル名 |

## 拡張の勘所（Claude Code 向け）

- **新しい表示要素**を足す → `layers` にキー追加 → `renderOverlay` か `renderRow` に描画 → 凡例（`renderStatusBar`）と `renderLayersMenu` に反映。
- **データ項目**を足す → `docs/DATA-SCHEMA.md` を更新 → `normalizeDoc` で取り込み → 使用箇所で参照。後方互換を保つ。
- **編集・保存**を足す（現状なし・最大の拡張ポイント）→ バーのドラッグは `dateToX` の逆変換で日付化、保存は File System Access API かバックエンド。DOM 構造ではなく `state.doc` を単一の真実として更新する。
- **仮想スクロール**（大規模データ）→ `renderBoard` の行ループを可視範囲だけに絞る。行高は `rh()` で一定なので計算は容易。
