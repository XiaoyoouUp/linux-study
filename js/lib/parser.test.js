import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from './parser.js';

function ok(line, expect = {}) {
  const r = parseCommand(line);
  const msgs = r.errors.map((e) => e.message).join(' | ');
  assert.equal(r.ok, true, `expected OK for "${line}", got errors: ${msgs}`);
  if (expect.program !== undefined) assert.equal(r.program, expect.program, `program of "${line}"`);
  if (expect.sub !== undefined) assert.equal(r.sub, expect.sub, `sub of "${line}"`);
  if (expect.positionals !== undefined)
    assert.deepEqual(r.positionals, expect.positionals, `positionals of "${line}" (got ${JSON.stringify(r.positionals)})`);
  if (expect.flag !== undefined) {
    for (const [k, v] of Object.entries(expect.flag))
      assert.deepEqual(r.flags[k], v, `flag ${k} of "${line}" (got ${JSON.stringify(r.flags[k])})`);
  }
  if (expect.sudo !== undefined) assert.equal(r.sudo, expect.sudo, `sudo of "${line}"`);
  if (expect.warning) assert.ok(r.warnings.length > 0, `expected warning for "${line}"`);
  return r;
}

function fail(line, msgPart) {
  const r = parseCommand(line);
  assert.equal(r.ok, false, `expected errors for "${line}"`);
  if (msgPart) assert.ok(r.errors.some((e) => e.message.includes(msgPart)),
    `expected error mentioning "${msgPart}", got: ${JSON.stringify(r.errors)}`);
  return r;
}

/* ---------- 基础与词法 ---------- */
test('简单命令与参数', () => ok('ls /etc', { program: 'ls', positionals: ['/etc'] }));
test('引号保留为单个参数', () => ok('echo "hello world"', { program: 'echo', positionals: ['hello world'] }));
test('单引号同样保留', () => ok("grep 'ssh password' /var/log/secure", { program: 'grep', positionals: ['ssh password', '/var/log/secure'] }));
test('sudo 前缀被剥离并标记', () => ok('sudo mkdir /tmp/demo', { program: 'mkdir', sudo: true, positionals: ['/tmp/demo'] }));
test('sudo 单独出现报错并提示', () => {
  const r = fail('sudo', '');
  assert.ok(r.suggestions.length > 0);
});
test('空命令', () => fail('  ', ''));
test('不支持的程序', () => fail('apt install x', '支持'));
test('交互式命令给出解释', () => fail('vim /etc/hosts', '交互'));
test('未知程序给出相近建议', () => {
  const r = fail('grpe ssh /etc/hosts', '支持');
  assert.ok(r.suggestions.some((s) => s.includes('grep')));
});

/* ---------- ls / cat / head / tail / wc ---------- */
test('ls 组合短旗标 -lah', () => ok('ls -lah /etc', { program: 'ls', flag: { all: true, long: true, 'human-readable': true } }));
test('ls 长旗标 --all', () => ok('ls --all /var/log', { flag: { all: true } }));
test('ls 无参数使用当前目录', () => ok('ls', { program: 'ls', positionals: [] }));
test('cat -n 显示行号', () => ok('cat -n /etc/hostname', { flag: { number: true } }));
test('cat 无文件给警告', () => ok('cat', { warning: true }));
test('head -n 数值', () => ok('head -n 5 /var/log/messages', { flag: { lines: '5' } }));
test('head 旧式 -5', () => ok('head -5 /var/log/messages', { flag: { lines: '5' } }));
test('head -n 非数字报错', () => fail('head -n abc /var/log/messages', '整数'));
test('tail -n 20', () => ok('tail -n 20 /var/log/secure', { flag: { lines: '20' } }));
test('wc -l', () => ok('wc -l /etc/passwd', { flag: { lines: true } }));

/* ---------- cp / mv / rm / mkdir / touch / ln ---------- */
test('cp 需要源和目标', () => fail('cp /etc/hosts', '源'));
test('cp -r 合法', () => ok('cp -r /home/student/scripts /tmp/', { flag: { recursive: true } }));
test('mv -i 两个参数', () => ok('mv -i /tmp/a.txt /tmp/b.txt', { flag: { interactive: true } }));
test('mv 缺目标报错', () => fail('mv /tmp/a.txt', '目标'));
test('rm 单文件', () => ok('rm /tmp/a.txt', { positionals: ['/tmp/a.txt'] }));
test('rm -rf 组合', () => ok('rm -rf /tmp/olddir', { flag: { recursive: true, force: true } }));
test('rm -rf / 给危险警告', () => ok('rm -rf /', { warning: true }));
test('mkdir -p 多目录', () => ok('mkdir -p /opt/app/logs /srv/ftp', { flag: { parents: true }, positionals: ['/opt/app/logs', '/srv/ftp'] }));
test('mkdir -m 模式', () => ok('mkdir -m 750 /tmp/box', { flag: { mode: '750' } }));
test('touch 需要文件', () => fail('touch', '文件'));
test('ln -s 需要两个参数', () => fail('ln -s /etc/hosts', '两个'));
test('ln -s 合法', () => ok('ln -s /etc/hosts /tmp/hosts-link', { flag: { symbolic: true } }));

