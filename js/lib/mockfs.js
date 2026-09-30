/* 模拟文件系统：固定目录树与文件内容 + 读取类命令基于内容真实过滤 + 变更类命令 canned 输出
 * 目标是让练习场"看起来像真的"，不做真实状态机（变更不保留），边界见 docs/content-contract.md。 */

const HOME = '/home/student';

/* ---------------- 目录树与文件内容 ---------------- */
const DIRS = {
  '/': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:00' },
  '/bin': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:00' },
  '/boot': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:10' },
  '/boot/efi': { owner: 'root', group: 'root', mode: '700', mtime: 'Aug 10 08:10' },
  '/boot/grub2': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:10' },
  '/dev': { owner: 'root', group: 'root', mode: '755', mtime: 'Sep 28 09:00' },
  '/etc': { owner: 'root', group: 'root', mode: '755', mtime: 'Sep 26 14:02' },
  '/etc/ssh': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:12' },
  '/etc/selinux': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:12' },
  '/etc/yum.repos.d': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:12' },
  '/etc/systemd': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:12' },
  '/etc/systemd/system': { owner: 'root', group: 'root', mode: '755', mtime: 'Sep 26 14:02' },
  '/etc/systemd/system/multi-user.target.wants': { owner: 'root', group: 'root', mode: '755', mtime: 'Sep 26 14:02' },
  '/home': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:20' },
  '/home/student': { owner: 'student', group: 'student', mode: '750', mtime: 'Sep 29 17:40' },
  '/home/student/scripts': { owner: 'student', group: 'student', mode: '750', mtime: 'Sep 28 10:03' },
  '/home/student/docs': { owner: 'student', group: 'student', mode: '750', mtime: 'Sep 27 19:11' },
  '/opt': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:20' },
  '/opt/app': { owner: 'root', group: 'root', mode: '755', mtime: 'Sep 20 09:30' },
  '/proc': { owner: 'root', group: 'root', mode: '555', mtime: 'Sep 28 09:00' },
  '/root': { owner: 'root', group: 'root', mode: '550', mtime: 'Sep 21 11:00' },
  '/run': { owner: 'root', group: 'root', mode: '755', mtime: 'Sep 28 09:00' },
  '/sbin': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:00' },
  '/srv': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:20' },
  '/srv/ftp': { owner: 'root', group: 'root', mode: '555', mtime: 'Aug 10 08:20' },
  '/sys': { owner: 'root', group: 'root', mode: '555', mtime: 'Sep 28 09:00' },
  '/tmp': { owner: 'root', group: 'root', mode: '1777', mtime: 'Sep 29 18:20' },
  '/usr': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:00' },
  '/usr/bin': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:00' },
  '/usr/share': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:00' },
  '/usr/share/doc': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:00' },
  '/var': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:00' },
  '/var/log': { owner: 'root', group: 'root', mode: '755', mtime: 'Sep 29 09:01' },
  '/var/www': { owner: 'root', group: 'root', mode: '755', mtime: 'Aug 10 08:20' },
  '/var/www/html': { owner: 'root', group: 'root', mode: '755', mtime: 'Sep 20 09:30' },
};

