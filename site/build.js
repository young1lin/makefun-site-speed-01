import { parseFrontMatter } from './frontmatter.js';
import { renderMarkdown } from './markdown.js';
import { parseTemplate, renderNodes, TemplateError } from './template.js';
import { escapeHtml, longDate, slugify, uniqueSlug } from './text.js';

export const REPORT_FILE = 'build-report.txt';
export const RESERVED = Object.freeze(['posts', 'tags', 'page']);

const byCodeUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function wordsOf(text) {
  const m = text.match(/\S+/g);
  return m === null ? 0 : m.length;
}

function resolvePath(dir, rel) {
  const parts = dir === '' ? [] : dir.split('/');
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join('/');
}

const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

function readSources(b) {
  const files = b.input.files;
  const sorted = new Array(files.length);
  for (let i = 0; i < files.length; i++) sorted[i] = files[i];
  sorted.sort((x, y) => byCodeUnits(x.path, y.path));
  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i];
    if (f.path.endsWith('.md')) b.sources.push({ path: f.path, text: f.content.replace(/\r\n?/g, '\n') });
    else b.statics.push({ path: f.path, content: f.content });
  }
}

function frontMatter(b) {
  const kept = [];
  const sources = b.sources;
  for (let si = 0; si < sources.length; si++) {
    const s = sources[si];
    const fm = parseFrontMatter(s.text);
    if ('error' in fm) {
      b.report.push(`refused ${s.path}: ${fm.error}`);
      continue;
    }
    s.data = fm.data;
    s.body = fm.body;
    s.post = s.path.startsWith('posts/');
    const own = RESERVED.find((d) => d !== 'posts' && s.path.startsWith(`${d}/`));
    if (own !== undefined) {
      b.report.push(`refused ${s.path}: ${own}/ is the generator's own`);
      continue;
    }
    if (s.post && !Object.hasOwn(s.data, 'date')) {
      b.report.push(`refused ${s.path}: a post needs a date`);
      continue;
    }
    const layout = s.data.layout ?? (s.post ? 'post' : 'page');
    if (!b.templates.has(layout)) {
      b.report.push(`refused ${s.path}: layout "${layout}" is no template that parses`);
      continue;
    }
    s.layout = layout;
    if (s.data.draft === true) {
      b.report.push(`draft ${s.path}`);
      continue;
    }
    kept.push(s);
  }
  b.sources = kept;
}

function permalinks(b) {
  const taken = new Map();
  const takenIn = (dir) => {
    let set = taken.get(dir);
    if (set === undefined) {
      set = new Set(dir === '' ? RESERVED : []);
      taken.set(dir, set);
    }
    return set;
  };
  const sources = b.sources;
  for (let si = 0; si < sources.length; si++) {
    const s = sources[si];
    const dir = s.post ? 'posts' : dirOf(s.path);
    const slug = uniqueSlug(s.data.slug ?? b.slug(s.data.title), takenIn(dir));
    s.slug = slug;
    s.outDir = dir === '' ? slug : `${dir}/${slug}`;
    s.url = `${b.base}/${s.outDir}/`;
    b.bySource.set(s.path, s);
  }
}

function markdown(b) {
  const staticPaths = new Set();
  const statics = b.statics;
  for (let i = 0; i < statics.length; i++) staticPaths.add(statics[i].path);
  const sources = b.sources;
  for (let si = 0; si < sources.length; si++) {
    const s = sources[si];
    const dir = dirOf(s.path);
    const env = {
      link: (target) => {
        if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) || target.startsWith('/') || target.startsWith('#')) return target;
        const hash = target.indexOf('#');
        const rel = hash === -1 ? target : target.slice(0, hash);
        const frag = hash === -1 ? '' : target.slice(hash);
        const path = rel === '' ? null : resolvePath(dir, rel);
        if (path !== null && b.bySource.has(path)) return `${b.bySource.get(path).url}${frag}`;
        if (path !== null && staticPaths.has(path)) return `${b.base}/${path}${frag}`;
        b.broken.add(`broken-link ${s.path} -> ${target}`);
        return target;
      },
    };
    const md = renderMarkdown(s.body, env);
    s.html = md.html;
    s.toc = md.toc;
    s.excerpt = md.excerpt;
  }
}

