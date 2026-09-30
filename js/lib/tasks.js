/* 任务正确性判定：将用户命令与任务要求逐条比对。
 * check 规约字段（全部可选，缺省即不校验）：
 *   program         期望程序名，如 'chmod'
 *   sub             期望子命令，如 systemctl 的 'enable'、dnf 的 'install'
 *   sudo            true 要求使用 sudo 前缀
 *   flagsMust       [{name, equals?, oneOf?}] 必须出现的旗标（长名，tar 用字母）
 *   flagsMustNot    ['force', 'grace-period=0'] 禁止出现的旗标（名或 名=值）
 *   minNames        至少 N 个位置参数（非旗标）
 *   firstArgPattern 位置参数第 1 个需匹配的正则字符串
 *   namePattern     任一位置参数需匹配的正则字符串 */
import { parseCommand } from './parser.js';

export function checkCommand(cmdLine, spec = {}) {
  const parsed = parseCommand(cmdLine);
  const checks = [];
  const add = (label, ok, detail = '') => checks.push({ label, ok, detail });

  if (!parsed.ok) {
    add('命令语法正确', false, (parsed.errors[0] && parsed.errors[0].message) || '命令解析失败');
    return { pass: false, checks, parsed };
  }
  add('命令语法正确', true);

  if (spec.program) add(`使用 ${spec.program} 命令`, parsed.program === spec.program, `实际为 ${parsed.program}`);
  if (spec.sub) add(`使用子命令 ${spec.sub}`, parsed.sub === spec.sub, `实际为 ${parsed.sub}`);
  if (spec.sudo) add('使用 sudo 前缀（以 root 执行）', parsed.sudo === true, '缺少 sudo 前缀');
  for (const f of spec.flagsMust || []) {
    const { name, equals, oneOf } = f;
    const flagName = name.length === 1 ? `-${name}` : `--${name}`;
    if (equals !== undefined) add(`旗标 ${flagName}=${equals}`, String(parsed.flags[name]) === String(equals), `实际为 ${JSON.stringify(parsed.flags[name])}`);
    else if (oneOf) add(`旗标 ${flagName} 取值 ${oneOf.join('/')}`, oneOf.includes(parsed.flags[name]), `实际为 ${JSON.stringify(parsed.flags[name])}`);
    else add(`包含旗标 ${flagName}`, parsed.flags[name] !== undefined && parsed.flags[name] !== false, parsed.flags[name] === undefined ? '缺少该旗标' : '');
  }
  for (const f of spec.flagsMustNot || []) {
    const [name, value] = f.split('=');
    const bad = value !== undefined ? String(parsed.flags[name]) === value : parsed.flags[name] !== undefined && parsed.flags[name] !== false;
    add(`不使用 ${f.startsWith('-') ? f : (name.length === 1 ? '-' + f : '--' + f)}`, !bad, bad ? '检测到被禁止的旗标' : '');
  }
  if (spec.minNames) add(`至少 ${spec.minNames} 个参数`, parsed.positionals.length >= spec.minNames,
    parsed.positionals.length ? `实际 ${parsed.positionals.length} 个` : '未指定参数');
  if (spec.firstArgPattern) add(`第 1 个参数匹配 ${spec.firstArgPattern}`,
    parsed.positionals.length > 0 && new RegExp(spec.firstArgPattern).test(parsed.positionals[0]),
    parsed.positionals.length ? `实际为 ${parsed.positionals[0]}` : '未指定参数');
  if (spec.namePattern) add(`参数需匹配 ${spec.namePattern}`, parsed.positionals.some((n) => new RegExp(spec.namePattern).test(n)),
    parsed.positionals.join(', ') || '未指定参数');

  const pass = checks.every((c) => c.ok);
  return { pass, checks, parsed };
}