const FILES = {
  '/etc/hostname': { content: 'server1', mtime: 'Aug 10 08:05' },
  '/etc/hosts': { content: '127.0.0.1   localhost localhost.localdomain\n192.168.56.10 server1 server1.example.com\n192.168.56.11 server2 server2.example.com\n', mtime: 'Aug 10 08:05' },
  '/etc/passwd': { content: 'root:x:0:0:root:/root:/bin/bash\nbin:x:1:1:bin:/bin:/sbin/nologin\ndaemon:x:2:2:daemon:/sbin:/sbin/nologin\nadm:x:3:4:adm:/var/adm:/sbin/nologin\nlp:x:4:7:lp:/var/spool/lpd:/sbin/nologin\nsync:x:5:0:sync:/sbin:/bin/sync\nshutdown:x:6:0:shutdown:/sbin:/sbin/shutdown\nhalt:x:7:0:halt:/sbin:/sbin/halt\nmail:x:8:12:mail:/var/spool/mail:/sbin/nologin\noperator:x:11:0:operator:/root:/sbin/nologin\nsshd:x:74:74:Privilege-separated SSH:/usr/share/empty.sshd:/usr/sbin/nologin\nchrony:x:992:989::/var/lib/chrony:/sbin/nologin\nsystemd-network:x:192:192:systemd Network Management:/:/usr/sbin/nologin\nstudent:x:1000:1000:Student User:/home/student:/bin/bash\ndev1:x:1001:1001::/home/dev1:/bin/bash\n', mtime: 'Sep 22 10:00' },
  '/etc/group': { content: 'root:x:0:\nbin:x:1:\ndaemon:x:2:\nwheel:x:10:student\nsshd:x:74:\nchrony:x:989:\nstudent:x:1000:\ndev1:x:1001:\n', mtime: 'Sep 22 10:00' },
  '/etc/fstab': { content: '\n/dev/mapper/rhel-root   /           xfs     defaults        0 0\nUUID=7c1e9f2a-3b44-4c5d-8e6f-a1b2c3d4e5f6  /boot  xfs  defaults  0 0\n/dev/mapper/rhel-swap   swap        swap    defaults        0 0\n', mtime: 'Aug 10 08:06' },
  '/etc/crontab': { content: 'SHELL=/bin/bash\nPATH=/sbin:/bin:/usr/sbin:/usr/bin\nMAILTO=root\n\n# For details see man 4 crontabs\n\n# Example of job definition:\n# .---------------- minute (0 - 59)\n# |  .------------- hour (0 - 23)\n# |  |  .---------- day of month (0 - 31)\n# |  |  |  .------- month (1 - 12) OR jan,feb,...\n# |  |  |  |  .---- day of week (0 - 6) OR sun,sat,...\n# |  |  |  |  |\n# *  *  *  *  * user-name  command to be executed\n', mtime: 'Aug 10 08:06' },
  '/etc/sudoers': { content: '## Sudoers allows particular users to run various commands as\n## the superuser.\nDefaults    secure_path = /sbin:/bin:/usr/sbin:/usr/bin\n\nroot    ALL=(ALL)       ALL\n%wheel  ALL=(ALL)       ALL\n', owner: 'root', group: 'root', mode: '440', mtime: 'Sep 21 11:00' },
  '/etc/logrotate.conf': { content: 'weekly\nrotate 4\ncreate\ninclude /etc/logrotate.d\n', mtime: 'Aug 10 08:06' },
  '/etc/selinux/config': { content: '# This file controls the state of SELinux on the system.\n# SELINUX= can take one of these three values:\n#     enforcing - SELinux security policy is enforced.\n#     permissive - SELinux prints warnings instead of enforcing.\nSELINUX=enforcing\nSELINUXTYPE=targeted\n', mtime: 'Aug 10 08:12' },
  '/etc/yum.repos.d/rhel10.repo': { content: '[baseos]\nname=Red Hat Enterprise Linux 10 - BaseOS\nbaseurl=https://cdn.redhat.com/content/dist/rhel10/$releasever/x86_64/baseos/os\nenabled=1\ngpgcheck=1\n', mtime: 'Aug 10 08:12' },
  '/etc/ssh/sshd_config': { content: '# OpenSSH server configuration\nPort 22\nPermitRootLogin no\nPasswordAuthentication yes\nX11Forwarding no\nSubsystem sftp /usr/libexec/openssh/sftp-server\n', mtime: 'Aug 10 08:12' },
  '/home/student/notes.txt': { content: '# RHCSA 备考笔记\n1. 每天至少 1 小时命令练习（练习场任务优先）。\n2. 重点章节：权限、用户与组、systemd、存储与 SELinux。\n3. 周末做一次阶段考试，错题记录到 todo.md。\n4. 考前两周：按考纲逐条自查，配置都要重启后仍生效。\n', mtime: 'Sep 29 17:40' },
  '/home/student/todo.md': { content: '# 待办\n- [x] 完成阶段一测验\n- [ ] 练习场任务刷到 40+\n- [ ] 整理 LVM 笔记\n- [ ] 模拟考 70 分以上\n', mtime: 'Sep 28 21:15' },
  '/home/student/.bashrc': { content: '# .bashrc\nalias ll=\'ls -l\'\nalias grep=\'grep --color=auto\'\nexport PS1="[\\u@\\h \\W]\\$ "\n', mtime: 'Aug 10 08:20' },
  '/home/student/.bash_history': { content: 'ls -l /etc\nsystemctl status sshd\ngrep -n root /etc/passwd\n', mtime: 'Sep 29 18:00' },
  '/home/student/access.log': { content: '192.168.56.1 - - [28/Sep/2026:10:01:02 +0800] "GET / HTTP/1.1" 200 3477\n192.168.56.1 - - [28/Sep/2026:10:01:03 +0800] "GET /style.css HTTP/1.1" 200 1204\n192.168.56.33 - - [28/Sep/2026:11:22:41 +0800] "GET /admin HTTP/1.1" 403 221\n192.168.56.1 - - [28/Sep/2026:12:03:10 +0800] "POST /login HTTP/1.1" 302 -\n192.168.56.1 - - [29/Sep/2026:09:15:00 +0800] "GET /index.html HTTP/1.1" 200 3477\n', mtime: 'Sep 29 09:16' },
  '/home/student/data.csv': { content: 'name,uid,shell\nstudent,1000,/bin/bash\ndev1,1001,/bin/bash\nops,1500,/bin/sh\n', mtime: 'Sep 25 14:00' },
  '/home/student/scripts/backup.sh': { content: '#!/bin/bash\n# 备份脚本：打包 scripts 目录自身\ntar -czf /tmp/backup.tar.gz /home/student/scripts\necho "backup done"\n', mtime: 'Sep 28 10:03' },
  '/home/student/scripts/sysinfo.sh': { content: '#!/bin/bash\n# 输出系统信息\nhostname\necho "$(date) $(uptime)"\n', mtime: 'Sep 28 10:02' },
  '/home/student/scripts/deploy.sh': { content: '#!/bin/bash\n# 部署脚本示例\nrsync -a /opt/app/ server2:/opt/app/\n', mtime: 'Sep 27 16:45' },
  '/home/student/docs/rhcsa-plan.md': { content: '# RHCSA 六周计划\n第1周 基础与命令行\n第2周 文件与权限\n第3-4周 脚本与服务\n第5周 存储与 SELinux\n第6周 模拟考冲刺\n', mtime: 'Sep 27 19:11' },
  '/home/student/docs/linux-notes.md': { content: '# Linux 学习笔记\nvim 三模式：普通/插入/末行。\n权限：chmod 640 = rw-r-----。\n', mtime: 'Sep 26 20:30' },
  '/var/log/messages': { content: 'Sep 28 09:12:34 server1 systemd[1]: Started OpenSSH server daemon.\nSep 28 09:12:35 server1 systemd[1]: Reached target Multi-User System.\nSep 28 15:40:01 server1 systemd[1]: Starting dnf makecache...\nSep 29 03:01:01 server1 systemd[1]: Started Session 12 of user root.\nSep 29 08:44:52 server1 kernel: eth0: link up at 1000 Mbps\n', mtime: 'Sep 29 08:45' },
  '/var/log/secure': { content: 'Sep 28 09:15:01 server1 sshd[1123]: Accepted publickey for student from 192.168.56.1 port 51234 ssh2\nSep 28 21:03:11 server1 unix_chkpwd[4312]: password check failed for user (root)\nSep 29 08:44:52 server1 sshd[2287]: Failed password for root from 192.168.56.33 port 40122 ssh2\nSep 29 08:44:55 server1 sshd[2287]: Failed password for root from 192.168.56.33 port 40124 ssh2\nSep 29 09:01:20 server1 sudo: student : TTY=pts/0 ; PWD=/home/student ; USER=root ; COMMAND=/bin/systemctl status sshd\n', mtime: 'Sep 29 09:01' },
  '/var/log/dnf.log': { content: '2026-09-28T15:40:01+0800 SUBDEBUG Merging user configs into priorities\n2026-09-28T15:40:04+0800 INFO --- logging initialized ---\n2026-09-28T15:40:11+0800 DDEBUG timer: config: 3 ms\n', mtime: 'Sep 28 15:41' },
  '/var/log/cron': { content: 'Sep 29 03:01:01 server1 crond[4012]: (root) CMD (run-parts /etc/cron.hourly)\nSep 29 04:02:01 server1 crond[4231]: (root) CMD (/usr/libexec/sa/sa1 1 1)\n', mtime: 'Sep 29 04:02' },
  '/var/log/boot.log': { content: '[    0.000000] Booting EL10 kernel\n[    2.104332] systemd[1]: Detected virtualization kvm.\n', mtime: 'Sep 28 09:12' },
  '/var/www/html/index.html': { content: '<!DOCTYPE html>\n<html><head><title>Server1</title></head>\n<body><h1>Hello from server1</h1></body></html>\n', mtime: 'Sep 20 09:30' },
  '/opt/app/app.conf': { content: 'port = 8080\nlog_level = info\n', mtime: 'Sep 20 09:30' },
  '/opt/app/run.sh': { content: '#!/bin/bash\nexec /opt/app/bin/server --config /opt/app/app.conf\n', mtime: 'Sep 20 09:30' },
  '/boot/grub2/grub.cfg': { content: '# GRUB2 配置由 grubby 生成，勿手改\nmenuentry \'Red Hat Enterprise Linux 10\' ...\n', mtime: 'Aug 10 08:10' },
  '/boot/vmlinuz-6.12.0-55.el10.x86_64': { content: '', mode: '755', mtime: 'Aug 10 08:10' },
};
/* 默认属主/权限 */
for (const [p, f] of Object.entries(FILES)) {
  if (!f.owner) f.owner = p.startsWith('/home/student') ? 'student' : 'root';
  if (!f.group) f.group = p.startsWith('/home/student') ? 'student' : 'root';
  if (!f.mode) f.mode = '644';
  if (f.size === undefined) f.size = f.content.length;
}
for (const [p, d] of Object.entries(DIRS)) {
  if (d.size === undefined) d.size = 4096;
}

