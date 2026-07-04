import { NextRequest } from "next/server";
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { DocItem, DocPDFData, DocumentPDF } from "@/lib/pdf/document";
import { sectionCode } from "@/lib/quote";
import { DOC_META, DocType, STATUS_LABEL } from "@/lib/docmeta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toLines = (t: string | null) =>
  (t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB") : "";

export async function GET(
  _req: NextRequest,
  { params }: { params: { docId: string } }
) {
  const supabase = createClient();
  const { docId } = params;

  const { data: doc, error } = await supabase
    .from("documents")
    .select(
      "id, doc_no, type, status, issue_date, valid_until, due_date, discount, terms_included, terms_excluded, terms_dlp, terms_conditions, project:projects(name, site_address, client:clients(name, address_line1, address_line2)), subcontractor:subcontractors(company_name, address)"
    )
    .eq("id", docId)
    .single();

  if (error || !doc) return new Response("单据不存在或无权访问", { status: 404 });

  const type = doc.type as DocType;
  const isPO = type === "purchase_order" || type === "subcon_quote";

  // 明细行来源：PO 读原表（含成本），客户单据读安全视图（仅客户价）
  type LineRow = {
    section_name: string;
    section_order: number | null;
    line_order: number | null;
    description: string | null;
    qty: number | null;
    amount: number;
  };
  let lines: LineRow[] = [];
  if (isPO) {
    const { data } = await supabase
      .from("line_items")
      .select("section_name, section_order, line_order, description, qty, cost")
      .eq("document_id", docId)
      .order("section_order")
      .order("line_order");
    lines = (data ?? []).map((l) => ({
      section_name: l.section_name,
      section_order: l.section_order,
      line_order: l.line_order,
      description: l.description,
      qty: l.qty,
      amount: Number(l.cost) || 0,
    }));
  } else {
    const { data } = await supabase
      .from("line_items_staff")
      .select("section_name, section_order, line_order, description, qty, client_price")
      .eq("document_id", docId)
      .order("section_order")
      .order("line_order");
    lines = (data ?? []).map((l) => ({
      section_name: l.section_name,
      section_order: l.section_order,
      line_order: l.line_order,
      description: l.description,
      qty: l.qty,
      amount: Number(l.client_price) || 0,
    }));
  }

  // group by section
  type SecGroup = { name: string; items: DocItem[] };
  const secMap = new Map<number, SecGroup>();
  lines.forEach((l) => {
    const key = l.section_order ?? 0;
    let g = secMap.get(key);
    if (!g) {
      g = { name: l.section_name, items: [] };
      secMap.set(key, g);
    }
    g.items.push({
      no: "",
      description: l.description ?? "",
      qty: Number(l.qty) || 1,
      amount: l.amount,
    });
  });
  const sections = [...secMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, g], si) => ({
      code: sectionCode(si),
      name: g.name,
      items: g.items.map((it, i) => ({ ...it, no: `${sectionCode(si)}${i + 1}` })),
    }));

  const subtotal = sections.flatMap((x) => x.items).reduce((a, it) => a + it.amount, 0);
  const discount = isPO ? 0 : Number(doc.discount) || 0;
  const grand = subtotal - discount;

  // payments (client-facing balance)
  let paidInfo: DocPDFData["paidInfo"];
  if (type === "invoice" || type === "receipt") {
    const { data: pays } = await supabase
      .from("payments")
      .select("amount, method")
      .eq("document_id", docId);
    const amount = (pays ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
    paidInfo = { amount, method: pays?.[0]?.method ?? "", balance: grand - amount };
  }

  // payment schedule (quotation / invoice)
  let paySchedule: DocPDFData["paySchedule"] = [];
  if (type === "quotation" || type === "invoice") {
    const { data: ps } = await supabase
      .from("payment_schedules")
      .select("stage_name, pct, condition_text, stage_order")
      .eq("document_id", docId)
      .order("stage_order");
    paySchedule = (ps ?? []).map((p) => ({
      stage_name: p.stage_name,
      pct: Number(p.pct) || 0,
      condition_text: p.condition_text ?? "",
      amount: Math.round((grand * (Number(p.pct) || 0)) / 100),
    }));
  }

  const project = doc.project as unknown as {
    name?: string;
    site_address?: string;
    client?: { name?: string; address_line1?: string; address_line2?: string };
  } | null;
  const subcon = doc.subcontractor as unknown as {
    company_name?: string;
    address?: string;
  } | null;

  const clientAddr = [
    project?.client?.address_line1,
    project?.client?.address_line2,
  ]
    .filter(Boolean)
    .join("\n");

  const meta = DOC_META[type];
  const data: DocPDFData = {
    docType: type,
    titleEn: meta.en,
    docNo: doc.doc_no ?? "",
    statusLabel: STATUS_LABEL[doc.status ?? "draft"] ?? "",
    recipientLabel: isPO ? "To 判包商" : "To 客户",
    recipientName: isPO
      ? subcon?.company_name ?? "—"
      : project?.client?.name ?? "—",
    recipientAddress: isPO ? subcon?.address ?? "" : clientAddr,
    issueDate: fmt(doc.issue_date),
    rightDateLabel:
      type === "quotation" ? "VALID" : type === "invoice" ? "DUE" : undefined,
    rightDateValue:
      type === "quotation"
        ? fmt(doc.valid_until)
        : type === "invoice"
          ? fmt(doc.due_date)
          : undefined,
    columns: isPO ? "qtycost" : type === "delivery_order" ? "qty" : "amount",
    sections,
    subtotal,
    discount,
    grand,
    showTotals: type !== "delivery_order",
    paySchedule,
    included: type === "quotation" ? toLines(doc.terms_included) : [],
    excluded: type === "quotation" ? toLines(doc.terms_excluded) : [],
    dlp: type === "quotation" ? toLines(doc.terms_dlp) : [],
    terms: type === "quotation" ? toLines(doc.terms_conditions) : [],
    paidInfo,
    poConfirm: isPO,
    signatures: isPO
      ? "po"
      : type === "delivery_order"
        ? "received"
        : type === "receipt"
          ? "none"
          : "client",
  };

  const buffer = await renderToBuffer(
    createElement(DocumentPDF, { d: data }) as unknown as ReactElement<DocumentProps>
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.docNo || "document"}.pdf"`,
    },
  });
}
