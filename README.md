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
| 定时任务 | node-cron |
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

## 生产部署

### 构建

```bash
npm run build
npm start
```

### 备份 Worker（可选）

如需启用 Wikidot 站点定时备份，需将 wikit CLI 安装到服务器 PATH 中，并以常驻进程方式运行 worker：

```bash
npm run worker
```

Worker 会在每天 12:00（Asia/Shanghai 时区）对所有 `wikitdb.config.js` 中声明的站点执行备份，归档写入工作目录下的 `wikit_data/`。任务限定为单进程串行执行，且服务端始终传递 `--keep-removed`，确保从 sitemap 消失的页面仍保留在归档中。

### 进程管理

推荐使用 PM2 守护 `npm start` 与 `npm run worker` 两个进程：

```bash
pm2 start "npm start" --name wikitdb
pm2 start "npm run worker" --name wikitdb-worker
pm2 save
```

## 项目结构

```
WikitDB-Server/
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
| `npm run worker` | 启动备份定时任务 worker |
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
