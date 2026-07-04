"use client";

import { Logo } from "@/components/logo";
import { rm } from "@/lib/format";
import {
  COMPANY,
  PayStage,
  QuoteSection,
  quoteTotals,
  sectionCode,
} from "@/lib/quote";

function toLines(text: string) {
  return text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function QuotePreview({
  docNo,
  clientName,
  clientAddress,
  issueDate,
  validUntil,
  sections,
  discount,
  paySchedule,
  included,
  excluded,
  dlp,
  terms,
}: {
  docNo: string;
  clientName: string;
  clientAddress: string;
  issueDate: string;
  validUntil: string;
  sections: QuoteSection[];
  discount: number;
  paySchedule: PayStage[];
  included: string;
  excluded: string;
  dlp: string;
  terms: string;
}) {
  const { subtotal, grand } = quoteTotals(sections, discount);

  return (
    <div className="relative overflow-hidden bg-white border border-line rounded-lg p-[26px_24px] text-[11px] text-ink shadow-doc">
      {/* watermark */}
      <div className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] font-sans font-extrabold text-[40px] text-moss/[.06] tracking-[2px] pointer-events-none">
        SMART Q
      </div>

      {/* head — 公司抬头 */}
      <div className="flex justify-between items-start pb-3 border-b-2 border-forest gap-3">
        <div className="flex items-start gap-2 w-[70%]">
          <div className="flex-none">
            <Logo height={34} />
          </div>
          <div className="leading-tight">
            <b className="font-sans font-extrabold text-[10px] block text-ink uppercase">
              {COMPANY.name}
            </b>
            <span className="block text-[6.5px] text-[#6b7570]">
              {COMPANY.reg}
            </span>
            <span className="block text-[7px] text-[#6b7570] mt-1">
              {COMPANY.address}
            </span>
            <span className="block text-[7px] text-[#6b7570]">
              Hotline: {COMPANY.phones}
            </span>
          </div>
        </div>
        <div className="text-right w-[28%]">
          <b className="font-sans text-[15px] font-extrabold text-forest block">
            QUOTATION
          </b>
          <span className="font-mono text-[8px] text-moss block mt-0.5">
            {docNo}
          </span>
        </div>
      </div>

      {/* meta */}
      <div className="flex justify-between my-3 text-[9px]">
        <div>
          <b className="block text-[10px] mb-0.5">{clientName || "—"}</b>
          <span className="text-[#6b7570] block leading-[1.6] whitespace-pre-line">
            {clientAddress || ""}
          </span>
        </div>
        <div className="text-right font-mono text-[8.5px] text-[#6b7570]">
          <div>DATE&nbsp;&nbsp;{issueDate}</div>
          <div>VALID&nbsp;&nbsp;{validUntil}</div>
          <div>PIC&nbsp;&nbsp;&nbsp;&nbsp;{COMPANY.pic}</div>
        </div>
      </div>

      {/* table */}
      <table className="w-full mt-1.5 text-[9px] border-collapse">
        <thead>
          <tr>
            {["No", "Description", "Amount"].map((h, i) => (
              <th
                key={h}
                className={`bg-forest text-white p-[5px_6px] text-[7.5px] font-mono tracking-tight uppercase ${
                  i === 2 ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((sec, si) => {
            if (!sec.items.length) return null;
            const code = sectionCode(si);
            return (
              <FragmentRows key={sec.key}>
                <tr>
                  <td
                    colSpan={3}
                    className="bg-paper font-mono text-[7.5px] tracking-tight text-moss uppercase font-semibold p-[5px_6px]"
                  >
                    Section {code} — {sec.name}
                  </td>
                </tr>
                {sec.items.map((it, i) => (
                  <tr key={it.key}>
                    <td className="p-[5px_6px] border-b border-paper-2 w-8">
                      {code}
                      {i + 1}
                    </td>
                    <td className="p-[5px_6px] border-b border-paper-2">
                      {it.description || "—"}
                    </td>
                    <td className="p-[5px_6px] border-b border-paper-2 text-right font-mono">
                      {rm(it.price)}
                    </td>
                  </tr>
                ))}
              </FragmentRows>
            );
          })}
        </tbody>
      </table>

      {/* totals */}
      <div className="flex justify-end mt-2.5">
        <div className="w-[55%]">
          <div className="flex justify-between py-[3px] text-[9px]">
            <span>Subtotal</span>
            <span className="font-mono">{rm(subtotal)}</span>
          </div>
          <div className="flex justify-between py-[3px] text-[9px]">
            <span>Discount</span>
            <span className="font-mono">-{rm(discount)}</span>
          </div>
          <div className="flex justify-between border-t-2 border-forest mt-1 pt-1.5 font-sans font-extrabold text-[12px] text-forest">
            <span>TOTAL</span>
            <span className="font-mono">{rm(grand)}</span>
          </div>
        </div>
      </div>

      {/* payment schedule */}
      <Block title="Payment Schedule · 付款时程">
        <table className="w-full text-[7.5px] border-collapse">
          <tbody>
            {paySchedule.map((s) => (
              <tr key={s.key}>
                <td className="p-[2px_3px] border-b border-paper-2 text-[#6b7570]">
                  {s.stage_name} · {s.pct}%
                </td>
                <td className="p-[2px_3px] border-b border-paper-2 text-[#8a938e]">
                  {s.condition_text}
                </td>
                <td className="p-[2px_3px] border-b border-paper-2 text-right font-mono text-forest font-semibold">
                  {rm(Math.round((grand * (Number(s.pct) || 0)) / 100))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      {toLines(included).length > 0 && (
        <Block title="What's Included · 包含">
          <List items={toLines(included)} />
        </Block>
      )}
      {toLines(excluded).length > 0 && (
        <Block title="Not Included · 不包含">
          <List items={toLines(excluded)} two />
        </Block>
      )}
      {toLines(dlp).length > 0 && (
        <Block title="Defect Liability Period (DLP) · 保固">
          <List items={toLines(dlp)} />
        </Block>
      )}
      {toLines(terms).length > 0 && (
        <Block title="Terms & Conditions">
          <ol className="text-[6.5px] text-[#6b7570] leading-[1.6] pl-3 m-0 list-decimal">
            {toLines(terms).map((t, i) => (
              <li key={i} className="mb-px">
                {t.replace(/^\d+\.\s*/, "")}
              </li>
            ))}
          </ol>
        </Block>
      )}

      {/* signatures */}
      <div className="flex justify-between mt-3 gap-5">
        <div className="flex-1 border-t border-ink pt-1 text-[7px] text-[#6b7570]">
          Accepted by (Client)
          <br />
          Signature &amp; Date
        </div>
        <div className="flex-1 border-t border-ink pt-1 text-[7px] text-[#6b7570]">
          For {COMPANY.name}
          <br />
          {COMPANY.pic} — Signature &amp; Date
        </div>
      </div>

      {/* footer */}
      <div className="mt-3.5 border-t border-paper-2 pt-2 text-[7px] text-[#9a938a] text-center font-mono">
        {COMPANY.bank} · {COMPANY.phones} · {COMPANY.reg} · 住宅装修免 SST
      </div>
    </div>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2.5">
      <div className="font-mono text-[7.5px] tracking-tight uppercase text-forest font-bold border-b border-paper-2 pb-0.5 mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function List({ items, two }: { items: string[]; two?: boolean }) {
  return (
    <div
      className={`text-[7.5px] text-[#4a544f] leading-[1.7] ${
        two ? "[column-count:2] [column-gap:14px]" : ""
      }`}
    >
      {items.map((x, i) => (
        <div key={i}>• {x}</div>
      ))}
    </div>
  );
}
