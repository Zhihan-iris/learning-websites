# 词间 · 雅思场景听写

一个无需账号、无需构建的雅思词汇听写网站。根据《雅思听力场景词汇》整理了 **15 个场景、966 个单词与短语**。

## 使用方式

1. 选择场景、每组词数（10 / 20 / 50 / 全部）和顺序，点击「开始今日练习」。
2. 听英语发音，输入单词或短语，按 **Enter** 检查。
3. 答对后显示拼写和中文释义，再按 **Enter** 进入下一词。
4. 答错后提示错误、显示正确拼写和中文，并自动加入错题本。
5. 按 **Enter** 隐藏正确拼写，开始 5 遍默写。每次输入后按 Enter，只有正确答案才计数；写错不增加次数，再次显示正确答案供记忆。
6. 完成 5 遍后，再按 **Enter** 进入下一题。错题记录保留，标记「已巩固」，可在「全部记录」中重新练习。

`Alt + P` 重播当前词。支持英式 / 美式口音与三档速度；设备缺少目标口音时使用可用英语语音。大小写、首尾空格、连续空格不影响判定，常见英美拼写差异可接受。同义词作为不同的听音题目，不混用答案。

## 本地运行

无需安装前端依赖。在仓库目录运行：

```sh
python3 -m http.server 4173
```

打开 <http://localhost:4173>。不要直接双击 HTML；词库通过 `fetch` 加载，需要 HTTP 服务。

可用 Node.js 运行核心逻辑与词库检查：

```sh
npm test
```

## GitHub Pages

在仓库 **Settings → Pages → Build and deployment** 中选择 **Deploy from a branch**，分支选 `main`，目录选 `/ (root)`，保存。根目录有 `.nojekyll`，可直接发布静态资源。

预计地址：<https://zhihan-iris.github.io/learning-websites/>（以 GitHub Pages 实际发布状态为准）。

## 数据与隐私

- 使用浏览器 `speechSynthesis` 提供英语读音，不需要 API 密钥。语音是否需要联网由浏览器和所选系统语音决定；网站本身没有语音上传功能。
- 首次播放需要点击开始或播放按钮。若无声，请检查音量、设备英语语音包和浏览器语音支持；刷新后点击声波重播。
- 进度、设置、错题和当前练习（包括重写次数）仅保存在当前浏览器的 `localStorage`。清除网站数据、更换浏览器或设备不会同步进度。
- 「已掌握词汇」统计首次答对或日后复习时直接答对的独立词；完成 5 遍的错词只标记「已巩固」，不会虚增首答正确率。
- 主动「结束本组」会结束当前练习与重写计数，历史答题与错题记录保留。

## 词库来源与整理

来源：用户提供的《雅思听力场景词汇》（新东方在线雅思研发中心），PDF 第 2–20 页，共 **903 条原始表格记录**。封面与推广页不进入词库。原 PDF 不在仓库内。

- `data/source-entries.json`：原始表格提取内容、PDF 页码及位置，便于核对。
- `data/vocabulary.json`：应用实际使用的 966 条练习词。拆开斜杠表达、补全共享的词组部分、展开括号可选形式；同一场景的相同词去重，跨场景同词保留。
- `scripts/build-vocabulary.py`：从原始记录重建应用词库，无第三方 Python 依赖。
- 词库保留英文与中文，并在词库页显示来源页码。
- 修正了明显排印或翻译问题，例如 `four-wheel driver → four-wheel drive`、`stretchclass → stretch class`、`Biophysics → 生物物理学`、`photocopier → 复印机`、`laser printer → 激光打印机`、`nuclear power plants → 核电站`；货币符号补充中文，分拆词汇补充对应释义。完整规则见构建脚本。

## 文件结构

```text
index.html                 页面结构
styles.css                 桌面 / 手机样式
app.js                     朗读、页面交互、记录持久化
core.js                    判题、练习状态、5 遍计数
 data/vocabulary.json      场景词库
 data/source-entries.json  提取的原始记录
scripts/build-vocabulary.py 词库整理规则
tests/core.test.js         核心流程与数据检查
```
