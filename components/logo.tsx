// Smart Q 正式 logo（用户提供的原图 public/logo.png，含 SMART Q 字）
export function Logo({
  height = 34,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Smart Q"
      style={{ height, width: "auto" }}
      className={className}
    />
  );
}
