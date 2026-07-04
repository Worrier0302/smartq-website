import path from "node:path";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { COMPANY } from "@/lib/quote";
import type { DocType } from "@/lib/docmeta";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Noto",
  fonts: [
    { src: path.join(FONT_DIR, "NotoSansSC-Regular.otf") },
    { src: path.join(FONT_DIR, "NotoSansSC-Bold.otf"), fontWeight: "bold" },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

const C = {
  ink: "#111917",
  forest: "#12352b",
  moss: "#2f6b57",
  paper: "#f3f0e9",
  paper2: "#e9e4d8",
  line: "#d4cdbc",
  amber: "#d98a2b",
  red: "#b8452f",
  ok: "#3f7d5a",
  grey: "#6b7570",
};

const rm = (n: number) =>
  "RM " + Number(n || 0).toLocaleString("en-MY", { maximumFractionDigits: 2 });

const s = StyleSheet.create({
  page: { fontFamily: "Noto", fontSize: 8, color: C.ink, padding: 34, lineHeight: 1.5 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: C.forest,
    paddingBottom: 10,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  mark: {
    width: 24,
    height: 24,
    backgroundColor: C.amber,
    borderRadius: 4,
    color: C.ink,
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    paddingTop: 5,
  },
  brandName: { fontSize: 13, fontWeight: "bold" },
  brandSub: { fontSize: 6.5, color: C.moss },
  docType: { fontSize: 15, fontWeight: "bold", color: C.forest, textAlign: "right" },
  docNo: { fontSize: 8, color: C.moss, textAlign: "right" },
  status: { fontSize: 7, color: C.amber, textAlign: "right", marginTop: 1 },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 8,
  },
  toLabel: { fontSize: 7, color: C.moss, marginBottom: 2 },
  recName: { fontSize: 10, fontWeight: "bold", marginBottom: 2 },
  recAddr: { fontSize: 8, color: C.grey },
  metaRight: { fontSize: 8, color: C.grey, textAlign: "right" },
  th: {
    flexDirection: "row",
    backgroundColor: C.forest,
    color: "#fff",
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 7.5,
  },
  secRow: {
    backgroundColor: C.paper,
    paddingVertical: 4,
    paddingHorizontal: 6,
    color: C.moss,
    fontSize: 7.5,
    fontWeight: "bold",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.paper2,
  },
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  totalsBox: { width: "50%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 2,
    borderTopColor: C.forest,
    marginTop: 3,
    paddingTop: 4,
    fontSize: 11,
    fontWeight: "bold",
    color: C.forest,
  },
  block: { marginTop: 10 },
  blockTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: C.forest,
    borderBottomWidth: 0.5,
    borderBottomColor: C.paper2,
    paddingBottom: 2,
    marginBottom: 3,
  },
  li: { fontSize: 7.5, color: "#4a544f", marginBottom: 1 },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
    borderBottomWidth: 0.5,
    borderBottomColor: C.paper2,
    fontSize: 7.5,
  },
  paidStamp: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: C.ok,
    color: C.ok,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: "bold",
  },
  callout: {
    marginTop: 10,
    backgroundColor: C.paper,
    borderLeftWidth: 3,
    borderLeftColor: C.amber,
    padding: 8,
    fontSize: 8,
    color: C.ink,
  },
  sign: { flexDirection: "row", justifyContent: "space-between", marginTop: 24, gap: 24 },
  signBox: {
    width: "46%",
    borderTopWidth: 0.5,
    borderTopColor: C.ink,
    paddingTop: 4,
    fontSize: 7.5,
    color: C.grey,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 34,
    right: 34,
    textAlign: "center",
    fontSize: 7,
    color: "#9a938a",
    borderTopWidth: 0.5,
    borderTopColor: C.paper2,
    paddingTop: 6,
  },
});

export type DocItem = {
  no: string;
  description: string;
  qty: number;
  amount: number;
};

