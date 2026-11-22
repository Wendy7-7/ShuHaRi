import { api } from "../api";

export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

export const BADGES: BadgeDef[] = [
  { id: "first_judge", icon: "🎯", name: "第一枪", desc: "完成第一次判题" },
  { id: "first_pass", icon: "🌱", name: "破土", desc: "第一次全部用例通过" },
  { id: "solve_5", icon: "⚡", name: "小有所成", desc: "累计独立解决 5 道题" },
  { id: "solve_10", icon: "🔥", name: "渐入佳境", desc: "累计独立解决 10 道题" },
  { id: "streak_3", icon: "📅", name: "三日之约", desc: "连续 3 天回到这里学习" },
  { id: "streak_7", icon: "🏆", name: "一周不断", desc: "连续 7 天学习" },
  { id: "mistake_clear", icon: "🧹", name: "清零大师", desc: "做过的题里错题本全部清零" },
  { id: "first_exam", icon: "🎓", name: "首考纪念", desc: "完成第一场考试" },
  { id: "night_owl", icon: "🦉", name: "夜猫子", desc: "在深夜 0-5 点完成一次判题" },
];

const owned = async (): Promise<string[]> => {
  const raw = await api.kvGet("badges");
  return raw ? JSON.parse(raw) : [];
};

const award = async (ids: string[]) => {
  const old = await owned();
  const next = [...new Set([...old, ...ids])];
  await api.kvSet("badges", JSON.stringify(next));
  return BADGES.filter((b) => next.includes(b.id) && !old.includes(b.id));
};

/** 每日连续学习追踪：应用启动时调用 */
export async function touchStreak(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const last = await api.kvGet("last_active");
    if (last === today) return;
    let streak = 1;
    if (last === yesterday) {
      streak = parseInt((await api.kvGet("streak")) ?? "1", 10) + 1;
    }
    await api.kvSet("last_active", today);
    await api.kvSet("streak", String(streak));
    const newBadges: string[] = [];
    if (streak >= 3) newBadges.push("streak_3");
    if (streak >= 7) newBadges.push("streak_7");
    if (newBadges.length) await award(newBadges);
  } catch {
    /* 追踪失败不影响使用 */
  }
}

/** 评估并解锁新徽章，返回本次新解锁的（用于弹 toast） */
export async function checkAndAward(event: "judge" | "pass" | "solve" | "mistake_clear" | "exam"): Promise<BadgeDef[]> {
  try {
    const candidates: string[] = [];
    const hour = new Date().getHours();
    if (event === "judge" && hour < 5) candidates.push("night_owl");
    if (event === "judge" || event === "pass") candidates.push("first_judge");
    if (event === "pass") candidates.push("first_pass");

    if (event === "solve" || event === "mistake_clear") {
      const solvedRaw = await api.kvGet("solved_ids");
      const solved: string[] = solvedRaw ? JSON.parse(solvedRaw) : [];
      if (solved.length >= 5) candidates.push("solve_5");
      if (solved.length >= 10) candidates.push("solve_10");
    }
    if (event === "mistake_clear") candidates.push("mistake_clear");
    if (event === "exam") candidates.push("first_exam");

    const have = new Set(await owned());
    const reallyNew = candidates.filter((c) => !have.has(c));
    if (reallyNew.length === 0) return [];
    // 有条件校验的徽章在此复核
    if (!reallyNew.includes("first_judge") && (candidates.includes("first_judge") || event === "pass")) {
      // first_judge 必然伴随事件成立
    }
    if (!reallyNew.includes("first_pass") && candidates.includes("first_pass")) {
      // first_pass 由 pass 事件触发，必然成立
    }
    if (reallyNew.includes("mistake_clear")) {
      const mistakes = await api.listMistakes();
      const solvedRaw = await api.kvGet("solved_ids");
      const solved: string[] = solvedRaw ? JSON.parse(solvedRaw) : [];
      // 只有"做过题"且错题全清才算：至少解决过 1 题
      if (mistakes.some((m) => !m.resolved) || solved.length === 0) {
        reallyNew.splice(reallyNew.indexOf("mistake_clear"), 1);
      }
    }
    return award(reallyNew);
  } catch {
    return [];
  }
}