/* ---------- 练习场内置任务清单（与模拟文件系统数据配套） ---------- */
export const TASKS = [
  /* ---- 入门 ---- */
  { id: 't01', level: 1, title: '查看目录内容', desc: '列出 /etc 目录下的文件与子目录。', hint: 'ls + 目录路径', solution: 'ls /etc',
    check: { program: 'ls', minNames: 1, namePattern: '^/etc' } },
  { id: 't02', level: 1, title: '长格式与隐藏文件', desc: '用一条命令以长格式列出 /home/student 的全部文件（含隐藏文件）。', hint: '组合短旗标 -lah', solution: 'ls -lah /home/student',
    check: { program: 'ls', flagsMust: [{ name: 'all' }, { name: 'long' }], minNames: 1 } },
  { id: 't03', level: 1, title: '查看文件内容', desc: '查看 /etc/hostname 的内容。', hint: 'cat + 文件路径', solution: 'cat /etc/hostname',
    check: { program: 'cat', minNames: 1, namePattern: '/etc/hostname' } },
  { id: 't04', level: 1, title: '当前登录用户', desc: '显示当前登录的用户名。', hint: 'whoami', solution: 'whoami',
    check: { program: 'whoami' } },
  { id: 't05', level: 1, title: '带行号查看', desc: '带行号查看 /etc/hosts 的内容。', hint: 'cat -n', solution: 'cat -n /etc/hosts',
    check: { program: 'cat', flagsMust: [{ name: 'number' }], minNames: 1 } },
  { id: 't06', level: 1, title: '取日志开头', desc: '查看 /var/log/messages 的前 5 行。', hint: 'head -n 5', solution: 'head -n 5 /var/log/messages',
    check: { program: 'head', flagsMust: [{ name: 'lines', equals: '5' }], minNames: 1 } },
  { id: 't07', level: 1, title: '取日志末尾', desc: '查看 /var/log/secure 的最后 3 行。', hint: 'tail -n 3', solution: 'tail -n 3 /var/log/secure',
    check: { program: 'tail', flagsMust: [{ name: 'lines', equals: '3' }], minNames: 1 } },
  { id: 't08', level: 1, title: '创建目录', desc: '在 /opt 下创建多层目录 /opt/app/logs。', hint: 'mkdir -p', solution: 'mkdir -p /opt/app/logs',
    check: { program: 'mkdir', flagsMust: [{ name: 'parents' }], namePattern: '^/opt/app/logs' } },
  { id: 't09', level: 1, title: '创建空文件', desc: '在 /tmp 下创建空文件 lab.txt。', hint: 'touch', solution: 'touch /tmp/lab.txt',
    check: { program: 'touch', minNames: 1, namePattern: '/tmp/lab' } },
  { id: 't10', level: 1, title: '复制文件', desc: '把 /etc/hosts 复制到 /tmp/hosts.bak。', hint: 'cp 源 目标', solution: 'cp /etc/hosts /tmp/hosts.bak',
    check: { program: 'cp', minNames: 2 } },
  { id: 't11', level: 1, title: '查找手册', desc: '查看 chmod 命令的手册页。', hint: 'man + 页名', solution: 'man chmod',
    check: { program: 'man', minNames: 1, namePattern: '^chmod' } },
  { id: 't12', level: 1, title: '统计行数', desc: '统计 /etc/passwd 有多少行。', hint: 'wc -l', solution: 'wc -l /etc/passwd',
    check: { program: 'wc', flagsMust: [{ name: 'lines' }], minNames: 1 } },

  /* ---- 进阶 ---- */
  { id: 't13', level: 2, title: '按名字找文件', desc: '在 /home/student 下找出所有 .sh 结尾的文件。', hint: 'find 路径 -name "*.sh"', solution: 'find /home/student -name "*.sh"',
    check: { program: 'find', flagsMust: [{ name: 'name' }], minNames: 1 } },
  { id: 't14', level: 2, title: '找目录', desc: '在 /home/student 下找出所有目录（类型 d）。', hint: 'find 路径 -type d', solution: 'find /home/student -type d',
    check: { program: 'find', flagsMust: [{ name: 'type', equals: 'd' }], minNames: 1 } },
  { id: 't15', level: 2, title: '过滤日志', desc: '从 /var/log/secure 中找出包含 Failed 的行并显示行号。', hint: 'grep -n', solution: 'grep -n Failed /var/log/secure',
    check: { program: 'grep', flagsMust: [{ name: 'line-number' }], minNames: 2 } },
  { id: 't16', level: 2, title: '忽略大小写搜索', desc: '不区分大小写地在 /var/log/secure 中搜索 failed。', hint: 'grep -i', solution: 'grep -i failed /var/log/secure',
    check: { program: 'grep', flagsMust: [{ name: 'ignore-case' }], minNames: 2 } },
  { id: 't17', level: 2, title: '递归搜索目录', desc: '在 /var/log 整个目录中递归搜索包含 cron 的行。', hint: 'grep -r', solution: 'grep -r cron /var/log',
    check: { program: 'grep', flagsMust: [{ name: 'recursive' }], minNames: 2 } },
  { id: 't18', level: 2, title: '设置八进制权限', desc: '把 /home/student/notes.txt 的权限改为 640。', hint: 'chmod 八进制模式', solution: 'chmod 640 /home/student/notes.txt',
    check: { program: 'chmod', minNames: 2, firstArgPattern: '^640$' } },
  { id: 't19', level: 2, title: '给脚本加执行权限', desc: '用符号模式给 /home/student/scripts/backup.sh 的属主加执行权限。', hint: 'chmod u+x', solution: 'chmod u+x /home/student/scripts/backup.sh',
    check: { program: 'chmod', minNames: 2, firstArgPattern: '^[ugoa]*\\+x$|^[ugoa]*\\+rx$' } },
  { id: 't20', level: 2, title: '修改属主与组', desc: '把 /home/student/notes.txt 的属主和组都改为 root。', hint: 'chown 用户:组', solution: 'chown root:root /home/student/notes.txt',
    check: { program: 'chown', minNames: 2, firstArgPattern: '^root[:.]root$' } },
  { id: 't21', level: 2, title: '创建软链接', desc: '给 /etc/hosts 创建一个符号链接 /tmp/hosts-link。', hint: 'ln -s 目标 链接名', solution: 'ln -s /etc/hosts /tmp/hosts-link',
    check: { program: 'ln', flagsMust: [{ name: 'symbolic' }], minNames: 2 } },
  { id: 't22', level: 2, title: '查看全部进程', desc: '查看系统中所有进程的详细列表（BSD 风格 aux）。', hint: 'ps aux', solution: 'ps aux',
    check: { program: 'ps', flagsMust: [{ name: 'all' }, { name: 'user' }] } },
  { id: 't23', level: 2, title: '强制结束进程', desc: '用 KILL 信号强制结束 PID 为 3456 的进程。', hint: 'kill -9', solution: 'kill -9 3456',
    check: { program: 'kill', flagsMust: [{ name: 'signal', equals: 'KILL' }], minNames: 1 } },
  { id: 't24', level: 2, title: '启用并启动服务', desc: '设置 crond 服务开机自启并立即启动（一条命令）。', hint: 'systemctl enable --now', solution: 'systemctl enable --now crond',
    check: { program: 'systemctl', sub: 'enable', flagsMust: [{ name: 'now' }], minNames: 1 } },
  { id: 't25', level: 2, title: '查看服务状态', desc: '查看 sshd 服务的运行状态。', hint: 'systemctl status', solution: 'systemctl status sshd',
    check: { program: 'systemctl', sub: 'status', minNames: 1 } },
  { id: 't26', level: 2, title: '安装软件包', desc: '安装 tmux 软件包并自动确认（不用手动输 y）。', hint: 'dnf install -y', solution: 'dnf install -y tmux',
    check: { program: 'dnf', sub: 'install', flagsMust: [{ name: 'assumeyes' }], minNames: 1 } },
  { id: 't27', level: 2, title: '查看网卡地址', desc: '查看本机网卡 IP 地址。', hint: 'ip addr', solution: 'ip addr show',
    check: { program: 'ip', sub: 'addr' } },
  { id: 't28', level: 2, title: '创建用户', desc: '创建用户 dev1，要求同时创建家目录并指定 shell 为 /bin/bash。', hint: 'useradd -m -s', solution: 'sudo useradd -m -s /bin/bash dev1',
    check: { program: 'useradd', sudo: true, flagsMust: [{ name: 'create-home' }, { name: 'shell' }], minNames: 1 } },
  { id: 't29', level: 2, title: '追加用户到组', desc: '把用户 dev1 追加到 wheel 组（保留原有组）。', hint: 'usermod -aG', solution: 'sudo usermod -aG wheel dev1',
    check: { program: 'usermod', flagsMust: [{ name: 'append' }, { name: 'groups' }], minNames: 1 } },
  { id: 't30', level: 2, title: '打包目录', desc: '把 /home/student/scripts 打包压缩为 /tmp/scripts.tar.gz。', hint: 'tar -czf 归档名 路径', solution: 'tar -czf /tmp/scripts.tar.gz /home/student/scripts',
    check: { program: 'tar', flagsMust: [{ name: 'c' }, { name: 'z' }, { name: 'f' }], minNames: 1 } },

  /* ---- 挑战 ---- */
  { id: 't31', level: 3, title: '统计匹配行数', desc: '统计 /var/log/secure 中包含 Failed 的行数（只输出数字）。', hint: 'grep -c', solution: 'grep -c Failed /var/log/secure',
    check: { program: 'grep', flagsMust: [{ name: 'count' }], minNames: 2 } },
  { id: 't32', level: 3, title: '扩展正则搜索', desc: '用扩展正则在 /var/log/messages 中找出以 Sep 开头的行。', hint: 'grep -E "^Sep"', solution: 'grep -E "^Sep" /var/log/messages',
    check: { program: 'grep', flagsMust: [{ name: 'extended-regexp' }], minNames: 2 } },
  { id: 't33', level: 3, title: '取列字段', desc: '从 /etc/passwd 中提取第 1 列用户名（分隔符为冒号）。', hint: "awk -F: '{print $1}'", solution: "awk -F: '{print $1}' /etc/passwd",
    check: { program: 'awk', flagsMust: [{ name: 'field-separator', equals: ':' }], minNames: 2 } },
  { id: 't34', level: 3, title: '文本替换', desc: '把 /etc/hosts 中的 server2 替换为 SERVER2 并显示到屏幕（不修改文件）。', hint: "sed 's/旧/新/g'", solution: "sed 's/server2/SERVER2/g' /etc/hosts",
    check: { program: 'sed', firstArgPattern: '^s[/.:|,]' } },
  { id: 't35', level: 3, title: '删除文件需谨慎', desc: '删除 /tmp/lab.txt，但要求交互确认（不能使用 -f）。', hint: 'rm -i；flagsMustNot 会拦住 -f', solution: 'rm -i /tmp/lab.txt',
    check: { program: 'rm', minNames: 1, flagsMust: [{ name: 'interactive' }], flagsMustNot: ['force'] } },
  { id: 't36', level: 3, title: '查看服务是否自启', desc: '查询 sshd 服务是否设置为开机自启。', hint: 'systemctl is-enabled', solution: 'systemctl is-enabled sshd',
    check: { program: 'systemctl', sub: 'is-enabled', minNames: 1 } },
  { id: 't37', level: 3, title: '设置默认启动目标', desc: '把系统默认启动目标设为 multi-user.target。', hint: 'systemctl set-default', solution: 'systemctl set-default multi-user.target',
    check: { program: 'systemctl', sub: 'set-default', minNames: 1, namePattern: 'target$' } },
  { id: 't38', level: 3, title: '密码立即过期', desc: '让用户 dev1 的密码立即失效（下次登录必须修改）。', hint: 'passwd -e', solution: 'sudo passwd -e dev1',
    check: { program: 'passwd', flagsMust: [{ name: 'expire' }], minNames: 1 } },
  { id: 't39', level: 3, title: '锁定用户', desc: '锁定用户 dev1 使其无法登录。', hint: 'usermod -L', solution: 'sudo usermod -L dev1',
    check: { program: 'usermod', flagsMust: [{ name: 'lock' }], minNames: 1 } },
  { id: 't40', level: 3, title: '指定 GID 建组', desc: '创建组 ops 并指定 GID 为 1500。', hint: 'groupadd -g 1500', solution: 'sudo groupadd -g 1500 ops',
    check: { program: 'groupadd', flagsMust: [{ name: 'gid', equals: '1500' }], minNames: 1 } },
  { id: 't41', level: 3, title: '查看软件包信息', desc: '查看 httpd 软件包的版本与描述信息（不安装）。', hint: 'dnf info', solution: 'dnf info httpd',
    check: { program: 'dnf', sub: 'info', minNames: 1 } },
  { id: 't42', level: 3, title: '查看连接配置', desc: '用 nmcli 查看所有网络连接的配置。', hint: 'nmcli connection show', solution: 'nmcli connection show',
    check: { program: 'nmcli', sub: 'connection' } },
  { id: 't43', level: 3, title: '查看归档内容', desc: '不解包，列出 /tmp/scripts.tar.gz 归档内的文件清单。', hint: 'tar -tzf', solution: 'tar -tzf /tmp/scripts.tar.gz',
    check: { program: 'tar', flagsMust: [{ name: 't' }, { name: 'f', equals: '/tmp/scripts.tar.gz' }] } },
  { id: 't44', level: 3, title: '解包到指定目录', desc: '把 /tmp/scripts.tar.gz 解包到 /tmp/restore 目录。', hint: 'tar -xzf -C 目录', solution: 'tar -xzf /tmp/scripts.tar.gz -C /tmp/restore',
    check: { program: 'tar', flagsMust: [{ name: 'x' }, { name: 'z' }, { name: 'f', equals: '/tmp/scripts.tar.gz' }, { name: 'C' }] } },
  { id: 't45', level: 3, title: '递归修改目录权限', desc: '递归地把 /opt/app 及其内容的权限改为 750。', hint: 'chmod -R 750', solution: 'chmod -R 750 /opt/app',
    check: { program: 'chmod', flagsMust: [{ name: 'recursive' }], minNames: 2, firstArgPattern: '^750$' } },
  { id: 't46', level: 3, title: '设置掩码', desc: '把当前 shell 的 umask 设置为 027。', hint: 'umask 027', solution: 'umask 027',
    check: { program: 'umask', minNames: 1, firstArgPattern: '^027$' } },
];
