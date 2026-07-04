// 加成工作台的共享类型与计算

export type MarkupMode = "global" | "line" | "manual";

export type MarkupLine = {
  key: string;
  description: string;
  subcontractor_id: string | null;
  cost: number;
  markupPct: number; // 逐行加成
  manualPrice: number | null; // 手动定价
};

export type MarkupSection = {
  key: string;
  name: string;
  items: MarkupLine[];
};

export function priceOf(
  it: MarkupLine,
  mode: MarkupMode,
  globalPct: number
): number {
  if (mode === "manual" && it.manualPrice != null) return it.manualPrice;
  const pct = mode === "global" ? globalPct : it.markupPct;
  return Math.round((it.cost || 0) * (1 + (Number(pct) || 0) / 100));
}

export function markupTotals(
  sections: MarkupSection[],
  mode: MarkupMode,
  globalPct: number
) {
  let cost = 0;
  let price = 0;
  sections.forEach((s) =>
    s.items.forEach((it) => {
      cost += Number(it.cost) || 0;
      price += priceOf(it, mode, globalPct);
    })
  );
  const margin = price - cost;
  const marginPct = price ? Math.round((margin / price) * 100) : 0;
  return { cost, price, margin, marginPct };
}
