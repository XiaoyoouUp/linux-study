import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from './parser.js';
import { simulate } from './mockfs.js';

function out(cmd, expectPart) {
  const sim = simulate(cmd, parseCommand(cmd));
  assert.ok(sim.text.includes(expectPart), `"${cmd}" 输出应包含 "${expectPart}"，实际：\n${sim.text}`);
  assert.notEqual(sim.tone, 'err', `"${cmd}" 不应是错误输出`);
  return sim;
}
function err(cmd, expectPart) {
  const sim = simulate(cmd, parseCommand(cmd));
  assert.equal(sim.tone, 'err', `"${cmd}" 应是错误输出，实际 tone=${sim.tone}`);
  assert.ok(sim.text.includes(expectPart), `"${cmd}" 错误应包含 "${expectPart}"，实际：${sim.text}`);
  return sim;
}

/* ---------- 目录列表与文件内容 ---------- */
test('ls /etc 列出 passwd', () => out('ls /etc', 'passwd'));
test('ls -l 显示权限位与属主', () => {
  const sim = out('ls -l /home/student', 'notes.txt');
  assert.ok(/[-dl][rwxsStT-]{9}/.test(sim.text), '应包含形如 -rw-r--r-- 的权限串');
  assert.ok(sim.text.includes('student'), '应包含属主');
});
test('ls -a 显示隐藏文件与 . ..', () => {
  const sim = out('ls -a /home/student', '.bashrc');
  assert.ok(sim.text.includes(' .') && sim.text.includes(' ..'));
});
test('ls 不存在的目录报错', () => err('ls /nope', 'No such file or directory'));
test('cat 显示文件内容', () => out('cat /home/student/notes.txt', 'RHCSA'));
test('cat 不存在的文件报错', () => err('cat /home/student/nope.txt', 'No such file or directory'));
test('cat 目录报错', () => err('cat /etc', 'Is a directory'));
test('head -n 取前 N 行', () => {
  const sim = out('head -n 2 /home/student/notes.txt', '');
  const lines = sim.text.split('\n');
  const full = simulate('cat /home/student/notes.txt', parseCommand('cat /home/student/notes.txt')).text.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], full[0]);
});
test('tail -n 取末尾行', () => {
  const sim = out('tail -n 1 /home/student/notes.txt', '');
  const full = simulate('cat /home/student/notes.txt', parseCommand('cat /home/student/notes.txt')).text.split('\n');
  assert.equal(sim.text.trim(), full[full.length - 1].trim());
});
test('wc -l 输出行数', () => {
  const sim = out('wc -l /etc/passwd', '/etc/passwd');
  assert.ok(/^\s*\d+\s+\/etc\/passwd$/m.test(sim.text), '应为 "行数 文件名" 格式');
});

/* ---------- grep / find ---------- */
test('grep 命中行', () => out('grep root /etc/passwd', 'root:x:0:0:root:/root:/bin/bash'));
test('grep -n 带行号', () => {
  const sim = out('grep -n root /etc/passwd', '');
  assert.ok(/^\d+:.+/m.test(sim.text), '应有 "行号:内容" 格式');
});
test('grep -c 输出计数', () => {
  const sim = out('grep -c root /etc/passwd', '');
  assert.ok(/^\d+$/.test(sim.text.trim()), '应只输出数字');
});
test('grep -i 忽略大小写', () => out('grep -i FAILED /var/log/secure', 'Failed'));
test('grep -r 递归目录', () => {
  const sim = out('grep -r cron /etc/crontab /var/log', '');
  assert.ok(sim.text.includes('/etc/crontab') || sim.text.includes('/var/log/'), '应带文件名前缀');
});
test('grep 无匹配输出为空', () => {
  const sim = out('grep zzzznotexist /etc/passwd', '');
  assert.equal(sim.text.trim(), '');
});
test('grep 目录需要 -r', () => err('grep root /etc', '递归'));
test('find -name 过滤', () => {
  const sim = out('find /home/student -name "*.sh"', 'backup.sh');
  assert.ok(sim.text.includes('sysinfo.sh'));
});
test('find -type d 列目录', () => {
  const sim = out('find /home/student -type d', 'scripts');
  assert.ok(!sim.text.includes('notes.txt'), '不应列出普通文件');
});
test('find 不存在的路径报错', () => err('find /nope -name "*.log"', 'No such file or directory'));