const KNOWN_USERS = { root: { uid: 0, gid: 0 }, student: { uid: 1000, gid: 1000 }, dev1: { uid: 1001, gid: 1001 } };
const KNOWN_GROUPS = new Set(['root', 'bin', 'daemon', 'wheel', 'sshd', 'chrony', 'student', 'dev1']);

const UNITS = {
  sshd: { desc: 'OpenSSH server daemon', state: 'active (running)', since: 'Mon 2026-09-28 09:12:34 CST; 2 days ago', pid: 1123, mem: '4.2M', cpu: '1.234s', enabled: 'enabled', want: true },
  crond: { desc: 'Command Scheduler', state: 'active (running)', since: 'Mon 2026-09-28 09:12:35 CST; 2 days ago', pid: 1180, mem: '3.1M', cpu: '0.456s', enabled: 'enabled', want: true },
  httpd: { desc: 'The Apache HTTP Server', state: 'inactive (dead)', since: 'n/a', pid: 0, mem: '-', cpu: '-', enabled: 'disabled', want: false },
  firewalld: { desc: 'firewalld - dynamic firewall daemon', state: 'active (running)', since: 'Mon 2026-09-28 09:12:36 CST; 2 days ago', pid: 1201, mem: '12.8M', cpu: '3.201s', enabled: 'enabled', want: true },
  NetworkManager: { desc: 'Network Manager', state: 'active (running)', since: 'Mon 2026-09-28 09:12:33 CST; 2 days ago', pid: 1102, mem: '18.4M', cpu: '2.987s', enabled: 'enabled', want: true },
};

const PKGS = {
  tmux: { version: '3.4', release: '4.el10', arch: 'x86_64', size: '350 k', repo: 'baseos', summary: 'A terminal multiplexer', url: 'https://github.com/tmux/tmux', license: 'ISC' },
  httpd: { version: '2.4.63', release: '2.el10', arch: 'x86_64', size: '1.4 M', repo: 'appstream', summary: 'Apache HTTP Server', url: 'https://httpd.apache.org/', license: 'ASL 2.0' },
  tree: { version: '2.1.0', release: '4.el10', arch: 'x86_64', size: '58 k', repo: 'baseos', summary: 'File system tree viewer', url: 'http://mama.indstate.edu/users/ice/tree/', license: 'GPLv2+' },
  git: { version: '2.45.0', release: '1.el10', arch: 'x86_64', size: '18 M', repo: 'appstream', summary: 'Fast Version Control System', url: 'https://git-scm.com/', license: 'GPLv2' },
  'vim-enhanced': { version: '9.1.0821', release: '2.el10', arch: 'x86_64', size: '3.6 M', repo: 'appstream', summary: 'A version of the VIM editor which includes recent enhancements', url: 'https://www.vim.org/', license: 'Vim and MIT' },
};
const INSTALLED = ['cronie', 'git', 'gnupg2', 'openssh-server', 'polkit', 'selinux-policy', 'sudo', 'systemd', 'vim-enhanced'];

