# Zhihan · 计量经济学手推学习室

在线学习：https://zhihan-iris.github.io/learning-websites/econometrics/

## 2026-10-25：以推导为主线

新增 22 章、125 个推导步骤和 22 道独立练习。按经典教材的常见脉络组织：符号与总体投影 → 一元/矩阵 OLS → 无偏性与方差 → 精确 t/F → 大数定律与中心极限定理 → 一致性与渐近正态性 → 稳健推断、IV、GLS、面板、GMM、MLE、Logit、相关误差与单位根。

每章列出假设，逐行显示公式并解释变形理由，提供练习解答、易错点、前置章节、笔记和打印。两个教学工具分别用于核对三个点的 OLS 手算，以及比较原始误差与估计量的重复抽样分布。模拟是直觉辅助，不替代理论证明。

课程结构参考 Greene 第 8 版作者目录、Wooldridge 教材介绍、Hansen 作者资料及 MIT 讲义；链接与对应章节说明在网站课程页。中文推导为独立编写，不是教材翻译，也不声称覆盖所有高级计量问题。推断结论以各章写明的假设为准。

- 新内容源：`scripts/build-proofs.py`，运行 `python3 econometrics/scripts/build-proofs.py` 生成 `data/proofs.json`。
- 新界面：`derivations.js`、`proofs.css`；纯计算与状态逻辑：`proof-core.js`。
- 验证：仓库根目录运行 `node --test econometrics/tests/*.test.js`。
- 新笔记与阅读记录：`zhihan-econometrics-proofs-v1`，只保存在当前浏览器，可导出 Markdown。
- 旧内容仍从「原讲义与练习」进入；旧笔记从「我的笔记 → 打开原讲义笔记」进入，保留原存储键。
- 起步：`#proof/scalar-ols`、`#proof/matrix-ols`；渐近证明：`#proof/asymptotic-normality`；分布对照：`#inference-map`。

## 原讲义与练习


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
