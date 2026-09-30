/* 命令练习场：终端 UI + 内置任务校验。
 * 布局：左侧终端（含当前任务横条），右侧固定侧栏 = 任务列表（可滚动/筛选）+ 判定结果。 */
import { parseCommand } from './lib/parser.js';
import { simulate } from './lib/mockfs.js';
import { checkCommand, TASKS } from './lib/tasks.js';
import { store } from './store.js';
import { esc } from './components.js';

const EXAMPLES = [
  'ls -l /etc', 'cat /home/student/notes.txt', 'grep -n ssh /home/student/access.log',
  'find /home/student -name "*.sh"', 'chmod 640 /home/student/notes.txt',
  'ps aux', 'systemctl status sshd', 'useradd -m -s /bin/bash dev1',
  'dnf info tmux', 'tar -czf /tmp/backup.tar.gz /home/student/scripts',
];
const LEVEL_NAME = { 1: '入门', 2: '进阶', 3: '挑战' };

export function renderPlayground(el) {
  el.innerHTML = `
  <div class="fade-in">
    <h1 style="margin:4px 0 6px;font-size:24px">Linux 命令练习场</h1>
    <p style="color:var(--ink-2);margin:0 0 12px;font-size:14px">输入命令回车执行：先做<strong>语法与用法校验</strong>（错误给修正建议），再在<strong>模拟文件系统</strong>上返回输出。选中右侧任务后，会逐条判定命令是否满足要求。</p>
    <div class="pg-chips"><span class="pg-chips-label">常用命令</span>${EXAMPLES.map((c) => `<button class="chip-btn pg-ex" type="button">${esc(c)}</button>`).join('')}</div>
    <div class="pg-taskbar" id="pg-taskbar"><span>🎯 在右侧「练习任务」中选一个任务，判定引擎会检查你的命令是否满足要求。</span></div>
    <div class="pg-layout">
      <div class="terminal">
        <div class="term-bar">
          <span class="term-dot" style="background:#ff5f57"></span><span class="term-dot" style="background:#febc2e"></span><span class="term-dot" style="background:#28c840"></span>
          <span class="term-title">linux-study · RHEL 10 模拟终端（student@server1）</span>
          <button id="pg-clear" class="chip-btn" style="margin-left:auto">清屏</button>
        </div>
        <div class="term-body" id="pg-out"></div>
        <div class="term-input"><span class="ps">[student@server1 ~]$</span><input id="pg-in" type="text" spellcheck="false" autocomplete="off" placeholder="输入 Linux 命令，回车执行…"></div>
      </div>
      <div class="pg-side">
        <div class="card pg-verdict-card" id="pg-verdict-card" style="display:none">
          <h3>任务判定</h3><div id="pg-verdict"></div>
        </div>
        <div class="card pg-tasks-card">
          <h3>练习任务 <span class="chip gray" id="pg-task-count"></span>
            <span class="pg-filter" id="pg-filter">
              <button class="chip-btn active" data-lv="0">全部</button>
              <button class="chip-btn" data-lv="1">入门</button>
              <button class="chip-btn" data-lv="2">进阶</button>
              <button class="chip-btn" data-lv="3">挑战</button>
            </span>
          </h3>
          <div id="pg-tasks" class="pg-task-list"></div>
        </div>
      </div>
    </div>
    <div class="callout info" style="margin-top:20px"><div class="co-title">ℹ️ 关于模拟终端</div>
    <p>文件系统是固定的演示集（/home/student、/etc、/var/log 等）。读取类命令（ls / cat / grep / find 等）基于模拟文件内容真实过滤；变更类命令（mkdir / rm / chmod / tar 等）返回模拟确认信息，不会真实改变状态。解析器覆盖常用命令与旗标，未覆盖的高级用法（如 <code>find -exec</code>、完整 awk 语法、firewall-cmd）会在课程中标注。</p></div>
  </div>`;

  const out = el.querySelector('#pg-out');
  const input = el.querySelector('#pg-in');
  const tasksEl = el.querySelector('#pg-tasks');
  const taskbarEl = el.querySelector('#pg-taskbar');
  const verdictCard = el.querySelector('#pg-verdict-card');
  const verdictEl = el.querySelector('#pg-verdict');
  let activeTask = null;
  let levelFilter = 0;
  const history = [];
  let hIdx = -1;

  const greet = document.createElement('div');
  greet.className = 't-out';
  greet.textContent = '欢迎使用 Linux 学练营模拟终端（RHEL 10）。试试 ls -l /etc，或从右侧选择一个练习任务。';
  out.appendChild(greet);

  function print(text, tone = 'out') {
    const div = document.createElement('div');
    if (tone === 'in') { div.className = 't-in'; div.textContent = text; out.appendChild(div); out.scrollTop = out.scrollHeight; return; }
    div.className = tone === 'err' ? 't-err' : tone === 'ok' ? 't-ok' : tone === 'sys' ? 't-sys' : 't-out';
    div.textContent = text;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }

  function renderTaskbar() {
    if (activeTask) {
      taskbarEl.classList.add('active');
      taskbarEl.innerHTML = `<span>🎯 <b>${esc(activeTask.title)}</b>　${esc(activeTask.desc)}</span><button class="chip-btn tb-cancel" type="button">取消选择</button>`;
    } else {
      taskbarEl.classList.remove('active');
      taskbarEl.innerHTML = `<span>🎯 在右侧「练习任务」中选一个任务，判定引擎会检查你的命令是否满足要求。</span>`;
    }
  }

  function refreshTasks() {
    const listTop = tasksEl.scrollTop;
    const done = TASKS.filter((t) => store.isTaskDone(t.id)).length;
    el.querySelector('#pg-task-count').textContent = `${done}/${TASKS.length}`;
    const list = levelFilter ? TASKS.filter((t) => t.level === levelFilter) : TASKS;
    tasksEl.innerHTML = list.map((t) => {
      const isDone = store.isTaskDone(t.id);
      const active = activeTask && activeTask.id === t.id;
      return `<div class="task-item ${active ? 'active' : ''} ${isDone ? 'done' : ''}" data-task="${t.id}">
        <span class="ti-status">${isDone ? '✅' : `<span class="chip ${t.level === 3 ? 'warn' : 'gray'}">${LEVEL_NAME[t.level]}</span>`}</span>
        <div class="ti-title">${esc(t.title)}</div><div class="ti-desc">${esc(t.desc)}</div></div>`;
    }).join('') || '<p style="color:var(--ink-3);font-size:13px">该级别暂无任务</p>';
    tasksEl.scrollTop = listTop;
  }

  function showVerdict(task, result) {
    verdictCard.style.display = '';
    const rows = result.checks.map((c) => `<li>${c.ok ? '✅' : '❌'} ${esc(c.label)}${c.detail && !c.ok ? ` — ${esc(c.detail)}` : ''}</li>`).join('');
    verdictEl.innerHTML = result.pass
      ? `<div class="verdict pass"><div class="v-title">🎉 任务完成</div><ul>${rows}</ul>${task.solution ? `<details style="margin-top:8px"><summary>参考答案</summary><pre>${esc(Array.isArray(task.solution) ? task.solution.join('\n') : task.solution)}</pre></details>` : ''}</div>`
      : `<div class="verdict fail"><div class="v-title">未通过，逐条检查：</div><ul>${rows}</ul>${task.hint ? `<p style="margin:8px 0 0"><b>提示：</b>${esc(task.hint)}</p>` : ''}</div>`;
  }

  tasksEl.addEventListener('click', (e) => {
    const item = e.target.closest('.task-item');
    if (!item) return;
    const t = TASKS.find((x) => x.id === item.dataset.task);
    activeTask = activeTask && activeTask.id === t.id ? null : t;
    if (activeTask) print(`已选择任务：${t.title} —— ${t.desc}`, 'out');
    verdictCard.style.display = 'none';
    renderTaskbar();
    refreshTasks();
    input.focus({ preventScroll: true });
  });

  el.querySelector('#pg-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    levelFilter = Number(btn.dataset.lv);
    el.querySelectorAll('#pg-filter .chip-btn').forEach((b) => b.classList.toggle('active', b === btn));
    refreshTasks();
  });

  taskbarEl.addEventListener('click', (e) => {
    if (!e.target.closest('.tb-cancel')) return;
    activeTask = null;
    verdictCard.style.display = 'none';
    renderTaskbar();
    refreshTasks();
  });

  function run(cmdLine) {
    print(cmdLine, 'in');
    history.unshift(cmdLine);
    hIdx = -1;
    if (cmdLine === 'clear') { out.innerHTML = ''; return; }
    if (cmdLine === 'history') {
      history.slice(1).reverse().forEach((h, i) => print(`  ${i + 1}  ${h}`, 'out'));
      if (history.length <= 1) print('（还没有历史命令）', 'out');
      const blank = document.createElement('div');
      blank.innerHTML = '&nbsp;';
      out.appendChild(blank);
      return;
    }
    const parsed = parseCommand(cmdLine);
    if (!parsed.ok) {
      for (const e of parsed.errors) print('✗ ' + e.message, 'err');
      if (parsed.suggestions.length) print('  建议：' + parsed.suggestions.join('；'), 'out');
    } else {
      for (const w of parsed.warnings) print('⚠ ' + w, 'out');
      const sim = simulate(cmdLine, parsed);
      if (sim.text) print(sim.text, sim.tone);
      if (sim.mutated) print('（模拟执行完成；演示环境不会保留变更）', 'sys');
    }
    if (activeTask) {
      const result = checkCommand(cmdLine, activeTask.check);
      showVerdict(activeTask, result);
      if (result.pass) { store.markTaskDone(activeTask.id); refreshTasks(); }
    }
    const blank = document.createElement('div');
    blank.innerHTML = '&nbsp;';
    out.appendChild(blank);
    out.scrollTop = out.scrollHeight;
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) { run(input.value.trim()); input.value = ''; }
    else if (e.key === 'ArrowUp') { if (hIdx < history.length - 1) { hIdx++; input.value = history[hIdx]; e.preventDefault(); } }
    else if (e.key === 'ArrowDown') { if (hIdx > 0) { hIdx--; input.value = history[hIdx]; e.preventDefault(); } else { hIdx = -1; input.value = ''; } }
  });
  el.querySelector('#pg-clear').addEventListener('click', () => { out.innerHTML = ''; });
  el.querySelectorAll('.pg-ex').forEach((b) => b.addEventListener('click', () => { input.value = b.textContent; input.focus({ preventScroll: true }); }));

  renderTaskbar();
  refreshTasks();
  input.focus({ preventScroll: true });
}
