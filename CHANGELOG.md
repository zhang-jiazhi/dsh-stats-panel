# Changelog

本插件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

## [0.4.0] - 2026-08-31

### 修复

- 缓存命中率口径对齐 DSH 自带定义：改为 `缓存读 ÷ (未命中输入 + 缓存读 + 缓存写)`。原式把输出 token 计入分母、把「缓存写」当作命中——缓存写本质是未命中并写入缓存。仅展示层计算，存量数据零迁移
- 「最近调用」改为按时间倒序取前 100。原实现取的是**收集顺序**尾部，启动回填按会话逐个追加，重启后该列表可能整段来自某个旧会话
- 趋势卡切到「按周 / 按月」后页脚仍写死「日均」（实际是每桶均值，按月时相差约 30 倍），改为跟随周期显示 日均 / 周均 / 月均
- 调用明细表 key 由数组索引改为 `sessionId + seq`，刷新后不再漂移

### 新增

- 日 / 周 / 月分桶日历可配置，默认跟随主机时区——UTC+8 下「今日消耗」不再到早上 8 点才归零：

  ```yaml
  stats-panel:
    dayBoundary: local   # local(默认) | utc | +08:00 | 480
  ```

  明细行仍只存原始时间戳，日历是纯展示层参数，改回 `utc` 可完整还原
- `summary` 新增 `dayKeyNow`（服务端下发的当日桶键，前端「今日」以此为准，跨零点自动重算）、`bucketOffsetMinutes`、`bucketNotice`
- `archive.json` 记录 `bucketOffsetMinutes`；缺失该字段的旧归档按 UTC 读入。归档段的明细已折叠、无法回溯重切，因此合并时继承更旧的日历，并由 `bucketNotice` 在趋势卡下方如实说明（总量不受影响，仅归档段的日期边界为近似值）
- 渠道余量每个探针增加截止时间，默认 12 秒，`DSH_STATS_BALANCE_DEADLINE_MS` 可调。此前单渠道最坏 20s×2+0.5s ≈ 40.5s 会拖住整轮；超时渠道返回明确的「查询超时」而不是被当作 0 用量
- `npm run build:host` + `tsdown.host.config.ts`：没有 DSH 源码检出时也能从源码重建 host 半区（client 半区仍需官方 `__ModuleLoader__` 工厂）

### 变更

- 保留压缩抽为 `maybeCompact()`，启动路径与 `summary` 路由共用：长期不重启的 host 明细日志不再无限增长。运行期压缩后只改写 `recordsAtWrite` 并保留 revisions，下次启动无需全量重扫
- 回归测试 21 → 28：命中率口径、prompt 为 0 不产生 NaN、乱序输入下最近调用仍时间倒序、分桶日历与默认 UTC 兼容、归档口径提示、路由触发压缩后总量不变、余量整轮截止

## [0.3.0] - 2026-08-29

### 新增

- 通用中转站余额兜底（无需按站点逐个适配）：
  - NewAPI / one-api 系（AgentRouter 等）：`/dashboard/billing/subscription` + `/usage` 计费模拟端点，余额 = hard_limit − total_usage/100
  - 无限额度令牌识别（`hard_limit_usd` = 1e8 哨兵值）：余额在用户配额上，改查控制台 `/api/user/self`——认证链：① 会话 Cookie 文件 `~/.dsh/stats-panel/<provider>-cookie.txt`（从已登录浏览器导出，附 `new-api-user=<uid>`；经浏览器桥时由桥注入 Cookie）→ ② 访问令牌凭据 `<XXX>_ACCESS_TOKEN` → ③ 手动填写并给引导提示
  - Sub2API 系网关（mdkj.lol 等）：`/v1/usage` 用 sk key 自查钱包余额、今日用量与累计成本

### 变更

