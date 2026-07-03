// 由于无法在后端读取 skill.md，这里导出一个基础提示词
// 完整 skill 内容会通过 fetch 从 public/skill.md 加载
export const SKILL_PROMPT_FALLBACK = `你是一个管理者精读萃取系统，请按 10 步流程为管理者生成一本管理/社科类书籍的精读报告。`;

export async function loadSkillPrompt(): Promise<string> {
  try {
    const res = await fetch('/skill.md');
    if (res.ok) return await res.text();
  } catch {}
  return SKILL_PROMPT_FALLBACK;
}
