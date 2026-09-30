/* 应用外壳：路由、导航、页面渲染（首页/阶段/课程/考试/练习场/速查表） */
import { store } from './store.js';
import { renderBlocks, renderCommandSheet, renderKeyPoints, esc } from './components.js';
import { renderQuizBlock, bindQuizBlock, questionHtml, bindQuestionEvents, collectPicks, gradeQuestions, isAnswerCorrect } from './quiz.js';
import { renderPlayground } from './playground.js';
import { checkCommand } from './lib/tasks.js';
import { parseCommand } from './lib/parser.js';
import { stages, exams, allLessons, totalLessons, totalQuestions, stageById, lessonById, stageOfLesson, examById, examOfStage, lessonNeighbors, firstLesson } from './data.js';
import { REF_SECTIONS } from '../data/reference.js';
import { TASKS } from './lib/tasks.js';

const content = document.getElementById('content');
const navEl = document.getElementById('nav');
const breadcrumbEl = document.getElementById('breadcrumb');
let timerHandle = null;

/* ---------------- 导航 ---------------- */
function renderNav(route) {
  const sum = store.summary(totalLessons);
  let html = `<div class="nav-group-title">学习</div>
  <a class="nav-link ${route === '#/' ? 'active' : ''}" href="#/">🏠 学习总览</a>
  <a class="nav-link ${route === '#/playground' ? 'active' : ''}" href="#/playground">⌨️ 命令练习场</a>
  <a class="nav-link ${route === '#/reference' ? 'active' : ''}" href="#/reference">📄 命令速查表</a>`;
  for (const s of stages) {
    const stageActive = route.startsWith('#/stage/' + s.id) || (route.startsWith('#/lesson/') && stageOfLesson(route.split('/')[2])?.id === s.id);
    html += `<div class="nav-group-title">阶段 ${s.num}</div>
    <a class="nav-link ${stageActive ? 'active' : ''}" href="#/stage/${s.id}"><span class="st-num">${s.num}</span><span>${esc(s.title)}</span></a>`;
    if (stageActive) {
      html += `<div class="nav-sub">` + s.lessons.map((l) => {
        const done = store.isLessonDone(l.id);
        const active = route === '#/lesson/' + l.id;
        return `<a class="nav-link ${active ? 'active' : ''} ${done ? 'done' : ''}" href="#/lesson/${l.id}">${esc(l.title)}</a>`;
      }).join('');
      const ex = examOfStage(s.id);
      if (ex) html += `<a class="nav-link ${route === '#/exam/' + ex.id ? 'active' : ''}" href="#/exam/${ex.id}">📝 ${esc(ex.title)}</a>`;
      html += `</div>`;
    }
  }
  html += `<div class="nav-group-title">认证冲刺</div>`;
  for (const e of exams) {
    if (e.stageId !== 's6') continue;
    html += `<a class="nav-link ${route === '#/exam/' + e.id ? 'active' : ''}" href="#/exam/${e.id}">🏁 ${esc(e.title)}</a>`;
  }
  html += `<a class="nav-link" href="#/stage/s6">🧭 备考路径与技巧</a>`;
  navEl.innerHTML = html;
  document.getElementById('nav-progress').innerHTML =
    `总进度 <b>${sum.percent}%</b> · 课程 ${sum.lessonsDone}/${totalLessons}<div class="progress-track"><div class="progress-fill" style="width:${sum.percent}%"></div></div>`;
}

function setBreadcrumb(items) {
  breadcrumbEl.innerHTML = items.map(([label, href]) => href ? `<a href="${href}" style="color:inherit;text-decoration:none">${esc(label)}</a>` : `<b>${esc(label)}</b>`).join('  ›  ');
}

function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

