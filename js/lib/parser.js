/* Linux/shell 命令解析与正确性校验（纯函数模块，浏览器与 Node 通用）
 * 覆盖学习场景常用程序与旗标，用于语法与用法判断；并非全量 shell 复刻。
 * 支持清单见 docs/content-contract.md 的"解析器支持清单"。 */

function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

/* 交互式/未覆盖程序：给出针对性解释而不是笼统的"不支持" */
const INTERACTIVE = new Set(['vim', 'vi', 'nano', 'less', 'more', 'top', 'htop', 'lesspipe', 'watch']);
const KNOWN_UNCOVERED = new Set(['rpm', 'firewall-cmd', 'journalctl', 'semanage', 'restorecon', 'lsblk', 'fdisk', 'parted', 'pvcreate', 'vgcreate', 'lvcreate', 'mkfs.xfs', 'mount', 'umount', 'df', 'du', 'crontab', 'at', 'ssh', 'scp', 'getfacl', 'setfacl', 'chattr', 'authconfig', 'nmcli_setup', 'tidy']);

/* ---------------- 程序与旗标定义 ---------------- */
/* 每个程序: [简写, 长名, 类型]；类型：bool / str / uint / value-opt（如 sed -i.bak） */
const PROGRAMS = {
  ls: { flags: [['a', 'all', 'bool'], ['A', 'almost-all', 'bool'], ['l', 'long', 'bool'], ['h', 'human-readable', 'bool'], ['d', 'dir', 'bool']] },
  cat: { flags: [['n', 'number', 'bool'], ['A', 'show-all', 'bool']] },
  head: { flags: [['n', 'lines', 'uint'], ['c', 'bytes', 'uint']], dashNumber: 'lines' },
  tail: { flags: [['n', 'lines', 'uint'], ['c', 'bytes', 'uint'], ['f', 'follow', 'bool']], dashNumber: 'lines' },
  wc: { flags: [['l', 'lines', 'bool'], ['w', 'words', 'bool'], ['c', 'bytes', 'bool'], ['m', 'chars', 'bool']] },
  cp: { flags: [['r', 'recursive', 'bool'], ['R', 'recursive', 'bool'], ['a', 'archive', 'bool'], ['i', 'interactive', 'bool'], ['v', 'verbose', 'bool'], ['p', 'preserve', 'bool'], ['f', 'force', 'bool']] },
  mv: { flags: [['i', 'interactive', 'bool'], ['f', 'force', 'bool'], ['n', 'no-clobber', 'bool'], ['v', 'verbose', 'bool']] },
  rm: { flags: [['r', 'recursive', 'bool'], ['R', 'recursive', 'bool'], ['f', 'force', 'bool'], ['i', 'interactive', 'bool'], ['v', 'verbose', 'bool']] },
  mkdir: { flags: [['p', 'parents', 'bool'], ['m', 'mode', 'str'], ['v', 'verbose', 'bool']] },
  rmdir: { flags: [['p', 'parents', 'bool']] },
  touch: { flags: [['c', 'no-create', 'bool'], ['a', 'time', 'bool'], ['m', 'time', 'bool']] },
  ln: { flags: [['s', 'symbolic', 'bool'], ['f', 'force', 'bool'], ['v', 'verbose', 'bool']] },
  chmod: { flags: [['R', 'recursive', 'bool'], ['v', 'verbose', 'bool']] },
  chown: { flags: [['R', 'recursive', 'bool'], ['v', 'verbose', 'bool']] },
  umask: { flags: [['S', 'symbolic', 'bool']] },
  grep: { flags: [['i', 'ignore-case', 'bool'], ['v', 'invert-match', 'bool'], ['n', 'line-number', 'bool'], ['r', 'recursive', 'bool'], ['R', 'recursive', 'bool'], ['c', 'count', 'bool'], ['E', 'extended-regexp', 'bool'], ['l', 'files-with-matches', 'bool'], ['w', 'word-regexp', 'bool']] },
  find: { flags: [[null, 'name', 'str'], [null, 'iname', 'str'], [null, 'type', 'str'], [null, 'maxdepth', 'uint'], [null, 'user', 'str']], dashLong: true },
  sed: { flags: [['n', 'quiet', 'bool'], ['i', 'in-place', 'value-opt'], ['E', 'extended', 'bool'], ['r', 'extended', 'bool']] },
  awk: { flags: [['F', 'field-separator', 'str'], ['f', 'file', 'str']] },
  ps: { flags: [['a', 'all', 'bool'], ['u', 'user', 'bool'], ['x', 'without-tty', 'bool'], ['e', 'e', 'bool'], ['f', 'f', 'bool']], noDash: true },
  kill: { flags: [['s', 'signal', 'str'], ['l', 'list', 'bool']] },
  systemctl: { flags: [[null, 'now', 'bool'], ['a', 'all', 'bool'], [null, 'no-pager', 'bool']], subs: ['start', 'stop', 'restart', 'reload', 'status', 'enable', 'disable', 'is-active', 'is-enabled', 'list-units', 'list-unit-files', 'daemon-reload', 'get-default', 'set-default'] },
  useradd: { flags: [['m', 'create-home', 'bool'], ['s', 'shell', 'str'], ['G', 'groups', 'str'], ['u', 'uid', 'uint'], ['c', 'comment', 'str'], ['d', 'home', 'str'], ['M', 'no-create-home', 'bool'], ['r', 'system', 'bool']] },
  usermod: { flags: [['a', 'append', 'bool'], ['G', 'groups', 'str'], ['s', 'shell', 'str'], ['L', 'lock', 'bool'], ['U', 'unlock', 'bool'], ['c', 'comment', 'str'], ['d', 'home', 'str'], ['m', 'move-home', 'bool']] },
  userdel: { flags: [['r', 'remove', 'bool'], ['f', 'force', 'bool']] },
  groupadd: { flags: [['g', 'gid', 'uint'], ['f', 'force', 'bool']] },
  groupdel: { flags: [] },
  passwd: { flags: [['e', 'expire', 'bool'], ['d', 'delete', 'bool'], ['l', 'lock', 'bool'], ['u', 'unlock', 'bool']] },
  id: { flags: [['u', 'user', 'bool'], ['g', 'group', 'bool'], ['n', 'name', 'bool']] },
  su: { flags: [[null, 'login', 'bool']] },
  dnf: { flags: [['y', 'assumeyes', 'bool'], ['q', 'quiet', 'bool'], ['C', 'cacheonly', 'bool']], subs: ['install', 'remove', 'update', 'upgrade', 'info', 'list', 'search', 'provides'] },
  ip: { flags: [['4', 'ipv4', 'bool'], ['6', 'ipv6', 'bool']], subs: ['addr', 'link', 'route'] },
  nmcli: { flags: [], subs: ['device', 'connection'] },
  tar: { flags: [['c', 'c', 'bool'], ['x', 'x', 'bool'], ['t', 't', 'bool'], ['z', 'z', 'bool'], ['j', 'j', 'bool'], ['J', 'J', 'bool'], ['v', 'v', 'bool'], ['f', 'f', 'str'], ['C', 'C', 'str'], [null, 'exclude', 'str']], noDash: true },
  gzip: { flags: [['k', 'keep', 'bool'], ['d', 'decompress', 'bool'], ['v', 'verbose', 'bool'], ['9', 'best', 'bool']] },
  gunzip: { flags: [['k', 'keep', 'bool'], ['v', 'verbose', 'bool']] },
  man: { flags: [['k', 'apropos', 'bool'], ['a', 'all', 'bool']] },
  echo: { flags: [['n', 'n', 'bool'], ['e', 'e', 'bool']] },
  whoami: { flags: [] },
  hostname: { flags: [['f', 'fqdn', 'bool']] },
  pwd: { flags: [['P', 'physical', 'bool']] },
  date: { flags: [[null, 'utc', 'bool'], ['R', 'rfc', 'bool']] },
  history: { flags: [['c', 'clear', 'bool']] },
  clear: { flags: [] },
};
const PROGRAM_NAMES = Object.keys(PROGRAMS);
const IP_SUB_ALIAS = { a: 'addr', address: 'addr', addr: 'addr', l: 'link', link: 'link', r: 'route', route: 'route' };
const SIGNALS = { 1: 'HUP', 2: 'INT', 3: 'QUIT', 9: 'KILL', 15: 'TERM', 10: 'USR1', 12: 'USR2', 18: 'CONT', 19: 'STOP' };
const SIGNAL_NAMES = new Set([...Object.values(SIGNALS), 'SEGV', 'PIPE', 'ALRM', 'TSTP', 'TTIN', 'TTOU']);

