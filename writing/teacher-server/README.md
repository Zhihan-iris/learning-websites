# Zhihan AI 写作老师 · 后台部署

此目录是可部署的 Cloudflare Worker。写作网站仍在 GitHub Pages；AI 密钥仅保存在 Worker Secrets 中。没有配置后台时，表达对照与本地订正仍可使用，页面不会伪造 AI 讲评。

## 当前配置：只用免费模型

根据用户要求，`ALLOW_PAID_MODELS` 默认为 `false`。后台仅接受 OpenRouter 的 `openrouter/free` 或白名单内以 `:free` 结尾的具体模型；即使填了其他供应商密钥，也不能调用它们。每次请求另设置 `provider.max_price` 的输入、输出及单次请求价格上限均为 0，并关闭回退。免费模型下线、限流或额度耗尽时停止，不自动启用收费服务。

目前的三个默认选项已于 2026-10-21 查询公开模型目录，输入和输出价格均为 0：`openrouter/free`、`minimax/minimax-m3.1-flash:free`、`google/gemma-4-31b-it:free`。免费路由实际选择的模型会显示在结果中；可用名单会变化，失效时应换另一个仍免费的模型，而不是去掉 `:free` 后缀。

个人低频练习可以先使用免费额度，不需要充值启用付费模型。免费接口不承诺无限次数、固定速度或固定模型。不能把其他厂商的限时赠送额度当作持续免费接口。

## 已实现的供应商适配（付费接口默认禁用）

| 供应商 | Secret 名称 | 模型名单变量 | 接口 |
| --- | --- | --- | --- |
| OpenRouter 免费模型 | `OPENROUTER_API_KEY` | `OPENROUTER_MODELS` | Chat Completions，零价格上限 |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODELS` | Chat Completions |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODELS` | Chat Completions，关闭可选思考 |
| 通义千问 / 百炼 | `QWEN_API_KEY` | `QWEN_MODELS` | OpenAI 兼容接口，关闭可选思考 |
| Claude / Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODELS` | Messages API，不开启扩展思考 |

本次只需开通 OpenRouter，其他密钥留空。每家的模型名单用英文逗号隔开，填写该账号控制台中实际可用的模型 ID。网站会读取这份白名单，让你选择不同供应商及模型；前端不能绕过名单。优先把适合短文本讲评、不强制长推理的模型放在前面。模型权限、价格、地区可用性及 API 额度以各供应商为准，网页订阅不等于 API 额度。

百炼的 `QWEN_REGION` 可选 `beijing`、`singapore`、`virginia`，必须与 API Key 所属地域一致。Claude 多工作区密钥可额外设置 `ANTHROPIC_WORKSPACE_ID`。端点在代码中固定，网页不会接收或转发任意上游地址。

## 首次上线

在本仓库根目录运行。先登录自己的 Cloudflare 账号：

```sh
NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem npx wrangler@4 login --use-keyring --scopes account:read user:read workers:write workers_scripts:write
```

1. 编辑 `writing/teacher-server/wrangler.jsonc` 的模型名单。文件只放模型 ID、允许来源、次数上限等非秘密配置。当前保留已配置的三个免费模型即可。
2. 在终端隐藏输入对应供应商密钥，以及你自己设置的至少 24 字符随机学习室访问口令（它不是供应商 API Key）：

```sh
npx wrangler@4 secret put TEACHER_ACCESS_TOKEN --config writing/teacher-server/wrangler.jsonc
# 只配置免费模型供应商；不要把真实密钥放入命令参数、Git 文件或聊天。
npx wrangler@4 secret put OPENROUTER_API_KEY --config writing/teacher-server/wrangler.jsonc
```

首次添加 Secret 若提示创建 Worker，确认创建即可。也可先部署未配置密钥的 Worker；它会拒绝讲评请求。

3. 部署：

```sh
npx wrangler@4 deploy --config writing/teacher-server/wrangler.jsonc
```

4. 打开写作网站的「AI 老师」，填入返回的 `https://…workers.dev` 地址和学习室访问口令，点击「连接并读取可用模型」。选择供应商、模型和讲评详略，再返回错题点击讲评。地址可填入 `writing/teacher-config.json` 的 `endpoint` 作为网站默认值；该文件绝不能包含口令或 API Key。

页面仅把访问口令保存在标签页 sessionStorage。供应商密钥从不发送到浏览器。当前是个人学习室的一组访问口令，不是多用户账号系统。

## Token 与重复调用控制

