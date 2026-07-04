export type DocType =
  | "quotation"
  | "invoice"
  | "receipt"
  | "delivery_order"
  | "purchase_order"
  | "subcon_quote";

export const DOC_META: Record<
  DocType,
  { label: string; en: string; prefix: string; pill: string }
> = {
  quotation: { label: "报价", en: "QUOTATION", prefix: "Q", pill: "t-Q" },
  invoice: { label: "发票", en: "INVOICE", prefix: "INV", pill: "t-INV" },
  receipt: { label: "收据", en: "RECEIPT", prefix: "RCPT", pill: "t-RCPT" },
  delivery_order: {
    label: "送货单",
    en: "DELIVERY ORDER",
    prefix: "DO",
    pill: "t-DO",
  },
  purchase_order: {
    label: "采购单",
    en: "PURCHASE ORDER",
    prefix: "PO",
    pill: "t-PO",
  },
  subcon_quote: {
    label: "判包报价",
    en: "SUBCON QUOTE",
    prefix: "SQ",
    pill: "t-Q",
  },
};

// 客户单据流转链：报价 → 发票 → 收据 → 送货单
export const NEXT_TYPE: Partial<Record<DocType, DocType>> = {
  quotation: "invoice",
  invoice: "receipt",
  receipt: "delivery_order",
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  sent: "已发出",
  confirmed: "已确认",
  due: "待付款",
  partial: "部分付款",
  paid: "已付清",
  completed: "已完成",
  cancelled: "已取消",
};

export const CLIENT_FACING: DocType[] = [
  "quotation",
  "invoice",
  "receipt",
  "delivery_order",
];
