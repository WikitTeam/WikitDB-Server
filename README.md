# WikitDB Server

> Wikidot 社区的数据归档站 — 把散落在各个分站的页面、作者、评分、论坛数据串起来，让创作者与读者各取所需。

WikitDB 是一个面向 Wikidot 社区生态的**非营利性同人项目**。它聚合多个 Wikidot 分站的页面、作者、评分和论坛数据，并提供一套围绕社区互动的工具集（盲盒、悬赏、宾果、虚拟股市等），同时支持基于 [`kakushi-w/wikit`](https://github.com/kakushi-w/wikit) CLI 的站点级备份能力。

## 功能概览

- **页面归档**：实时同步各分站页面元数据，支持按站点、标签、评分区间、发布时间多维筛选
- **作者追踪**：跨站收录作者创作与评分走势，可订阅作者动态
- **虚拟股市**：把创作产出、评分变化、互动数据转化为波动曲线的「作者概念股」
- **论坛同步**：已接入分站的论坛帖子索引与搜索，保留完整回帖树结构
- **实用工具集**：盲盒抽取、删除公告生成、质量评审、悬赏活动、宾果活动、乱斗竞猜、成员自助管理等
- **管理员备份**：基于 wikit CLI 的可视化备份管理工具，支持每日定时任务

## 技术栈

| 维度 | 选型 |
|------|------|
| 前端框架 | Next.js 15 (Pages Router) + React 18 |
| 样式 | Tailwind CSS 3 |
| 图表 | Chart.js / Recharts / lightweight-charts |
| 后端存储 | PostgreSQL via Prisma ORM 6 |
| 抓取与同步 | kakushi-w/wikit CLI、Wikit GraphQL API |
| 论坛渲染 | FTML (Wikidot 文本标记语言) WASM 内核 |
| HTML 消毒 | sanitize-html |
| 鉴权 | JWT (HS256) + bcrypt + httpOnly Cookie |
| 定时任务 | GitHub Actions（`.github/workflows/serverless-jobs.yml`）或 Vercel Cron |
| 邮件 | nodemailer |
| 缓存 | Upstash Redis (可选) |
| 语言 | JavaScript (逐步迁移至 TypeScript) |

## 环境要求

- **Node.js** ≥ 18（生产推荐 20）
- **PostgreSQL** 数据库
- **wikit** CLI（仅在使用备份工具时安装，按其官方说明安装即可）

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/WikitTeam/WikitDB-Server.git
cd WikitDB-Server
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填入所需值：

```bash
cp .env.example .env
```

关键环境变量说明见 `.env.example` 内注释，常见项包括：

- `DATABASE_URL` — PostgreSQL 连接字符串
- `JWT_SECRET` — JWT 签名密钥（≥ 32 字符）
- `SITE_ORIGIN` — 站点公网 HTTPS origin
- `TRUST_PROXY` — 是否信任反代头（仅在反代后开启）
- 短信 / 邮件相关凭据（按需）

### 4. 初始化数据库

```bash
npm run prisma:generate
npm run prisma:push
```

### 5. 配置收录站点

编辑 [`wikitdb.config.js`](wikitdb.config.js) 中的 `SUPPORT_WIKI` 数组，按注释模板添加或删除站点。每个站点对象包含 `NAME` / `URL` / `ImgURL` / `PARAM` / `WIKIT_ID` 等字段。

### 6. 启动开发服务器

```bash
npm run dev
```

默认监听 `http://localhost:3000`。

## 生产部署（无服务器）

站点本身是 Next.js，部署到 Vercel 后每个页面和 API 都是按需启动的函数，**不要再跑 `npm start` + PM2，也不要再跑常驻 worker**。

状态都在 Postgres 里：爬虫游标（`crawler:cursor`）、运行状态（`crawler:status`）、任务日志（`logs:crawler`）、管理后台改过的站点列表（`site:config`）。函数结束不影响进度。

### 1. 部署 Web

把仓库接到 Vercel（或任何支持 Next.js 的无服务器平台），配上：

- `DATABASE_URL` — 用连接池地址（Neon / Supabase pooler），带 `connection_limit=1`
- `JWT_SECRET`、`SITE_ORIGIN`
- `CRON_SECRET` — 至少 16 字符，调度接口靠它鉴权
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — 可选，配了之后限速跨实例共享

`vercel.json` 里有两条每天一次的 Cron（Hobby 计划不允许更密）。真正的推进频率靠下面的 GitHub Actions。

### 2. 调度爬虫和归属同步

`.github/workflows/serverless-jobs.yml` 每 10 分钟跑一片（最长约 8 分钟），游标没跑完下次接着跑。爬虫一轮结束后冷却 3 小时，归属同步冷却 30 分钟。

在仓库 Secrets 里设置 `DATABASE_URL`（以及可选的 `WIKIDOT_BOT_USER` / `WIKIDOT_BOT_PASS`）。没有数据库密钥时，可以改成调用线上接口：仓库 Variables 设 `SITE_ORIGIN`，Secrets 设 `CRON_SECRET`。

本地手动跑一整轮或一片：

```bash
node auto-crawler.js            # 把当前一轮爬完后退出
node auto-crawler.js --for 480  # 最多 480 秒
node auto-attribution.js --slice
```

`npm run worker` 仍指向爬虫脚本，但**跑完就退出**，不要再用 PM2 守护它。

### 3. 全站备份

`wikit` CLI 要二进制和磁盘，不能塞进函数。每天 12:00（北京时间）由同一条 Actions 工作流下载 `wikit`、执行 `node auto-crawler.js --backup`，把 `wikit_data/` 收成 artifact。

### 4. 仍然想自建虚拟机

可以 `npm run build && npm start`，但调度请用系统 cron 调用上面的一次性命令，不要再装 `deploy/wikitdb-attribution.service` 那种常驻进程。

## 项目结构

```
WikitDB-Server/
├── jobs/                   # 无服务器任务切片（爬虫 / 归属 / 备份）
├── pages/                  # Next.js Pages Router
│   ├── api/                # API 路由
│   ├── tools/              # 工具页面
│   └── *.js                # 业务页面
├── components/             # 复用组件
├── lib/                    # 基础设施（Prisma client）
├── utils/                  # 工具函数（auth / security / sanitizer / markdownLite 等）
├── content/                # 静态内容（about.md 等）
├── public/                 # 静态资源
│   └── vendor/ftml/        # FTML WASM 内核
├── prisma/                 # Prisma schema
├── scripts/                # 一次性脚本
├── tests/                  # 单元测试
├── middleware.js           # 全局限速 / Honeypot
├── next.config.js          # Next.js 配置（含安全头）
└── wikitdb.config.js       # 站点列表与全局配置
```

## 可用脚本

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm start` | 启动生产服务器 |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查 (`tsc --noEmit`) |
| `npm test` | 运行单元测试 (`node --test tests/*.test.js`) |
| `npm run test:ftml` | FTML 运行时测试 |
| `npm run worker` / `npm run job:crawl` | 跑一轮爬虫后退出（不再常驻） |
| `npm run job:attribution` | 跑一轮归属同步后退出 |
| `npm run job:backup` | 调用本机 wikit CLI 做备份 |
| `npm run prisma:generate` | 生成 Prisma Client |
| `npm run prisma:push` | 同步 schema 到数据库 |
| `npm run prisma:studio` | 打开 Prisma Studio 可视化管理数据库 |

## TypeScript 渐进式迁移

项目支持渐进式采用 TypeScript，**不改变 Pages Router 结构**，也不影响现有 JavaScript 路由。规则如下：

- 新增或大改的模块优先使用 `.ts` / `.tsx`
- 现有 JavaScript 可按区域逐步迁移
- `others/` 下的参考仓库不参与应用类型检查
- 提交前执行 `npm run typecheck` 确保无类型错误

## 安全说明

- **`SITE_ORIGIN`** 必须设置为公网 HTTPS origin
- **`TRUST_PROXY=true`** 仅在请求总是经过可信反代（反代会覆写转发头）时开启
- **管理员权限**仅由数据库 `User.isAdmin` 字段控制，无基于用户名的管理员兜底
- **运行时数据与凭据**不得提交至 `data/` 或环境文件
- **Wikidot 管理代理工具**仅接受 `wikitdb.config.js` 中声明的 HTTPS origin
- **CSRF 防护**：写操作校验 Origin / Referer
- **限速**：IP + Key 双层（内存 + DB 持久化），middleware 层全局生效
- **Honeypot**：对常见攻击路径返回 800-2000ms 随机延迟并记录行为日志

数据库 schema 包含持久化的注册验证记录和悬赏领取幂等性约束。从旧版本升级时，**必须在提供服务前执行 `npm run prisma:push`**。

## 开发规范

- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/) 风格（如 `feat:`、`fix:`、`security:`、`chore:`）
- 修改后端逻辑前先用 `npm run typecheck` 与 `npm test` 验证
- 新增 API 路由必须用 `withAuth` / `withAdmin` 包装（按需），并通过 CSRF Origin 校验
- 输出 HTML 前必须经过 `sanitizeRichHtml` 消毒
- 静态资源 URL 已带 hash，可放心设置长期缓存

## 贡献

欢迎通过 Issue 或 Pull Request 反馈问题与改进建议。提交 PR 前：

1. 确保本地 `npm run typecheck` 与 `npm test` 通过
2. 遵循现有代码风格与提交信息规范
3. 不要在提交中包含运行时数据、凭据或 `data/` 目录内容

## 致谢

- **Laimu_slime** — 主要贡献者/维护者
- **lestday233** — 初版 WikitDB 创始人
- **白然** — WikitDB LOGO 设计师
- **Kakushi** - Wikit创始人，Wikit API运维
- **UMOU** - 贡献者
- **OxygenNine** - ui-redesign
- 每一位为 Wikidot 社区贡献原创内容的创作者

## 许可证

详见 [LICENSE.md](LICENSE.md)。