- 内置默认价格表补齐全部常用模型官方牌价（2026-08-29 官方页原文核对）：DeepSeek V4 Flash/Pro 官方峰谷价取高峰口径（flash 3/9、pro 9/27，缓存命中 0.1/0.3，空闲减半）、GPT-5.6 Sol/Luna（Standard 短上下文价含官方缓存写价，≈7.1 汇率折算）、Claude Opus 5（$5/$25，缓存读 0.1×/写 1.25×）、GLM-5.3-Flash、Kimi K2.7 Code；套餐内（MiMo）与免费模型计 0
- 修正：此前误将第三方媒体「V4 Pro 降价 75%」报道当作官方现价（flash 1/2、pro 3/6），经官方定价页原文核对无此调价，恢复峰谷价高峰口径；价格分页提示注明峰谷说明
- 价格表加载改为「内置默认 + localStorage 用户配置」按模型合并：升级内置价格表不影响已有用户修改，缺失模型自动补默认价
- 入口从「设置侧边栏 section（`settings.section`）」迁移为「会话顶部 Tab（`conversation.view`，id `stats`，order 40）」，与 对话 / 轨迹 / 上下文 / 记忆 并列，不再占用设置页空间
- 页面按 NewAPI / Sub2API 看板风格全宽重排：KPI 卡片行 → 消耗趋势（输入/输出/缓存堆叠柱状图，按天/周/月）+ 模型占比环形图 → 渠道余量卡片 → 明细分页卡（模型统计 / 渠道统计 / 模型价格 / 调用记录）
- 计量单位：Token 数值新增 B 档（1B = 1000M，对齐账单口径），并采用紧凑位数（<10 两位小数、<100 一位、≥100 取整）；KPI、图表坐标轴、表格、配额文案统一生效
- KPI 卡片升级为彩色图标芯片（newapi 风格），「今日消耗」附环比昨日涨跌指示；模型/渠道统计表新增占比迷你条（与环形图同色系，sub2api 风格），费用列琥珀色高亮；趋势卡新增范围合计 / 调用数 / 日均汇总行
- 配色改用 DSH `--dsw-alias-*` 设计令牌，跟随亮暗主题与皮肤；新增渲染错误边界（ErrorBoundary），单卡渲染异常不再影响 GUI
- 页面挂载期间每 60 秒自动刷新；新增「今日消耗」KPI（按服务端 UTC 日口径）
- 价格表状态提升至页面顶层，估算费用 KPI 与费用列实时联动

### 修复

- host：live event 的 model/provider 归属改为按 session 隔离，交错会话不会互相污染
- host：连续 compaction 改为合并已有 archive；严格 cutoff 和坏文件校验避免历史覆盖、重复计数或 summary 崩溃
- host：backfill state 升级为持久化 revision；旧 state、revision 不可用、日志缩短时安全全量重扫，revision 变化的既有会话会补收新增事件
- host：JSONL 和 live usage 计数统一做非负安全整数校验，非法行被忽略，可选旧字段兼容为零
- client：summary/balances 请求加入 generation fencing；即使 fetch 忽略 AbortController，旧响应也不能覆盖新状态
- build：补齐可复现的 `pnpm install --frozen-lockfile`、类型检查、Vitest 和 bundle 构建脚本
- host：加载 JSONL 时先应用 archive cutoff 并按 `sessionId+seq` 去重；拒绝超出 JS Date 范围的时间戳和 totals/各维度不一致的 archive，避免坏数据遮蔽、溢出或假统计
- build：`tsdown.config.ts` 通过 `DSH_CLIENT_BUNDLE_FACTORY` 显式接收 DSH workspace preset 路径，跨 checkout 构建无需改配置文件或依赖开发者本机目录
- host：atomic 写入临时文件按进程/序号隔离，降低并发 remount 互相覆盖风险；LAN trust 支持大小写归一化和 IPv6 ULA authority
- package：补充根包与 `./client` 的 TypeScript `types` exports，外部 consumer 不再解析不到 `lib/types` 声明

### 性能（信息看板式数据流）

