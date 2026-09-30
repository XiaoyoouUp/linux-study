/* 内容块渲染：把课程数据渲染为 HTML（配合 css/style.css） */
import { renderQuizBlock } from './quiz.js';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* 简单语法着色（bash / yaml），不追求完整，只提升可读性 */
function highlight(code, lang) {
  return code.split('\n').map((line) => {
    if (lang === 'yaml') return hlYamlLine(line);
    return hlBashLine(line);
  }).join('\n');
}
function wrap(text, cls) { return `<span class="${cls}">${esc(text)}</span>`; }
function hlBashLine(line) {
  if (/^\s*#/.test(line)) return wrap(line, 'tok-cm');
  let out = '', body = line;
  const cm = line.match(/^(\s*\$\s*)([\w./@-]+)(.*)$/);
  if (cm) { out += wrap(cm[1], 'tok-cm') + wrap(cm[2], 'tok-cmd'); body = cm[3]; }
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(--?[\w][\w.-]*)|(\b\d+\b)/g;
  let last = 0, m;
  while ((m = re.exec(body))) {
    out += esc(body.slice(last, m.index));
    if (m[1]) out += wrap(m[1], 'tok-str');
    else if (m[2]) out += wrap(m[2], 'tok-flag');
    else out += wrap(m[3], 'tok-num');
    last = m.index + m[0].length;
  }
  return out + esc(body.slice(last));
}
function hlYamlLine(line) {
  if (/^\s*#/.test(line)) return wrap(line, 'tok-cm');
  const m = line.match(/^(\s*-?\s*)([\w./-]+)(:)(.*)$/);
  if (m) {
    let rest = m[4];
    rest = rest
      .replace(/(".*?"|'.*?')/g, (t) => wrap(t, 'tok-str'))
      .replace(/\b(true|false|null)\b/g, (t) => wrap(t, 'tok-num'))
      .replace(/\b(\d+)\b/g, (t) => wrap(t, 'tok-num'));
    return wrap(m[1] + m[2], 'tok-key') + esc(m[3]) + rest;
  }
  return esc(line).replace(/\b(\d+)\b/g, (t) => wrap(t, 'tok-num'));
}

function renderCode(b) {
  const head = `${b.file ? esc(b.file) : (b.lang === 'yaml' ? 'YAML' : 'bash')}`;
  return `<div class="codeblock"><div class="cb-head"><span>${head}</span><button class="cb-copy" type="button">复制</button></div><pre><code>${highlight(b.code, b.lang)}</code></pre>${b.out ? `<pre class="cb-out"><code>${esc(b.out)}</code></pre>` : ''}</div>`;
}

function renderDiagram(b) {
  return `<figure class="diagram"><img loading="lazy" src="./diagrams/${esc(b.src)}" alt="${esc(b.caption)}"><figcaption><b>${esc(b.caption)}</b>　${b.desc ? esc(b.desc) : ''}</figcaption></figure>`;
}

export function renderBlock(b, ctx = {}) {
  switch (b.t) {
    case 'h2': return `<h2 id="h-${esc(b.text).replace(/\s/g, '-')}">${esc(b.text)}</h2>`;
    case 'h3': return `<h3>${esc(b.text)}</h3>`;
    case 'p': return `<p>${b.html}</p>`;
    case 'list': return `<${b.ordered ? 'ol' : 'ul'}>${b.items.map((i) => `<li>${i}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`;
    case 'code': return renderCode(b);
    case 'callout': return `<div class="callout ${esc(b.kind)}"><div class="co-title">${{ info: 'ℹ️', tip: '💡', warn: '⚠️', cka: '🎯' }[b.kind] || 'ℹ️'} ${esc(b.title)}</div><p>${b.text}</p></div>`;
    case 'diagram': return renderDiagram(b);
    case 'table': {
      const head = `<tr>${b.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
      const body = b.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
      return `<div class="tablewrap"><table class="tb">${head}${body}</table></div>`;
    }
    case 'quiz': return renderQuizBlock(b, ctx);
    default: return '';
  }
}

export function renderBlocks(blocks, ctx = {}) {
  return `<div class="content">${blocks.map((b) => renderBlock(b, ctx)).join('\n')}</div>`;
}

export function renderCommandSheet(commands) {
  if (!commands || !commands.length) return '';
  return `<div class="cmdsheet"><h3>本课命令速查</h3><table>${commands.map((c) =>
    `<tr><td><code>${esc(c.cmd)}</code></td><td>${esc(c.desc)}</td></tr>`).join('')}</table></div>`;
}

export function renderKeyPoints(points) {
  if (!points || !points.length) return '';
  return `<div class="keypoints"><h3>📌 本课小结</h3><ul>${points.map((p) => `<li>${p}</li>`).join('')}</ul></div>`;
}
