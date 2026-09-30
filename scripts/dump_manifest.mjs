/* 导出课程/考试清单，供浏览器回归脚本使用：node scripts/dump_manifest.mjs */
import { stages, exams } from '../js/data.js';
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync(new URL('../.shots/', import.meta.url), { recursive: true });
const manifest = {
  lessons: stages.flatMap((s) => s.lessons.map((l) => l.id)),
  exams: exams.map((e) => e.id),
};
writeFileSync(new URL('../.shots/manifest.json', import.meta.url), JSON.stringify(manifest, null, 2));
console.log(`manifest: ${manifest.lessons.length} lessons, ${manifest.exams.length} exams`);