/* ---------------- 首页 ---------------- */
function pageHome() {
  const sum = store.summary(totalLessons);
  const start = allLessons.find((l) => !store.isLessonDone(l.id)) || firstLesson();
  content.innerHTML = `
  <div class="fade-in">
    <section class="hero">
      <h1>系统学透 Linux 管理，一次拿下 RHCSA</h1>
      <p>参照《鸟哥的Linux私房菜》知识体系与 Red Hat RHCSA（EX200）考纲组织课程：图文讲解 → 随堂测验 → 阶段考试 → 全真模拟，配套 Linux 在线命令练习场，边学边练。</p>
      <div class="actions">
        <a class="btn btn-primary" href="#/lesson/${start ? start.id : ''}">▶ 从上次进度继续</a>
        <a class="btn btn-ghost" href="#/playground" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.35)">⌨️ 命令练习场</a>
        <a class="btn btn-ghost" href="#/exam/exam-final" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.35)">🏁 RHCSA 模拟考</a>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><b>${stages.length}</b><span>学习阶段</span></div>
        <div class="hero-stat"><b>${totalLessons}</b><span>图文课程</span></div>
        <div class="hero-stat"><b>${totalQuestions}+</b><span>练习与考题</span></div>
        <div class="hero-stat"><b>${TASKS.length}</b><span>命令任务</span></div>
      </div>
    </section>

    <div class="section-title"><h2>学习路线</h2><span class="sub">由浅入深，对标 RHCSA 考纲重点领域</span></div>
    <div class="grid-cards">
      ${stages.map((s) => {
        const doneCount = s.lessons.filter((l) => store.isLessonDone(l.id)).length;
        const pct = s.lessons.length ? Math.round((doneCount / s.lessons.length) * 100) : 0;
        return `<a class="card" href="#/stage/${s.id}">
          <h3><span class="chip">${stageIcon(s.num)}</span> 阶段 ${s.num} · ${esc(s.title)}</h3>
          <p>${esc(s.subtitle)}</p>
          <div class="meta">${(Array.isArray(s.cert) ? s.cert : [s.cert]).map((c) => `<span class="chip cka">${esc(c)}</span>`).join('')}</div>
          <div class="meta"><span class="chip gray">${s.lessons.length} 课</span><span class="chip ${pct === 100 ? 'ok' : 'gray'}">${pct === 100 ? '✓ 已完成' : '进度 ' + pct + '%'}</span></div>
        </a>`;
      }).join('')}
    </div>

    <div class="section-title"><h2>练与考</h2><span class="sub">学完就练，练完就考</span></div>
    <div class="grid-cards">
      <a class="card" href="#/playground"><h3>⌨️ 命令练习场</h3><p>在线 Linux 终端：语法校验、错误提示、模拟文件系统执行，${TASKS.length} 个任务逐关判定正确性。</p></a>
      <a class="card" href="#/reference"><h3>📄 命令速查表</h3><p>按场景分类的 Linux 管理常用命令与 RHCSA 考试要点，支持直接跳转练习场。</p></a>
      ${exams.filter((e) => e.stageId !== 's6').map((e) => `<a class="card" href="#/exam/${e.id}"><h3>📝 ${esc(e.title)}</h3><p>${e.questions.length} 道选择/判断题 + ${e.tasks.length} 道实操任务，限时 ${e.duration} 分钟，${e.passScore} 分及格。</p></a>`).join('')}
      <a class="card" href="#/exam/exam-final"><h3>🏁 RHCSA 全真模拟考试</h3><p>按 RHCSA 考纲重点领域配题：限时 120 分钟，${exams.find((e) => e.id === 'exam-final') ? exams.find((e) => e.id === 'exam-final').tasks.length + ' 道实操任务' : '实操任务'}，完整模拟考试节奏。</p></a>
    </div>

    <div class="section-title"><h2>你的进度</h2><span class="sub">进度保存在浏览器本地</span></div>
    <div class="grid-cards">
      <div class="card"><h3>📚 课程完成 ${sum.lessonsDone}/${totalLessons}</h3><div class="progress-track" style="height:8px"><div class="progress-fill" style="width:${sum.percent}%"></div></div></div>
      <div class="card"><h3>✏️ 随堂测验 ${sum.quizCount} 次</h3><p>提交随堂测验后自动记录成绩。</p></div>
      <div class="card"><h3>📝 考试 ${sum.examCount} 场</h3><p>阶段考与模拟考的最佳成绩。</p></div>
      <div class="card"><h3>⌨️ 命令任务 ${sum.taskCount}/${TASKS.length}</h3><p>练习场任务完成情况。</p></div>
    </div>
  </div>`;
  setBreadcrumb([['学习总览', null]]);
}
function stageIcon(n) { return ['🐧', '📁', '⌨️', '👤', '⚙️', '🏁'][n - 1] || '📘'; }

