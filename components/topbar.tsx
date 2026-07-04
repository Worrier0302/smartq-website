export function Topbar({
  crumb,
  title,
  children,
}: {
  crumb: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-[30px] py-[18px] border-b border-line bg-paper sticky top-0 z-20">
      <div>
        <div className="font-mono text-[11px] text-moss tracking-wide mb-0.5 uppercase">
          SMART Q / {crumb}
        </div>
        <h1 className="font-sans font-extrabold text-[21px] tracking-tight">
          {title}
        </h1>
      </div>
      <div className="flex gap-2.5">{children}</div>
    </div>
  );
}