const MAN_PAGES = {
  ls: { sections: [1], name: 'list directory contents', syn: 'ls [OPTION]... [FILE]...' },
  cat: { sections: [1], name: 'concatenate files and print on the standard output', syn: 'cat [OPTION]... [FILE]...' },
  chmod: { sections: [1], name: 'change file mode bits', syn: 'chmod [OPTION]... MODE[,MODE]... FILE...' },
  chown: { sections: [1], name: 'change file owner and group', syn: 'chown [OPTION]... [OWNER][:[GROUP]] FILE...' },
  grep: { sections: [1], name: 'print lines that match patterns', syn: 'grep [OPTION]... PATTERNS [FILE]...' },
  sed: { sections: [1], name: 'stream editor for filtering and transforming text', syn: 'sed [OPTION]... {script-only-if-no-other-script} [input-file]...' },
  awk: { sections: [1], name: 'pattern scanning and processing language', syn: 'awk [options] \'program\' file...' },
  find: { sections: [1], name: 'search for files in a directory hierarchy', syn: 'find [-H] [-L] path... [expression]' },
  tar: { sections: [1], name: 'an archiving utility', syn: 'tar [OPTION...] [FILE]...' },
  systemctl: { sections: [1], name: 'Control the systemd system and service manager', syn: 'systemctl [OPTIONS...] COMMAND [UNIT...]' },
  useradd: { sections: [8], name: 'create a new user or update default new user information', syn: 'useradd [options] LOGIN' },
  usermod: { sections: [8], name: 'modify a user account', syn: 'usermod [options] LOGIN' },
  passwd: { sections: [1], name: 'change user password', syn: 'passwd [options] [LOGIN]' },
  dnf: { sections: [8], name: 'DNF Package Manager', syn: 'dnf [options] COMMAND' },
  sshd: { sections: [8], name: 'OpenSSH daemon', syn: 'sshd [-46DdeEiqTtV] [-C connection_spec] [-c host_key_file]...' },
  crontab: { sections: [1, 5], name: 'files used to schedule the execution of programs', syn: '/etc/crontab /etc/cron.d/*' },
  vim: { sections: [1], name: 'Vi IMproved, a programmer\'s text editor', syn: 'vim [options] [file ...]' },
};

/* ---------------- 路径与条目工具 ---------------- */
function resolvePath(p) {
  if (!p || p === '~' || p === '~/' ) return HOME;
  if (p.startsWith('~/')) p = HOME + p.slice(1);
  const abs = p.startsWith('/') ? p : HOME + '/' + p;
  const parts = [];
  for (const seg of abs.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  return '/' + parts.join('/');
}
function entryOf(path) {
  if (DIRS[path]) return { type: 'dir', meta: DIRS[path] };
  if (FILES[path]) return { type: 'file', meta: FILES[path] };
  return null;
}
function listDir(dir) {
  const prefix = dir === '/' ? '/' : dir + '/';
  const names = [];
  for (const d of Object.keys(DIRS)) {
    if (d.startsWith(prefix) && !d.slice(prefix.length).includes('/')) names.push(d.slice(prefix.length));
  }
  for (const f of Object.keys(FILES)) {
    if (f.startsWith(prefix) && !f.slice(prefix.length).includes('/')) names.push(f.slice(prefix.length));
  }
  return [...new Set(names)];
}
function walkFiles(dir) {
  const out = [];
  for (const f of Object.keys(FILES)) if (f === dir || f.startsWith(dir + '/')) out.push(f);
  return out;
}
function permStr(mode, isDir) {
  let m = mode.slice(-3).split('').map((d) => {
    const n = Number(d);
    return [(n & 4 ? 'r' : '-'), (n & 2 ? 'w' : '-'), (n & 1 ? 'x' : '-')].join('');
  }).join('');
  if (mode === '1777') m = 'rwxrwxrwt';
  if (mode === '440') m = 'r--r-----';
  return (isDir ? 'd' : '-') + m + '.';
}
function globToRegex(glob, ignoreCase) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + esc + '$', ignoreCase ? 'i' : '');
}
const linesOf = (content) => content.replace(/\n$/, '').split('\n');