/* ---------------- 阶段页 ---------------- */
function pageStage(sid) {
  const s = stageById(sid);
  if (!s) { page404(); return; }
  const ex = examOfStage(s.id);
  content.innerHTML = `
  <div class="fade-in">
    <div class="stage-hero">
      <span class="chip">阶段 ${s.num} / ${stages.length}</span>
      <h1>${esc(s.title)}</h1>
      <p class="lead">${esc(s.subtitle)}</p>
      <div style="margin-bottom:10px">${(Array.isArray(s.cert) ? s.cert : [s.cert]).map((c) => `<span class="chip cka">${esc(c)}</span>`).join('')}</div>
      <div class="objectives"><div class="obj-title">🎯 学完本阶段你将能够</div><ul>${s.goals.map((g) => `<li>${g}</li>`).join('')}</ul></div>
    </div>
    ${s.lessons.map((l, i) => {
      const done = store.isLessonDone(l.id);
      return `<a class="lesson-row ${done ? 'done' : ''}" href="#/lesson/${l.id}">
        <div class="lr-no">${done ? '✓' : i + 1}</div>
        <div class="lr-main"><div class="lr-title">${esc(l.title)}</div><div class="lr-sum">${esc(l.summary)}</div></div>
        <div class="lr-right"><span>⏱ ${l.duration} 分钟</span></div>
      </a>`;
    }).join('')}
    ${ex ? `<a class="lesson-row" href="#/exam/${ex.id}">
      <div class="lr-no">📝</div>
      <div class="lr-main"><div class="lr-title">${esc(ex.title)}</div><div class="lr-sum">${ex.questions.length} 道题 + ${ex.tasks.length} 道实操任务 · 限时 ${ex.duration} 分钟 · ${ex.passScore} 分及格</div></div>
      <div class="lr-right"><span class="chip warn">限时考试</span></div>
    </a>` : ''}
  </div>`;
  setBreadcrumb([['学习总览', '#/'], [`阶段 ${s.num}：${s.title}`, null]]);
}

/* ---------------- 课程页 ---------------- */
function pageLesson(lid) {
  const l = lessonById(lid);
  const s = stageOfLesson(lid);
  if (!l || !s) { page404(); return; }
  const done = store.isLessonDone(l.id);
  const { prev, next } = lessonNeighbors(lid);
  content.innerHTML = `
  <article class="fade-in">
    <header class="lesson-header">
      <span class="chip">阶段 ${s.num} · ${esc(s.title)}</span><span class="chip gray">⏱ 约 ${l.duration} 分钟</span>
      <h1>${esc(l.title)}</h1>
      <p class="lead">${esc(l.summary)}</p>
    </header>
    ${renderBlocks(l.blocks, {})}
    ${renderKeyPoints(l.keyPoints)}
    ${renderCommandSheet(l.commands)}
    <div class="complete-row"><button class="btn ${done ? 'btn-ok' : 'btn-primary'}" id="mark-done">${done ? '✓ 已完成，点击取消' : '✅ 标记本课已完成'}</button></div>
    <nav class="lesson-footer-nav">
      ${prev ? `<a class="pager prev" href="#/lesson/${prev.id}"><div class="pg-label">上一篇</div><div class="pg-title">← ${esc(prev.title)}</div></a>` : '<div class="pager prev" style="visibility:hidden"></div>'}
      ${next ? `<a class="pager next" href="#/lesson/${next.id}"><div class="pg-label">下一篇</div><div class="pg-title">${esc(next.title)} →</div></a>` : '<div class="pager next" style="visibility:hidden"></div>'}
    </nav>
  </article>`;
  setBreadcrumb([['学习总览', '#/'], [`阶段 ${s.num}`, '#/stage/' + s.id], [l.title, null]]);
  content.querySelectorAll('.quiz').forEach((el) => {
    const quiz = l.blocks.find((b) => b.t === 'quiz' && b.id === el.dataset.quiz);
    if (quiz) bindQuizBlock(content, quiz);
  });
  document.getElementById('mark-done').addEventListener('click', (e) => {
    const now = store.isLessonDone(l.id);
    store.markLessonDone(l.id, !now);
    e.target.className = `btn ${!now ? 'btn-ok' : 'btn-primary'}`;
    e.target.textContent = !now ? '✓ 已完成，点击取消' : '✅ 标记本课已完成';
    renderNav('#/lesson/' + l.id);
  });
  document.querySelectorAll('.cb-copy').forEach((btn) => btn.addEventListener('click', () => {
    const code = btn.closest('.codeblock').querySelector('pre > code').textContent;
    navigator.clipboard && navigator.clipboard.writeText(code).then(() => {
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = '复制'; }, 1200);
    });
  }));
}

