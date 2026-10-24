# Zhihan · 学习网站

三个独立的学习模块，各自保存进度。先选择主题，再进入对应站点。

**[打开分类入口](https://zhihan-iris.github.io/learning-websites/catalog.html)**

## 按主题进入

| 分类 | 模块 | 在线使用 | 文件与说明 |
| --- | --- | --- | --- |
| 经济学 | 计量经济学：概念、公式、自测与互动实验 | [计量学习室](https://zhihan-iris.github.io/learning-websites/econometrics/) | [econometrics/](econometrics/) · [说明](econometrics/README.md) |
| 英语 | 听力：听写、同义替换、数字与错题练习 | [听力练习室](https://zhihan-iris.github.io/learning-websites/listening/) | [listening/](listening/) · [使用说明](listening/USAGE.md) |
| 英语 | 写作：表达积累、搭配回忆与范文练习 | [写作学习室](https://zhihan-iris.github.io/learning-websites/writing/) | [writing/](writing/) · [说明](writing/README.md) |

## 目录约定

- `econometrics/`：计量经济学课程及交互实验。
- `listening/`：听力站点、词库、构建脚本和测试。
- `writing/`：写作站点、学习资料与测试。
- `catalog.html`：三个模块的分类入口。
- `index.html`：兼容旧听力地址，保留原有跳转。
- `docs/`：历史说明；旧版总说明保存在 [README-original.md](docs/README-original.md)。

新增课程放进对应学科目录；模块自己的使用细节写在模块内，总 README 只保留导航和共用运行说明。

## 本地运行

在仓库根目录运行：

```sh
python3 -m http.server 4173
```

打开 http://localhost:4173/catalog.html 。各模块的测试命令见对应说明；根目录原有测试可通过 `npm test` 运行。

## 数据与进度

学习记录保存在当前浏览器中，三个模块独立保存。原有页面路径、存储键和练习流程未改动。
