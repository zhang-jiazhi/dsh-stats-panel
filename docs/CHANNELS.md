# 渠道适配器说明

插件按渠道（provider）聚合用量，并自动查询各渠道的余额或套餐余量。
渠道由 `~/.dsh/settings.yaml` 中的模型配置自动发现（`llm-pi-ai.providers` 与 `llm-deepseek`），
凭据按 `apiKeyEnv` 通过 DSH 的 credentials 服务解析（`~/.dsh/.credentials.yaml` 或环境变量）。

## 查询方式

| 渠道（baseURL 匹配） | 类型 | 端点 | 说明 |
|---|---|---|---|
| `api.deepseek.com` | 余额 | `GET /user/balance` | 官方余额（CNY） |
| `api.moonshot.cn` / `api.kimi.ai` | 余额 | `GET /v1/users/me/balance` | Kimi 官方余额（CNY） |
| `api.siliconflow.cn` / `.com` | 余额 | `GET /v1/user/info` | 硅基流动余额（CNY/USD） |
| `api.stepfun.com` / `.ai` | 余额 | `GET /v1/accounts` | 阶跃星辰余额（CNY） |
| `openrouter.ai` | 余额 | `GET /api/v1/credits` | OpenRouter 额度（USD） |
| `api.novita.ai` | 余额 | `GET /v3/user/balance` | Novita 余额（USD，0.0001 精度） |
| `opencode.ai/zen/go` | 套餐配额 | `GET /zen/go/v1/usage` | 滚动 / 7天 / 30天 配额百分比与重置时间 |
| `api.openai.com` | 用量 | `GET /v1/usage` | 5小时 / 7天 / 30天 Token 用量（需组织级 Key） |
| `api.anthropic.com` | 用量 | `GET /v1/organizations/usage/costs` | 同上（需管理员 Key） |
| `token-plan-cn.xiaomimimo.com`（provider `mimo`） | 套餐用量 | `GET platform.xiaomimimo.com/api/v1/tokenPlan/usage` | 需平台登录 Cookie（`~/.dsh/stats-panel/mimo-cookie.txt` 或 `MIMO_PLATFORM_COOKIE`） |
| **通用兜底 ①**：任意 baseURL | 余额 | `GET <base>/dashboard/billing/subscription` + `/usage` | NewAPI / one-api 系中转（AgentRouter 等）。`hard_limit_usd` = 剩余+已用，余额 = hard_limit − `total_usage`/100；直连被 Cloudflare 拦时可走本地浏览器桥 |
| **通用兜底 ①（无限额度令牌）** | 余额 | `GET <站点 origin>/api/user/self` | `hard_limit_usd` = 1e8 哨兵值（key 为无限额度令牌）时余额在**用户配额**上。认证链：① 控制台会话 Cookie 存 `~/.dsh/stats-panel/<provider>-cookie.txt`（内容如 `session=...; new-api-user=<uid>`，从已登录浏览器导出；经本地浏览器桥时由桥注入 Cookie，插件另发 `New-Api-User` 头）→ ② 访问令牌凭据 `<XXX>_ACCESS_TOKEN`。余额按 new-api `QuotaPerUnit`（500000）换算 |
| **通用兜底 ②**：任意 baseURL（通常以 `/v1` 结尾） | 余额 | `GET <base>/usage` | Sub2API 系网关（mdkj.lol 等）。用 sk key 自查：`remaining`/`balance` + `unit`，附今日用量与累计成本摘要 |
| 其余渠道 | 手动 | — | 两个通用兜底都不命中时，在页面手动填写（存 localStorage） |

## 新增渠道适配器

在 `src/index.ts` 的 `probeChannel()` 中按 baseURL 前缀添加分支即可：

1. 按渠道实际返回结构构造 `ChannelBalance`（`balance` / `quota` / `usage` 三选一）
2. 凭据一律通过 `resolveKey(apiKeyEnv)` 获取，禁止硬编码

> OpenAI / Anthropic 用量接口需要组织级权限，普通项目 Key 可能返回 403（页面会显示查询失败）。