/* ---------------- 考试页 ---------------- */
function pageExam(eid) {
  const ex = examById(eid);
  if (!ex) { page404(); return; }
  const prev = store.getExam(ex.id);
  const qCount = ex.questions.length;
  const tPoints = ex.tasks.reduce((n, t) => n + (t.points || 10), 0);
  const totalPoints = qCount + tPoints;
  if (!prev) return examCover(ex, qCount, tPoints, totalPoints);
  content.innerHTML = `
  <div class="fade-in">
    <div class="exam-cover">
      <div class="icon">📝</div>
      <h1>${esc(ex.title)}</h1>
      <div class="cover-meta">
        <span class="chip">${qCount} 道选择题</span><span class="chip">${ex.tasks.length} 道实操任务</span>
        <span class="chip">总分 ${totalPoints}</span><span class="chip warn">限时 ${ex.duration} 分钟</span><span class="chip ok">及格线 ${ex.passScore}%</span>
      </div>
      <div class="card" style="max-width:520px;margin:0 auto 20px;text-align:left">
        <h3>上一次成绩</h3>
        <p style="font-size:26px;font-weight:800;color:${prev.percent >= ex.passScore ? 'var(--ok)' : 'var(--err)'}">${prev.percent} 分 ${prev.percent >= ex.passScore ? '🎉 通过' : '未通过'}</p>
        <p style="margin-top:6px">答题 ${prev.answered}/${qCount} 题 · 任务通过 ${prev.tasksPassed}/${ex.tasks.length}</p>
      </div>
      <button class="btn btn-primary" id="exam-start">重新考试</button>
      <button class="btn btn-ghost" id="exam-back">返回</button>
    </div>
  </div>`;
  document.getElementById('exam-start').addEventListener('click', () => examCover(ex, qCount, tPoints, totalPoints));
  document.getElementById('exam-back').addEventListener('click', () => { location.hash = '#/stage/' + ex.stageId; });
  setBreadcrumb([['考试', '#/'], [ex.title, null]]);
}

function examCover(ex, qCount, tPoints, totalPoints) {
  content.innerHTML = `
  <div class="fade-in"><div class="exam-cover">
    <div class="icon">📝</div>
    <h1>${esc(ex.title)}</h1>
    <p style="color:var(--ink-2)">模拟真实考试节奏：限时作答，交卷后统一判分并公布解析。实操任务在页面内直接输入命令校验（与练习场同一判定引擎）。</p>
    <div class="cover-meta">
      <span class="chip">${qCount} 道选择题（每题 1 分）</span>
      <span class="chip">${ex.tasks.length} 道实操任务（共 ${tPoints} 分）</span>
      <span class="chip">总分 ${totalPoints}</span>
      <span class="chip warn">限时 ${ex.duration} 分钟</span>
      <span class="chip ok">${ex.passScore} 分及格</span>
    </div>
    <div class="objectives" style="max-width:560px;margin:0 auto 24px;text-align:left"><div class="obj-title">考试须知</div>
      <ul><li>选择题支持多选与判断题，可返回修改</li><li>实操任务输入命令后点击「校验」，逐条显示判定结果</li><li>倒计时结束自动交卷</li></ul>
    </div>
    <button class="btn btn-primary" id="exam-begin">开始考试</button>
  </div></div>`;
  document.getElementById('exam-begin').addEventListener('click', () => examRun(ex, qCount, totalPoints));
  setBreadcrumb([['考试', '#/'], [ex.title, null]]);
}

