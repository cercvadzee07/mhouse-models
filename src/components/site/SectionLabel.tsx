export function SectionLabel({ index, label, inverted = false }: { index: string; label: string; inverted?: boolean }) {
  return (
    <p className={`eyebrow flex items-center gap-4 ${inverted ? "text-paper/55" : "text-graphite"}`}>
      <span className={inverted ? "text-paper/35" : "text-concrete"}>{index}</span>
      <span aria-hidden className="inline-block h-px w-10 bg-current opacity-50" />
      <span>{label}</span>
    </p>
  );
}
