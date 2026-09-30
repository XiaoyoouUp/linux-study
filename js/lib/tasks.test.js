import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCommand } from './tasks.js';

function pass(cmd, spec) {
  const r = checkCommand(cmd, spec);
  const failed = r.checks.filter((c) => !c.ok).map((c) => c.label).join(' | ');
  assert.equal(r.pass, true, `expected PASS for "${cmd}" with ${JSON.stringify(spec)}, failed checks: ${failed}`);
  return r;
}
function reject(cmd, spec, labelPart) {
  const r = checkCommand(cmd, spec);
  assert.equal(r.pass, false, `expected FAIL for "${cmd}" with ${JSON.stringify(spec)}`);
  if (labelPart) assert.ok(r.checks.some((c) => !c.ok && c.label.includes(labelPart)),
    `expected failing check mentioning "${labelPart}", got: ${JSON.stringify(r.checks)}`);
  return r;
}

/* ---------- 语法门 ---------- */
test('语法错误直接不过', () => reject('chmdo 640 a.txt', { program: 'chmod' }, '语法'));
test('通过时包含语法正确项', () => {
  const r = pass('ls /etc', { program: 'ls' });
  assert.ok(r.checks.some((c) => c.ok && c.label.includes('语法')));
});

/* ---------- program / sub ---------- */
test('program 不匹配', () => reject('ls -l /etc', { program: 'cat' }, 'cat'));
test('program 匹配', () => pass('cat /etc/hostname', { program: 'cat' }));
test('systemctl sub 匹配', () => pass('systemctl enable crond', { program: 'systemctl', sub: 'enable' }));
test('systemctl sub 不匹配', () => reject('systemctl start crond', { program: 'systemctl', sub: 'enable' }, 'enable'));
test('dnf sub 匹配', () => pass('dnf install tmux', { program: 'dnf', sub: 'install', minNames: 1 }));

/* ---------- sudo ---------- */
test('要求 sudo 而未加', () => reject('useradd -m dev1', { program: 'useradd', sudo: true }, 'sudo'));
test('sudo 前缀满足要求', () => pass('sudo useradd -m dev1', { program: 'useradd', sudo: true, flagsMust: [{ name: 'create-home' }] }));

/* ---------- flagsMust ---------- */
test('flagsMust 存在', () => pass('systemctl enable --now crond', { program: 'systemctl', sub: 'enable', flagsMust: [{ name: 'now' }] }));
test('flagsMust 缺失', () => reject('systemctl enable crond', { program: 'systemctl', sub: 'enable', flagsMust: [{ name: 'now' }] }, '--now'));
test('flagsMust equals 匹配', () => pass('grep -c ssh /etc/hosts', { program: 'grep', flagsMust: [{ name: 'count' }] }));
test('flagsMust oneOf 匹配', () =>
  pass('chmod 640 notes.txt', { program: 'chmod', minNames: 2, firstArgPattern: '^(640|600)$' }));
test('firstArgPattern 不匹配', () =>
  reject('chmod 777 notes.txt', { program: 'chmod', minNames: 2, firstArgPattern: '^(640|600)$' }, '参数'));

/* ---------- flagsMustNot ---------- */
test('flagsMustNot 命中旗标名', () => reject('rm -f /tmp/a.txt', { program: 'rm', flagsMustNot: ['force'] }, '-f'));
test('flagsMustNot 未出现则通过', () => pass('rm -i /tmp/a.txt', { program: 'rm', flagsMustNot: ['force'] }));
test('rm -rf 被 flagsMustNot 拦截', () =>
  reject('rm -rf /tmp/olddir', { program: 'rm', flagsMust: [{ name: 'recursive' }], flagsMustNot: ['force'] }, '-f'));

/* ---------- minNames / namePattern ---------- */
test('minNames 不足（语法层已拦截）', () => reject('mkdir', { program: 'mkdir', minNames: 1 }, ''));
test('minNames 满足', () => pass('mkdir /tmp/a /tmp/b', { program: 'mkdir', minNames: 1 }));
test('namePattern 命中任一参数', () =>
  pass('tar -czf /tmp/backup.tar.gz /home/student/scripts', { program: 'tar', minNames: 1, namePattern: '^/home/student/' }));
test('namePattern 不匹配则判不通过', () => {
  const r = reject('tar -czf /tmp/backup.tar.gz /opt/app', { program: 'tar', minNames: 1, namePattern: '^/home/student/' }, '');
  assert.ok(r.checks.some((c) => !c.ok));
});

/* ---------- 综合场景 ---------- */
test('useradd 完整场景', () =>
  pass('sudo useradd -m -s /bin/bash dev1', {
    program: 'useradd', sudo: true,
    flagsMust: [{ name: 'create-home' }, { name: 'shell', equals: '/bin/bash' }], minNames: 1,
  }));
test('useradd 缺 -m', () =>
  reject('sudo useradd -s /bin/bash dev1', {
    program: 'useradd', sudo: true,
    flagsMust: [{ name: 'create-home' }, { name: 'shell', equals: '/bin/bash' }], minNames: 1,
  }, '--create-home'));
test('chmod 八进制场景', () =>
  pass('chmod 640 /home/student/notes.txt', { program: 'chmod', minNames: 2, firstArgPattern: '^640$' }));
test('chmod 符号模式被判不满足八进制要求', () =>
  reject('chmod u+rw /home/student/notes.txt', { program: 'chmod', minNames: 2, firstArgPattern: '^640$' }, '参数'));
test('systemctl enable --now 完整场景', () =>
  pass('sudo systemctl enable --now crond', { program: 'systemctl', sub: 'enable', sudo: true, flagsMust: [{ name: 'now' }], minNames: 1 }));
test('ps aux 场景', () => pass('ps aux', { program: 'ps', flagsMust: [{ name: 'all' }, { name: 'user' }] }));
test('ps 不带 aux 被判不满足', () => reject('ps', { program: 'ps', flagsMust: [{ name: 'all' }] }, '--all'));
test('grep -i 场景', () =>
  pass('grep -in failed /var/log/secure', { program: 'grep', flagsMust: [{ name: 'ignore-case' }, { name: 'line-number' }], minNames: 2 }));
