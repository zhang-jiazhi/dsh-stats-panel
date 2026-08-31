# DSH Token 使用统计（dsh-stats-panel）

DeepSeek Harness (DSH) 的 Token 用量统计面板：模型用量、Token 消耗、缓存命中率、按渠道统计、渠道余额/套餐余量、费用估算（人民币）。以会话顶部独立 Tab 页呈现（「Token 统计」，与 对话 / 轨迹 / 上下文 / 记忆 并列），按 NewAPI / Sub2API 统计看板风格设计的全宽仪表盘。

## 功能

- **总览卡片**：总调用次数、总 Token、今日消耗（按 `stats-panel.dayBoundary` 日历分桶，默认主机本地时区）、缓存命中率、估算费用（人民币）
- **渠道统计**：按渠道（provider）聚合调用次数与 Token 消耗 —— 自动识别 DeepSeek 官方、OpenCode Go、MiMo、OpenAI、Anthropic、Kimi、硅基流动、阶跃星辰、OpenRouter、Novita 等
- **渠道余额 / 套餐余量**：
  - 自动查询（余额类）：DeepSeek 官方（`/user/balance`）、Kimi 月之暗面（`/v1/users/me/balance`）、硅基流动（`/v1/user/info`）、阶跃星辰（`/v1/accounts`）、OpenRouter（`/api/v1/credits`）、Novita AI（`/v3/user/balance`）
  - 自动查询（用量类）：OpenCode Go（`/zen/go/v1/usage`，滚动/7天/30天配额）、OpenAI（`/v1/usage`，5小时/7天/30天用量）、Anthropic（`/v1/organizations/usage/costs`，同上）
  - 通用兜底 ①：NewAPI / one-api 系中转（AgentRouter 等），走 `/dashboard/billing/*` 计费模拟端点；key 为无限额度令牌时（`hard_limit_usd`=1e8 哨兵）改查控制台用户余额 `/api/user/self`——会话 Cookie 存 `~/.dsh/stats-panel/<provider>-cookie.txt`（附 `new-api-user=<uid>`），或访问令牌凭据 `<XXX>_ACCESS_TOKEN`
  - 通用兜底 ②：Sub2API 系网关（mdkj.lol 等），走 `/v1/usage` 用 sk key 自查钱包余额、今日用量与累计成本
  - MiMo Token Plan：自动查询平台控制台（`platform.xiaomimimo.com/api/v1/tokenPlan/usage`，需登录 Cookie）；未配置 Cookie 时回退为手动填写（存 localStorage）
- **模型统计**：各模型调用/输入/输出/缓存/总 Token/费用
- **可视化**：每日/每周/每月 Token 堆叠柱状图（输入/输出/缓存）、模型占比环形图、最近调用记录
- **费用估算**：可编辑的模型价格表（人民币，元/1M tokens），内置本机全部模型的官方牌价（DeepSeek V4 / GPT-5.6 / Claude Opus 5 / GLM-5.3 / Kimi K2.7 / MiMo 等），用户修改优先
- **看板式数据流**：切回标签页先用会话内缓存秒开再后台校验；页面可见时每 60 秒静默轮询（无新数据不重渲染、不闪加载态），后台标签页不轮询；余额自动探测客户端限流 2 分钟（服务端缓存 60 秒 + 并发去重 + 渠道并行探测），手动刷新不受限
- **数据留存**：明细累计到 `DSH_STATS_COMPACT_MAX_RECORDS`（默认 10000 条，环境变量可调）即整体折叠为精确聚合并与已有内容合并写入 `~/.dsh/stats-panel/archive.json` 并原子写回 cutoff 之后的 retained 明细——压缩在启动时与 summary 请求路径都会触发，长期不重启的 host 明细也不会无限增长；不保存、不读取已折叠的单条历史明细，统计数字不受影响；「调用记录」分页显示未折叠的 retained 明细及之后新增的调用。`archive.json` 是压缩前历史的唯一载体，请勿删除；`backfill-state.json` 按持久化 session revision 记录已扫描版本，未变化的非 live 会话可跳过，旧 state、revision 不可用或明细日志缩短时会安全全量重扫