/* ---------------- 词法 ---------------- */
function tokenize(line) {
  const out = [];
  let cur = '', quote = null;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null; else cur += ch;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/* ---------------- 主解析 ---------------- */
export function parseCommand(line) {
  const r = {
    raw: line, program: null, sudo: false, sub: null, flags: {}, positionals: [],
    errors: [], warnings: [], suggestions: [], ok: false,
  };
  const err = (message, hint = '') => r.errors.push({ code: 'ERR', message, hint });
  let tokens = tokenize(line);
  if (!tokens.length) { err('命令为空。试试：ls -l /etc'); return r; }

  /* sudo 前缀 */
  if (tokens[0] === 'sudo' || tokens[0] === 'doas') {
    tokens = tokens.slice(1);
    r.sudo = true;
    while (tokens.length && /^-(i|s|login|shell|u|g)$|^--(login|shell|user|group)$/.test(tokens[0])) {
      if (/^-(i|s|login|shell)$|^--(login|shell)$/.test(tokens[0])) {
        err('sudo -i / sudo -s 会启动交互式 shell，练习场不支持；请直接输入 sudo <命令>。');
        return r;
      }
      if (tokens[0] === '-u' || tokens[0] === '--user') tokens.splice(0, 2);
      else tokens.splice(0, 1);
    }
    if (tokens[0] === 'su' && (tokens[1] === '-' || tokens[1] === '-l')) tokens.splice(0, 2);
    if (!tokens.length) {
      err('sudo 后面需要跟要执行的命令。示例：sudo systemctl restart sshd');
      r.suggestions.push('sudo systemctl restart sshd');
      return r;
    }
  }

  const program = tokens[0].toLowerCase();
  if (INTERACTIVE.has(program)) {
    err(`${program} 是交互式程序，练习场无法模拟。请在真实环境练习；本站课程中有它的图文讲解。`);
    return r;
  }
  if (KNOWN_UNCOVERED.has(program)) {
    err(`目前练习场不支持 "${tokens[0]}"（超出覆盖范围）。支持列表见命令速查表；该命令在课程正文中有讲解。`);
    return r;
  }
  if (!PROGRAMS[program]) {
    const near = PROGRAM_NAMES.map((p) => [editDistance(program, p), p]).sort((a, b) => a[0] - b[0])[0];
    err(`目前练习场不支持 "${tokens[0]}"。` + (near && near[0] <= 2 ? `你是不是想用 "${near[1]}"？` : '支持列表见命令速查表。'));
    if (near && near[0] <= 2) r.suggestions.push(near[1] + ' --help');
    return r;
  }
  r.program = program;
  const spec = PROGRAMS[program];
  const shorts = {}; const longs = {};
  for (const [sh, long, type] of spec.flags) {
    longs[long] = type;
    if (sh) shorts[sh] = long;
  }

  const positionals = [];
  let i = 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === '--') { positionals.push(...tokens.slice(i + 1)); break; }
    if (t === '-' && program === 'su') { r.flags.login = true; i++; continue; }
    if (t === '-') { positionals.push(t); i++; continue; }
    if (t === '--help' || (t === '-h' && !('h' in shorts))) { r.flags.help = true; i++; continue; }
    /* head/tail 旧式 -N 与 kill 数字信号 */
    if (spec.dashNumber && /^-\d+$/.test(t)) { r.flags[spec.dashNumber] = t.slice(1); i++; continue; }
    if (program === 'kill' && /^-\d+$/.test(t)) {
      const name = SIGNALS[t.slice(1)];
      if (!name) { err(`kill: 未知信号 "${t}"。常用：-15 (TERM)、-9 (KILL)、-1 (HUP)`); return r; }
      r.flags.signal = name; i++; continue;
    }
    if (program === 'kill' && /^-SIG[A-Za-z]+$|^-?[A-Z]{2,}$/.test(t)) {
      const name = t.replace(/^-SIG/, '').replace(/^-/, '');
      if (!SIGNAL_NAMES.has(name)) { err(`kill: 未知信号 "${t}"。常用：TERM、KILL、HUP`); return r; }
      r.flags.signal = name; i++; continue;
    }
    if (t.startsWith('--')) {
      const eq = t.indexOf('=');
      const name = t.slice(2, eq > -1 ? eq : undefined);
      if (!(name in longs)) {
        const keys = Object.keys(longs).filter((k) => k.length > 1 || program === 'ps');
        const near = keys.map((k) => [editDistance(name, k), k]).sort((a, b) => a[0] - b[0])[0];
        err(`未知的旗标 --${name}。` + (near && near[0] <= 2 ? `你是不是想输入 --${near[1]}？` : `"${program}" 的常用旗标：${keys.slice(0, 8).join(', ') || '（无）'}`));
        return r;
      }
      const type = longs[name];
      let value;
      if (eq > -1) value = t.slice(eq + 1);
      else if (type === 'bool') value = true;
      else { if (i + 1 >= tokens.length) { err(`旗标 --${name} 需要一个值`); return r; } value = tokens[++i]; }
      const vErr = checkValue(name, type, value);
      if (vErr) { err(vErr); return r; }
      r.flags[name] = value;
      i++;
      continue;
    }
    if (t.startsWith('-') && t.length > 1) {
      /* find 风格：单横线长名选项（-name 值） */
      if (spec.dashLong) {
        const eq = t.indexOf('=');
        const name = t.slice(1, eq > -1 ? eq : undefined);
        if (name in longs) {
          const type = longs[name];
          let value;
          if (eq > -1) value = t.slice(eq + 1);
          else { if (i + 1 >= tokens.length) { err(`选项 -${name} 需要一个值`); return r; } value = tokens[++i]; }
          const vErr = checkValue(name, type, value);
          if (vErr) { err(vErr); return r; }
          r.flags[name] = value;
          i++;
          continue;
        }
      }
      const chars = t.slice(1).split('');
      let ci = 0;
      for (; ci < chars.length; ci++) {
        const c = chars[ci];
        const long = shorts[c];
        if (!long) { err(`未知的旗标 -${c}。" ${program}" 的简写旗标：${Object.keys(shorts).map((s) => '-' + s).join(' ') || '（无）'}`); return r; }
        const type = longs[long];
        if (type === 'bool') { r.flags[long] = true; continue; }
        let value;
        const tail = chars.slice(ci + 1).join('');
        if (tail) value = tail.replace(/^=/, '');
        else { if (i + 1 >= tokens.length) { err(`旗标 -${c} 需要一个值`); return r; } value = tokens[++i]; }
        const vErr = checkValue(long, type, value);
        if (vErr) { err(vErr); return r; }
        r.flags[long] = value;
        break;
      }
      i++;
      continue;
    }
    /* ps/tar 的无横线组合风格：aux、czf */
    if (spec.noDash && /^[a-zA-Z]+$/.test(t) && !r.sub && !positionals.length && !r._noDashUsed) {
      let used = false;
      for (const c of t.split('')) {
        const long = shorts[c];
        if (!long) break;
        const type = longs[long];
        if (type === 'bool') { r.flags[long] = true; used = true; continue; }
        if (i + 1 >= tokens.length) { err(`参数 -${c} 需要一个值`); return r; }
        const vErr = checkValue(long, type, tokens[++i]);
        if (vErr) { err(vErr); return r; }
        r.flags[long] = tokens[i];
        used = true;
        break;
      }
      if (used) { r._noDashUsed = true; i++; continue; }
    }
    positionals.push(t);
    i++;
  }

  /* 子命令 */
  if (spec.subs) {
    const tok = positionals.shift();
    if (!tok) {
      err(`${program} 需要子命令（${program === 'nmcli' ? '对象' : '操作'}）。可选：${spec.subs.join(' / ')}`);
      return r;
    }
    let s = tok.toLowerCase();
    if (program === 'ip') s = IP_SUB_ALIAS[s];
    if (!s || !spec.subs.includes(s)) {
      err(`缺少有效的子命令："${tok}" 不是 ${program} 的有效${program === 'nmcli' ? '对象' : '操作'}。可选：${spec.subs.join(' / ')}`);
      return r;
    }
    r.sub = s;
  }
  r.positionals = positionals;

  const pErr = validate(r, spec);
  if (pErr) { err(pErr); return r; }

  r.ok = r.errors.length === 0;
  return r;
}