/* ---------------- simulate 入口 ---------------- */
export function simulate(cmdLine, parsed) {
  if (!parsed || !parsed.ok) {
    return { text: (parsed && parsed.errors[0] ? parsed.errors[0].message : '命令无法解析'), tone: 'err' };
  }
  const p = parsed.program;
  const f = parsed.flags;
  const a = parsed.positionals;
  const MUT = (text = '') => ({ text, tone: 'out', mutated: true });
  const sys = (text) => ({ text, tone: 'sys' });

  switch (p) {
    case 'pwd': return { text: HOME, tone: 'out' };
    case 'whoami': return { text: 'student', tone: 'out' };
    case 'hostname': return { text: f.fqdn ? 'server1.example.com' : 'server1', tone: 'out' };
    case 'date': return { text: new Date().toString().replace(/ GMT.*$/, ' CST'), tone: 'out' };
    case 'echo': return { text: a.join(' '), tone: 'out' };
    case 'clear':
    case 'history': return { text: '', tone: 'out' };

    case 'cd': {
      const target = resolvePath(a[0] || '~');
      const e = entryOf(target);
      if (!e) return { text: `bash: cd: ${a[0]}: No such file or directory`, tone: 'err' };
      if (e.type === 'file') return { text: `bash: cd: ${a[0]}: Not a directory`, tone: 'err' };
      return sys('（模拟环境：cd 不会改变后续命令的工作目录，示例统一使用绝对路径）');
    }
    case 'su': return sys(`（模拟）已切换到 ${a[0] || 'root'} 的登录 shell；后续命令仍以 student 视角执行`);

    case 'ls': return simLs(f, a);
    case 'cat': return simCat(f, a);
    case 'head':
    case 'tail': return simHeadTail(p, f, a);
    case 'wc': return simWc(f, a);
    case 'grep': return simGrep(f, a);
    case 'find': return simFind(f, a);

    case 'mkdir':
    case 'rmdir':
    case 'touch':
    case 'cp':
    case 'mv':
    case 'rm':
    case 'ln':
      return MUT('');

    case 'chmod': return MUT('');
    case 'chown': return MUT('');
    case 'umask': return a.length ? MUT('') : { text: '0022', tone: 'out' };

    case 'ps': return simPs(f);
    case 'kill': return MUT('');
    case 'systemctl': return simSystemctl(f, a, parsed.sub);

    case 'useradd': {
      const name = a[0];
      if (KNOWN_USERS[name]) return { text: `useradd: user ${name} already exists`, tone: 'err' };
      return MUT('');
    }
    case 'usermod':
    case 'userdel': {
      if (!KNOWN_USERS[a[0]]) return { text: `${p}: no such user ${a[0] || ''}`.trim(), tone: 'err' };
      return MUT('');
    }
    case 'groupadd': {
      if (KNOWN_GROUPS.has(a[0])) return { text: `groupadd: group '${a[0]}' already exists`, tone: 'err' };
      return MUT('');
    }
    case 'groupdel': {
      if (!KNOWN_GROUPS.has(a[0])) return { text: `groupdel: group '${a[0] || ''}' does not exist`, tone: 'err' };
      return MUT('');
    }
    case 'passwd': {
      if (a[0] && !KNOWN_USERS[a[0]]) return { text: `passwd: Unknown user name '${a[0]}'.`, tone: 'err' };
      return MUT('');
    }
    case 'id': {
      if (!a.length) return { text: 'uid=1000(student) gid=1000(student) 组=1000(student),10(wheel)', tone: 'out' };
      const u = KNOWN_USERS[a[0]];
      if (!u) return { text: `id: '${a[0]}': no such user`, tone: 'err' };
      return { text: `uid=${u.uid}(${a[0]}) gid=${u.gid}(${a[0]}) 组=${u.gid}(${a[0]})`, tone: 'out' };
    }

    case 'dnf': return simDnf(f, a, parsed.sub);
    case 'ip': return simIp(a, parsed.sub);
    case 'nmcli': return simNmcli(a, parsed.sub);

    case 'tar': return simTar(f, a);
    case 'gzip':
    case 'gunzip': {
      const target = resolvePath(a[0]);
      if (!entryOf(target)) return { text: `${p}: ${a[0]}: No such file or directory`, tone: 'err' };
      return MUT('');
    }

    case 'man': return simMan(f, a);
    default: return { text: '', tone: 'out' };
  }
}

/* ---------------- 各命令实现 ---------------- */
function notFound(cmd, orig) { return { text: `${cmd}: ${orig}: No such file or directory`, tone: 'err' }; }

function simLs(f, a) {
  if (f.dir) {
    const t = resolvePath(a[0] || '.');
    const e = entryOf(t);
    if (!e) return notFound('ls', a[0] || '.');
    return { text: f.long ? lsLongLine(a[0] || '.', e) : (a[0] || '.'), tone: 'out' };
  }
  const target = resolvePath(a[0] || '.');
  const e = entryOf(target);
  if (!e) return notFound('ls', a[0] || '.');
  if (e.type === 'file') return { text: f.long ? lsLongLine(a[0], e) : (a[0] || '.'), tone: 'out' };
  let names = listDir(target);
  const showAll = f.all, showAlmost = f['almost-all'];
  if (!showAll && !showAlmost) names = names.filter((n) => !n.startsWith('.'));
  names.sort();
  const rows = [];
  if (showAll) rows.push('.', '..');
  const lines = [];
  if (f.long) lines.push(`total ${rows.length * 8 + names.length * 8}`);
  for (const n of [...rows, ...names]) {
    const full = (target === '/' ? '' : target) + '/' + n;
    const en = entryOf(full);
    if (!en) continue;
    lines.push(f.long ? lsLongLine(n, en) : n);
  }
  return { text: f.long ? lines.join('\n') : (showAll ? [...rows, ...names].join('  ') : names.join('  ')), tone: 'out' };
}
function lsLongLine(name, e) {
  const m = e.meta;
  return `${permStr(m.mode, e.type === 'dir')}  1 ${m.owner} ${m.group} ${String(m.size).padStart(6)} ${m.mtime} ${name}`;
}

function simCat(f, a) {
  if (!a.length) return { text: '', tone: 'out' };
  const errs = [];
  for (const orig of a) {
    const e = entryOf(resolvePath(orig));
    if (!e) errs.push(`cat: ${orig}: No such file or directory`);
    else if (e.type === 'dir') errs.push(`cat: ${orig}: Is a directory`);
  }
  if (errs.length) return { text: errs[0], tone: 'err' };
  let text = a.map((o) => FILES[resolvePath(o)] ? FILES[resolvePath(o)].content : '').join('');
  if (text.endsWith('\n')) text = text.slice(0, -1);
  if (f.number) text = text.split('\n').map((l, i) => `${String(i + 1).padStart(6)}\t${l}`).join('\n');
  return { text, tone: 'out' };
}

function simHeadTail(p, f, a) {
  for (const orig of a) {
    const e = entryOf(resolvePath(orig));
    if (!e) return notFound(p, orig);
    if (e.type === 'dir') return { text: `${p}: ${orig}: Is a directory`, tone: 'err' };
  }
  const n = Number(f.lines || 10);
  let text = a.map((o) => FILES[resolvePath(o)]?.content || '').join('').replace(/\n$/, '');
  let lines = text.split('\n');
  lines = p === 'head' ? lines.slice(0, n) : lines.slice(-n);
  return { text: lines.join('\n'), tone: 'out' };
}