/* ---------- 权限 ---------- */
test('chmod 八进制', () => ok('chmod 640 /home/student/notes.txt', { positionals: ['640', '/home/student/notes.txt'] }));
test('chmod 符号模式', () => ok('chmod u+x /home/student/scripts/backup.sh', {}));
test('chmod 组合符号模式', () => ok('chmod go-rwx /home/student/private', {}));
test('chmod 模式不合法', () => fail('chmod 999 /etc/hosts', '权限模式'));
test('chmod 缺参数', () => fail('chmod', '用法'));
test('chmod -R 递归', () => ok('chmod -R 755 /opt/app', { flag: { recursive: true } }));
test('chown user:group', () => ok('chown student:student /home/student/notes.txt', {}));
test('chown 格式不合法', () => fail('chown a:b:c /etc/hosts', '属主'));
test('umask 显示', () => ok('umask', { positionals: [] }));
test('umask 设置八进制', () => ok('umask 027', { positionals: ['027'] }));
test('umask 非法值', () => fail('umask 999', '八进制'));

/* ---------- grep / sed / awk ---------- */
test('grep 基本用法', () => ok('grep ssh /home/student/access.log', { positionals: ['ssh', '/home/student/access.log'] }));
test('grep -rn 组合', () => ok('grep -rn Failed /var/log', { flag: { recursive: true, 'line-number': true } }));
test('grep 缺模式报错', () => fail('grep /var/log/secure', '模式'));
test('grep 缺文件报错', () => fail('grep ssh', '文件'));
test('grep -E 扩展正则', () => ok('grep -E "^Sep" /var/log/messages', { flag: { 'extended-regexp': true } }));
test('sed 替换脚本', () => ok("sed 's/ssh/SSH/g' /etc/hosts", { positionals: ['s/ssh/SSH/g', '/etc/hosts'] }));
test('sed 分隔符不足报错', () => fail("sed 's/ssh' /etc/hosts", '替换'));
test('sed -n 行区间打印', () => ok("sed -n '10,20p' /var/log/messages", { flag: { quiet: true } }));
test('sed -i 带备份后缀', () => ok("sed -i.bak 's/root/ROOT/' /etc/hosts", { flag: { 'in-place': '.bak' } }));
test('awk -F 与脚本', () => ok("awk -F: '{print $1}' /etc/passwd", { flag: { 'field-separator': ':' } }));
test('awk 脚本缺花括号报错', () => fail("awk 'print $1' /etc/passwd", '{print'));
test('awk 缺文件', () => fail("awk '{print $1}'", '文件'));

/* ---------- 进程 / systemctl ---------- */
test('ps aux 无横线风格', () => ok('ps aux', { flag: { all: true, user: true, 'without-tty': true } }));
test('ps -ef 横线风格', () => ok('ps -ef', { flag: { e: true, f: true } }));
test('kill 默认 TERM', () => ok('kill 1234', { positionals: ['1234'] }));
test('kill -9 数字信号', () => ok('kill -9 1234', { flag: { signal: 'KILL' } }));
test('kill -s 信号名', () => ok('kill -s TERM 1234', { flag: { signal: 'TERM' } }));
test('kill -SIGKILL 形式', () => ok('kill -SIGKILL 1234', { flag: { signal: 'KILL' } }));
test('kill 未知信号报错', () => fail('kill -99 1234', '信号'));
test('kill 缺 PID 报错', () => fail('kill -9', 'PID'));
test('systemctl status', () => ok('systemctl status sshd', { sub: 'status', positionals: ['sshd'] }));
test('systemctl enable --now', () => ok('systemctl enable --now crond', { sub: 'enable', flag: { now: true } }));
test('systemctl 缺子命令', () => fail('systemctl', '子命令'));
test('systemctl 非法子命令', () => fail('systemctl foo sshd', '操作'));
test('systemctl start 需要单元名', () => fail('systemctl start', '单元'));
test('systemctl daemon-reload 不需要参数', () => ok('systemctl daemon-reload', { sub: 'daemon-reload' }));
test('systemctl set-default 需要目标', () => fail('systemctl set-default', 'target'));

