# Linux 学习网站 · 需求交接（新会话从这里开始）

> 本文档由 k8s-study 项目收尾时整理，供新会话直接执行。参考工程：`C:\ai-repo\k8s-study`（同一位用户的已完成项目）。

## 项目初衷（与 k8s-study 完全对齐）

为一名有基础能力的 DevOps 工程师搭建**系统化 Linux 学习网站**：

1. **图文课程**：参照《鸟哥的Linux私房菜（基础学习篇）》的知识体系组织内容，配原创 SVG 图解
2. **随堂测验 + 阶段考试**：每课带测验，每阶段结业考试（限时、逐题解析、成绩存档）
3. **命令练习场（核心）**：在线终端，输入 Linux/shell 命令 → 解析器做语法与用法校验（错误给修正建议），**对命令进行正确性判定**；内置任务逐关判定，思路对标 k8s-study 的 `parser.js + mockcluster.js + tasks.js` 三件套
4. **认证导向**：对标市面 Linux 管理岗要求与认证考试——主推 **RHCSA（EX200，实机操作考试）**，兼顾 **LFCS / LPIC-1**；认证冲刺阶段给考纲映射 + 备考计划
5. **进度追踪**：localStorage 保存课程完成度、测验/考试成绩

## 内容大纲草案（映射《鸟哥的Linux私房菜》）

| 阶段 | 主题 | 私房菜对应 | 认证映射 |
|---|---|---|---|
| 1 | Linux 是什么与安装（发行版、分区、首次登录、man/help） | 第一部分 | RHCSA: 了解与访问命令行 |
| 2 | 文件、目录与权限（FHS、chmod/chown、隐藏权限、链接） | 第二部分 | RHCSA: 管理文件 |
| 3 | vim、bash 与 shell 脚本（变量、管道重定向、正则、sed/awk、脚本） | 第三部分 | RHCSA: 运用基础的 shell 脚本 |
| 4 | 用户、组与权限进阶（账号管理、sudo、ACL、quota、计划任务） | 第四部分 | RHCSA: 管理用户和组、调度任务 |
| 5 | 进程、服务与系统管理（ps/top/signals、systemd、日志 journald、软件管理 dnf/rpm、网络基础 nmcli/防火墙） | 第四/五部分 | RHCSA: 管理进程/服务/网络/软件 |
| 6 | 运维与认证冲刺（存储/挂载/LVM、开机流程、排障、备份、SELinux 基础、RHCSA 考纲精讲与模拟考） | 第五部分 | RHCSA: 管理存储/安全（SELinux）、全真模拟 |

> 开工时先用 WebSearch 核实 RHCSA 当前考试版本（RHEL 9）、 domains 与权重，写入冲刺课程。

## 命令练习场设计要点

- 解析器范围：文件/目录操作（ls/cp/mv/rm/mkdir/find/grep/…）、权限（chmod/chown/umask）、文本三剑客（grep/sed/awk 常用法）、进程与服务（ps/kill/systemctl start|enable|status）、用户（useradd/usermod/passwd/groupadd）、软件（dnf install/remove/info）、网络（ip/nmcli 常用只读）、归档（tar/gzip）
- 校验层次：程序名 → 子命令/动词 → 参数合法性（如 chmod 的八进制/符号模式、tar 选项组合、kill 信号）→ 任务级判定（check 规约沿用 k8s-study 的 `checkCommand` 模式）
- 模拟文件系统：给一个固定的小目录树 + 若干文件，`ls/cat/find` 返回模拟输出；变更命令返回 canned 确认信息（不做真实状态机，与 k8s-study 同边界，路线图里列扩展项）
- 覆盖不了的高级用法在课程中标注，不硬造

## 工程复用（强烈建议）

直接以 `C:\ai-repo\k8s-study` 为模板（用户自有项目，可复制）：
- 复制骨架：`index.html / css / js/app.js + components.js + quiz.js + store.js + data.js / scripts 三个测试脚本`
- 领域替换：`parser/mockcluster/tasks` 全部按 Linux 命令重写（TDD：先写测试再实现，解析器测试覆盖 ~85 用例量级）
- 数据契约：沿用 `docs/content-contract.md` 的结构（block 类型、题目/考试 schema、check 规约），把 k8s 专属示例换成 Linux 示例
- 三层验证不裁剪：`npm test`（解析器）+ `validate_content.mjs`（内容自洽）+ `full_regression.py`（浏览器爬全部页面）
- 相对路径、hash 路由、无构建、无外部依赖等设计决策照搬（见 k8s-study `docs/development.md` 的"关键设计决策"）

## 交付要求（与 k8s-study 相同）

1. 项目初始化前先建 GitHub 仓库（建议名 `linux-study`），给出地址
2. 全站中文、UI 风格可延续 k8s-study 设计系统（换主题色，如 Tux 黄/终端绿）
3. 内容量大：用并行子代理按阶段生成课程与考试，先写内容契约文档统一 schema
4. 完成前三层测试全绿 + 浏览器全量回归通过
5. 推送 GitHub；托管方式由用户自行配置，文档不写死托管平台
