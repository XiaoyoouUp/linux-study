# Linux 学练营 · 课程内容契约（生成课程/考试数据必须严格遵守）

> 任何课程/考试数据改动，提交前必须通过：`node scripts/validate_content.mjs`
> 校验器强制本文档的硬性规则（id 唯一、答案下标、图引用存在、实操题参考答案必须通过自己的 check 规约）。
> 考试内容对齐 **RHCSA（EX200，当前基于 RHEL 10）**；讲解以 RHEL 9/10 通用写法为准，工具为 dnf / systemctl / nmcli / firewalld。

## 文件与模块形式
- 课程：`data/stages/sN.js`，导出 `export const stage = {...}`
- 考试：`data/exams/examN.js`，导出 `export const exam = {...}`
- 速查表：`data/reference.js`，导出 `export const REF_SECTIONS = [...]`
- 纯 ESM，无任何 import（除非明确允许）。文件必须是合法 JS，可用下面命令自检：
  `node -e "import('./data/stages/s2.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"`
- 代码字符串建议用模板字符串；**必须转义反引号（\`）与美元插值（\${）**。
- 所有面向用户的文字使用简体中文；命令、路径、字段名保持英文原文。
- 示例环境统一：普通用户 `student`，家目录 `/home/student`，主机名 `server1`，域名 `example.com`。

## stage 结构
```js
export const stage = {
  id: 's2', num: 2,
  title: '文件、目录与权限',            // 8~14 字
  subtitle: '一句话说明本阶段主线',
  goals: ['学完本阶段你能…', '…'],      // 3~5 条，动宾结构
  cert: 'RHCSA 考纲对应：管理文件与权限',  // 或数组
  lessons: [ /* lesson 数组，见下 */ ],
};
```

## lesson 结构
```js
{
  id: 's2l1',                 // 唯一：阶段号 l 课号
  title: 'FHS 与目录配置',
  duration: 25,               // 预计学习分钟数
  summary: '一句话导语（列表页展示）',
  blocks: [ /* 内容块，见下 */ ],
  keyPoints: ['**小结1**', '小结2'],        // 3~5 条，可含 <strong>/<code>
  commands: [ { cmd: 'ls -lah /etc', desc: '长格式查看 /etc' } ],  // 5~10 条本课命令
}
```
**commands 里的命令必须是解析器支持的程序**（见下方"解析器支持清单"），因为速查表"试"按钮会带入练习场执行。

## block 类型（t 字段）
| t | 字段 | 说明 |
|---|---|---|
| h2 | text | 章节标题 |
| p | html | 段落；可内嵌 `<code>` `<strong>` `<mark>`，**不要**用其他标签 |
| list | items:[html], ordered?:bool | 列表 |
| code | lang:'bash', code, out?, file? | 代码块；out 为模拟输出（显示在下方灰区）；file 为文件名。lang 一律 'bash' |
| callout | kind:'info'\|'tip'\|'warn'\|'cka', title, text(html) | 提示框；cka 类型用于"考试考点" |
| diagram | src, caption, desc | 插图；src 必须来自下方图库清单 |
| table | headers:[...], rows:[[...],...] | 表格 |
| quiz | id, title?, questions:[...] | 随堂测验，每课 3~6 题 |

## 题目结构（quiz 与考试共用）
```js
{ id: 'q-s2l1-1',                       // 全局唯一
  type: 'single' | 'multi' | 'judge',   // 单选/多选/判断
  q: '题干（可含 <code>）',
  options: ['A 选项', 'B 选项'],         // judge 类型固定 ['正确','错误']
  answer: [1],                           // 0 起始的下标数组；multi 可多个；judge [0]=正确
  explain: '解析（可含 <code>），必须讲透为什么' }
```
命题要求：场景题为主（"执行 `chmod 640 notes.txt` 后，同组用户可以…"),选项差异明显但需要理解才能区分；错误选项不能一眼假；禁止"以上都对"。

## 考试 exam 结构（data/exams/examN.js）
```js
export const exam = {
  id: 'exam2', stageId: 's2', title: '阶段二结业考试',
  duration: 30,            // 分钟，倒计时；exam-final 为 120
  passScore: 66,           // 百分制及格线；exam-final 为 70（对齐 RHCSA 210/300）
  questions: [ /* 同题目结构，exam1~5 每场 12~15 题；exam-final 20 题 */ ],
  tasks: [ /* 操作题 exam1~5 每场 2~4 题；exam-final 4~6 题 */ ],
};
```
操作题 task：
```js
{ id: 'exam2-t1', points: 10,          // 分值
  text: '将 /home/student/notes.txt 的权限改为属主可读写、同组只读、其他人无权限。',
  hint: '八进制：读写=6，只读=4',
  solution: ['chmod 640 /home/student/notes.txt'],  // 数组，每行一条命令
  check: { program: 'chmod', minNames: 2, firstArgPattern: '^640$' } }
