# 开发指南（面向后续调整）

本站是**纯静态站点**：原生 ES 模块，无构建步骤、无运行时依赖、无框架。改完文件本地刷新即生效；在线托管方式由使用者自行配置（任意静态文件服务器都可以直接部署仓库根目录）。

## 架构总览

```
浏览器
 index.html                壳（侧栏/顶栏/内容区）
 └─ js/app.js              路由 + 全部页面渲染（hash 路由 #/lesson/s2l3 …）
     ├─ js/data.js         数据注册表：动态 import 全部 stage/exam，单个文件缺失不致崩溃
     ├─ js/components.js   内容块 → HTML（代码高亮、图、表格、提示框）
     ├─ js/quiz.js         测验引擎（随堂即时判分 / 考试统一判分共用题目渲染）
     ├─ js/playground.js   命令练习场 UI
     ├─ js/store.js        进度持久化（localStorage key: linux-study-v1）
     └─ js/lib/
         parser.js         Linux 命令解析器（纯函数，浏览器/Node 通用）★核心
         tasks.js          任务判定 checkCommand() + 46 个内置练习任务 TASKS
         mockfs.js         模拟文件系统（目录树/文件内容）+ 读取类命令真实过滤 + 变更命令 canned 输出
data/
 stages/s1..s6.js          课程数据（结构见 docs/content-contract.md）
 exams/exam1..5,final.js   考试数据
 reference.js              速查表数据
diagrams/*.svg             25 张原创图解
```

**关键设计决策**（改动前先读）：
- 无构建：所有 JS 是浏览器原生 ESM；Node 侧测试直接 import 同一份源码
- 相对路径：任何资源引用必须 `./` 相对路径，禁止 `/` 开头——保证站点可部署在任意子路径或本地直接起服务
- hash 路由：无需服务端配置，刷新/分享链接都基于 `#/...`
- 数据即内容：课程/考试/任务都是 JS 数据文件，页面是通用渲染器
- 模拟无状态：练习场读取类命令基于 mockfs 内容实时过滤，变更类命令返回 canned 确认但不保留状态（与 k8s-study 同边界）

## 常见改动怎么做

### 1. 改课程 / 加一课 / 加阶段
课程数据结构（block 类型、题目结构）**严格遵循 [content-contract.md](content-contract.md)**。

1. 编辑 `data/stages/sN.js`（新阶段：复制现有文件改 `id/num/lessons`，并在 `js/data.js` 与 `scripts/validate_content.mjs` 的 id 数组加入）
2. 自检：`node -e "import('./data/stages/s2.js').then(()=>console.log('OK'))"`
3. 全量校验：`node scripts/validate_content.mjs`
4. 浏览器看效果

### 2. 改考试 / 加实操题
结构同契约。实操题三条硬约束：
- **单条命令可判定**（考试输入框逐条判分，solution 禁止写多条；不能含管道/重定向）
- `check` 只允许字段：`program, sub, sudo, flagsMust[{name, equals?, oneOf?}], flagsMustNot, minNames, firstArgPattern, namePattern`
- 命令与路径必须与解析器支持清单、模拟文件系统一致，否则用户做对了也判不过

### 3. 加练习任务
编辑 `js/lib/tasks.js` 的 `TASKS` 数组（字段：`id/level/title/desc/hint/solution/check`）。提交前 `node scripts/validate_content.mjs` 会用解析器实际执行 solution 并比对 check，不过即报错。

### 4. 扩展命令解析器（js/lib/parser.js）
- 程序注册：`PROGRAMS` 表（旗标 `[简写, 长名, 类型]`，类型 `bool/str/uint/value-opt`；子命令 `subs`；特殊风格 `noDash`（ps/tar）、`dashLong`（find 的 -name））
- 位置参数规则：`validate()` 按程序分支
- **改解析器必须先补测试**：`js/lib/parser.test.js`（`npm test`），先加用例看它失败再实现
- 已知边界：练习场只覆盖常用命令；交互式程序（vim/top）直接给出解释性报错；未覆盖命令在课程中标注"练习场不支持"

### 5. 扩展模拟文件系统（js/lib/mockfs.js）
- 加文件：`FILES`（content/owner/group/mode/mtime）；加目录：`DIRS`
- 加 canned 输出：单元 `UNITS`、软件包 `PKGS`、手册 `MAN_PAGES`、tar 成员 `TAR_MEMBERS`
- 新命令模拟：`simulate()` 的 switch 加分支
- 测试：`js/lib/mockfs.test.js`

### 6. 改样式 / 布局
全部在 `css/style.css`，按注释分区（设计系统变量在顶部 `:root`）。主题色：终端绿 `--k8s-blue`（变量名沿用 k8s-study 工程未改）、Tux 黄用于强调。内容区宽度三档由 `#main-wrap.w-wide/.w-full` 控制（app.js 持久化到 `localStorage['linux-study-width']`）。改配色只动 `:root` 变量。

## 测试与验证（三层）

| 层 | 命令 | 用途 |
|---|---|---|
| 单元测试 | `npm test` | 解析器/任务判定/模拟文件系统（191 用例，TDD 开发） |
| 内容校验 | `node scripts/validate_content.mjs` | 全站课程/考试/任务数据合法性与自洽性 |
| 浏览器回归 | 起服务后 `node scripts/dump_manifest.mjs && python scripts/full_regression.py` | 爬全部 28 课/6 考试页面：渲染、图加载、考试可开考交卷、零 JS 错误 |

浏览器回归需要先起静态服务（另开终端，跑完可 Ctrl+C）：
```bash
npx serve -l 8123 .        # 或 python -m http.server 8123
node scripts/dump_manifest.mjs
python scripts/full_regression.py   # 依赖 playwright: pip install playwright && playwright install chromium
```

**注意**：`serve` 对并发改写过的文件可能返回旧缓存，改完数据文件后重启服务再回归。

改动了页面交互后建议再手动过一遍练习场与一场考试。

## 发布流程

```bash
git add -A && git commit -m "..." && git push
```

仓库本身无自动部署；如需在线访问，自行配置任意静态托管（指向仓库根目录即可，无构建产物）。发布前建议本地跑一遍三层测试。本地预览：`npx serve -l 8080 .`（ESM 必须走 HTTP，双击 index.html 打不开）。

## 排障速查

| 现象 | 原因与处理 |
|---|---|
| 页面空白，控制台 `Failed to load module` | data.js 引用了不存在的 stage/exam 文件，或相对路径写成了 `/` 开头 |
| 某课 404 但文件里明明有 | 动态 import 被 data.js 静默吞掉——先 `node -e "import('./data/stages/sN.js')..."` 看语法错误；再重启 serve（缓存） |
| 某命令在练习场报"不支持" | parser.js 的 PROGRAMS 没注册该程序；按第 4 节 TDD 扩展 |
| 实操题"参考答案未通过自己的 check" | validate_content.mjs 报错，通常是 check 与 solution 不一致（如 namePattern 检查了位置参数但参数都成了旗标值） |
| 本地测试 404 | serve 的目录不对（必须在项目根启动） |

## 路线图（按价值排序）

- [ ] 练习场支持可变更的模拟文件系统（mkdir/rm/chmod 后 ls 结果真实变化）——需要把 FILES 改成可变状态并加重置
- [ ] firewall-cmd / SELinux 管理命令（getenforce/semanage）解析与模拟
- [ ] 错题本 + 间隔复习（数据已都在 store.js 里，缺 UI）
- [ ] LFCS / LPIC-1 专项题库与独立模考
- [ ] 解析器覆盖 find -exec、完整 awk 语法、管道组合
