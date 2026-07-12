export function PlaceholderPage({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">{blurb}</p>
      <div className="mt-8 grid place-items-center rounded-lg border border-dashed border-border bg-card/40 py-20 text-sm text-muted-foreground">
        Coming soon
      </div>
    </div>
  );
}