```
**check 规约只允许这些字段**（校验引擎按此实现，超出字段会被忽略）：
`program, sub, flagsMust[{name, equals?, oneOf?}], flagsMustNot['f', 'no-preserve-root'], minNames, firstArgPattern, namePattern`
- `program`：期望程序名（必填字段之一）
- `sub`：期望子命令（systemctl/dnf/ip/nmcli/tar 的动词）
- `flagsMust`：旗标用**长名**（如 `recursive`、`create-home`；`equals` 比较字符串值）
- `flagsMustNot`：只写旗标名或 `名=值`
- `minNames`：位置参数（非旗标）至少个数
- `firstArgPattern`：第 1 个位置参数需匹配的正则（如 chmod 的模式、sed 的脚本）
- `namePattern`：任一位置参数需匹配的正则（如文件名、用户名）
任务必须能被解析器判定（支持程序见下表）。任务描述要给出**明确的路径/名称**，保证答案可判定。单条命令可判定（考试输入框逐条判分，solution 禁止写多条）。

## 解析器支持清单（练习场可判定范围）
| 类别 | 程序与用法 |
|---|---|
| 文件/目录 | `ls`(-l -a -A -h -d)、`pwd`、`cd`、`cat`(-n)、`head`/`tail`(-n)、`wc`(-l -w -c)、`cp`(-r -a -i -v)、`mv`(-i -f -v)、`rm`(-r -f -i)、`mkdir`(-p -m)、`rmdir`、`touch`、`ln`(-s -f)、`find`(path -name -iname -type -maxdepth -user)、`file` 不支持 |
| 权限 | `chmod`(-R; 八进制或符号模式)、`chown`(-R; owner[:group])、`umask`(八进制) |
| 文本三剑客 | `grep`(-i -v -n -r -c -E -l)、`sed`(-n -i -E; s///、d、p)、`awk`(-F; '{print $N}' 常用法) |
| 进程/服务 | `ps`(无参 / aux / -ef)、`kill`(-9 -15 -s 信号名)、`systemctl`(start/stop/restart/reload/status/enable/disable/is-active/list-units/list-unit-files/daemon-reload/get-default/set-default；`--now`) |
| 用户 | `useradd`(-m -s -G -u -c -d)、`usermod`(-aG -s -L -U -c)、`userdel`(-r)、`groupadd`(-g)、`groupdel`、`passwd`(-e)、`id`、`su`(-)、`sudo` 前缀 |
| 软件 | `dnf`(install/remove/update/info/list/search/provides；`-y`) |
| 网络(只读) | `ip`(addr/link/route + show + dev X)、`nmcli`(device status / connection show) |
| 归档 | `tar`(c x t + z j J + v + f 值 + C 值 + --exclude=值)、`gzip`/`gunzip`(-k -v) |
| 文档/杂项 | `man`(页名)、`echo`(-n -e)、`whoami`、`hostname`、`date`、`history`、`clear` |

**超出清单的用法（如 `find -exec`、`awk` 完整语法、`firewall-cmd`、`SELinux 管理命令`、`LVM 命令`）解析器不支持**：课程正文可以讲授并出选择题，但不得写成考试实操题；在相应 code 块或 callout 注明"练习场不支持，请在真实环境练习"。

## 模拟文件系统（练习场数据源，写教程/任务时引用这些真实路径）
```
/etc/{hostname, hosts, passwd, group, fstab, crontab, selinux/config, yum.repos.d/rhel10.repo,
      ssh/sshd_config, systemd/system/multi-user.target.wants/, logrotate.conf, sudoers}
/home/student/{notes.txt, todo.md, access.log, .bashrc, .bash_history,
      scripts/{backup.sh, sysinfo.sh, deploy.sh}, docs/{rhcsa-plan.md, linux-notes.md}, data.csv}
