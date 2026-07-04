import { rm } from "@/lib/format";

export type POTextInput = {
  docNo: string;
  subconName: string;
  projectName: string;
  siteAddress: string;
  requiredBy: string;
  items: { description: string; cost: number }[];
  total: number;
  paymentTerms: string;
};

// 生成可复制的 PO WhatsApp 纯文字
export function poWhatsAppText(i: POTextInput) {
  const lines = i.items
    .map((it, n) => `${n + 1}. ${it.description} — ${rm(it.cost)}`)
    .join("\n");
  return `*采购单 PURCHASE ORDER*
PO No: ${i.docNo}
To: ${i.subconName}
Project: ${i.projectName}
Site: ${i.siteAddress || "-"}
Required By: ${i.requiredBy || "-"}

*Items:*
${lines}

*Total: ${rm(i.total)}*
Payment Terms: ${i.paymentTerms || "完工验收后 7 天内结清"}

请回复 *CONFIRMED* 确认接单。
— Smart HQME Solution Enterprise`;
}