function simWc(f, a) {
  const errs = [];
  const rows = [];
  const want = [f.lines, f.words, f.bytes, f.chars];
  const any = want.some(Boolean);
  let tot = [0, 0, 0];
  for (const orig of a) {
    const e = entryOf(resolvePath(orig));
    if (!e) { errs.push(`${orig}: No such file or directory`); continue; }
    const content = FILES[resolvePath(orig)]?.content || '';
    const l = content === '' ? 0 : content.replace(/\n$/, '').split('\n').length;
    const w = content.split(/\s+/).filter(Boolean).length;
    const b = content.length;
    tot[0] += l; tot[1] += w; tot[2] += b;
    const cols = any ? [f.lines ? l : null, f.words ? w : null, f.bytes ? b : null, f.chars ? b : null].filter((v) => v !== null) : [l, w, b];
    rows.push(cols.map((c) => String(c).padStart(6)).join('') + ' ' + orig);
  }
  if (errs.length) return { text: `wc: ${errs[0]}`, tone: 'err' };
  if (a.length > 1) rows.push([tot[0], tot[1], tot[2]].map((c) => String(c).padStart(6)).join('') + ' 总计');
  return { text: rows.join('\n'), tone: 'out' };
}

function simGrep(f, a) {
  const pattern = a[0];
  const paths = a.slice(1);
  let re;
  try { re = new RegExp(pattern, f['ignore-case'] ? 'i' : ''); }
  catch { return { text: `grep: 无效的正则表达式: ${pattern}`, tone: 'err' }; }
  const files = [];
  for (const orig of paths) {
    const t = resolvePath(orig);
    const e = entryOf(t);
    if (!e) return notFound('grep', orig);
    if (e.type === 'dir') {
      if (!f.recursive) return { text: `grep: ${orig}: Is a directory（提示：搜索目录需要 -r 递归）`, tone: 'err' };
      files.push(...walkFiles(t));
    } else files.push(t);
  }
  const multi = files.length > 1;
  const out = [];
  let anyOut = false;
  for (const file of files) {
    const lines = linesOf(FILES[file].content);
    const hits = [];
    lines.forEach((line, i) => {
      const m = re.test(line);
      if (f['invert-match'] ? !m : m) hits.push([i + 1, line]);
    });
    if (f.count) {
      out.push(multi || f.recursive ? `${file}:${hits.length}` : String(hits.length));
      if (hits.length) anyOut = true;
      continue;
    }
    if (f['files-with-matches']) {
      if (hits.length) out.push(file);
      continue;
    }
    for (const [no, line] of hits) {
      const prefix = (multi || f.recursive ? file + ':' : '') + (f['line-number'] ? no + ':' : '');
      out.push(prefix + line);
      anyOut = true;
    }
  }
  return { text: out.join('\n') + (anyOut && !f.count && !f['files-with-matches'] && out.length ? '\n' : ''), tone: 'out' };
}

function simFind(f, a) {
  const start = resolvePath(a[0] || '.');
  if (!entryOf(start)) return { text: `find: '${a[0]}': No such file or directory`, tone: 'err' };
  const nameRe = f.name ? globToRegex(f.name, false) : (f.iname ? globToRegex(f.iname, true) : null);
  const maxDepth = f.maxdepth ? Number(f.maxdepth) : Infinity;
  const out = [];
  const visit = (dir, depth) => {
    if (depth > maxDepth) return;
    const e = entryOf(dir);
    if (e) out.push([dir, e]);
    if (e && e.type === 'dir') {
      for (const n of listDir(dir).sort()) visit((dir === '/' ? '' : dir) + '/' + n, depth + 1);
    }
  };
  visit(start, 0);
  const result = out.filter(([path, e]) => {
    if (nameRe && !nameRe.test(path.slice(path.lastIndexOf('/') + 1))) return false;
    if (f.type && !((f.type === 'd' && e.type === 'dir') || (f.type === 'f' && e.type === 'file'))) return false;
    if (f.user && e.meta.owner !== f.user) return false;
    return true;
  }).map(([path]) => path);
  return { text: result.join('\n'), tone: 'out' };
}

function simPs(f) {
  if (!f.all && !f.user && !f.e) {
    return { text: '    PID TTY          TIME CMD\n   4521 pts/0    00:00:00 bash\n   4587 pts/0    00:00:00 ps', tone: 'out' };
  }
  if (f.e || f.f) {
    const rows = [
      'root          1      0  0 09:12 ?        00:00:03 /usr/lib/systemd/systemd --switched-root --system',
      'root       1123      1  0 09:12 ?        00:00:01 /usr/sbin/sshd -D',
      'root       1180      1  0 09:12 ?        00:00:00 /usr/sbin/crond -n $CRONDARGS',
      'root       1201      1  0 09:12 ?        00:00:03 /usr/bin/firewalld --nofork --nopid',
      'student    4521   4519  0 10:02 pts/0    00:00:00 -bash',
      'student    4588   4521  0 10:12 pts/0    00:00:00 ps -ef',
    ];
    return { text: 'UID          PID    PPID  C STIME TTY          TIME CMD\n' + rows.join('\n'), tone: 'out' };
  }
  const rows = [
    'root        1123  0.0  0.1  15432  5216 ?        Ss   09:12   0:01 /usr/sbin/sshd -D',
    'root        1180  0.0  0.0   8320  3020 ?        Ss   09:12   0:00 /usr/sbin/crond -n $CRONDARGS',
    'root        1201  0.1  0.3 245120 12288 ?        Ssl  09:12   3:20 /usr/bin/firewalld --nofork --nopid',
    'root        1102  0.0  0.4 338944 18432 ?        Ssl  09:12   2:59 /usr/sbin/NetworkManager --no-daemon',
    'student     4521  0.0  0.1  22412  5124 pts/0    Ss   10:02   0:00 -bash',
    'student     4560  0.0  0.1  52104  6200 pts/0    R+   10:12   0:00 ps aux',
  ];
  return { text: 'USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n' + rows.join('\n'), tone: 'out' };
}

