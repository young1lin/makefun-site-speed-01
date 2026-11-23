/** Hand-constructed valid sites exercising makefun-site edge behaviour. Oracle: vendor baseline. */

const baseTpl = {
  head: '<!doctype html><html><head><title>{{ page.title }}</title></head><body>\n',
  footer: '</body></html>\n',
  page: '{% include "head" %}<h1>{{ page.title }}</h1>{{{ page.content }}}{% include "footer" %}',
  post: '{% include "head" %}<h1>{{ page.title }}</h1><time>{{ page.date }}</time>{{{ page.content }}}<nav>{% if page.newer %}<a href="{{ page.newer.url }}">n</a>{% endif %}{% if page.older %}<a href="{{ page.older.url }}">o</a>{% endif %}</nav>{% include "footer" %}',
  index: '{% include "head" %}{% for p in posts %}<a href="{{ p.url }}">{{ p.title }}</a>{% endfor %}<span>{{ pager.number }}/{{ pager.total }}</span>{% include "footer" %}',
  tag: '{% include "head" %}<h1>{{ tag.name }}</h1>{% for p in tag.posts %}<a href="{{ p.url }}">{{ p.title }}</a>{% endfor %}{% include "footer" %}',
  tags: '{% include "head" %}{% for t in tags %}<a href="{{ t.url }}">{{ t.name }}({{ t.count }})</a>{% endfor %}{% include "footer" %}',
};

const site = (over = {}) => ({
  title: 'Hand Suite',
  base_url: 'https://hand.example/',
  per_page: 2,
  recent: 2,
  ...over,
});

