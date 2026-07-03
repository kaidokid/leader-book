/** 10 步进度条 */
const STEPS = [
  '执行摘要',
  '定位锚定',
  '结构总览',
  '逐章精粹',
  '框架提炼',
  '反常识',
  '决策启示',
  '行动清单',
  '金句锚点',
  '延伸结论',
];

interface Props {
  currentStep: number;
}

export default function ProgressBar({ currentStep }: Props) {
  const percent = Math.min(100, (currentStep / 10) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-ink-700">
          步骤 {currentStep}/10 · {STEPS[currentStep - 1] || '准备中'}
        </span>
        <span className="text-gold-600">{Math.round(percent)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {STEPS.map((label, i) => {
          const done = i + 1 < currentStep;
          const active = i + 1 === currentStep;
          return (
            <span
              key={label}
              className={`rounded px-1.5 py-0.5 text-[10px] ${
                done
                  ? 'bg-gold-100 text-gold-700'
                  : active
                    ? 'bg-ink-900 text-gold-200'
                    : 'bg-ink-50 text-ink-300'
              }`}
            >
              {i + 1}.{label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