function simSystemctl(f, a, sub) {
  const unitName = (s) => (s || '').replace(/\.service$/, '');
  const unitOf = (orig) => {
    const u = UNITS[unitName(orig)];
    return u ? { name: unitName(orig), ...u } : null;
  };
  if (sub === 'status') {
    const u = unitOf(a[0]);
    if (!u) return { text: `Unit ${a[0]}.service could not be found.`, tone: 'err' };
    const dot = u.state.startsWith('active') ? '●' : '○';
    return {
      text: `${dot} ${u.name}.service - ${u.desc}\n     Loaded: loaded (${u.path}; ${u.enabled}; preset: disabled)\n     Active: ${u.state} since ${u.since}\n       Docs: man:sshd(8)\n   Main PID: ${u.pid}${u.pid ? ` (${u.name})` : ''}\n      Tasks: 1 (limit: 11234)\n     Memory: ${u.mem}\n        CPU: ${u.cpu}`,
      tone: 'out',
    };
  }
  if (sub === 'is-active') {
    const u = unitOf(a[0]);
    if (!u) return { text: 'inactive', tone: 'out' };
    return { text: u.state.startsWith('active') ? 'active' : 'inactive', tone: 'out' };
  }
  if (sub === 'is-enabled') {
    const u = unitOf(a[0]);
    if (!u) return { text: `Failed to query unit: Unit ${a[0]}.service could not be found.`, tone: 'err' };
    return { text: u.enabled, tone: 'out' };
  }
  if (sub === 'list-units') {
    const rows = Object.entries(UNITS).map(([n, u]) =>
      `  ${n}.service`.padEnd(30) + 'loaded  ' + u.state.replace(' (running)', '     ').replace(' (dead)', '      ').padEnd(9) + ' ' + u.desc);
    return { text: '  UNIT                         LOAD   ACTIVE   SUB     DESCRIPTION\n' + rows.join('\n'), tone: 'out' };
  }
  if (sub === 'list-unit-files') {
    const rows = Object.entries(UNITS).map(([n, u]) => `  ${n}.service`.padEnd(28) + u.enabled.padEnd(10) + 'disabled');
    return { text: 'UNIT FILE                  STATE     PRESET\n' + rows.join('\n') + '\n\n1 unit files listed.', tone: 'out' };
  }
  if (sub === 'enable' || sub === 'disable') {
    const u = unitOf(a[0]);
    if (!u) return { text: `Failed to ${sub} unit: Unit ${a[0]}.service could not be found.`, tone: 'err' };
    const link = `/etc/systemd/system/multi-user.target.wants/${u.name}.service`;
    return sub === 'enable'
      ? { text: `Created symlink '${link}' → '${u.path}'.`, tone: 'out', mutated: true }
      : { text: `Removed "${link}".`, tone: 'out', mutated: true };
  }
  if (sub === 'get-default') return { text: 'multi-user.target', tone: 'out' };
  if (sub === 'set-default')
    return { text: `Removed '/etc/systemd/system/default.target'.\nCreated '/etc/systemd/system/default.target' → '/usr/lib/systemd/system/${a[0]}'.`, tone: 'out', mutated: true };
  if (sub === 'daemon-reload') return { text: '', tone: 'out', mutated: true };
  /* start/stop/restart/reload */
  const u = unitOf(a[0]);
  if (!u) return { text: `Failed to ${sub} ${a[0]}.service: Unit ${a[0]}.service could not be found.`, tone: 'err' };
  return { text: '', tone: 'out', mutated: true };
}

function simDnf(f, a, sub) {
  if (sub === 'info') {
    const pkg = PKGS[a[0]];
    if (!pkg) return { text: `Error: Unable to find a match: ${a[0]}`, tone: 'err' };
    return {
      text: `Available Packages\nName            : ${a[0]}\nVersion         : ${pkg.version}\nRelease         : ${pkg.release}\nArchitecture    : ${pkg.arch}\nSize            : ${pkg.size}\nSource          : ${a[0]}-${pkg.version}-${pkg.release}.src.rpm\nRepository      : ${pkg.repo}\nSummary         : ${pkg.summary}\nURL             : ${pkg.url}\nLicense         : ${pkg.license}`,
      tone: 'out',
    };
  }
  if (sub === 'install' || sub === 'remove' || sub === 'update' || sub === 'upgrade') {
    for (const name of a) {
      if (!PKGS[name] && !INSTALLED.includes(name)) return { text: `Error: Unable to find a match: ${name}`, tone: 'err' };
    }
    const rows = a.map((n) => {
      const p = PKGS[n] || {};
      return ` ${sub === 'install' ? 'Installing' : sub === 'remove' ? 'Removing' : 'Upgrading'}:\n  ${n}    ${p.arch || 'x86_64'}    ${p.version || ''}-${p.release || ''}    ${p.repo || '@system'}    ${p.size || ''}`;
    }).join('\n');
    const verb = sub === 'install' ? 'Installed' : sub === 'remove' ? 'Removed' : 'Upgraded';
    return { text: `Dependencies resolved.\n================================================================================\n${rows}\n\nTransaction Summary\n================================================================================\n${verb}:\n  ${a.join(', ')}\n\nComplete!`, tone: 'out', mutated: true };
  }
  if (sub === 'list') {
    if (a[0] === 'installed') {
      const rows = INSTALLED.map((n) => `  ${n}.${PKGS[n]?.arch || 'noarch'}`.padEnd(28) + `${PKGS[n] ? PKGS[n].version + '-' + PKGS[n].release : '1.0-1.el10'}`.padEnd(22) + '@system');
      return { text: '已安装的软件包\n' + rows.join('\n'), tone: 'out' };
    }
    const rows = Object.entries(PKGS).map(([n, p]) => `  ${n}.${p.arch}`.padEnd(28) + `${p.version}-${p.release}`.padEnd(22) + p.repo);
    return { text: '可用的软件包\n' + rows.join('\n'), tone: 'out' };
  }
  if (sub === 'search') {
    const hits = Object.entries(PKGS).filter(([n, p]) => a.some((k) => n.includes(k) || p.summary.toLowerCase().includes((k || '').toLowerCase())));
    if (!hits.length) return { text: `No matches found for: ${a.join(' ')}`, tone: 'out' };
    return { text: hits.map(([n, p]) => `===== Matched: ${n} =====\n${n} : ${p.summary}`).join('\n'), tone: 'out' };
  }
  if (sub === 'provides') {
    return { text: `${a[0]} : 提供该文件的软件包\n  ${a[0].includes('/') ? a[0] : '/usr/bin/' + a[0]} : ${PKGS[a[0]] ? a[0] + '-' + PKGS[a[0]].version : '（示例输出）'}`, tone: 'out' };
  }
  return { text: '', tone: 'out' };
}

