/* 学习进度持久化（localStorage） */
const KEY = 'linux-study-v1';
let state = load();
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 隐私模式等场景忽略 */ } }

export const store = {
  isLessonDone: (id) => !!(state.lessons && state.lessons[id]),
  markLessonDone(id, done = true) {
    state.lessons = state.lessons || {};
    if (done) state.lessons[id] = Date.now(); else delete state.lessons[id];
    save();
  },
  getQuiz: (id) => (state.quizzes ? state.quizzes[id] : undefined),
  saveQuiz(id, score, total) {
    state.quizzes = state.quizzes || {};
    state.quizzes[id] = { score, total, at: Date.now() };
    save();
  },
  getExam: (id) => (state.exams ? state.exams[id] : undefined),
  saveExam(id, result) {
    state.exams = state.exams || {};
    state.exams[id] = { ...result, at: Date.now() };
    save();
  },
  isTaskDone: (id) => !!(state.tasks && state.tasks[id]),
  markTaskDone(id) {
    state.tasks = state.tasks || {};
    state.tasks[id] = Date.now();
    save();
  },
  summary(totalLessons) {
    const lessonsDone = Object.keys(state.lessons || {}).length;
    const quizCount = Object.keys(state.quizzes || {}).length;
    const examCount = Object.keys(state.exams || {}).length;
    const taskCount = Object.keys(state.tasks || {}).length;
    return { lessonsDone, quizCount, examCount, taskCount, percent: totalLessons ? Math.round((lessonsDone / totalLessons) * 100) : 0 };
  },
  reset() { state = {}; save(); },
};
