/** Markdown 渲染器：支持 GFM 表格 + Mermaid 图表
 * 流式输出时，未闭合的 mermaid 代码块不渲染为图表，只显示为代码
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Components } from 'react-markdown';
import MermaidChart from './MermaidChart';

const components: Components = {
  code({ className, children, ...props }) {
    const text = String(children).replace(/\n$/, '');
    // mermaid 代码块（由 ```mermaid 包裹的完整代码块）
    if (className === 'language-mermaid' || /^mermaid\b/.test(text)) {
      return <MermaidChart chart={text} />;
    }
    // 行内代码
    if (!className && !text.includes('\n')) {
      return <code>{children}</code>;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre({ children }) {
    // pre 包裹 code，mermaid 已自行渲染，其余直接透传
    return <>{children}</>;
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

export default function MarkdownRenderer({ content }: { content: string }) {
  // 流式输出时，检查最后是否有未闭合的代码块
  // 如果有，临时移除未闭合部分，避免 react-markdown 错误解析
  let processedContent = content;
  const lastFence = content.lastIndexOf('```');
  if (lastFence !== -1) {
    const afterFence = content.slice(lastFence + 3);
    // 如果 ``` 后面到内容结尾没有换行后的闭合 ```, 说明代码块未完成
    const hasClosing = /```\s*$/.test(content) && lastFence !== content.length - 3;
    if (!hasClosing && afterFence.split('```').length === 1) {
      // 未闭合的代码块，截断到最后一个闭合的代码块
      // 找到最后一个完整的代码块结束位置
      const beforeLastFence = content.slice(0, lastFence);
      const completeBlocks = beforeLastFence.split(/```/);
      // 如果有完整的代码块对（偶数个 ```），最后一个 ``` 是新代码块的开始
      if (completeBlocks.length % 2 === 1) {
        // 有未闭合的代码块，暂时移除
        processedContent = beforeLastFence;
      }
    }
  }

  return (
    <div className="report-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