function collections(b) {
  const posts = [];
  const sources = b.sources;
  for (let i = 0; i < sources.length; i++) if (sources[i].post) posts.push(sources[i]);
  posts.sort((x, y) => byCodeUnits(y.data.date, x.data.date) || byCodeUnits(x.slug, y.slug));
  b.posts = posts;
  for (let k = 0; k < posts.length; k++) {
    posts[k].newer = k === 0 ? null : posts[k - 1];
    posts[k].older = k === posts.length - 1 ? null : posts[k + 1];
  }
}

function tags(b) {
  const slug = b.slug;
  const bySlug = new Map();
  const ownTags = (s) => {
    const seen = new Set();
    const tags = s.data.tags ?? [];
    const out = [];
    for (let i = 0; i < tags.length; i++) {
      const name = tags[i];
      const slugVal = slug(name);
      if (!seen.has(slugVal)) {
        seen.add(slugVal);
        out.push(name);
      }
    }
    return out;
  };
  const posts = b.posts;
  for (let pi = 0; pi < posts.length; pi++) {
    const p = posts[pi];
    p.tagRefs = [];
    const names = ownTags(p);
    for (let ti = 0; ti < names.length; ti++) {
      const name = names[ti];
      const slugName = slug(name);
      let tag = bySlug.get(slugName);
      if (tag === undefined) {
        tag = { name, slug: slugName, url: `${b.base}/tags/${slugName}/`, posts: [] };
        bySlug.set(slugName, tag);
      }
      tag.posts.push(p);
      p.tagRefs.push(tag);
    }
  }
  const sources = b.sources;
  for (let si = 0; si < sources.length; si++) {
    const s = sources[si];
    if (!s.post) {
      const names = ownTags(s);
      const refs = [];
      for (let ti = 0; ti < names.length; ti++) {
        const name = names[ti];
        const slugName = slug(name);
        const tag = bySlug.get(slugName);
        refs.push(tag ?? { name, slug: slugName, url: '', posts: [] });
      }
      s.tagRefs = refs;
    }
  }
  b.tags = [...bySlug.values()].sort((x, y) => y.posts.length - x.posts.length || byCodeUnits(x.slug, y.slug));
}

const linkOf = (s) => (s === null ? null : { title: s.data.title, url: s.url, date: s.data.date ?? '', date_long: s.data.date === undefined ? '' : longDate(s.data.date) });

const tagOf = (b, t) => ({ name: t.name, slug: t.slug, url: t.url, count: t.posts.length, posts: t.posts.map((p) => b.cards.get(p)) });

function cardOf(s) {
  const tagRefs = s.tagRefs;
  const tags = new Array(tagRefs.length);
  for (let i = 0; i < tagRefs.length; i++) {
    const t = tagRefs[i];
    tags[i] = { name: t.name, slug: t.slug, url: t.url };
  }
  return {
    title: s.data.title,
    url: s.url,
    date: s.data.date ?? '',
    date_long: s.data.date === undefined ? '' : longDate(s.data.date),
    summary: s.data.summary ?? '',
    excerpt: s.excerpt,
    reading_minutes: Math.max(1, Math.ceil(wordsOf(s.body) / 200)),
    tags,
  };
}

function pageOf(s) {
  const toc = s.toc;
  const tocOut = new Array(toc.length);
  for (let i = 0; i < toc.length; i++) {
    const h = toc[i];
    tocOut[i] = { level: h.level, id: h.id, html: h.html };
  }
  return {
    ...cardOf(s),
    slug: s.slug,
    content: s.html,
    toc: tocOut,
    newer: linkOf(s.newer ?? null),
    older: linkOf(s.older ?? null),
    is_post: s.post,
  };
}

