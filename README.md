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
- `script.js` — playlist logic, playback, progress, UI wiring.
- `js/i18n.js` — language loader for `lang/*.json`.
- `lang/` — translations (zh-CN, en, ja).
- `lang-icon.svg` — language icon; `favicon.png` — favicon.
- `js/utils.js` — helpers for durations, ids, formatting.

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
- `script.js`：播放列表、播放与进度逻辑。
- `js/i18n.js`：加载 `lang/*.json` 语言。
- `lang/`：翻译文件（中/英/日）。
- `lang-icon.svg`：语言图标；`favicon.png`：站点图标。
- `js/utils.js`：时长、ID、格式化工具。

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
- `script.js`：プレイリスト、再生、進捗ロジック。
- `js/i18n.js`：`lang/*.json` の読み込み。
- `lang/`：翻訳ファイル（中/英/日）。
- `lang-icon.svg`：言語アイコン。`favicon.png`：ファビコン。
- `js/utils.js`：時間計算、ID、フォーマット用ツール。

### 注意
- 再生はブラウザ対応の形式に依存し、一部の特殊形式は再生できない場合があります。
- ピークチェック：選曲を解析し、ピーク周辺約15秒を再生してレベル合わせに使えます。
