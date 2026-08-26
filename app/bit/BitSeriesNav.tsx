type BitSeriesNavProps = {
  active: "angle" | "blank" | "sequence" | "input-rain";
};

const games = [
  { id: "angle", number: "001", label: "ANGLE", href: "/bit" },
  { id: "blank", number: "002", label: "BLANK", href: "/bit/blank" },
  { id: "sequence", number: "003", label: "SEQUENCE", href: "/bit/sequence" },
  { id: "input-rain", number: "004", label: "INPUT RAIN", href: "/bit/input-rain" },
] as const;

export function BitSeriesNav({ active }: BitSeriesNavProps) {
  return (
    <nav className="bitSeriesNav" aria-label="ゲームを選ぶ">
      {games.map((game) => (
        <a key={game.id} className={active === game.id ? "isActive" : undefined} href={game.href}>
          <small>{game.number}</small>{game.label}
        </a>
      ))}
    </nav>
  );
}
