# 关于 WikitDB

**WikitDB** 是面向 Wikidot 社区生态的开源项目，基于 **Wikit API** 的数据接口，致力于把散落在各个 Wikidot 站点的页面、作者、评分、论坛数据串联起来，为读者和作者提供统一的检索、追踪与分析体验。

**WikitDB** 企划最初由 lestday233 提出，由 Laimu_slime 主持开发和架构，由 OxygenNine 进行全面的视觉升级；数据接口由 **Wikit API** 提供强力支持。

---

## 核心能力

### 页面归档
- 自动同步来自 Wikit API 的各分站页面元数据
- 支持按站点、标签、评分区间、发布时间等多要素筛选数据
- 通过增量更新，保留已从原站点移除的页面（`--keep-removed`）

### 作者追踪
- 收录作者在不同分站的创作与评分走势
- 可按标签、站点、时间范围细化分析
- 绑定账号后可订阅作者动态

### 虚拟股市（作者概念股）
- 把创作产出、评分变化、互动数据转化为波动曲线
- 在充满博弈的虚拟市场中挖掘被低估的潜力新星

### 论坛同步
- 支持已接入分站的论坛帖子索引与搜索
- 保留并还原完整的帖楼数据

### 多样工具
- 盲盒抽取、交易市场、战力雷达等娱乐玩法
- FTML编辑器、代发页面、删帖公示等实用工具集

---

## 收录站点（当前 {WIKIS_COUNT} 个）

| 站点 | 简写 | 说明 |
|------|------|------|
| 深林文学部 | dfc | 文学创作导向 |
| 后室 IF 分站 | if | Backrooms 衍生 |
| 地下黑市 | ubmh | 原创创作社区 |
| SCP 基金会云国分部 | scp-wiki-cloud | SCP 同人 |
| 规则怪谈档案馆 | rule | 规则怪谈专题 |
| 纸上书 | wop | 纸笔主题创作 |
| The Backrooms X 层群 | x | Backrooms 衍生 |
| 世界机构联合体 | pin | 世界观共创 |
| SCP 基金会 Minecraft 分部 | scp-wiki-mc | SCP + MC 融合 |
| The Backrooms 中文维基 | brcn | Backrooms 主分社区 |

> 如需申请收录更多站点，请联系 WikitDB 团队职员。

---

## 技术栈一览

- **前端框架**：Next.js Pages Router + React 18 + Tailwind CSS
- **后端存储**：PostgreSQL via Prisma ORM
- **抓取与同步**：kakushi-w/wikit CLI，Wikit GraphQL API
- **论坛渲染**：FTML (Wikidot 文本标记语言) WASM 内核
- **安全与基础设施**：JWT (HS256)、bcrypt、CSRF Origin 校验、IP 双层限速

---

## 开发团队

- **Kakushi** - Wikit创始人，Wikit API运维
- **Laimu_slime** — 主要开发者/维护者
- **lestday233** — 概念提出者/初步构建者
- **umou** — 项目贡献者/测试站运维
- **OxygenNine** - UI-redesign
