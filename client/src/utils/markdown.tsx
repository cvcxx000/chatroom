import React from 'react';

/**
 * 轻量 Markdown 渲染（零依赖，正则实现）。
 * 支持：
 *  - **粗体** / *斜体* / `行内代码`
 *  - ```代码块```（多行，等宽字体深色背景）
 *  - [链接](url) 以及裸 URL 自动识别
 *  - 以 `- ` 开头的无序列表
 * 全部通过 React 元素构建，不使用 dangerouslySetInnerHTML，无 XSS 风险。
 */

const INLINE_RE =
  /(`[^`\n]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\([^)\s]+\))/g;
const URL_RE = /(https?:\/\/[^\s<]+)/g;

function renderUrls(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const url = m[1];
    out.push(
      <a key={`${keyPrefix}-u${k++}`} href={url} target="_blank" rel="noreferrer">
        {url}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) {
      out.push(...renderUrls(text.slice(last, m.index), `${keyPrefix}-${k}`));
    }
    const token = m[0];
    const key = `${keyPrefix}-t${k}`;
    if (token.startsWith('`')) {
      out.push(
        <code key={key} className="md-inline-code">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('[')) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (lm) {
        out.push(
          <a key={key} href={lm[2]} target="_blank" rel="noreferrer">
            {lm[1]}
          </a>,
        );
      } else {
        out.push(token);
      }
    }
    k += 1;
    last = m.index + token.length;
  }
  if (last < text.length) out.push(...renderUrls(text.slice(last), `${keyPrefix}-${k}`));
  return out;
}

/**
 * 将消息文本渲染为 React 节点。
 */
export function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  // 1) 按 ``` 围栏切分出代码块与普通文本
  const segments: Array<{ type: 'code' | 'text'; value: string }> = [];
  const fenceRe = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) });
    segments.push({ type: 'code', value: m[2].replace(/\n$/, '') });
    last = fenceRe.lastIndex;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });

  const nodes: React.ReactNode[] = [];
  segments.forEach((seg, si) => {
    if (seg.type === 'code') {
      nodes.push(
        <pre key={`c${si}`} className="md-code-block">
          <code>{seg.value}</code>
        </pre>,
      );
      return;
    }
    // 2) 普通文本：按行处理，识别无序列表
    const lines = seg.value.split('\n');
    let listBuffer: string[] = [];
    const flushList = () => {
      if (listBuffer.length === 0) return;
      const items = listBuffer;
      listBuffer = [];
      nodes.push(
        <ul key={`l${si}-${items.length}`} className="md-list">
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, `l${si}-${i}`)}</li>
          ))}
        </ul>,
      );
    };
    lines.forEach((line, li) => {
      const isItem = /^\s*[-*]\s+/.test(line);
      if (isItem) {
        listBuffer.push(line.replace(/^\s*[-*]\s+/, ''));
      } else {
        flushList();
        if (line.trim() === '') {
          nodes.push(<br key={`br${si}-${li}`} />);
        } else {
          nodes.push(<div key={`p${si}-${li}`}>{renderInline(line, `p${si}-${li}`)}</div>);
        }
      }
    });
    flushList();
  });

  return nodes;
}

export default renderMarkdown;
