/* 测验引擎：随堂测验（即时判分）+ 考试题目渲染与评分 */
import { esc } from './components.js';
import { store } from './store.js';

const TYPE_LABEL = { single: '单选', multi: '多选', judge: '判断' };

function optionLabel(i) { return String.fromCharCode(65 + i); }

export function isAnswerCorrect(q, picked) {
  const right = [...q.answer].sort().join(',');
  const mine = [...(picked || [])].sort().join(',');
  return right === mine && mine !== '';
}

function normalizePicked(q, picked) {
  if (q.type === 'judge') return picked.length ? [picked[0] === '正确' || picked[0] === 0 ? 0 : 1] : [];
  return picked;
}

export function gradeQuestions(questions, picks) {
  let score = 0;
  const per = questions.map((q, i) => {
    const correct = isAnswerCorrect(q, normalizePicked(q, picks[i] || []));
    if (correct) score++;
    return { id: q.id, correct };
  });
  return { score, total: questions.length, per };
}

/* 渲染一道题的题干与选项（复用于随堂/考试）；picked 用于回显 */
export function questionHtml(q, idx, picked = [], disabled = false) {
  const opts = (q.type === 'judge' ? ['正确', '错误'] : q.options).map((opt, oi) => {
    const sel = picked.includes(oi) ? ' sel' : '';
    const input = q.type === 'multi' ? 'checkbox' : 'radio';
    return `<label class="q-opt${sel}${disabled ? ' disabled' : ''}" data-q="${esc(q.id)}" data-opt="${oi}">
      <input type="${input}" name="${esc(q.id)}" ${picked.includes(oi) ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <span class="opt-tag">${optionLabel(oi)}</span><span>${opt}</span></label>`;
  }).join('');
  return `<div class="q-item" data-qid="${esc(q.id)}" data-type="${q.type}">
    <div class="q-text"><span class="q-no">${idx + 1}.</span>（${TYPE_LABEL[q.type] || '单选'}）${q.q}</div>
    <div class="q-opts">${opts}</div></div>`;
}

export function bindQuestionEvents(root, onChange) {
  root.addEventListener('click', (e) => {
    const label = e.target.closest('.q-opt');
    if (!label || label.classList.contains('disabled')) return;
    const qid = label.dataset.q;
    const oi = Number(label.dataset.opt);
    const item = root.querySelector(`.q-item[data-qid="${CSS.escape(qid)}"]`);
    const type = item.dataset.type;
    if (type === 'multi') {
      const input = label.querySelector('input');
      input.checked = !input.checked;
      label.classList.toggle('sel', input.checked);
    } else {
      item.querySelectorAll('.q-opt').forEach((el) => { el.classList.remove('sel'); el.querySelector('input').checked = false; });
      label.classList.add('sel');
      label.querySelector('input').checked = true;
    }
    if (onChange) onChange(qid, oi);
  });
}

export function collectPicks(root) {
  const picks = {};
  root.querySelectorAll('.q-item').forEach((item) => {
    const qid = item.dataset.qid;
    picks[qid] = [];
    item.querySelectorAll('.q-opt.sel').forEach((el) => picks[qid].push(Number(el.dataset.opt)));
  });
  return picks;
}

/* ---------- 随堂测验块 ---------- */
export function renderQuizBlock(quiz, ctx = {}) {
  const prev = ctx.preview ? null : store.getQuiz(quiz.id);
  const inner = quiz.questions.map((q, i) => questionHtml(q, i)).join('');
  const prevChip = prev ? `<span class="chip ok" title="上次成绩">上次 ${prev.score}/${prev.total}</span>` : '';
  return `<section class="quiz" data-quiz="${esc(quiz.id)}">
    <div class="quiz-head">✏️ ${esc(quiz.title || '随堂小测')} ${prevChip}</div>
    <div class="quiz-body">${inner}
      <div class="q-actions"><button class="btn btn-primary q-submit" type="button">提交答案</button><span class="q-hint">共 ${quiz.questions.length} 题，提交后查看解析</span></div>
      <div class="q-result"></div>
    </div></section>`;
}

export function bindQuizBlock(root, quiz) {
  const section = root.querySelector(`.quiz[data-quiz="${CSS.escape(quiz.id)}"]`);
  if (!section) return;
  const body = section.querySelector('.quiz-body');
  bindQuestionEvents(body);
  section.querySelector('.q-submit').addEventListener('click', () => {
    const picksByQid = collectPicks(body);
    const picks = quiz.questions.map((q) => picksByQid[q.id] || []);
    const { score, total } = gradeQuestions(quiz.questions, picks);
    const pass = score / total >= 0.66;
    const result = section.querySelector('.q-result');
    result.innerHTML = `
      <div class="q-result-banner ${pass ? 'pass' : 'fail'}">${pass ? '🎉 通过！' : '💪 再接再厉！'}得分 ${score} / ${total}</div>
      ${quiz.questions.map((q, i) => {
        const mine = picks[i] || [];
        const ok = isAnswerCorrect(q, mine);
        const item = body.querySelector(`.q-item[data-qid="${CSS.escape(q.id)}"]`);
        item.querySelectorAll('.q-opt').forEach((el, oi) => {
          el.classList.add('disabled');
          if (q.answer.includes(oi)) el.classList.add('right');
          else if (!ok && mine.includes(oi)) el.classList.add('wrong');
        });
        return `<div class="q-explain"><b>${ok ? '✅' : '❌'} 第 ${i + 1} 题</b>　正确答案：${q.answer.map((a) => optionLabel(a)).join('、')}<br>${q.explain}</div>`;
      }).join('')}
      <div class="q-actions"><button class="btn btn-ghost q-retry" type="button">重做</button></div>`;
    section.querySelector('.q-submit').disabled = true;
    section.querySelector('.q-submit').style.display = 'none';
    result.querySelector('.q-retry').addEventListener('click', () => {
      result.innerHTML = '';
      body.querySelectorAll('.q-opt').forEach((el) => { el.classList.remove('sel', 'right', 'wrong', 'disabled'); const inp = el.querySelector('input'); if (inp) inp.checked = false; });
      const btn = section.querySelector('.q-submit');
      btn.disabled = false; btn.style.display = '';
    });
    store.saveQuiz(quiz.id, score, total);
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