function checkValue(name, type, value) {
  if (type === 'bool') return null;
  if (value === undefined || value === '') return `旗标 --${name} 需要一个非空值`;
  if (type === 'uint' && !/^\d+$/.test(value)) return `旗标 -${name.length === 1 ? name : '-' + name} 需要一个非负整数（收到 "${value}"）`;
  return null;
}

const OCTAL_MODE = /^[0-7]{3,4}$/;
const SYMBOL_MODE = /^([ugoa]*[+\-=][rwxstX]+)(,([ugoa]*[+\-=][rwxstX]+))*$/;
const OWNER_RE = /^[A-Za-z_][\w.-]*([:.][A-Za-z_][\w.-]*)?$/;
const PKG_RE = /^[A-Za-z0-9][\w.+*-]*$/;

/* 按程序做位置参数校验；返回错误消息或 null */
function validate(r) {
  if (r.flags.help) return null;
  const p = r.program;
  const args = r.positionals;
  const needFiles = (n, what) => (args.length < n ? what : null);

  switch (p) {
    case 'cp': return needFiles(2, 'cp 需要 <源> 和 <目标> 两个参数。示例：cp -r 源目录 目标目录');
    case 'mv': return needFiles(2, 'mv 需要 <源> 和 <目标> 两个参数。示例：mv 旧名 新名');
    case 'rm': {
      if (!args.length) return 'rm 需要至少一个文件或目录参数';
      if (args.includes('/') && r.flags.recursive) r.warnings.push('危险：rm -rf / 会删除整个系统，真实环境绝不能执行（这里只是提醒）');
      return null;
    }
    case 'mkdir': return args.length ? null : 'mkdir 需要至少一个目录参数。示例：mkdir -p /opt/app/logs';
    case 'rmdir': return args.length ? null : 'rmdir 需要至少一个目录参数';
    case 'touch': return args.length ? null : 'touch 需要至少一个文件参数';
    case 'ln': return args.length === 2 ? null : 'ln 需要 <目标> 和 <链接名> 两个参数。示例：ln -s /etc/hosts /tmp/hosts-link';
    case 'chmod': {
      if (args.length < 2) return '用法：chmod <模式> <文件>...。模式如 640、u+x、go-rwx';
      const mode = args[0];
      if (!OCTAL_MODE.test(mode) && !SYMBOL_MODE.test(mode))
        return `权限模式 "${mode}" 不合法。八进制如 640；符号模式如 u+x、go=r、a+X`;
      return null;
    }
    case 'chown': {
      if (args.length < 2) return '用法：chown <属主[:组]> <文件>...。示例：chown student:student /home/student/notes.txt';
      if (!OWNER_RE.test(args[0])) return `属主格式 "${args[0]}" 不合法。应为 用户、用户:组 或 用户.组`;
      return null;
    }
    case 'umask': {
      if (args.length > 1) return 'umask 只接受一个掩码参数';
      if (args.length === 1 && !OCTAL_MODE.test(args[0]))
        return `umask 掩码 "${args[0]}" 需要是 3~4 位八进制数（如 022、027）`;
      return null;
    }
    case 'grep': return args.length >= 2 ? null : 'grep 需要 <模式> 和至少一个 <文件> 参数。示例：grep -n root /etc/passwd';
    case 'sed': {
      if (args.length < 2) return 'sed 需要 <脚本> 和至少一个 <文件> 参数。示例：sed \'s/old/new/g\' file';
      const script = args[0];
      if (script.startsWith('s')) {
        const d = script[1];
        if (!d || /[\w\s]/.test(d)) return `sed 替换表达式 "${script}" 不合法，应为 s/旧/新/[g] 形式`;
        if (script.split(d).length < 4) return `sed 替换表达式 "${script}" 不完整，应为 s${d}旧${d}新${d}[g] 形式`;
      } else if (!/^(\/.*\/|\d+|\d+,\d+|\$|\d+\$|,[\d$]+)?[pPdD]$/.test(script)) {
        return `暂不支持 sed 脚本 "${script}"。练习场覆盖 s/替换 与 行区间p/d 常用法`;
      }
      return null;
    }
    case 'awk': {
      if (args.length < 2) return `awk 需要 <脚本> 和至少一个 <文件> 参数。脚本形如 '{print $1}'`;
      if (!args[0].includes('{') || !args[0].includes('}'))
        return `awk 脚本应形如 '{print $1}'（用花括号包住动作）`;
      return null;
    }
    case 'kill': {
      if (!args.length) return 'kill 需要 PID 参数。示例：kill -9 1234';
      if (!r.flags.list && args.some((a) => !/^\d+$/.test(a))) return `kill 的参数应是数字 PID（收到 "${args.find((a) => !/^\d+$/.test(a))}"）`;
      return null;
    }
    case 'systemctl': {
      const s = r.sub;
      if (['start', 'stop', 'restart', 'reload', 'status', 'enable', 'disable', 'is-active', 'is-enabled'].includes(s) && !args.length)
        return `systemctl ${s} 需要单元名。示例：systemctl ${s} sshd`;
      if (s === 'set-default') {
        if (!args.length) return 'systemctl set-default 需要 target 名称（如 multi-user.target）';
        if (!args[0].endsWith('.target')) return `target 名称应以 .target 结尾（收到 "${args[0]}"）。常用：multi-user.target、graphical.target`;
      }
      return null;
    }
    case 'useradd': return args.length >= 1 ? null : 'useradd 需要用户名。示例：sudo useradd -m -s /bin/bash dev1';
    case 'usermod':
    case 'userdel':
    case 'groupdel':
      return args.length >= 1 ? null : `${p} 需要 ${p === 'groupdel' ? '组名' : '用户名'}参数`;
    case 'groupadd': return args.length >= 1 ? null : 'groupadd 需要组名。示例：sudo groupadd -g 1500 ops';
    case 'passwd': return null;
    case 'su': return null;
    case 'dnf': {
      const s = r.sub;
      if (['install', 'remove', 'info', 'provides', 'update', 'upgrade'].includes(s) && !args.length)
        return `dnf ${s} 需要软件包名。示例：dnf ${s} tmux`;
      if (['install', 'remove', 'update', 'upgrade', 'info'].includes(s)) {
        for (const a of args)
          if (!PKG_RE.test(a)) return `"${a}" 不是合法的软件包名。示例：tmux、vim-enhanced`;
      }
      return null;
    }
    case 'ip': {
      /* show/dev 处理：跳过 show，dev 吞掉下一个参数 */
      const rest = [];
      for (let k = 0; k < args.length; k++) {
        if (args[k] === 'show') continue;
        if (args[k] === 'dev') { k++; if (k < args.length) rest.push(args[k]); continue; }
        rest.push(args[k]);
      }
      r.positionals = rest;
      return null;
    }
    case 'nmcli': {
      const ok = (r.sub === 'device' && (!args.length || args[0] === 'status' || args[0] === 'show'))
        || (r.sub === 'connection' && (!args.length || args[0] === 'show'));
      if (!ok) return '练习场仅支持只读查看：nmcli device status、nmcli connection show（配置修改请在真实环境用 nmcli con mod 练习）';
      return null;
    }
    case 'tar': {
      const ops = ['c', 'x', 't'].filter((o) => r.flags[o]);
      if (!ops.length) return 'tar 需要一个操作：-c 创建 / -x 解包 / -t 列表';
      if (ops.length > 1) return '不能同时指定多个操作（-c / -x / -t 选其一）';
      if (r.flags.z && r.flags.j) return '压缩格式只能选一个：-z (gzip) 或 -j (bzip2) 或 -J (xz)';
      if (!r.flags.f) return 'tar 需要 -f <归档文件> 指定归档名。示例：tar -czf backup.tar.gz 目录';
      if (r.flags.c && !args.length) return 'tar -c 需要至少一个要打包的路径。示例：tar -czf backup.tar.gz /home/student/scripts';
      return null;
    }
    case 'gzip':
    case 'gunzip': return args.length ? null : `${p} 需要至少一个文件参数`;
    case 'man': {
      if (!args.length) return 'man 需要手册页名。示例：man ls、man 5 crontab';
      if (args.length > 2) return 'man 最多接受 [分节号] 和 页名 两个参数';
      return null;
    }
    case 'cat':
    case 'head':
    case 'tail':
    case 'wc':
      if (!args.length) r.warnings.push(`${p} 未指定文件：真实 shell 会在此等待标准输入（Ctrl+D 结束）`);
      return null;
    case 'whoami':
    case 'hostname':
    case 'pwd':
    case 'date':
    case 'history':
    case 'clear':
      if (args.length) r.warnings.push(`${p} 不需要参数（收到的参数将被忽略）`);
      return null;
    default:
      return null;
  }
}
