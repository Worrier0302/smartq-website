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
  reg: "Reg 202403276597 (JM1013409-A)",
  address: "30 Jalan Nibong 38, Taman Daya, 81100 JB",
  phones: "+65 9381 1110 / +60 10-766 5565",
  bank: "Hong Leong Bank 37800097539",
  pic: "Jaxson Ong",
};