- host：聚合摘要加脏标记缓存——`computeSummary` 只在新记录写入后重算，无新用量的轮询请求零折叠开销（记录日志只增不减，此前每次请求都全量重算）
- host：余额探测并行化 + 并发去重——各渠道探测从串行 await 改为 `Promise.all`（单渠道 WAF 慢不再拖累其余），同一窗口内的并发请求共享同一次探测轮次，不重复打平台 API
- client：会话级 stale-while-revalidate——切回标签页先用缓存秒开（实测 121ms 完整渲染），后台静默校验；页面级缓存，重载即重新拉取
- client：静默轮询——自动刷新不再触发加载态（按钮/「刷新中…」不闪烁）；载荷未变化时保留旧对象引用，配合 React.memo 只重渲染头部时钟，图表与 100 行表格不动
- client：visibility 门控——浏览器标签页隐藏时不轮询，切回时若缓存过期立即补一次
- client：余额自动探测客户端限流 2 分钟（手动刷新不受限），与 host 60 秒缓存对齐后实际探测频率减半
- UI：首屏骨架屏（shimmer 占位）、内容淡入、刷新按钮内联旋转图标（`prefers-reduced-motion` 时全部降级为静态）；调用次数列千分位格式化；「今日」卡片在页面跨零点时自动重算桶（dayKey 驱动）

### 性能（全量体检后的深优化）

- host：回填状态缓存（`backfill-state.json`）——持久化 revision 未变化的非 live 会话跨重启可跳过，revision 变化或服务不可用时自动重扫，实测重启后 sweep 秒级完成且状态文件无需重写；顺带修复 boot 时处于 live 的会话历史事件漏收（live 会话现在也回填，监听器先注册 + seq 去重保证不重复）
- host：数据留存压缩——明细累计到阈值（`DSH_STATS_COMPACT_MAX_RECORDS`，默认 10000 条）即将 eligible 明细前缀**整体折叠**为精确聚合并写入 `archive.json`，未来/边界明细原样保留，已折叠历史不保存、不读取单条明细（应用户要求由「45 天保留窗」改为全量折叠；未来/边界 rows retained）；`computeSummary` 合并档案与新增明细，总账/模型/渠道/日周月桶分毫不差；`cutoffTs` 在加载与收集两端过滤——崩溃窗口、回填状态丢失后的重扫都不会双算；「调用记录」分页在每次压缩后从新调用重新累积。实测：3.6MB 明细 → 9.7KB 档案，压缩前后总账逐项一致
- client：价格编辑器改字符串草稿——修复受控 number 输入吞小数点（输入 "0.5" 此前会变成 "05"），保存时才解析
- client：趋势图自定义悬停 tooltip（即时浮动卡，含日期/调用数/输入/输出/缓存/合计；边缘防裁切），柱子附 aria-label（无障碍）
- client：fetch 加 AbortController——切走标签页/新请求取代旧请求时中止在途请求
- client：余额卡挂载时缓存已过期（>2 分钟）立即静默补刷，不再等下一个轮询 tick

### 移除

- 设置页侧边栏入口（被顶部 Tab 取代）

## [0.2.0] - 2026-08-16

### 新增

- 渠道统计：按 provider 聚合调用次数与 Token 消耗，自动识别主流渠道
- 渠道余额 / 套餐余量（自动查询）：
  - 余额类：DeepSeek 官方、Kimi 月之暗面、硅基流动、阶跃星辰 StepFun、OpenRouter、Novita AI
  - 用量类（5小时/7天/30天）：OpenCode Go（配额百分比）、OpenAI、Anthropic
  - MiMo Token Plan 自动查询平台控制台套餐用量（需登录 Cookie）；未配置 Cookie 时回退手动填写
- 费用估算改为人民币（元 / 1M tokens），内置 DeepSeek 官方峰谷定价（2026-08-16 生效）
- 每日 Token 柱状图、模型占比饼图、最近调用记录

### 修复

- 历史补扫重复累加导致总 Token 虚高（改为 `(sessionId, seq)` 跨重启去重）
- 渠道余量查询增加 60 秒内存缓存，避免频繁刷新打爆渠道账户 API
- OpenAI/Anthropic 用量桶改为并发查询，缩短刷新耗时
- 渠道统计表格窄屏溢出（精简列 + 横向滚动兜底）

## [0.1.0] - 2026-08-16

### 新增

- 设置侧菜单「Token 使用统计」入口（`settings.section`）
- 总览卡片：调用次数、总 Token、输入/输出、缓存命中率、费用
- Token 使用数据持久化（`~/.dsh/stats-panel/records.jsonl`）
