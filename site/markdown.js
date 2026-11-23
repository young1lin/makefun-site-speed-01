import { escapeHtml, slugify, uniqueSlug } from './text.js';

const BLANK = /^[ \t]*$/;
const FENCE_OPEN = /^```([A-Za-z0-9_+-]*)[ \t]*$/;
const FENCE_CLOSE = /^```[ \t]*$/;
const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*$/;
const HR = /^(?:---|\*\*\*)[ \t]*$/;
const QUOTE = /^>/;
const BULLET = /^[-*] (.*)$/;
const ORDERED = /^(\d{1,9})\. (.*)$/;
const CONTINUED = /^ {2,}\S/;

function headingOf(line) {
  const m = HEADING.exec(line);
  return m === null || m[2] === '' ? null : { depth: m[1].length, text: m[2] };
}

function endsParagraph(line) {
  return BLANK.test(line) || FENCE_OPEN.test(line) || headingOf(line) !== null || HR.test(line);
}

const trimLine = (line) => line.replace(/^[ \t]+|[ \t]+$/g, '');

export function lex(src) {
  const lines = src.split('\n');
  const tokens = [];
  let i = 0;
  const n = lines.length;
  while (i < n) {
    const line = lines[i];
    if (BLANK.test(line)) {
      i++;
      continue;
    }
    const fence = FENCE_OPEN.exec(line);
    if (fence !== null) {
      const body = [];
      i++;
      while (i < n && !FENCE_CLOSE.test(lines[i])) body.push(lines[i++]);
      i++;
      tokens.push({ type: 'code', lang: fence[1], lines: body });
      continue;
    }
    const heading = headingOf(line);
    if (heading !== null) {
      tokens.push({ type: 'heading', depth: heading.depth, text: heading.text });
      i++;
      continue;
    }
    if (HR.test(line)) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const body = [];
      while (i < n && QUOTE.test(lines[i])) body.push(lines[i++].replace(/^> ?/, ''));
      tokens.push({ type: 'blockquote', lines: body.map(trimLine).filter((l) => l !== '') });
      continue;
    }
    const bullet = BULLET.exec(line);
    const ordered = bullet === null ? ORDERED.exec(line) : null;
    if (bullet !== null || ordered !== null) {
      const isOrdered = ordered !== null;
      const marker = isOrdered ? ORDERED : BULLET;
      const items = [];
      while (i < n) {
        const m = marker.exec(lines[i]);
        if (m !== null) {
          items.push([trimLine(isOrdered ? m[2] : m[1])]);
          i++;
        } else if (CONTINUED.test(lines[i])) {
          items[items.length - 1].push(trimLine(lines[i]));
          i++;
        } else break;
      }
      tokens.push({ type: 'list', ordered: isOrdered, start: isOrdered ? Number(ordered[1]) : 1, items: items.map((parts) => parts.join('\n')) });
      continue;
    }
    const body = [trimLine(line)];
    i++;
    while (i < n && !endsParagraph(lines[i])) body.push(trimLine(lines[i++]));
    tokens.push({ type: 'paragraph', text: body.join('\n') });
  }
  return tokens;
}

const ESCAPABLE = new Set(['\\', '`', '*', '_', '[', ']', '(', ')', '#', '+', '-', '.', '!', '>']);

function findUnescaped(s, what, from) {
  const wlen = what.length;
  const slen = s.length;
  for (let j = from; j <= slen - wlen; j++) {
    if (s[j] === '\\' && j + 1 < slen && ESCAPABLE.has(s[j + 1])) {
      j++;
      continue;
    }
    if (s.startsWith(what, j)) return j;
  }
  return -1;
}

function findSingleStar(s, from) {
  const slen = s.length;
  for (let j = from; j < slen; j++) {
    const c = s[j];
    if (c === '\\' && j + 1 < slen && ESCAPABLE.has(s[j + 1])) {
      j++;
      continue;
    }
    if (c !== '*') continue;
    if (s[j + 1] === '*') {
      j++;
      continue;
    }
    return j;
  }
  return -1;
}

