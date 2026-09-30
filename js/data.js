/* 数据注册表：阶段、课程、考试（动态导入，单文件缺失不致整站崩溃） */
const stageIds = ['s1', 's2', 's3', 's4', 's5', 's6'];
const examIds = ['exam1', 'exam2', 'exam3', 'exam4', 'exam5', 'exam-final'];

const stagesLoaded = (await Promise.all(stageIds.map(async (id) => {
  try { return (await import(`../data/stages/${id}.js`)).stage; } catch { return null; }
}))).filter(Boolean).sort((a, b) => a.num - b.num);

const examsLoaded = (await Promise.all(examIds.map(async (id) => {
  try { return (await import(`../data/exams/${id}.js`)).exam; } catch { return null; }
}))).filter(Boolean);

export const stages = stagesLoaded;
export const exams = examsLoaded;
export const allLessons = stages.flatMap((s) => s.lessons);
export const totalLessons = allLessons.length;
export const totalQuestions = stages.reduce((n, s) => n + s.lessons.reduce((m, l) => m + (l.blocks || []).reduce((k, b) => k + (b.t === 'quiz' ? b.questions.length : 0), 0), 0), 0)
  + exams.reduce((n, e) => n + (e.questions ? e.questions.length : 0), 0);

export const stageById = (id) => stages.find((s) => s.id === id);
export const lessonById = (id) => allLessons.find((l) => l.id === id);
export const stageOfLesson = (lessonId) => stages.find((s) => s.lessons.some((l) => l.id === lessonId));
export const examById = (id) => exams.find((e) => e.id === id);
export const examOfStage = (stageId) => exams.find((e) => e.stageId === stageId);

export function lessonNeighbors(lessonId) {
  const i = allLessons.findIndex((l) => l.id === lessonId);
  return { prev: i > 0 ? allLessons[i - 1] : null, next: i > -1 && i < allLessons.length - 1 ? allLessons[i + 1] : null };
}
export const firstLesson = () => allLessons[0];