function examRun(ex, qCount, totalPoints) {
  let remaining = ex.duration * 60;
  content.innerHTML = `
  <div class="fade-in">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <h1 style="margin:0;font-size:22px">${esc(ex.title)}</h1>
      <span class="timer" id="exam-timer"></span>
      <span class="chip gray" id="exam-progress"></span>
      <button class="btn btn-primary" id="exam-submit" style="margin-left:auto">交卷</button>
    </div>
    <div id="exam-questions">${ex.questions.map((q, i) => questionHtml(q, i)).join('')}</div>
    <h2 style="margin:34px 0 6px">实操任务（共 ${ex.tasks.reduce((n, t) => n + (t.points || 10), 0)} 分）</h2>
    <p style="color:var(--ink-2);font-size:13.5px">输入命令并点击「校验」。判定与练习场使用同一引擎，通过即得分。</p>
    <div id="exam-tasks">${ex.tasks.map((t, i) => taskCardHtml(t, i)).join('')}</div>
    <div style="text-align:center;margin:34px 0"><button class="btn btn-primary" id="exam-submit2" style="padding:12px 40px">交卷</button></div>
  </div>`;
  setBreadcrumb([['考试', '#/'], [ex.title, null], ['作答中', null]]);
  const body = document.getElementById('exam-questions');
  bindExamTasks(content, ex);

  const timerEl = document.getElementById('exam-timer');
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  timerEl.textContent = fmt(remaining);
  stopTimer();
  timerHandle = setInterval(() => {
    remaining--;
    timerEl.textContent = fmt(Math.max(remaining, 0));
    if (remaining <= 300) timerEl.classList.add('danger');
    if (remaining <= 0) { stopTimer(); examSubmit(ex, qCount, totalPoints); }
  }, 1000);

  const progress = () => {
    const picks = collectPicks(content);
    const answered = ex.questions.filter((q) => (picks[q.id] || []).length).length;
    document.getElementById('exam-progress').textContent = `已答 ${answered}/${qCount}`;
  };
  bindQuestionEvents(body, progress);
  document.getElementById('exam-submit').addEventListener('click', () => examSubmit(ex, qCount, totalPoints));
  document.getElementById('exam-submit2').addEventListener('click', () => examSubmit(ex, qCount, totalPoints));
  content.scrollIntoView();
}

function taskCardHtml(t, i) {
  return `<div class="task-card" data-task="${esc(t.id)}" data-points="${t.points || 10}">
    <div class="t-head"><h3>任务 ${i + 1}</h3><span class="t-points">${t.points || 10} 分</span><span class="t-status"></span></div>
    <div class="t-text">${t.text}</div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <input type="text" class="task-input" spellcheck="false" style="flex:1;font-family:var(--mono);font-size:13px;border:1.5px solid var(--line);border-radius:8px;padding:8px 12px" placeholder="输入命令，如 ls -l /etc">
      <button class="btn btn-ghost task-check">校验</button>
    </div>
    <div class="task-result"></div>
    <details class="solution" style="display:none"><summary>参考答案</summary><pre>${esc(Array.isArray(t.solution) ? t.solution.join('\n') : String(t.solution || ''))}</pre>${t.hint ? `提示：${esc(t.hint)}` : ''}</details>
  </div>`;
}

function bindExamTasks(root, ex) {
  root.querySelectorAll('.task-card').forEach((card) => {
    const t = ex.tasks.find((x) => x.id === card.dataset.task);
    card.querySelector('.task-check').addEventListener('click', () => {
      const cmd = card.querySelector('.task-input').value.trim();
      const resultEl = card.querySelector('.task-result');
      if (!cmd) { resultEl.innerHTML = '<p style="color:var(--err);font-size:13px">请先输入命令</p>'; return; }
      const result = checkCommand(cmd, t.check || {});
      card.dataset.pass = result.pass ? '1' : '';
      const rows = result.checks.map((c) => `<li>${c.ok ? '✅' : '❌'} ${esc(c.label)}${c.detail && !c.ok ? ` — ${esc(c.detail)}` : ''}</li>`).join('');
      resultEl.innerHTML = `<div class="verdict ${result.pass ? 'pass' : 'fail'}"><div class="v-title">${result.pass ? '✅ 通过' : '未通过'}</div><ul>${rows}</ul></div>`;
      if (result.pass) {
        card.querySelector('.t-status').textContent = '✅';
        card.querySelector('.solution').style.display = '';
        card.querySelector('.solution summary').textContent = '查看参考解法（已完成）';
      }
    });
  });
}