const ESCAPE_CHARS = /[&<>"']/;

function flushPlain(parts, s, start, end) {
  if (end <= start) return;
  const chunk = s.slice(start, end);
  parts.push(ESCAPE_CHARS.test(chunk) ? escapeHtml(chunk) : chunk);
}

export function inline(s, env) {
  const parts = [];
  let i = 0;
  const slen = s.length;
  let plainStart = 0;
  while (i < slen) {
    const c = s[i];
    if (c === '\\' && i + 1 < slen && ESCAPABLE.has(s[i + 1])) {
      flushPlain(parts, s, plainStart, i);
      plainStart = i + 2;
      parts.push(escapeHtml(s[i + 1]));
      i += 2;
      continue;
    }
    if (c === '`') {
      flushPlain(parts, s, plainStart, i);
      const j = s.indexOf('`', i + 1);
      if (j > i + 1) {
        parts.push(`<code>${escapeHtml(s.slice(i + 1, j))}</code>`);
        i = j + 1;
      } else {
        parts.push('`');
        i++;
      }
      plainStart = i;
      continue;
    }
    if (c === '*') {
      flushPlain(parts, s, plainStart, i);
      if (s[i + 1] === '*') {
        const j = findUnescaped(s, '**', i + 2);
        if (j > i + 2) {
          parts.push(`<strong>${inline(s.slice(i + 2, j), env)}</strong>`);
          i = j + 2;
        } else {
          parts.push('**');
          i += 2;
        }
      } else {
        const j = findSingleStar(s, i + 1);
        if (j > i + 1) {
          parts.push(`<em>${inline(s.slice(i + 1, j), env)}</em>`);
          i = j + 1;
        } else {
          parts.push('*');
          i++;
        }
      }
      plainStart = i;
      continue;
    }
    if (c === '[') {
      flushPlain(parts, s, plainStart, i);
      const k = findUnescaped(s, ']', i + 1);
      const m = k !== -1 && s[k + 1] === '(' ? s.indexOf(')', k + 2) : -1;
      const target = m === -1 ? '' : s.slice(k + 2, m);
      if (target !== '' && !/\s/.test(target)) {
        parts.push(`<a href="${escapeHtml(env.link(target))}">${inline(s.slice(i + 1, k), env)}</a>`);
        i = m + 1;
      } else {
        parts.push('[');
        i++;
      }
      plainStart = i;
      continue;
    }
    i++;
  }
  flushPlain(parts, s, plainStart, slen);
  return parts.length === 1 ? parts[0] : parts.join('');
}

export function renderMarkdown(src, env) {
  const ids = new Set();
  const blocks = [];
  const toc = [];
  let excerpt = null;
  const tokens = lex(src);
  for (let ti = 0; ti < tokens.length; ti++) {
    const t = tokens[ti];
    switch (t.type) {
      case 'heading': {
        const id = uniqueSlug(slugify(t.text), ids);
        const html = inline(t.text, env);
        blocks.push(`<h${t.depth} id="${id}">${html}</h${t.depth}>`);
        if (t.depth === 2 || t.depth === 3) toc.push({ level: t.depth, id, html });
        break;
      }
      case 'code': {
        const cls = t.lang === '' ? '' : ` class="language-${escapeHtml(t.lang)}"`;
        const lines = t.lines;
        let code = '';
        for (let li = 0; li < lines.length; li++) code += `${escapeHtml(lines[li])}\n`;
        blocks.push(`<pre><code${cls}>${code}</code></pre>`);
        break;
      }
      case 'hr':
        blocks.push('<hr>');
        break;
      case 'blockquote':
        blocks.push(t.lines.length === 0 ? '<blockquote>\n</blockquote>' : `<blockquote>\n<p>${inline(t.lines.join('\n'), env)}</p>\n</blockquote>`);
        break;
      case 'list': {
        const tag = t.ordered ? 'ol' : 'ul';
        const open = t.ordered && t.start !== 1 ? `<ol start="${t.start}">` : `<${tag}>`;
        const items = t.items;
        let lis = '';
        for (let ii = 0; ii < items.length; ii++) lis += `<li>${inline(items[ii], env)}</li>\n`;
        blocks.push(`${open}\n${lis}</${tag}>`);
        break;
      }
      case 'paragraph': {
        const html = inline(t.text, env);
        if (excerpt === null) excerpt = html;
        blocks.push(`<p>${html}</p>`);
        break;
      }
    }
  }
  let html = '';
  for (let bi = 0; bi < blocks.length; bi++) html += `${blocks[bi]}\n`;
  return { html, toc, excerpt: excerpt ?? '' };
}