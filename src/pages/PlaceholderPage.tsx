export function PlaceholderPage({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <div>
      <h1 className="text-h1 font-medium text-black">{title}</h1>
      <p className="mt-2 max-w-[60ch] text-muted">{blurb}</p>
      <div className="mt-8 rounded-card border border-dashed border-border px-6 py-20 text-center text-small text-muted">
        Nothing here yet. This screen arrives in a later phase.
      </div>
    </div>
  );
}
