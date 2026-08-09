/**
 * DocViewer.jsx —— 内置文档查看器
 *
 * 侧边栏展示 docs/nav.cjs 生成的导航分组，正文用 react-markdown 渲染
 * content/ 目录下的 Markdown。全部内容打包进 renderer，无需网络。
 */
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildNav, findDoc, extractHeadings } from './nav.cjs';
import './docs.css';

const CONTENT_GLOB = import.meta.glob('./content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** 以文件名索引的原始 Markdown 内容 */
const CONTENT_BY_FILE = Object.fromEntries(
  Object.entries(CONTENT_GLOB).map(([path, raw]) => [path.split('/').pop(), raw]),
);

function DocViewer() {
  const nav = useMemo(() => buildNav(), []);
  const [activeId, setActiveId] = useState(nav[0].items[0].id);

  useEffect(() => {
    document.title = '文档 · lo-agent';
  }, []);

  const doc = findDoc(activeId);
  const raw = doc ? CONTENT_BY_FILE[doc.file] || '' : '';
  const headings = useMemo(() => extractHeadings(raw), [raw]);

  return (
    <div className="docs-layout">
      <aside className="docs-nav">
        {nav.map((group) => (
          <div key={group.title} className="docs-group">
            <h4 className="docs-group-title">{group.title}</h4>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={item.id === activeId ? 'active' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveId(item.id);
                    }}
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>

      <section className="docs-content">
        <article className="docs-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{raw}</ReactMarkdown>
        </article>
        {headings.length > 0 && (
          <nav className="docs-toc">
            <h5>本页目录</h5>
            <ul>
              {headings.map((h) => (
                <li key={h.slug} style={{ paddingLeft: (h.level - 1) * 10 }}>
                  <a href={`#${h.slug}`}>{h.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </section>
    </div>
  );
}

export default DocViewer;
