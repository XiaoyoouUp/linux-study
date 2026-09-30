# Linux 学练营

系统化 Linux 学习网站：图文课程 + 随堂测验/阶段考试 + 在线命令练习场，对标 **RHCSA（EX200）** 认证。

纯静态站点：原生 ES 模块、无构建步骤、无运行时依赖、无框架。任意静态文件服务器指向仓库根目录即可直接部署。

## 功能

- **图文课程**：参照《鸟哥的Linux私房菜》知识体系组织 6 个阶段、28 节课，每课配原创 SVG 图解、可复现命令示例与随堂测验
- **命令练习场**：在线 Linux 终端——先做语法与用法校验（错误给修正建议），再在模拟文件系统上返回输出；46 个内置任务逐关判定命令正确性
- **随堂测验 + 阶段考试**：限时、逐题解析、成绩本地存档；每阶段一场结业考试（12~15 选择题 + 3~4 道命令实操题，与练习场同一判定引擎）
- **RHCSA 全真模拟**：120 分钟模拟考（20 选择 + 5 实操），及格线 70 对齐官方 210/300；冲刺课程含 EX200（RHEL 10）考纲映射与备考路径
- **进度追踪**：localStorage 保存课程完成度、测验/考试成绩与任务进度

## 本地运行

ESM 必须走 HTTP（双击 index.html 打不开），在仓库根目录起一个静态服务即可：

```bash
./serve.sh              # macOS/Linux；Windows 用 start.bat 或 npx serve -l 8080 .
```

浏览器打开 `http://localhost:8080`。

## 测试（三层）

| 层 | 命令 | 覆盖 |
|---|---|---|
| 单元测试 | `npm test` | 命令解析器 / 任务判定 / 模拟文件系统（191 用例，TDD 开发） |
| 内容校验 | `node scripts/validate_content.mjs` | 全站课程/考试/任务数据合法性与自洽性（id 唯一、答案下标、图引用存在、实操题参考答案必须通过自己的 check） |
| 浏览器回归 | 起服务后 `python scripts/full_regression.py` | 爬全部 28 课/6 考试页面：渲染、图加载、考试可开考、零 JS 错误 |

浏览器回归依赖 Playwright：`pip install playwright && playwright install chromium`。

## 目录结构

```
index.html                 壳（侧栏/顶栏/内容区）
js/app.js                  hash 路由 + 页面渲染
js/lib/parser.js           Linux 命令解析器（纯函数，浏览器/Node 通用）★核心
js/lib/mockfs.js           模拟文件系统与命令输出
js/lib/tasks.js            任务判定 checkCommand() + 46 个内置任务
data/stages/s1..s6.js      课程数据（结构见 docs/content-contract.md）
data/exams/exam1..5,final  考试数据
data/reference.js          速查表数据
diagrams/*.svg             25 张原创图解
docs/                      内容契约与开发指南
scripts/                   三层测试脚本
```

## 内容契约

课程/考试数据改动必须遵守 [docs/content-contract.md](docs/content-contract.md)，提交前跑 `node scripts/validate_content.mjs`。日常修改指南见 [docs/development.md](docs/development.md)。

## 部署

仓库本身无构建产物，任意静态文件托管指向根目录即可；托管方式由使用者自行配置。课程内容基于《鸟哥的Linux私房菜》知识体系与 Red Hat 公开考纲整理，仅供学习参考；Red Hat、RHCSA 为 Red Hat, Inc. 商标。
