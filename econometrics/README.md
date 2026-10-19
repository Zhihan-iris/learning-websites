# Zhihan · 计量经济学学习室

独立地址：https://zhihan-iris.github.io/learning-websites/econometrics/

依据用户提供的《太白金星 计量经济学讲义》（太白金星 V，2023 年版，177 页扫描 PDF）主题独立编写。覆盖主要知识框架，不是逐字转录或完整高级教材。原 PDF、截图与 OCR 均不发布。所有来源页码为 PDF 阅读器页码；第 101、102 页重复，之后 PDF 页码比印刷页码大 1。

- 20 个单元：概率与 OLS、多元回归、IV、时间序列、极大似然、离散选择与面板。
- 每单元 3 道自测及解析、主动回忆笔记、条件明确的公式卡。
- 5 个教学实验：OLS、区间宽度、遗漏偏差、AR(1)、Logit。图形为教学构造，非实证数据。
- 40 个术语和 15 条订正／条件补充，附原页码及官方参考资料。
- 阅读标记、最近答题、历史错题与笔记独立保存于 `zhihan-econometrics-v1`；不触碰雅思站记录。记录只在本浏览器，笔记可导出 Markdown。
- 打印本章时展示例题解答并使用白底。公式由本地 KaTeX 渲染，其许可证在 `assets/katex/LICENSE`。

在仓库根目录执行 `python3 -m http.server 4176`，打开 `/econometrics/`。内容源在 `scripts/build-content.py`；运行 `python3 econometrics/scripts/build-content.py` 重建 JSON。`npm test` 覆盖三站逻辑。

公式、例题、条件补充与来源链接已进行人工核对；本网站并不宣称覆盖原讲义全部证明或穷尽所有适用条件。进阶研究需阅读完整教材和对应模型文献。