/var/{log/{messages, secure, dnf.log, cron, boot.log}, www/html/index.html, tmp/}
/opt/{app/{app.conf, run.sh}}
/srv/{ftp/}
/boot/{vmlinuz-6.12.0-55.el10.x86_64, grub2/grub.cfg, efi/}
/usr/{bin/, share/doc/}
[root 家目录 /root 存在；/mnt、/media、/proc、/sys、/dev、/run、/tmp 空目录存在]
```
文件有真实内容（messages/secure 日志若干行、access.log 数十行、data.csv 表格数据、passwd 完整条目等），`cat/grep/head/tail/find` 基于内容真实过滤；变更类命令返回 canned 确认信息（不做真实状态机）。系统单元与软件包的 canned 数据：`sshd/crond/httpd/firewalld/NetworkManager` 单元可用，包有 `httpd/tmux/tree/git/vim-enhanced`。

## 图库清单（diagram 的 src 只能引用这些）
| 文件 | 内容 |
|---|---|
| linux-distro-family.svg | 发行版族谱：RHEL/Fedora/CentOS Stream、Debian/Ubuntu、SUSE、Arch 分支与包管理器 |
| install-partition.svg | 安装分区方案：/、/boot、/home、swap 与 LVM 布局 |
| shell-architecture.svg | 用户→shell→内核→硬件分层，bash 的位置与用途 |
| man-sections.svg | man 手册分节结构（1/5/8 常用节）与翻页键位 |
| fhs-tree.svg | FHS 目录树：/etc /home /var /usr /boot /tmp 等用途标注 |
| permission-model.svg | ls -l 字段分解与 ugo/rwx 权限位、八进制换算 |
| hard-vs-soft-link.svg | 硬链接（同一 inode）vs 符号链接（指向路径）对比 |
| vim-modes.svg | vim 普通模式/插入模式/末行模式切换键位图 |
| io-redirection.svg | 标准流与重定向：> >> 2> &> | 数据流图 |
| text-pipeline.svg | 管道文本处理流：grep 过滤 → sed 编辑 → awk 取列 |
| script-flow.svg | shell 脚本结构：shebang、变量、if 判断、for 循环执行流 |
| user-accounts.svg | 用户/组模型：UID/GID、passwd 与 group 文件字段分解 |
| sudo-chain.svg | sudo 授权链：/etc/sudoers → wheel 组 → sudo 命令执行 |
| cron-syntax.svg | crontab 五字段语法图（分 时 日 月 周）与常用示例 |
| process-lifecycle.svg | 进程状态机（R/S/D/Z/T）与常用信号作用 |
| systemd-flow.svg | systemd target 树与服务单元依赖/启动关系 |
| log-flow.svg | 日志流转：服务→journald/rsyslog→/var/log，logrotate 轮转 |
| dnf-workflow.svg | dnf 工作流：repo 元数据 → 依赖解析 → 事务安装（vs rpm 直装） |
| network-firewalld.svg | NetworkManager/nmcli 配置与 firewalld 区域流量路径 |
| lvm-structure.svg | LVM 层级：物理盘→PV→VG→LV→文件系统→挂载点 |
| boot-process.svg | 开机流程：固件→GRUB2→内核+initramfs→systemd→target |
| selinux-context.svg | SELinux 上下文与 DAC/MAC 两级决策流、模式切换 |
| rhcsa-exam-map.svg | RHCSA EX200 考纲域与本站阶段映射图 |

自建 SVG 规则（命名即上表名，放 `diagrams/`）：
- 宽 860、白底 #ffffff、圆角矩形、终端绿 #159A48、浅绿 #E8F7EE、深色 #0d1b2e、Tux 黄 #F0B429、警示 #c53030
- `font-family="'PingFang SC','Microsoft YaHei',sans-serif"`，正文字号 13，标题 15 加粗
- 线条 #7b8ca0 1.5px，箭头用 marker；结构扁平清晰，不超过 30 个元素
- 图必须能脱离上下文独立看懂，中文标注

## 语言风格
- 讲解由浅入深：是什么 → 为什么需要 → 怎么用 → 常见坑；对标《鸟哥的Linux私房菜》的知识组织与 RHEL 官方文档用语
- 每课 10~16 个 block；至少 1 个 diagram、2 个 code（一半带 out 输出）、1 个 callout（cka 类型指出 RHCSA 考点与命令）
- 命令示例真实可运行；引用路径必须存在于上方模拟文件系统（便于读者到练习场复现）
- 出现新术语首次给出中文+英文，如 "逻辑卷（Logical Volume）"
- RHCSA 考纲事实（冲刺课使用）：EX200 当前基于 RHEL 10，纯实机操作考试、限时约 3 小时、满分 300 及格 210（70%）、配置需重启后仍生效、不允许互联网但可用产品文档；Red Hat 未公布分域权重，介绍时用"重点领域"而非编造百分比