/* ---------- 用户 ---------- */
test('useradd -m -s', () => ok('useradd -m -s /bin/bash dev1', { flag: { 'create-home': true, shell: '/bin/bash' }, positionals: ['dev1'] }));
test('useradd -aG 属于 usermod', () => fail('useradd -aG wheel dev1', '旗标'));
test('useradd 缺用户名', () => fail('useradd -m', '用户名'));
test('usermod -aG 组合', () => ok('usermod -aG wheel dev1', { flag: { append: true, groups: 'wheel' } }));
test('usermod -L 锁定', () => ok('usermod -L dev1', { flag: { lock: true } }));
test('userdel -r', () => ok('userdel -r dev1', { flag: { remove: true } }));
test('groupadd -g 指定 GID', () => ok('groupadd -g 1500 ops', { flag: { gid: '1500' } }));
test('passwd -e 过期', () => ok('passwd -e dev1', { flag: { expire: true } }));
test('id 用户', () => ok('id dev1', { positionals: ['dev1'] }));
test('su - 切换用户', () => ok('su - dev1', { flag: { login: true }, positionals: ['dev1'] }));

/* ---------- dnf ---------- */
test('dnf install -y', () => ok('dnf install -y tmux', { sub: 'install', flag: { assumeyes: true }, positionals: ['tmux'] }));
test('dnf 缺子命令', () => fail('dnf tmux', '子命令'));
test('dnf 非法子命令', () => fail('dnf foo tmux', 'install'));
test('dnf install 缺包名', () => fail('dnf install', '软件包'));
test('dnf info', () => ok('dnf info httpd', { sub: 'info', positionals: ['httpd'] }));
test('dnf list installed', () => ok('dnf list installed git', { sub: 'list', positionals: ['installed', 'git'] }));

/* ---------- ip / nmcli ---------- */
test('ip addr show', () => ok('ip addr show', { sub: 'addr' }));
test('ip a 别名', () => ok('ip a', { sub: 'addr' }));
test('ip addr show dev eth0', () => ok('ip addr show dev eth0', { sub: 'addr', positionals: ['eth0'] }));
test('ip route', () => ok('ip route show', { sub: 'route' }));
test('nmcli device status', () => ok('nmcli device status', { sub: 'device', positionals: ['status'] }));
test('nmcli connection show', () => ok('nmcli connection show', { sub: 'connection', positionals: ['show'] }));
test('nmcli 不支持的子命令', () => fail('nmcli connection add type ethernet', '只读'));

/* ---------- tar / gzip ---------- */
test('tar czf 组合短旗标带值', () => ok('tar -czf /tmp/backup.tar.gz /home/student/scripts',
  { flag: { c: true, z: true, f: '/tmp/backup.tar.gz' }, positionals: ['/home/student/scripts'] }));
test('tar 分离式 -f', () => ok('tar -c -z -f backup.tar.gz /home/student/docs',
  { flag: { c: true, z: true, f: 'backup.tar.gz' } }));
test('tar xvf 解包', () => ok('tar -xvf /tmp/backup.tar.gz -C /tmp/restore',
  { flag: { x: true, v: true, f: '/tmp/backup.tar.gz', C: '/tmp/restore' } }));
test('tar -t 列表', () => ok('tar -tzf /tmp/backup.tar.gz', { flag: { t: true, z: true } }));
test('tar c 与 x 冲突', () => fail('tar -czx -f a.tar.gz /etc', '不能同时'));
test('tar 缺 -f', () => fail('tar -cz /etc', '-f'));
test('tar 缺操作对象', () => fail('tar -czf backup.tar.gz', '路径'));
test('gzip -k 保留原文件', () => ok('gzip -k /home/student/access.log', { flag: { keep: true } }));
test('gunzip 合法', () => ok('gunzip /home/student/access.log.gz', {}));

/* ---------- 文档与杂项 ---------- */
test('man 页名', () => ok('man ls', { positionals: ['ls'] }));
test('man 分节号', () => ok('man 5 crontab', { positionals: ['5', 'crontab'] }));
test('man 缺页名', () => fail('man', '手册'));
test('echo -n', () => ok('echo -n hello', { flag: { n: true } }));
test('whoami / hostname / pwd / date', () => ok('whoami', {}) && ok('hostname', {}) && ok('pwd', {}) && ok('date', {}));
test('cd 目录参数', () => ok('cd /etc', { program: 'cd', positionals: ['/etc'] }));
test('cd 无参数回家目录', () => ok('cd', { program: 'cd', positionals: [] }));
test('--help 全局可用', () => ok('chmod --help', { flag: { help: true } }));
test('-h 短帮助', () => ok('ls -h /etc', { flag: { 'human-readable': true } }) && ok('tar --help', { flag: { help: true } }));
