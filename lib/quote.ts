// 报价构建器的共享类型与计算

export type QuoteLine = {
  key: string;
  description: string;
  price: number; // 客户价（manual_price）
  cost: number; // 判包成本（owner）
  subcontractor_id: string | null;
};

export type QuoteSection = {
  key: string;
  name: string;
  items: QuoteLine[];
};

export type PayStage = {
  key: string;
  stage_name: string;
  pct: number;
  condition_text: string;
};

export const sectionCode = (i: number) => String.fromCharCode(65 + i); // A/B/C

const _uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
const _num = (s: string) => {
  const n = Number(String(s).replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? NaN : n;
};

// 批量解析：从 Excel/报价单粘贴 -> sections（数字识别为客户价 price）
export function parseBulkQuote(text: string): QuoteSection[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const out: QuoteSection[] = [];
  let cur: QuoteSection | null = null;
  const newSection = (name: string) => {
    cur = { key: _uid(), name: name.trim() || "导入项目", items: [] };
    out.push(cur);
  };
  for (const raw of lines) {
    const line = raw.trim();
    let desc = "";
    let price = NaN;
    if (raw.includes("\t")) {
      const cells = raw.split("\t").map((c) => c.trim());
      desc = cells.find((c) => c) ?? "";
      for (let i = cells.length - 1; i >= 0; i--) {
        if (/^[\d,]+(\.\d+)?$/.test(cells[i].replace(/\s/g, ""))) {
          price = _num(cells[i]);
          break;
        }
      }
    } else {
      const m = line.match(/^(.*?)[\s,，:：]+([\d,]+(?:\.\d+)?)\s*$/);
      if (m) {
        desc = m[1];
        price = _num(m[2]);
      } else desc = line;
    }
    desc = desc.replace(/^\s*\d+[.)、]\s*/, "").trim();
    const isSummary =
      /^(sub\s*total|total|discount|balance|lorry|delivery|shipping|handling|deposit|payment|amount|note|remark|小计|合计|总计|折扣|运费|送货|定金|余额|结余|备注)/i.test(
        desc.trim()
      ) || /^[*~•]/.test(line);
    if (isSummary) continue;
    if (isNaN(price)) newSection(desc);
    else {
      if (!cur) newSection("导入项目");
      cur!.items.push({
        key: _uid(),
        description: desc,
        price,
        cost: 0,
        subcontractor_id: null,
      });
    }
  }
  return out.filter((s) => s.items.length);
}

export function quoteTotals(sections: QuoteSection[], discount: number) {
  const all = sections.flatMap((s) => s.items);
  const subtotal = all.reduce((s, i) => s + (Number(i.price) || 0), 0);
  const cost = all.reduce((s, i) => s + (Number(i.cost) || 0), 0);
  const grand = subtotal - (Number(discount) || 0);
  const margin = grand - cost;
  const marginPct = grand ? Math.round((margin / grand) * 100) : 0;
  return { subtotal, cost, grand, margin, marginPct };
}

export const COMPANY = {
  name: "Smart HQME Solution Enterprise",
  brand: "Smart Q",
  reg: "(202403276597) (JM1013409-A)",
  address: "30, Jalan Nibong 38, Taman Daya, 81100 Johor Bahru, Johor",
  phones: "+65 9381 1110 (WhatsApp) / +60 10-766 5565",
  bank: "Hong Leong Bank 37800097539",
  pic: "Jaxson Ong",
};