## 安装

### 方式一：本地安装（开发）
```bash
cd ~/.dsh/local-plugins
git clone https://github.com/zhang-jiazhi/dsh-stats-panel.git
cd dsh-stats-panel && pnpm install --frozen-lockfile
# 仓库已包含预构建 lib/，无需本地构建
pnpm run typecheck
pnpm test
```

> 从源码重建 client bundle 需要 DSH 源码仓库中的官方 `packages/client/tsdown.client.ts` 工厂；普通安装直接使用仓库内预构建的 `lib/` 产物。

### 方式二：作为 profile 依赖
在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 添加：
```json
"@linxin666/dsh-stats-panel": "<git 或 npm 地址>"
```
并加入 `dsh.profile.bundles` 列表，重启 `dsh web` 即可。

## 使用

1. 打开 DSH Web UI，进入任意会话
2. 点击会话顶部的 **Token 统计** Tab（与 对话 / 轨迹 / 上下文 / 记忆 并列）
3. 查看总览 KPI、消耗趋势、模型占比、渠道余量，以及「模型统计 / 渠道统计 / 模型价格 / 调用记录」分页明细

渠道余额/余量自动从各平台官方 API 查询（需要你在 DSH 中配置对应渠道的 API Key，读取自 `~/.dsh/.credentials.yaml` 或环境变量）；查询失败或无公开 API 的渠道会显示错误/待配置，可手动填写。

MiMo Token Plan 自动查询需要平台登录 Cookie（`platform.xiaomimimo.com`）。配置方式二选一：
- 把登录后的 Cookie 请求头内容保存到 `~/.dsh/stats-panel/mimo-cookie.txt`（权限建议 600）
- 或设置环境变量 `MIMO_PLATFORM_COOKIE`

Cookie 过期后重新登录平台并更新该文件即可。

## 支持渠道与查询方式

| 渠道 | 类型 | 查询 API | 币种 |
|---|---|---|---|
| DeepSeek 官方 | 余额 | `api.deepseek.com/user/balance` | CNY |
| Kimi 月之暗面 | 余额 | `api.moonshot.cn/v1/users/me/balance` | CNY |
| 硅基流动 | 余额 | `api.siliconflow.cn/v1/user/info` | CNY |
| 阶跃星辰 StepFun | 余额 | `api.stepfun.com/v1/accounts` | CNY |
| OpenRouter | 余额 | `openrouter.ai/api/v1/credits` | USD |
| Novita AI | 余额 | `api.novita.ai/v3/user/balance` | USD |
| OpenCode Go | 套餐配额 | `opencode.ai/zen/go/v1/usage` | 滚动/7天/30天 |
| OpenAI | 用量（5h/7d/30d） | `api.openai.com/v1/usage` | — |
| Anthropic | 用量（5h/7d/30d） | `api.anthropic.com/v1/organizations/usage/costs` | — |
| MiMo Token Plan | 套餐用量 | `platform.xiaomimimo.com/api/v1/tokenPlan/usage`（需登录 Cookie） | — |

> OpenAI / Anthropic 用量接口需要组织级（admin）API Key，普通项目 Key 可能返回 403。
> 渠道自动发现：读取 `~/.dsh/settings.yaml` 中 `llm-pi-ai.providers` 与 `llm-deepseek` 配置，按 baseURL 匹配查询方式；凭据通过 DSH credentials 服务按 `apiKeyEnv` 解析。

## 计价