/* ---------- 进程 / 服务 / 用户身份 ---------- */
test('ps aux 表格含 sshd', () => out('ps aux', 'sshd'));
test('ps aux 有 USER/PID/%CPU 表头', () => out('ps aux', '%CPU'));
test('ps -ef 表头含 UID', () => out('ps -ef', 'UID'));
test('systemctl status sshd 运行中', () => {
  const sim = out('systemctl status sshd', 'sshd.service');
  assert.ok(sim.text.includes('active (running)'), '应为 active (running)');
});
test('systemctl status 未知单元报错', () => err('systemctl status nosuch-unit', 'Unit'));
test('systemctl is-active 输出状态', () => out('systemctl is-active crond', 'active'));
test('systemctl list-units 有表头', () => out('systemctl list-units', 'UNIT'));
test('whoami 输出 student', () => {
  const sim = out('whoami', '');
  assert.equal(sim.text.trim(), 'student');
});
test('id 输出 uid/gid', () => {
  const sim = out('id', 'uid=1000(student)');
  assert.ok(sim.text.includes('gid=1000(student)'));
});
test('hostname 输出 server1', () => {
  const sim = out('hostname', '');
  assert.equal(sim.text.trim(), 'server1');
});
test('echo 输出参数', () => out('echo hello world', 'hello world'));
test('echo -n 不换行', () => {
  const sim = out('echo -n abc', '');
  assert.equal(sim.text, 'abc');
});
test('umask 无参输出当前值', () => {
  const sim = out('umask', '');
  assert.match(sim.text.trim(), /^0\d{3}$/);
});

/* ---------- 网络 / 软件包 ---------- */
test('ip addr 显示网卡', () => {
  const sim = out('ip addr', 'eth0');
  assert.ok(sim.text.includes('inet '), '应有 inet 地址行');
});
test('nmcli device status 表格', () => {
  const sim = out('nmcli device status', 'eth0');
  assert.ok(sim.text.includes('TYPE'), '应有表头 TYPE');
});
test('dnf info tmux 包信息', () => {
  const sim = out('dnf info tmux', 'tmux');
  assert.ok(sim.text.includes('Version'), '应有 Version 字段');
});
test('dnf info 未知包报错', () => err('dnf info nosuchpkg-xyz', 'Error'));
test('dnf list installed 列表', () => out('dnf list installed git', 'git'));
test('rpm 查询暂不支持', () => err('rpm -qa', '支持'));

/* ---------- 变更类命令（canned + mutated 标记） ---------- */
test('mkdir 成功静默且标记 mutated', () => {
  const sim = simulate('mkdir /tmp/demo', parseCommand('mkdir /tmp/demo'));
  assert.equal(sim.mutated, true);
});
test('touch 标记 mutated', () => {
  const sim = simulate('touch /tmp/newfile.txt', parseCommand('touch /tmp/newfile.txt'));
  assert.equal(sim.mutated, true);
});
test('chmod 返回模拟确认', () => {
  const sim = out('chmod 750 /home/student/scripts/backup.sh', '');
  assert.equal(sim.mutated, true);
});
test('chown 返回模拟确认', () => {
  const sim = out('chown root:root /home/student/notes.txt', '');
  assert.equal(sim.mutated, true);
});
test('tar -czf 创建归档', () => {
  const sim = out('tar -czf /tmp/backup.tar.gz /home/student/scripts', 'backup.tar.gz');
  assert.equal(sim.mutated, true);
});
test('tar -tzf 列出归档成员', () => out('tar -tzf /tmp/backup.tar.gz', 'backup.sh'));
test('gzip 标记 mutated', () => {
  const sim = simulate('gzip /home/student/access.log', parseCommand('gzip /home/student/access.log'));
  assert.equal(sim.mutated, true);
});
test('useradd 返回模拟确认', () => {
  const sim = out('sudo useradd -m dev9', '');
  assert.equal(sim.mutated, true);
});
test('dnf install 返回事务输出', () => {
  const sim = out('dnf install -y tree', 'Complete');
  assert.equal(sim.mutated, true);
});
test('systemctl enable 返回 symlink 确认', () => {
  const sim = out('systemctl enable crond', 'symlink');
  assert.equal(sim.mutated, true);
});

/* ---------- man / cd ---------- */
test('man 输出手册概要', () => out('man chmod', 'chmod'));
test('man 未知页报错', () => err('man nosuchpage', 'No manual entry'));
test('man 5 crontab 分节', () => out('man 5 crontab', 'crontab'));
