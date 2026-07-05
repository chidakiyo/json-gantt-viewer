#!/usr/bin/env node
// sync-dist.mjs — src の日常変更（Component ロジック / {{ app }} ラッパー）を
// dist/GanttViewer.html に反映する。BUNDLE.md「方式A」の正しい実装。
//
// 使い方:  node scripts/sync-dist.mjs
//
// 前提と限界（重要）:
//   dist は Design 環境がバンドルした完成品で、support.js とフォントを
//   base64+gzip でインライン化し、DC ソースを <script type="__bundler/template">
//   の中に JSON 文字列として保持している。
//   このスクリプトは、その JSON 文字列の中の「日常的に変わる2領域」だけを
//   src から差し替える:
//     (A) <script data-dc-script ...> ... </script>  ← Component ロジック + data-props
//     (B) </helmet> 〜 </x-dc> の間（{{ app }} を含むラッパー）
//   これで「ロジック・インラインスタイル・props」の変更はすべてカバーできる。
//
//   ⚠ <helmet> の中身（@font-face / @keyframes / scrollbar 等）や、
//     support.js 自体を変えた場合は、このスクリプトでは同期できない。
//     その時は Design 環境で再バンドルすること。
//     （このスクリプトは helmet 変更を検知したら警告して中断する）

import { readFile, writeFile } from 'node:fs/promises';

const SRC  = 'src/Gantt Viewer.dc.html';
const DIST = 'dist/GanttViewer.html';

const TPL_OPEN = '<script type="__bundler/template">';
const CLOSE    = '</script>';

// --- 汎用: regex に一致する1箇所を slice で置換（$ 特殊文字の事故を防ぐ）---
function replaceOnce(str, regex, replacement, label) {
  const m = regex.exec(str);
  if (!m) throw new Error(`[sync] ${label}: 一致が見つからない`);
  const rest = str.slice(m.index + m[0].length);
  if (regex.exec(rest)) throw new Error(`[sync] ${label}: 一致が複数ある（曖昧）`);
  return str.slice(0, m.index) + replacement + str.slice(m.index + m[0].length);
}

// --- src から領域を抽出 ---
function extractLogicBlock(html) {
  const m = /<script\b[^>]*\bdata-dc-script\b[^>]*>/.exec(html);
  if (!m) throw new Error('[sync] src に data-dc-script が無い');
  const start = m.index;
  const end = html.indexOf(CLOSE, start);
  if (end === -1) throw new Error('[sync] src の data-dc-script が閉じていない');
  return html.slice(start, end + CLOSE.length);
}
function extractAppWrapper(html) {
  // </helmet> と </x-dc> の間（前後の改行含む）
  const m = /<\/helmet>([\s\S]*?)<\/x-dc>/.exec(html);
  if (!m) throw new Error('[sync] src に </helmet>…</x-dc> が無い');
  return m[1];
}

async function main() {
  const srcHtml  = await readFile(SRC,  'utf8');
  const distHtml = await readFile(DIST, 'utf8');

  const srcLogic   = extractLogicBlock(srcHtml);
  const srcWrapper = extractAppWrapper(srcHtml);

  // dist の template JSON を取り出す
  const openIdx = distHtml.indexOf(TPL_OPEN);
  if (openIdx === -1) throw new Error('[sync] dist に __bundler/template が無い');
  const contentStart = openIdx + TPL_OPEN.length;
  // JSON は内部の </script> を \u002F でエスケープ済みなので最初の </script> が終端
  const closeIdx = distHtml.indexOf(CLOSE, contentStart);
  if (closeIdx === -1) throw new Error('[sync] dist の template が閉じていない');
  const rawJson = distHtml.slice(contentStart, closeIdx).trim();

  let template;
  try { template = JSON.parse(rawJson); }
  catch (e) { throw new Error('[sync] template JSON の parse 失敗: ' + e.message); }

  // helmet 変更ガード: src の helmet と dist の helmet(style除く比較は難しいので)
  // ここでは「src helmet に含まれる @keyframes / scrollbar 定義」が dist に残っているかを緩く確認。
  const srcHelmet = (/<helmet>([\s\S]*?)<\/helmet>/.exec(srcHtml) || [])[1] || '';
  const keyframeNames = [...srcHelmet.matchAll(/@keyframes\s+([\w-]+)/g)].map(x => x[1]);
  for (const k of keyframeNames) {
    if (!template.includes('@keyframes ' + k)) {
      throw new Error(
        `[sync] helmet の @keyframes ${k} が dist に無い。helmet を変更した可能性。\n` +
        `       helmet / フォント / support.js を変えた場合は Design 環境で再バンドルすること。`);
    }
  }

  // (A) ロジックブロック差し替え
  template = replaceOnce(
    template,
    /<script\b[^>]*\bdata-dc-script\b[\s\S]*?<\/script>/,
    srcLogic,
    'logic block'
  );
  // (B) app ラッパー差し替え
  template = replaceOnce(
    template,
    /(<\/helmet>)[\s\S]*?(<\/x-dc>)/,
    '</helmet>' + srcWrapper + '</x-dc>',
    'app wrapper'
  );

  // 書き戻し（template タグの前後はそのまま）
  // ⚠ JSON.stringify は "/" をエスケープしないため、そのままでは JSON 内に生の
  //   </script> が現れて template タグが途中で閉じ、dist が壊れる。
  //   "</" → "<\/"（JSON で合法なエスケープ）にして防ぐ。
  const newJson = JSON.stringify(template).replace(/<\//g, '<\\/');
  const before = distHtml.slice(0, contentStart);
  const after  = distHtml.slice(closeIdx);
  const newDist = `${before}\n${newJson}\n  ${after}`;

  if (newDist === distHtml) {
    console.log('[sync] 変更なし（src と dist は既に同期済み）');
    return;
  }
  await writeFile(DIST, newDist);
  console.log('[sync] dist/GanttViewer.html を更新した。');
  console.log('[sync] 検証: file:// で開き、examples/sample-data.json を読み込んで動作確認すること。');
}

main().catch(err => { console.error(String(err.message || err)); process.exit(1); });