- 内置默认价格表覆盖本机实际用到的全部模型（人民币 元/1M tokens，美元模型按 ≈7.1 汇率折算），2026-08-29 查询：
  - DeepSeek V4 Flash/Pro 及变体：官方峰谷价，内置取高峰口径（[api-docs.deepseek.com](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)；高峰 = 周一至五 9-12/14-18 时，空闲减半；缓存写免费）
  - GPT-5.6 Sol / Luna：OpenAI Standard 短上下文价（[developers.openai.com](https://developers.openai.com/api/docs/pricing)，Sol 为 2026-11-21 前促销价；含官方缓存读/缓存写价）
  - Claude Opus 5：$5/$25（[anthropic.com](https://www.anthropic.com/claude/opus/5)；缓存读 0.1×、缓存写 1.25× 输入价）
  - GLM-5.3-Flash：智谱定价页 0.002 元/千 tokens（[bigmodel.cn](https://bigmodel.cn/pricing)；缓存读按输入价 10% 估算）
  - Kimi K2.7 Code：输入 6.5 / 输出 27 / 缓存命中 1.3（[platform.kimi.com](https://platform.kimi.com/docs/pricing/chat-k27-code)）
  - 套餐内模型（MiMo Token Plan）与免费模型（ox-alpha-free 等）计 0
- 价格表存 localStorage；用户编辑过的模型以用户为准，缺失模型自动用内置默认价补齐
- 中转站实际扣费可能低于牌价（如 Sub2API 折扣），估算值会偏高；按需修改「模型价格」

## 开发

仓库已包含预构建产物（`lib/`），安装后开箱即用，无需构建。

如需从源码重建：

```bash
pnpm run typecheck
pnpm test
DSH_CLIENT_BUNDLE_FACTORY=/absolute/path/to/packages/client/tsdown.client.ts pnpm run build
```

`build` 先生成类型中间产物，再用 DSH 官方 `clientBundle` 工厂生成 node half 和 `__ModuleLoader__` client bundle。`DSH_CLIENT_BUNDLE_FACTORY` 可传绝对路径，或传相对插件目录的路径。没有 DSH 源码环境时：`pnpm run build:host` 可从源码重建 host 半区（`lib/index.js`），client 半区仍使用仓库预构建产物。

数据持久化于 `~/.dsh/stats-panel/records.jsonl`（按 `sessionId+seq` 去重，跨重启安全）；`archive.json` 保存已压缩历史，`backfill-state.json` 保存已扫描的持久化 revision。

## 常见问题

- **OpenAI / Anthropic 的用量查不到？** 这两个平台的用量接口需要组织级（管理员）API Key，普通项目 Key 会返回 403（页面显示查询失败）。
- **MiMo Token Plan 没有自动余量？** 请确认已配置平台 Cookie（`~/.dsh/stats-panel/mimo-cookie.txt` 或环境变量 `MIMO_PLATFORM_COOKIE`），且 Cookie 未过期；未配置或失效时会回退为手动填写。
- **费用为什么和实际账单不一致？** 费用按你配置的价格表估算；套餐渠道（OpenCode Go / MiMo / OpenAI / Anthropic）建议将模型价格设为 0，避免与套餐额度重复计费。
- **换机器后价格配置丢失？** 价格表存于浏览器 localStorage；如需迁移可在「模型价格」编辑后导出。
- **数据存在哪里？** 用量数据存 `~/.dsh/stats-panel/records.jsonl`（按 sessionId+seq 去重）。
- **「今日消耗」按哪个时区？** 默认主机本地时区，跨零点即归零；如需 UTC 口径，在 `~/.dsh/settings.yaml` 配置 `stats-panel.dayBoundary: utc`（也可写 `+08:00` 或分钟数，如 `480`）。切换日历只影响分桶展示，明细与总量不变；已折叠到 `archive.json` 的历史段无法回溯重切，趋势卡下方会显示相应说明。

## 贡献

欢迎提交 PR：
- 新增渠道适配器：见 [docs/CHANNELS.md](docs/CHANNELS.md)
- 余额连通性验证：`node scripts/verify-balances.mjs`

## License

Apache-2.0
