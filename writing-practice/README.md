# Zhihan · 自由写作练习室

地址：https://zhihan-iris.github.io/learning-websites/writing-practice/

输入自己的题目 → 开始写作 → 独立输入英文正文 → 提交后查看拼写与搭配提示。独立于原有 `/writing/` 表达学习室。

## 原文保护

题目和正文关闭 autocapitalize、autocorrect、spellcheck、autocomplete，并向常见语法扩展声明禁用。网站不在输入时检查，不替换或补全文本。外部输入法或扩展的强制改写不在网页控制范围内。

检查使用提交快照，定位仅选中文字。检查期间继续编辑会使旧结果作废。大小写、标点与风格建议不纳入在线报告；不做作文评分或切题判断。

## 检查范围和隐私

基础检查通过本地 nspell 与英美 SCOWL/Hunspell 词典运行于 Worker。正确英美拼写都接受，偏好只影响建议。搭配是有限的常见规则，不保证理解所有上下文或找到全部问题。专业词可能误报，支持最多 100 个忽略词。最多显示 120 个拼写位置，前 40 个不同拼写提供计算建议，合并报告最多 160 条。

在线检查默认关闭。勾选后，仅在点击提交时向 https://api.languagetool.org/v2/check POST 正文；题目、历史与忽略词不发送。无账户密钥，无自动重试或后台轮询。15 秒提交间隔，18 KB 文本上限，20 秒超时。失败、限流及不完整结果会明确显示“只展示本地结果”。页面提供 LanguageTool 署名和隐私链接。

草稿只保存在本浏览器，键为 `zhihan-free-writing-v1`，可以下载原文及检查记录。不改变其他模块记录，不在服务器保存草稿。新模块没有修改原 AI 老师的后台、口令、模型或费用设置。

## 开发

仓库根目录运行 `python3 -m http.server 4191`，打开 `/writing-practice/`。
验证：`node --test writing-practice/tests/*.test.js`。

第三方资源：nspell 2.1.5（MIT，https://github.com/wooorm/nspell）、dictionary-en 4.0.0、dictionary-en-gb 3.0.0（SCOWL 派生词典）。完整词典许可和 is-buffer 依赖许可见 `vendor/*LICENSE.txt`。esbuild 0.28.2 用于打包，不随网站部署。

打包入口：`import nspell from 'nspell'; export default nspell;`，命令：`esbuild spell-entry.js --bundle --format=esm --platform=browser --minify --outfile=vendor/nspell.js`。
LanguageTool API 使用规则：https://dev.languagetool.org/public-http-api.html
