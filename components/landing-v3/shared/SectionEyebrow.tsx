interface SectionEyebrowProps {
  index: string;
  label: string;
  tone?: 'light' | 'dark';
}

export function SectionEyebrow({ index, label, tone = 'light' }: SectionEyebrowProps) {
  const ink = tone === 'dark' ? 'text-white/45' : 'text-black/45';
  const dot = tone === 'dark' ? 'bg-white/30' : 'bg-black/25';
  return (
    <p className={`editorial-eyebrow flex items-center gap-3 ${ink}`}>
      <span>{index}</span>
      <span className={`h-px w-8 ${dot}`} />
      <span>{label}</span>
    </p>
  );
}
