export const rm = (n: number | null | undefined) =>
  "RM " + Number(n ?? 0).toLocaleString("en-MY", { maximumFractionDigits: 2 });

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}