- 自动对照无需模型。点击 AI 按钮才调用；不自动重试、不自动降级到其他模型。
- 输入只包括当前答案（最多 2,000 字符）、中文提示（500）、参考（1,200）、有关段落（1,200）和少量搭配结构（600）。后台再次验证长度及模型名单，整体请求体上限 18 KB。不是发送全部词库或错题本。
- 默认精简输出上限 1,200 tokens，详细档 2,000；OpenAI 使用 `max_completion_tokens`（包含推理输出），其他接口用 `max_tokens`。不请求搜索、工具、图片或扩展思考；若选用本身需要推理的 OpenAI 模型，可能在短输出预算下不足以生成完整 JSON，应选择适合短讲评的模型。
- 浏览器最多缓存 40 条，后台最多 80 条，24 小时过期；键包含完整题目、答案、供应商、模型、详略及后台提示版本。后台使用 Durable Object，跨设备复用与并发请求去重。
- 默认每天最多 40 次新调用、每 10 秒一次，UTC 日期重置。失败也计数，因为供应商可能已经生成并计费；缓存命中不计次数。`MAX_DAILY_REQUESTS` 可调整为 1–200。
- 用量来自供应商返回的实际统计；缓存命中显示“原讲评用量”，不是本次新增。未返回的统计显示“未提供”，不冒充 0。不要用 token 数直接推算金额；在供应商控制台设置适合自己的预算与额度。
- 输出不完整、超时、限额或格式异常时只提示，不再次花 token 修复。客户端缓存清理不会清除后台缓存。

后台会缓存讲评结果 24 小时（不保存输入明文，只保存其 SHA-256 键与返回讲评；讲评可能引用你的原表达）。模型供应商的数据处理政策独立适用。代码不记录正文或密钥日志。

## 验证与维护

```sh
npm test
npx wrangler@4 deploy --dry-run --config writing/teacher-server/wrangler.jsonc
```

自动测试覆盖四供应商请求构造、token 上限、模型白名单、来源和口令验证、缓存去重、日限额、截断/异常响应，以及原写作学习流程。浏览器验证使用模拟模型返回，不代表真实密钥、账号额度或模型质量已验证。部署后应手动调用一次并查看实际用量。

供应商原始错误不会直接返回页面，避免泄露密钥或内部请求信息；页面只显示可行动的错误类型。变更模型名单或提示后部署 Worker；改变讲评规则时升级 `teacher-free-v2` 缓存版本，同时更新前端缓存命名。

官方接口说明：[OpenAI](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)、[DeepSeek](https://api-docs.deepseek.com/api/create-chat-completion/)、[百炼](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)、[Claude](https://platform.claude.com/docs/en/api/overview)、[Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)。

免费模式依据：[OpenRouter 免费路由](https://openrouter.ai/docs/guides/routing/routers/free-router)、[价格上限及路由](https://openrouter.ai/docs/guides/routing/provider-selection)、[免费额度及限流](https://openrouter.ai/docs/api_reference/limits)。

## 整句判定

请求只增加当前题的 corePhrases（最多 12 条、总长 1,200 字符），不发送全书。模型返回 grammar / fluency / meaning / corePhrases 四项检查结果；valid 必须四项为 true 且 issues 为空，矛盾或不完整的通过结论会被拒绝。重点短语允许合理词形与句法变体；遗漏学习目标与语法错误分别解释。新提示使用独立缓存版本，输出上限仍为 1,200 / 2,000 tokens。

## 避免讲评截断

默认免费模型顺序以 Gemma 开始，并请求关闭推理；MiniMax 免费模型强制推理，按公开模型目录使用其支持的 low 档；免费路由也请求 low。精简最多 1,200 tokens、2 个问题；详细最多 2,000 tokens、4 个问题。这是上限，实际用量由回复决定，推理也可能计入其中。正确答案使用空 revision，由后台回填原答案，减少重复输出。截断仍拒绝判分与缓存，不自动重试；错误返回安全的模型名、停止原因及用量，不返回原始推理或供应商响应。

依据：[OpenRouter 推理与输出预算](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)。

## 免费额度和短时限流

`/models` 在访问口令验证后读取 OpenRouter `/api/v1/key`，只返回免费日请求的已用、上限、剩余及 UTC 日重置时间；不返回账户名、密钥或付费信息。该查询不生成模型内容。不支持该统计或查询失败时显示未知，绝不显示为零。模型返回 429 时再查询一次：若日额度为零，等待至 UTC 次日；否则按 Retry-After 等待，未提供时建议等待 60 秒。Durable Object 保存等待状态，等待期重复点击不产生新模型请求或增加本地调用计数；已有讲评缓存仍可复用。全局免费日额度耗尽不会通过切换模型自动重试。