export const handCases = [
  {
    id: 'hand-minimal-page',
    note: 'single root page',
    input: {
      site: site({ per_page: 5 }),
      templates: { ...baseTpl },
      files: [{ path: 'hello.md', content: '---\ntitle: Hello\n---\n\nPlain paragraph.\n' }],
    },
  },
  {
    id: 'hand-unicode-slug',
    note: 'NFKD slug from café title',
    input: {
      site: site(),
      templates: { ...baseTpl },
      files: [{ path: 'cafe.md', content: '---\ntitle: Café Français\n---\n\nUnicode in title only.\n' }],
    },
  },
  {
    id: 'hand-slug-collision',
    note: 'uniqueSlug suffix on duplicate titles',
    input: {
      site: site(),
      templates: { ...baseTpl },
      files: [
        { path: 'a-first.md', content: '---\ntitle: Same Title\n---\n\nFirst.\n' },
        { path: 'b-second.md', content: '---\ntitle: Same Title\n---\n\nSecond.\n' },
      ],
    },
  },
  {
    id: 'hand-post-order-tags',
    note: 'post date order, tag dedupe and tag index order',
    input: {
      site: site({ per_page: 10 }),
      templates: { ...baseTpl },
      files: [
        { path: 'posts/a.md', content: '---\ntitle: Alpha Post\ndate: 2024-01-02\ntags: [Rust, rust]\n---\n\nA.\n' },
        { path: 'posts/b.md', content: '---\ntitle: Beta Post\ndate: 2024-06-01\ntags: [Rust, Go]\n---\n\nB.\n' },
        { path: 'posts/c.md', content: '---\ntitle: Gamma Post\ndate: 2024-03-15\ntags: [go]\n---\n\nC.\n' },
      ],
    },
  },
  {
    id: 'hand-markdown-escape',
    note: 'inline escapes and raw HTML escaped',
    input: {
      site: site(),
      templates: { ...baseTpl },
      files: [
        {
          path: 'esc.md',
          content:
            '---\ntitle: Escape Table\n---\n\n' +
            'Use `code` and *em* and **strong** and [link](other.md) and \\*literal\\*.\n\n' +
            'Chars: & < > " \' \n',
        },
        { path: 'other.md', content: '---\ntitle: Other\n---\n\nTarget.\n' },
      ],
    },
  },
  {
    id: 'hand-links-mixed',
    note: 'absolute, mailto, hash, broken, static',
    input: {
      site: site(),
      templates: { ...baseTpl },
      files: [
        {
          path: 'links.md',
          content:
            '---\ntitle: Links\n---\n\n' +
            '[rel](other.md) [abs](https://x.test/y) [root](/z) [#h](#frag) [bad](../missing.md) [static](assets/x.txt)\n',
        },
        { path: 'other.md', content: '---\ntitle: Other\n---\n\nT.\n' },
        { path: 'assets/x.txt', content: 'static-bytes\n' },
      ],
    },
  },
  {
    id: 'hand-draft-refuse-reserved',
    note: 'draft line in report, refused reserved/tag path, unknown key refusal',
    input: {
      site: site(),
      templates: { ...baseTpl },
      files: [
        { path: 'posts/draft.md', content: '---\ntitle: Draft Post\ndate: 2024-01-01\ndraft: true\n---\n\nHidden.\n' },
        { path: 'tags/evil.md', content: '---\ntitle: Evil\n---\n\nNope.\n' },
        { path: 'bad.md', content: '---\ntitle: Bad\nauthor: x\n---\n\nRefused.\n' },
        { path: 'ok.md', content: '---\ntitle: OK\n---\n\nFine.\n' },
      ],
    },
  },
  {
    id: 'hand-template-include-depth',
    note: 'nested includes to depth 8',
    input: {
      site: site(),
      templates: {
        ...baseTpl,
        i7: '{% include "i6" %}',
        i6: '{% include "i5" %}',
        i5: '{% include "i4" %}',
        i4: '{% include "i3" %}',
        i3: '{% include "i2" %}',
        i2: '{% include "i1" %}',
        i1: '{% include "i0" %}',
        i0: 'DEPTH',
        page: '{% include "head" %}{% include "i7" %}{{{ page.content }}}{% include "footer" %}',
      },
      files: [{ path: 'deep.md', content: '---\ntitle: Deep\nlayout: page\n---\n\nBody.\n' }],
    },
  },
  {
    id: 'hand-template-raw-escape',
    note: '{{ escape }} vs {{{ raw }}}',
    input: {
      site: site(),
      templates: {
        ...baseTpl,
        page: '{% include "head" %}<p>{{ page.title }}</p><div>{{{ page.content }}}</div>{% include "footer" %}',
      },
      files: [{ path: 'raw.md', content: '---\ntitle: "<script>"\n---\n\n<p> & " \'\n' }],
    },
  },
  {
    id: 'hand-pager',
    note: 'per_page=2 with 5 posts',
    input: {
      site: site({ per_page: 2 }),
      templates: { ...baseTpl },
      files: Array.from({ length: 5 }, (_, i) => ({
        path: `posts/p${i}.md`,
        content: `---\ntitle: Post ${i}\ndate: 2024-01-${String(i + 1).padStart(2, '0')}\n---\n\nText ${i}.\n`,
      })),
    },
  },
  {
    id: 'hand-static-shadow',
    note: 'static refused when page took path',
    input: {
      site: site(),
      templates: { ...baseTpl },
      files: [
        { path: 'taken.md', content: '---\ntitle: Taken Path\nslug: assets/data\n---\n\nPage wins.\n' },
        { path: 'assets/data', content: 'would-be-static\n' },
      ],
    },
  },
  {
    id: 'hand-crlf',
    note: 'CRLF normalised in md sources',
    input: {
      site: site(),
      templates: { ...baseTpl },
      files: [{ path: 'crlf.md', content: '---\r\ntitle: CRLF\r\n---\r\n\r\nLine.\r\n' }],
    },
  },
  {
    id: 'hand-empty-posts',
    note: 'no posts still builds index and tags',
    input: {
      site: site(),
      templates: { ...baseTpl },
      files: [{ path: 'only-page.md', content: '---\ntitle: Lonely\n---\n\nNo posts.\n' }],
    },
  },
  {
    id: 'hand-malformed-layout',
    note: 'unclosed template adds report not throw',
    input: {
      site: site(),
      templates: {
        ...baseTpl,
        broken: '{% if page %}{% endif %}',
        page: '{% include "head" %}{{ page.title }}{% include "footer" %}',
      },
      files: [
        { path: 'use-broken.md', content: '---\ntitle: Bad Layout\nlayout: broken\n---\n\nX.\n' },
        { path: 'ok.md', content: '---\ntitle: OK\n---\n\nY.\n' },
      ],
    },
  },
  {
    id: 'hand-page-tags-no-post',
    note: 'page tags without matching post tag',
    input: {
      site: site(),
      templates: { ...baseTpl },
      files: [
        { path: 'posts/p.md', content: '---\ntitle: P\ndate: 2024-01-01\ntags: [Only]\n---\n\nP.\n' },
        { path: 'about.md', content: '---\ntitle: About\ntags: [Only, Missing]\n---\n\nA.\n' },
      ],
    },
  },
];