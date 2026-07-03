# デザインシステム

`json-gantt-viewer` の視覚仕様。値はすべて `src/Gantt Viewer.dc.html` 内にインライン定義（外部トークンは持たない — 理由は [`DECISIONS.md`](DECISIONS.md)）。本書は**その値の一覧・出典・使い分け**を記す“読み取り専用の地図”。値を変えるときは `src/` を直し、本書を追従させる。

## 2 軸のテーマモデル

テーマは **構造（STRUCT）× 配色（PALETTE）** の掛け合わせ。`buildTheme(structKey, paletteKey)` が両者を合成して `T`（実効テーマ）を返す。

### 構造軸 STRUCT（レイアウト・密度・明暗）

| キー | 名称 | 角丸 | 行高 | ヘッダ高 | 文字 | 等幅 | 発光 | 明暗 |
|---|---|---|---|---|---|---|---|---|
| `A` | クリーン | 7px | 40px | 56px | 13px | – | – | light |
| `B` | デンス | 3px | 30px | 48px | 12px | ✓ | – | light |
| `C` | ダーク | 8px | 40px | 56px | 13px | – | ✓ | dark |

> 行高は「行間（density）」設定で `×0.72 / ×1.0 / ×1.32`（compact / default / spacious）。バー高は行高の約 0.5。

### 配色軸 PALETTE（アクセント＋地色ランプ＋イナズマ線色）

11 種。各パレットは `accentL`（明）/`accentD`（暗）/`ramp`（使用する地色ランプ）/`ina`（イナズマ線色）を持つ。

| キー | 名称 | アクセント(明) | ランプ | イナズマ線 |
|---|---|---|---|---|
| `ocean` | オーシャン | `#3b6fd4` | cool | `#7a5fd0` |
| `teal` | ティール | `#1d867c` | slate | `#c56b8a` |
| `sage` | セージ | `#4d8757` | sage | `#b06a3c` |
| `moss` | モス | `#697538` | sage | `#b0623c` |
| `indigo` | インディゴ | `#4a54c4` | slate | `#c9902e` |
| `plum` | プラム | `#7a5ac2` | cool | `#c9902e` |
| `rose` | ローズ | `#b0567a` | blush | `#4d8757` |
| `coral` | コーラル | `#dc6c4b` | blush | `#3f8a86` |
| `terracotta` | テラコッタ | `#bd5c39` | warm | `#3f8f88` |
| `steel` | スティール | `#4d6d94` | slate | `#b06a3c` |
| `graphite` | グラファイト | `#566274` | cool | `#7a5fd0` |

> イナズマ線はアクセントの反対色を選び、進捗折れ線が埋もれないようにしている。

### 地色ランプ RAMPS（ニュートラル＋ステータス）

`cool / warm / sage / slate / blush` の 5 系統 × `light / dark`。各ランプが以下のキーを供給する:

`bg, panel, headerBg, text, dim, faint, grid, gridStrong, rowAlt, weekend, track, planBorder`（ニュートラル）
`amber, rose, done, doneFill, crit, ms`（機能色）

代表値（cool・light）: `bg #f3f5f8` / `panel #ffffff` / `text #232b39` / `dim #6a7383` / `faint #98a1b0` / `grid #edf0f4` / `gridStrong #dde2ea`。

## ステータス色（タスク状態）

`statusOf(task)` が予定・実績・進捗・本日から判定し、`statusColor()` で色に対応。

| 状態 | 意味 | 色ソース |
|---|---|---|
| `ontrack` | 順調 | アクセント（`T.blue`） |
| `done` | 完了（progress≥1） | `T.done`（グレー） |
| `risk` | 要注意（着手遅れ/進捗遅延） | `T.amber` |
| `delay` | 遅延（本日が予定終了超過・未完） | `T.rose` |
| `future` | 未着手（予定開始前） | `T.faint` |

特別線: **本日線** `today`（明 `#db5f47` / 暗 `#e77a63`）、**クリティカル** `crit`、**マイルストーン** `ms`。

## タイポグラフィ

- UI 本文: `Inter` ＋ `Noto Sans JP`（日本語）。基準サイズは STRUCT の `fs`（12–13px）。
- 数値（日付・工数・％）: `JetBrains Mono`（構造 B では UI 全体も等幅寄り `mono:true`）。
- ウェイト: 見出し/強調 700、ラベル 600、本文 500。

## スペーシング・形状

- 角丸: バー=STRUCT の `radius`、メニュー=11–12px、チップ/ピル=5–8px、アバター=円。
- ツールバー: ボタン `padding 5–7px / 9–13px`、`borderRadius 8`、区切り縦線 `1×26px @ gridStrong`。
- グリッド: 縦線は週/月境界=`gridStrong`、日=`grid`。週末網掛け=`weekend`、祝日網掛け=`rose @ 9–11%`。
- 進捗バー（データ列）: 高さ 5px、角丸 3px、トラック=`track`。

## アバター

- 円形。色は `assignees[].color`、省略時は `autoColor(key)` が 12 色パレットから決定的に採番。
- イニシャル: 英名`Taro Sato`→`TS` / 和名`山田花子`→`山田` / コード`SM`→`SM` / 会社`XYZ`→最大3文字。`abbr` で明示可。

## バー注記（バー外ラベル、既定オフ）

- **担当者**: バー開始の左横（アバター）。
- **タスク名**: バー終了の右横（テキスト）。
- **日付**: 開始＝左端外、終了＝右端外（等幅・`faint`）。

> バー“内”にテキストを置かない設計。理由は [`DECISIONS.md`](DECISIONS.md)。
