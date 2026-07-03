/** Mermaid 图表渲染组件
 * 渲染失败时静默降级为源码显示，不显示冗长错误信息
 */
import { useEffect, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#f5f0e8',
    primaryTextColor: '#16162a',
    primaryBorderColor: '#c9a961',
    lineColor: '#9a7631',
    secondaryColor: '#fbf7ed',
    tertiaryColor: '#f9f4ea',
    background: '#fdfbf7',
    mainBkg: '#f5f0e8',
    nodeBorder: '#c9a961',
    clusterBkg: '#fbf7ed',
    clusterBorder: '#dec06c',
    fontFamily: '"Noto Sans SC", sans-serif',
  },
  flowchart: { curve: 'basis', htmlLabels: true },
  mindmap: { padding: 16 },
});

let idCounter = 0;

/** 预处理 mermaid 源码，修复常见的导致渲染失败的问题 */
function preprocessMermaid(chart: string): string {
  let s = chart.trim();
  // 移除可能的前后 ```mermaid 标记
  s = s.replace(/^```mermaid\s*\n?/i, '').replace(/\n?```\s*$/, '');
  // 移除行尾分号（某些模型会加分号导致语法错误）
  // s = s.replace(/;/g, ''); // 分号在 mermaid 中是合法的，不移除
  return s.trim();
}

export default function MermaidChart({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>('');
  const [failed, setFailed] = useState(false);
  const processedChart = preprocessMermaid(chart);

  useEffect(() => {
    if (!processedChart) {
      setFailed(true);
      return;
    }

    const id = `mermaid-${++idCounter}`;
    let cancelled = false;

    setFailed(false);

    mermaid
      .parse(processedChart)
      .then(() => mermaid.render(id, processedChart))
      .then(({ svg: result }) => {
        if (!cancelled) {
          setSvg(result);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [processedChart]);

  // 渲染失败时：静默降级为源码显示，不显示错误信息
  if (failed) {
    return (
      <div className="my-4 overflow-x-auto rounded-lg border border-paper-300 bg-paper-100 p-4">
        <pre className="text-xs text-ink-500">
          <code>{processedChart}</code>
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 flex h-32 items-center justify-center rounded-lg bg-paper-100">
        <span className="text-xs text-ink-300">图表渲染中…</span>
      </div>
    );
  }

  return (
    <div
      className="my-4 flex justify-center overflow-x-auto rounded-lg bg-paper-50 p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