function layouts(b) {
  const cards = new Map();
  const posts = b.posts;
  for (let i = 0; i < posts.length; i++) cards.set(posts[i], cardOf(posts[i]));
  b.cards = cards;
  const site = { title: b.input.site.title, base_url: b.base };
  const allTags = b.tags.map((t) => ({ name: t.name, slug: t.slug, url: t.url, count: t.posts.length }));
  const recentN = b.input.site.recent;
  const recent = new Array(Math.min(recentN, posts.length));
  for (let i = 0; i < recent.length; i++) recent[i] = cards.get(posts[i]);
  const ctx = { templates: b.templates, escape: escapeHtml };
  const render = (name, vars) => {
    const nodes = b.templates.get(name);
    return nodes === undefined ? null : renderNodes(nodes, { vars: { site, tags: allTags, recent, ...vars }, parent: null }, ctx, 0);
  };
  const sources = b.sources;
  for (let si = 0; si < sources.length; si++) {
    const s = sources[si];
    b.output[`${s.outDir}/index.html`] = render(s.layout, { page: pageOf(s) });
  }
  const per = b.input.site.per_page;
  const pages = Math.max(1, Math.ceil(posts.length / per));
  const indexUrl = (k) => (k === 1 ? `${b.base}/` : `${b.base}/page/${k}/`);
  for (let k = 1; k <= pages; k++) {
    const slice = posts.slice((k - 1) * per, k * per);
    const postCards = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) postCards[i] = cards.get(slice[i]);
    const html = render('index', {
      posts: postCards,
      pager: { number: k, total: pages, url: indexUrl(k), newer_url: k === 1 ? '' : indexUrl(k - 1), older_url: k === pages ? '' : indexUrl(k + 1) },
    });
    if (html !== null) b.output[k === 1 ? 'index.html' : `page/${k}/index.html`] = html;
  }
  const tagList = b.tags;
  for (let ti = 0; ti < tagList.length; ti++) {
    const t = tagList[ti];
    const html = render('tag', { tag: tagOf(b, t) });
    if (html !== null) b.output[`tags/${t.slug}/index.html`] = html;
  }
  const tagsHtml = render('tags', {});
  if (tagsHtml !== null) b.output['tags/index.html'] = tagsHtml;
  const statics = b.statics;
  for (let i = 0; i < statics.length; i++) {
    const f = statics[i];
    if (Object.hasOwn(b.output, f.path)) b.report.push(`shadowed ${f.path}: a built page has its path`);
    else b.output[f.path] = f.content;
  }
}

function report(b) {
  const lines = [...b.report, ...b.broken].sort(byCodeUnits);
  let pages = 0;
  const sources = b.sources;
  for (let i = 0; i < sources.length; i++) if (!sources[i].post) pages++;
  lines.push(`built ${pages} pages, ${b.posts.length} posts, ${b.tags.length} tags and ${b.statics.length} static files`);
  b.output[REPORT_FILE] = `${lines.join('\n')}\n`;
}

const PIPELINE = [readSources, frontMatter, permalinks, markdown, collections, tags, layouts, report];

function makeSlugMemo() {
  const slugCache = new Map();
  return (text) => {
    let s = slugCache.get(text);
    if (s === undefined) {
      s = slugify(text);
      slugCache.set(text, s);
    }
    return s;
  };
}

export function build(input) {
  const slug = makeSlugMemo();
  const templates = new Map();
  const report = [];
  const names = Object.keys(input.templates).sort(byCodeUnits);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    try {
      templates.set(name, parseTemplate(name, input.templates[name]));
    } catch (err) {
      if (!(err instanceof TemplateError)) throw err;
      report.push(err.message);
    }
  }
  const b = {
    input,
    base: input.site.base_url.replace(/\/+$/, ''),
    slug,
    templates,
    sources: [],
    statics: [],
    bySource: new Map(),
    broken: new Set(),
    report,
    posts: [],
    tags: [],
    cards: new Map(),
    output: {},
  };
  for (let pi = 0; pi < PIPELINE.length; pi++) PIPELINE[pi](b);
  return b.output;
}

export function run(input) {
  return build(input);
}