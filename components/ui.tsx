"use client";

import { useEffect } from "react";

export function Btn({
  variant = "default",
  className = "",
  children,
  ...props
}: {
  variant?: "default" | "primary" | "amber";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    default: "bg-card text-ink border-line hover:border-moss",
    primary: "bg-forest text-white border-forest hover:bg-forest-2",
    amber: "bg-amber text-ink border-amber font-bold hover:bg-[#c67c22]",
  }[variant];
  return (
    <button
      {...props}
      className={`font-sans font-semibold text-[13px] px-4 py-[9px] rounded-lg border inline-flex items-center gap-[7px] transition disabled:opacity-60 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <label className="block font-mono text-[11px] tracking-wide uppercase text-moss mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputCls =
  "w-full px-[11px] py-[9px] border border-line rounded-[7px] bg-paper text-[13.5px] text-ink focus:outline-none focus:border-moss focus:bg-white focus:ring-[3px] focus:ring-moss/10 transition";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-start justify-center p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card border border-line rounded-xl shadow-doc w-full max-w-[480px] mt-[6vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-paper-2">
          <h3 className="font-sans font-bold text-[15px]">{title}</h3>
          <button
            onClick={onClose}
            className="text-moss hover:text-brick text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-[13px] text-[#9a938a]"
      >
        {text}
      </td>
    </tr>
  );
}
