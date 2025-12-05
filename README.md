# Cassette Recording Helper

<p align="right">
  <a href="#english">English</a> |
  <a href="#简体中文">简体中文</a> |
  <a href="#日本語">日本語</a>
</p>

## English

### Overview
Lightweight web app for assembling and previewing cassette-friendly track lists. Import audio, reorder with drag-and-drop, set lead-in and gap silences, and play inline in the browser.

### Features
- Import multiple audio files (click or drag-drop) and probe durations.
- Drag-and-drop reordering; delete items.
- Lead-in and per-track gap silence with live total time.
- Inline playback with current/overall progress.
- Multi-language support (globe menu).
- Light/dark theme toggle and a peak check with spectrum + 15s peak excerpt playback.

### Run locally
Use any static server:
```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

### Structure
- `index.html` — main UI.
- `style.css`, `styles/` — base/components styling.
- `js/state.js` — shared DOM refs and app state.
- `js/theme-lang.js` — theme toggle + language menu helpers.
- `js/player.js` — core playback controls, lead/gap handling.
- `js/playlist.js` — list rendering, drag/reorder, level UI.
- `js/peak.js` — peak analysis + waveform playback.
- `js/peak-visualizer.js` — WaveSurfer gradient/builder.
- `js/level-utils.js` — level compute/adjust helpers.
- `js/i18n.js` — language loader for `lang/*.json`.
- `js/utils.js` — generic helpers (duration, ids, input normalize).
- `lang/` — translations (zh-CN, en, ja).
- `lang-icon.svg`, `favicon.png` — assets.

### Notes
- Playback depends on browser-supported formats; some uncommon formats may not work.
- Always serve over HTTP(S); `file://` will block language JSON loading.
- Peak check: analyze the current track, see the spectrum, and play a ~15s excerpt around the loudest point.

---

## 简体中文

### 概述
轻量网页应用，用来拼装和预览磁带友好的播放列表。导入音频、拖拽排序、设置前导和间隔空白，并在浏览器内直接播放。

### 功能
- 点击或拖拽导入多首音频并读取时长。
- 支持拖拽排序、删除曲目。
- 设置前导空白和曲间空白，实时显示总时长。
- 内置播放，显示当前/全局进度。
- 多语言支持。
- 主题切换以及峰值检查（频谱 + 峰值前后约15秒试播）。

### 本地运行
需要本地静态服务器：
```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

### 结构
- `index.html`：主界面。
- `style.css`、`styles/`：样式。
- `js/state.js`：共享 DOM 引用和状态。
- `js/theme-lang.js`：主题切换与语言菜单。
- `js/player.js`：播放控制、前导/间隔逻辑。
- `js/playlist.js`：列表渲染、拖拽、水平展示与输入。
- `js/peak.js`：峰值分析与波形播放。
- `js/peak-visualizer.js`：WaveSurfer 配置/渐变构造。
- `js/level-utils.js`：电平计算与调整工具。
- `js/i18n.js`：加载 `lang/*.json` 语言。
- `js/utils.js`：通用工具（时长、ID、输入规范）。
- `lang/`：翻译文件（中/英/日）。
- `lang-icon.svg`、`favicon.png`：图标。

### 说明
- 播放依赖浏览器支持的格式，部分特殊格式可能无法播放。
- 峰值检查：分析当前曲目，查看频谱并播放峰值前后约15秒，用于校准录音电平。

## 日本語

### 概要
カセット向けプレイリストを手軽に組み立てて試聴できるウェブアプリ。音源を追加してドラッグで並べ替え、頭出しや曲間の無音を設定し、ブラウザ内で再生できます。

### 機能
- クリックまたはドラッグ&ドロップで複数の音源を追加し、長さを取得。
- ドラッグで並び替え、削除に対応。
- 頭出し無音と曲間無音を設定し、合計時間を即時表示。
- 内蔵プレイヤーで現在/全体の進捗を表示。
- 多言語対応。
- テーマ切替とピークチェック（スペクトラム＋ピーク前後約15秒の再生）。

### ローカル実行
ローカル静的サーバーを利用してください：
```bash
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

### 構成
- `index.html`：メイン UI。
- `style.css`、`styles/`：スタイル一式。
- `js/state.js`：共有 DOM 参照と状態。
- `js/theme-lang.js`：テーマ切替と言語メニュー。
- `js/player.js`：再生コントロール、頭出し/曲間処理。
- `js/playlist.js`：リスト描画、ドラッグ並び替え、レベル UI。
- `js/peak.js`：ピーク分析と波形再生。
- `js/peak-visualizer.js`：WaveSurfer 用グラデ/ビルダー。
- `js/level-utils.js`：レベル計算と調整ツール。
- `js/i18n.js`：`lang/*.json` 読み込み。
- `js/utils.js`：汎用ヘルパー（時間、ID、入力正規化）。
- `lang/`：翻訳ファイル（中/英/日）。
- `lang-icon.svg`、`favicon.png`：アイコン。

### 注意
- 再生はブラウザ対応の形式に依存し、一部の特殊形式は再生できない場合があります。
- ピークチェック：選曲を解析し、ピーク周辺約15秒を再生してレベル合わせに使えます。