function examSubmit(ex, qCount, totalPoints) {
  stopTimer();
  const picksByQid = collectPicks(content);
  const picks = ex.questions.map((q) => picksByQid[q.id] || []);
  const { score, per } = gradeQuestions(ex.questions, picks);
  let taskScore = 0, tasksPassed = 0;
  const taskResults = ex.tasks.map((t) => {
    const card = content.querySelector(`.task-card[data-task="${CSS.escape(t.id)}"]`);
    const passed = card && card.dataset.pass === '1';
    if (passed) { taskScore += t.points || 10; tasksPassed++; }
    return { id: t.id, passed };
  });
  const answered = ex.questions.filter((q) => (picksByQid[q.id] || []).length).length;
  const percent = Math.round((100 * (score + taskScore)) / totalPoints);
  const pass = percent >= ex.passScore;
  store.saveExam(ex.id, { percent, answered, qCount, tasksPassed, tasksTotal: ex.tasks.length });

  content.innerHTML = `
  <div class="fade-in">
    <div class="exam-cover" style="padding-bottom:10px">
      <div class="icon">${pass ? '🎉' : '📖'}</div>
      <h1>${pass ? '恭喜通过！' : '继续加油！'}</h1>
      <div style="font-size:44px;font-weight:800;color:${pass ? 'var(--ok)' : 'var(--err)'}">${percent} 分</div>
      <p style="color:var(--ink-2)">选择题 ${score}/${qCount} · 实操任务 ${taskScore}/${ex.tasks.reduce((n, t) => n + (t.points || 10), 0)} 分（通过 ${tasksPassed}/${ex.tasks.length}） · 及格线 ${ex.passScore}</p>
      <button class="btn btn-ghost" id="exam-review-toggle">展开逐题回顾</button>
    </div>
    <div id="exam-review" style="display:none">
      <h2>选择题回顾</h2>
      ${ex.questions.map((q, i) => {
        const mine = picks[i] || [];
        const ok = isAnswerCorrect(q, mine);
        return `<div class="q-item">
          <div class="q-text">${ok ? '✅' : '❌'} <span class="q-no">${i + 1}.</span>${q.q}</div>
          <div class="q-explain"><b>正确答案：${q.answer.map((a) => String.fromCharCode(65 + a)).join('、')}</b>${!ok && mine.length ? `　你的答案：${mine.map((a) => String.fromCharCode(65 + a)).join('、')}` : ''}<br>${q.explain}</div>
        </div>`;
      }).join('')}
      <h2>实操任务回顾</h2>
      ${ex.tasks.map((t, i) => {
        const r = taskResults.find((x) => x.id === t.id);
        return `<div class="task-card"><div class="t-head"><h3>任务 ${i + 1} ${r && r.passed ? '✅' : '❌'}</h3><span class="t-points">${t.points || 10} 分</span></div>
        <div class="t-text">${t.text}</div><details class="solution" style="display:block;margin-top:8px"><summary>参考解法</summary><pre>${esc(Array.isArray(t.solution) ? t.solution.join('\n') : String(t.solution || ''))}</pre></details></div>`;
      }).join('')}
    </div>
  </div>`;
  setBreadcrumb([['考试', '#/'], [ex.title, null], ['成绩', null]]);
  document.getElementById('exam-review-toggle').addEventListener('click', (e) => {
    const rv = document.getElementById('exam-review');
    rv.style.display = rv.style.display === 'none' ? '' : 'none';
    e.target.textContent = rv.style.display === 'none' ? '展开逐题回顾' : '收起回顾';
  });
  renderNav('#/exam/' + ex.id);
}

