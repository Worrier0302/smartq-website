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

const _uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const _num = (s: string) => {
  const n = Number(String(s).replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? NaN : n;
};

// 批量解析：从 Excel/报价单复制粘贴的文本 -> sections
// 规则：
//  - 有制表符(Excel 粘贴)：第一列=描述，最后一个纯数字列=成本
//  - 单行文本："描述 逗号/空格 成本"，末尾数字=成本
//  - 没有数字的行 = 工种(section)标题
//  - 以 * ~ 注 note payment subtotal total discount 开头的行 = 备注，跳过
export function parseBulkMarkup(
  text: string,
  defaultMarkup: number
): MarkupSection[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const out: MarkupSection[] = [];
  let cur: MarkupSection | null = null;
  const newSection = (name: string) => {
    cur = { key: _uid(), name: name.trim() || "导入项目", items: [] };
    out.push(cur);
  };

  for (const raw of lines) {
    const line = raw.trim();
    let desc = "";
    let cost = NaN;

    if (raw.includes("\t")) {
      const cells = raw.split("\t").map((c) => c.trim());
      desc = cells.find((c) => c) ?? "";
      for (let i = cells.length - 1; i >= 0; i--) {
        // 纯数字/金额列（排除含 mm、x 等尺寸列）
        if (/^[\d,]+(\.\d+)?$/.test(cells[i].replace(/\s/g, ""))) {
          cost = _num(cells[i]);
          break;
        }
      }
    } else {
      const m = line.match(/^(.*?)[\s,，:：]+([\d,]+(?:\.\d+)?)\s*$/);
      if (m) {
        desc = m[1];
        cost = _num(m[2]);
      } else {
        desc = line;
      }
    }

    desc = desc.replace(/^\s*\d+[.)、]\s*/, "").trim(); // 去掉行首编号 "1. "

    // 汇总/备注行一律跳过（即便带数字，如 SUBTOTAL 39,220）
    const isSummary =
      /^(sub\s*total|total|discount|balance|lorry|delivery|shipping|handling|deposit|payment|amount|note|remark|小计|合计|总计|折扣|运费|送货|定金|余额|结余|备注)/i.test(
        desc.replace(/\s/g, " ").trim()
      ) || /^[*~•]/.test(line);

    if (isSummary) continue;

    if (isNaN(cost)) {
      newSection(desc);
    } else {
      if (!cur) newSection("导入项目");
      cur!.items.push({
        key: _uid(),
        description: desc,
        subcontractor_id: null,
        cost,
        markupPct: defaultMarkup,
        manualPrice: null,
      });
    }
  }
  return out.filter((s) => s.items.length);
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
