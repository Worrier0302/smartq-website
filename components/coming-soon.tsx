import { Topbar } from "@/components/topbar";

export function ComingSoon({
  crumb,
  title,
  phase,
}: {
  crumb: string;
  title: string;
  phase: string;
}) {
  return (
    <>
      <Topbar crumb={crumb} title={title} />
      <div className="px-[30px] pt-[26px] pb-[60px]">
        <div className="bg-card border border-line rounded-xl shadow-card px-6 py-12 text-center">
          <div className="font-mono text-[10px] tracking-[1.5px] uppercase text-moss mb-2">
            {phase}
          </div>
          <p className="text-sm text-[#6b7570]">此模块将在后续 PHASE 接入。</p>
        </div>
      </div>
    </>
  );
}
