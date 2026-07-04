// Smart Q 标志（黑圆 + 嵌套房子）。variant:
//  - "dark"  黑圆 + 白房子（用于浅色背景：登录页 / PDF / 预览）
//  - "light" 白圆 + 墨绿房子（用于深色背景：侧边栏）
export function LogoMark({
  size = 34,
  variant = "dark",
}: {
  size?: number;
  variant?: "dark" | "light";
}) {
  const circle = variant === "dark" ? "#111917" : "#fbfaf6";
  const fg = variant === "dark" ? "#fbfaf6" : "#12352b";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="50" fill={circle} />
      <path
        d="M26 80 L26 46 Q26 30 42 30 L58 30 Q74 30 74 46 L74 80"
        stroke={fg}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36 80 L36 54 Q36 42 50 42 Q64 42 64 54 L64 80"
        stroke={fg}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M45 80 L45 61 Q45 53 50 53 Q55 53 55 61 L55 80 Z" fill={fg} />
    </svg>
  );
}