export type DocPDFData = {
  docType: DocType;
  titleEn: string;
  docNo: string;
  statusLabel: string;
  recipientLabel: string;
  recipientName: string;
  recipientAddress: string;
  issueDate: string;
  rightDateLabel?: string;
  rightDateValue?: string;
  // 列型：amount=客户价, qty=仅数量(DO), qtycost=数量+成本(PO)
  columns: "amount" | "qty" | "qtycost";
  sections: { code: string; name: string; items: DocItem[] }[];
  subtotal: number;
  discount: number;
  grand: number;
  showTotals: boolean;
  paySchedule: {
    stage_name: string;
    pct: number;
    condition_text: string;
    amount: number;
  }[];
  included: string[];
  excluded: string[];
  dlp: string[];
  terms: string[];
  paidInfo?: { amount: number; method: string; balance: number };
  poConfirm?: boolean;
  signatures: "client" | "received" | "po" | "none";
};

export function DocumentPDF({ d }: { d: DocPDFData }) {
  const amtCol = d.columns === "amount" || d.columns === "qtycost";
  const qtyCol = d.columns === "qty" || d.columns === "qtycost";
  const descW = d.columns === "amount" ? "68%" : qtyCol && amtCol ? "56%" : "78%";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* head */}
        <View style={s.head}>
          <View style={s.brandRow}>
            <Text style={s.mark}>SQ</Text>
            <View>
              <Text style={s.brandName}>{COMPANY.brand}</Text>
              <Text style={s.brandSub}>{COMPANY.name}</Text>
            </View>
          </View>
          <View>
            <Text style={s.docType}>{d.titleEn}</Text>
            <Text style={s.docNo}>{d.docNo}</Text>
            {d.statusLabel ? <Text style={s.status}>{d.statusLabel}</Text> : null}
          </View>
        </View>

        {/* meta */}
        <View style={s.meta}>
          <View style={{ maxWidth: "60%" }}>
            <Text style={s.toLabel}>{d.recipientLabel}</Text>
            <Text style={s.recName}>{d.recipientName}</Text>
            <Text style={s.recAddr}>{d.recipientAddress}</Text>
          </View>
          <View style={s.metaRight}>
            <Text>DATE  {d.issueDate}</Text>
            {d.rightDateLabel ? (
              <Text>
                {d.rightDateLabel}  {d.rightDateValue}
              </Text>
            ) : null}
            <Text>PIC  {COMPANY.pic}</Text>
          </View>
        </View>

        {/* table */}
        <View style={s.th}>
          <Text style={{ width: "10%" }}>NO</Text>
          <Text style={{ width: descW }}>DESCRIPTION</Text>
          {qtyCol ? (
            <Text style={{ width: "12%", textAlign: "right" }}>QTY</Text>
          ) : null}
          {amtCol ? (
            <Text style={{ width: "22%", textAlign: "right" }}>
              {d.columns === "qtycost" ? "COST" : "AMOUNT"}
            </Text>
          ) : null}
        </View>
        {d.sections.map((sec) =>
          sec.items.length ? (
            <View key={sec.code} wrap={false}>
              <Text style={s.secRow}>
                Section {sec.code} — {sec.name}
              </Text>
              {sec.items.map((it, i) => (
                <View style={s.tr} key={i}>
                  <Text style={{ width: "10%" }}>{it.no}</Text>
                  <Text style={{ width: descW }}>{it.description}</Text>
                  {qtyCol ? (
                    <Text style={{ width: "12%", textAlign: "right" }}>
                      {it.qty}
                    </Text>
                  ) : null}
                  {amtCol ? (
                    <Text style={{ width: "22%", textAlign: "right" }}>
                      {rm(it.amount)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null
        )}

        {/* totals */}
        {d.showTotals && (
          <View style={s.totalsWrap}>
            <View style={s.totalsBox}>
              <View style={s.totalRow}>
                <Text>Subtotal</Text>
                <Text>{rm(d.subtotal)}</Text>
              </View>
              {d.discount > 0 && (
                <View style={s.totalRow}>
                  <Text>Discount</Text>
                  <Text>-{rm(d.discount)}</Text>
                </View>
              )}
              <View style={s.grand}>
                <Text>TOTAL</Text>
                <Text>{rm(d.grand)}</Text>
              </View>
              {d.paidInfo && (
                <>
                  <View style={s.totalRow}>
                    <Text>已收 Paid</Text>
                    <Text>{rm(d.paidInfo.amount)}</Text>
                  </View>
                  <View style={{ ...s.totalRow, color: C.red }}>
                    <Text>结余 Balance</Text>
                    <Text>{rm(d.paidInfo.balance)}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* receipt paid stamp */}
        {d.docType === "receipt" && d.paidInfo && (
          <Text style={s.paidStamp}>
            ✓ PAID {rm(d.paidInfo.amount)}
            {d.paidInfo.method ? ` · ${d.paidInfo.method}` : ""}
          </Text>
        )}

        {/* invoice bank callout */}
        {d.docType === "invoice" && (
          <View style={s.callout}>
            <Text>
              请转账至 {COMPANY.bank}（{COMPANY.name}）。付款后请保留凭证。
            </Text>
          </View>
        )}

        {/* PO confirm callout */}
        {d.poConfirm && (
          <View style={s.callout}>
            <Text>
              请回复 CONFIRMED 确认接单。完工验收后依双方约定结算。
            </Text>
          </View>
        )}

        {/* payment schedule (quotation / invoice) */}
        {d.paySchedule.length > 0 && (
          <View style={s.block}>
            <Text style={s.blockTitle}>Payment Schedule · 付款时程</Text>
            {d.paySchedule.map((p, i) => (
              <View style={s.payRow} key={i}>
                <Text style={{ width: "40%" }}>
                  {p.stage_name} · {p.pct}%
                </Text>
                <Text style={{ width: "40%", color: C.grey }}>
                  {p.condition_text}
                </Text>
                <Text style={{ width: "20%", textAlign: "right", color: C.forest }}>
                  {rm(p.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* quotation terms */}
        <Block title="What's Included · 包含" items={d.included} />
        <Block title="Not Included · 不包含" items={d.excluded} />
        <Block title="Defect Liability Period (DLP) · 保固" items={d.dlp} />
        {d.terms.length > 0 && (
          <View style={s.block}>
            <Text style={s.blockTitle}>Terms & Conditions</Text>
            {d.terms.map((t, i) => (
              <Text style={s.li} key={i}>
                {i + 1}. {t.replace(/^\d+\.\s*/, "")}
              </Text>
            ))}
          </View>
        )}

        {/* signatures */}
        {d.signatures === "client" && (
          <View style={s.sign}>
            <Text style={s.signBox}>
              Accepted by (Client){"\n"}Signature & Date
            </Text>
            <Text style={s.signBox}>
              For {COMPANY.name}
              {"\n"}
              {COMPANY.pic} — Signature & Date
            </Text>
          </View>
        )}
        {d.signatures === "received" && (
          <View style={s.sign}>
            <Text style={s.signBox}>
              Received in good condition (客户签收){"\n"}Name / Signature & Date
            </Text>
            <Text style={s.signBox}>
              Delivered by{"\n"}
              {COMPANY.pic} — Signature & Date
            </Text>
          </View>
        )}
        {d.signatures === "po" && (
          <View style={s.sign}>
            <Text style={s.signBox}>
              Accepted by (Sub-con){"\n"}Signature & Date
            </Text>
            <Text style={s.signBox}>
              Issued by {COMPANY.name}
              {"\n"}
              {COMPANY.pic}
            </Text>
          </View>
        )}

        {/* footer */}
        <Text style={s.footer} fixed>
          {COMPANY.bank} · {COMPANY.phones} · {COMPANY.reg} · 住宅装修免 SST
        </Text>
      </Page>
    </Document>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={s.block}>
      <Text style={s.blockTitle}>{title}</Text>
      {items.map((x, i) => (
        <Text style={s.li} key={i}>
          • {x}
        </Text>
      ))}
    </View>
  );
}
