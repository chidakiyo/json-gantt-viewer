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
//   さらに (C) として、template の外側（バンドラーの外枠）の読み込み画面を、
//   ビューアー本体の起動スプラッシュと同じ見た目のものに差し替える（gv-boot）。
//   配色はユーザーの表示設定（localStorage）に追従し、色は src のテーマ定義から生成する。
//
//   ⚠ <helmet> の中身（@font-face / @keyframes / scrollbar 等）や、
//     support.js 自体を変えた場合は、このスクリプトでは同期できない。
//     その時は Design 環境で再バンドルすること。
//     （このスクリプトは helmet 変更を検知したら警告して中断する）

import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

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

// --- (C) 外枠の起動スプラッシュ（gv-boot） ---
// src の Component クラスを評価し、全「構造 × 配色」の起動画面の色を取り出す（テーマ変更に自動追従）
function bootThemeMap(logicBlock) {
  const body = logicBlock.replace(/^<script\b[^>]*>/, '').replace(/<\/script>$/, '');
  const ctx = {};
  vm.runInNewContext('class DCLogic{};\n' + body + '\n;this.C=Component;', ctx);
  const inst = Object.create(ctx.C.prototype);
  const map = {};
  for (const sk of Object.keys(inst.STRUCT)) for (const pk of Object.keys(inst.PALETTES)) {
    const T = inst.buildTheme(sk, pk);
    map[sk + '|' + pk] = { bg: T.bg, b: T.blue, tr: T.track, sh: inst.hex(T.blue, .35) };
  }
  return map;
}
// ビューアーの renderSplash と同じ寸法・アニメーション。document 差し替え（replaceWith）を跨いで
// 同じ要素を表示し続け、アプリ側（componentDidMount）が準備できたら window.__gvBoot.done() でフェードアウトする。
// スタイルは外枠の <style> が差し替えで消えるため、すべてインライン＋要素内 <style> で持つ。
function bootMarkup(map) {
  const d = map['A|ocean'];
  const bar = (h, op, delay) => `<i data-p="1100" data-d="${delay}" data-a="gvb-bar 1.1s ease-in-out infinite" style="display:block;width:5.5px;height:${h}px;background:#fff;border-radius:3px;opacity:${op};transform-origin:bottom"></i>`;
  return `<!--gv-boot-->
  <div id="gv-boot" style="position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:${d.bg};transition:opacity .38s ease">
    <style>@keyframes gvb-bar{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1)}}@keyframes gvb-shim{0%{transform:translateX(-110%)}100%{transform:translateX(240%)}}</style>
    <div data-k="ic" style="width:56px;height:56px;border-radius:15px;background:${d.b};display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px ${d.sh}">
      <div style="display:flex;gap:4.5px;align-items:flex-end;height:26px">${bar(16, .92, 0)}${bar(25, 1, 180)}${bar(11, .85, 360)}</div>
    </div>
    <div data-k="tr" style="width:132px;height:3px;border-radius:2px;background:${d.tr};overflow:hidden;position:relative">
      <div data-k="sh" data-p="1000" data-d="0" data-a="gvb-shim 1s ease-in-out infinite" style="position:absolute;top:0;left:0;width:45%;height:100%;border-radius:2px;background:${d.b}"></div>
    </div>
  </div>
  <div id="__bundler_loading" style="display:none;position:fixed;bottom:20px;right:20px;font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#666;background:#fff;padding:8px 14px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.12);z-index:2147483001">Unpacking...</div>
  <script>(function(){
    var M=${JSON.stringify(map)};
    var el=document.getElementById('gv-boot'), p={};
    try{ p=JSON.parse(localStorage.getItem('jsonGanttViewer.prefs.v1')||'{}')||{}; }catch(e){}
    var t=M[(p.variant||'A')+'|'+(p.palette||'ocean')]||M['A|ocean'];
    el.style.background=t.bg; document.documentElement.style.background=t.bg;
    var q=function(k){ return el.querySelector('[data-k="'+k+'"]'); };
    q('ic').style.background=t.b; q('ic').style.boxShadow='0 10px 30px '+t.sh; q('tr').style.background=t.tr; q('sh').style.background=t.b;
    // 位相を document の時刻に揃える（再挿入でアニメーションが巻き戻らないように）
    var anim=function(){ var now=performance.now(); [].forEach.call(el.querySelectorAll('[data-a]'),function(n){ n.style.animation=n.getAttribute('data-a'); n.style.animationDelay=(parseFloat(n.getAttribute('data-d'))-(now%parseFloat(n.getAttribute('data-p'))))+'ms'; }); };
    anim();
    var mo=new MutationObserver(function(){ if(!el.isConnected && document.body){ document.documentElement.style.background=t.bg; document.body.appendChild(el); anim(); } });
    mo.observe(document,{childList:true,subtree:true});
    var gone=false, hide=function(){ if(gone) return; gone=true; mo.disconnect(); el.style.opacity='0'; el.style.pointerEvents='none'; setTimeout(function(){ el.remove(); },420); };
    window.__gvBoot={ t0:performance.now(), done:hide };
    // 展開に失敗したらエラー表示を隠さない
    var ld=document.getElementById('__bundler_loading');
    new MutationObserver(function(){ if(/^Error/.test(ld.textContent)){ ld.style.display='block'; hide(); } }).observe(ld,{childList:true,characterData:true,subtree:true});
    window.addEventListener('error',function(){ hide(); });
    setTimeout(hide,20000); // 保険: 何があっても最後は消す
  })();</script>
  <!--/gv-boot-->`;
}
function patchOuter(before, map) {
  const head = `<!--gv-boot:head--><title>Gantt Viewer</title>
  <style>html,body{margin:0;padding:0}</style><!--/gv-boot:head-->`;
  if (before.includes('<!--gv-boot:head-->')) {
    before = replaceOnce(before, /<!--gv-boot:head-->[\s\S]*?<!--\/gv-boot:head-->/, head, 'boot head');
  } else {
    before = replaceOnce(before, /<title>Bundled Page<\/title>\s*<style>[\s\S]*?<\/style>/, head, 'bundler head style');
  }
  if (before.includes('<!--gv-boot-->')) {
    before = replaceOnce(before, /<!--gv-boot-->[\s\S]*?<!--\/gv-boot-->/, bootMarkup(map), 'boot body');
  } else {
    before = replaceOnce(before, /<div id="__bundler_thumbnail">[\s\S]*?<\/div>\s*<div id="__bundler_loading">[^<]*<\/div>/, bootMarkup(map), 'bundler thumbnail');
  }
  return before;
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
  // ⚠ JSON.stringify は '/' をエスケープしない。生の </script> が JSON 文字列内に残ると
  //   <script type="__bundler/template"> ブロックが途中で閉じ、dist が壊れる。
  //   '</' → '<\/' に変換する（valid な JSON エスケープ。parse すると同一内容に戻る）。
  const newJson = JSON.stringify(template).replace(/<\//g, '<\\/');
  const before = patchOuter(distHtml.slice(0, contentStart), bootThemeMap(srcLogic));
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