/* ---------------- 速查表页 ---------------- */
function pageReference() {
  content.innerHTML = `
  <div class="fade-in">
    <h1 style="margin:4px 0 8px">Linux 命令速查表</h1>
    <p style="color:var(--ink-2);margin:0 0 18px">按场景分类的常用命令与 RHCSA 考试要点。「试」按钮直接在练习场执行。</p>
    <div class="ref-grid">
      ${REF_SECTIONS.map((s) => `
      <div class="card">
        <h3>${s.icon} ${esc(s.title)}</h3>
        <div class="ref-list">
          ${s.items.map((it) => `
          <div class="ref-item">
            <div class="ref-main">
              <code class="ref-cmd">${esc(it.cmd)}</code>
              <span class="ref-desc">${esc(it.desc)}</span>
            </div>
            <button class="chip-btn ref-try" data-cmd="${esc(it.cmd)}" title="去练习场执行">试</button>
          </div>`).join('')}
        </div>
      </div>`).join('')}
    </div>
    <div class="callout cka" style="margin-top:24px"><div class="co-title">🎯 RHCSA 实战提醒</div>
    <p>EX200 是<strong>实机操作考试</strong>：所有任务都在真机上完成，配置要<strong>重启后仍生效</strong>。平时就要养成习惯——改完配置用 <code>systemctl enable --now</code> 让服务持久生效，挂载写进 <code>/etc/fstab</code>，用 <code>man -k</code> 和产品文档查语法。所有命令都在「命令练习场」练到肌肉记忆。</p></div>
  </div>`;
  setBreadcrumb([['命令速查表', null]]);
  content.querySelectorAll('.ref-try').forEach((b) => b.addEventListener('click', () => {
    sessionStorage.setItem('pg-cmd', b.dataset.cmd);
    location.hash = '#/playground';
  }));
}

/* ---------------- 404 ---------------- */
function page404() {
  content.innerHTML = `<div class="exam-cover"><div class="icon">🧭</div><h1>页面不存在</h1><p><a href="#/">返回学习总览</a></p></div>`;
}

/* ---------------- 路由 ---------------- */
function route() {
  stopTimer();
  const hash = location.hash || '#/';
  const [_, page, arg] = hash.split('/');
  document.getElementById('sidebar').classList.remove('open');
  content.scrollTop = 0;
  window.scrollTo(0, 0);
  if (page === 'stage') pageStage(arg);
  else if (page === 'lesson') pageLesson(arg);
  else if (page === 'exam') pageExam(arg);
  else if (page === 'playground') { renderPlayground(content); setBreadcrumb([['命令练习场', null]]); }
  else if (page === 'reference') pageReference();
  else pageHome();
  renderNav(hash.startsWith('#/') && hash !== '#/' ? hash : (page ? '#/' + page : '#/'));
}

window.addEventListener('hashchange', route);
document.getElementById('menu-btn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

/* 内容区宽度调节（标准 / 宽 / 全宽），选择持久化 */
const WKEY = 'linux-study-width';
function applyWidth(w) {
  const wrap = document.getElementById('main-wrap');
  wrap.classList.toggle('w-wide', w === 'wide');
  wrap.classList.toggle('w-full', w === 'full');
  document.querySelectorAll('#width-ctrl button').forEach((b) => b.classList.toggle('active', b.dataset.w === w));
  try { localStorage.setItem(WKEY, w); } catch { /* 忽略 */ }
}
document.getElementById('width-ctrl').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) applyWidth(btn.dataset.w);
});
let savedWidth = 'narrow';
try { savedWidth = localStorage.getItem(WKEY) || 'narrow'; } catch { /* 忽略 */ }
applyWidth(savedWidth);
/* 本地双站导航：仅本地服务时显示（../ 为统一门户首页）；托管环境下隐藏避免死链 */
if (/^(localhost|127.0.0.1|[::1]|::1)$/.test(location.hostname)) {
  document.getElementById('nav-progress')?.insertAdjacentHTML('beforebegin',
    '<a class="nav-link" href="../" style="margin-top:8px">📚 学习站导航</a>');
}
route();

/* 从速查表带命令进入练习场 */
const pgCmd = sessionStorage.getItem('pg-cmd');
if (pgCmd && location.hash === '#/playground') {
  sessionStorage.removeItem('pg-cmd');
  const input = document.getElementById('pg-in');
  if (input) { input.value = pgCmd; input.focus(); }
}