function simIp(a, sub) {
  const devFilter = a[0];
  if (sub === 'addr') {
    const blocks = {
      lo: '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n    inet 127.0.0.1/8 scope host lo\n       valid_lft forever preferred_lft forever',
      eth0: '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000\n    link/ether 52:54:00:a1:b2:c3 brd ff:ff:ff:ff:ff:ff\n    altname enp0s3\n    inet 192.168.56.10/24 brd 192.168.56.255 scope global noprefixroute eth0\n       valid_lft forever preferred_lft forever',
    };
    if (devFilter && !blocks[devFilter]) return { text: `Device "${devFilter}" does not exist.`, tone: 'err' };
    const keys = devFilter ? [devFilter] : ['lo', 'eth0'];
    return { text: keys.map((k) => blocks[k]).join('\n'), tone: 'out' };
  }
  if (sub === 'link') {
    return {
      text: '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default qlen 1000',
      tone: 'out',
    };
  }
  return {
    text: 'default via 192.168.56.1 dev eth0 proto static metric 100\n172.17.0.0/16 dev docker0 proto kernel scope link src 172.17.0.1 linkdown\n192.168.56.0/24 dev eth0 proto kernel scope link src 192.168.56.10 metric 100',
    tone: 'out',
  };
}

function simNmcli(a, sub) {
  if (sub === 'device') {
    if (a[0] === 'show') {
      return { text: 'GENERAL.DEVICE:  eth0\nGENERAL.TYPE:    ethernet\nGENERAL.STATE:   100 (connected)\nGENERAL.CONNECTION: eth0', tone: 'out' };
    }
    return {
      text: 'DEVICE  TYPE      STATE                  CONNECTION\neth0    ethernet  connected              eth0\nlo      loopback  connected (externally)  lo',
      tone: 'out',
    };
  }
  return {
    text: 'NAME    UUID                                  TYPE      DEVICE\neth0    3f8c2b1a-9d4e-4f60-b5a2-6c7d8e9f0a1b  ethernet  eth0\nlo      8a1b2c3d-4e5f-4a5b-8c9d-0e1f2a3b4c5d  loopback  lo',
    tone: 'out',
  };
}

const TAR_MEMBERS = {
  scripts: ['home/student/scripts/', 'home/student/scripts/backup.sh', 'home/student/scripts/sysinfo.sh', 'home/student/scripts/deploy.sh'],
  backup: ['home/student/scripts/', 'home/student/scripts/backup.sh', 'home/student/scripts/sysinfo.sh', 'home/student/scripts/deploy.sh'],
  docs: ['home/student/docs/', 'home/student/docs/rhcsa-plan.md', 'home/student/docs/linux-notes.md'],
};
function tarKind(archive) {
  for (const k of Object.keys(TAR_MEMBERS))
    if (archive.includes(k)) return k;
  return null;
}
function simTar(f, a) {
  const archive = f.f || '';
  if (f.c) {
    const lines = ['tar: Removing leading `/\' from member names'];
    if (f.v) {
      for (const p of a) {
        const t = resolvePath(p);
        if (entryOf(t)?.type === 'dir') lines.push(...walkFiles(t).map((x) => x.replace(/^\//, '')));
        else lines.push(t.replace(/^\//, ''));
      }
    }
    lines.push(`（模拟输出）已创建归档 ${archive}`);
    return { text: lines.join('\n'), tone: 'out', mutated: true };
  }
  if (f.t) {
    const kind = tarKind(archive);
    if (!kind) return { text: `tar: ${archive}: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now`, tone: 'err' };
    return { text: TAR_MEMBERS[kind].join('\n'), tone: 'out' };
  }
  if (f.x) {
    const kind = tarKind(archive);
    if (!kind) return { text: `tar: ${archive}: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now`, tone: 'err' };
    return { text: `（模拟输出）${f.v ? TAR_MEMBERS[kind].join('\n') + '\n' : ''}已解包到 ${f.C || HOME}；演示环境不保留变更`, tone: 'out', mutated: true };
  }
  return { text: '', tone: 'out' };
}

function simMan(f, a) {
  if (f.apropos) {
    const kw = a[0] || '';
    const hits = Object.entries(MAN_PAGES).filter(([n, p]) => n.includes(kw) || p.name.includes(kw));
    return { text: hits.map(([n, p]) => `${n} (${p.sections.join(', ')})          - ${p.name}`).join('\n') || ` Nothing appropriate.`, tone: 'out' };
  }
  let page = a[0];
  let section = null;
  if (a.length === 2 && /^\d[a-z]*$/.test(a[0])) { section = a[0]; page = a[1]; }
  const doc = MAN_PAGES[page];
  if (!doc) return { text: `No manual entry for ${page}`, tone: 'err' };
  if (section && !doc.sections.includes(Number(section[0]))) return { text: `No manual entry for ${page} in section ${section}`, tone: 'err' };
  const head = `${page.toUpperCase()}(${doc.sections[0]})`;
  return {
    text: `${head}\n\nNAME\n       ${page} - ${doc.name}\n\nSYNOPSIS\n       ${doc.syn}\n\nDESCRIPTION\n       （模拟手册节选，完整内容用 man ${page} 在真实环境查看）`,
    tone: 'out',
  };
}
