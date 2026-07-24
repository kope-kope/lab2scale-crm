import { useState } from "react";
import { FlaskConical, Loader2, Search } from "lucide-react";
import { Badge, Button, Card, Input, type BadgeRole } from "@/components/ds";
import { useAuth } from "@/auth/AuthProvider";
import { screenPreview, type ScreenInput, type ScreenResult } from "@/lib/leads";

/**
 * Screen Lab — a sandbox for the client qualification screener. Type any company
 * (plus optional context), run it, and see the full screen the AI produces. It
 * reads and writes nothing: no Leads sheet, no Drive. Same engine as the Qualify
 * button, so it's the place to understand and calibrate how the screener thinks.
 */

function verdictRole(v?: string): BadgeRole {
  if (v === "Pursue") return "success";
  if (v === "Gate") return "warning";
  if (v === "Pass") return "danger";
  return "neutral";
}

/** One labelled block of the screen output. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-caption uppercase tracking-wide text-muted">{label}</div>
      <p className="mt-1 whitespace-pre-wrap text-body">{value || "—"}</p>
    </div>
  );
}

const EXAMPLES = ["Overland AI", "Commonwealth Fusion Systems", "Form Energy"];

export function ScreenLabPage() {
  const { token } = useAuth();
  const [form, setForm] = useState<ScreenInput>({ company: "" });
  const [result, setResult] = useState<ScreenResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof ScreenInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function run() {
    if (!token || !form.company.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      setResult(await screenPreview(token, form));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't screen that company.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <FlaskConical size={22} strokeWidth={1.5} className="text-action" />
          <h1 className="text-h1 font-medium text-black">Screen Lab</h1>
        </div>
        <p className="mt-2 max-w-2xl text-muted">
          Type any company and run the client qualification screener — the same engine as the Qualify button on
          Leads. It researches the company on the web, then decides <b>Pursue / Gate / Pass</b> on whether Lab2Scale
          should take them on as a client and can get paid. Nothing is read from or written to your sheets.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Input form */}
        <Card title="Company to screen">
          <div className="flex flex-col gap-4">
            <Input
              label="Company (required)"
              placeholder="Overland AI"
              value={form.company}
              onChange={set("company")}
              onKeyDown={(e) => e.key === "Enter" && void run()}
            />
            <Input label="Sector" placeholder="Storage & batteries" value={form.sector ?? ""} onChange={set("sector")} />
            <Input label="Stage" placeholder="TRL 6 / Series A" value={form.stage ?? ""} onChange={set("stage")} />
            <Input label="Relevance (internal)" placeholder="8.6" value={form.relevance ?? ""} onChange={set("relevance")} />
            <label className="block" style={{ fontFamily: "var(--font-sans)" }}>
              <span className="mb-2 block text-small text-body">Why it was flagged</span>
              <textarea
                placeholder="Solid-state battery maker with a running pilot line; targeting grid + EV."
                value={form.whyItFits ?? ""}
                onChange={set("whyItFits")}
                rows={3}
                className="w-full rounded-control border border-border bg-white px-3 py-2 text-body outline-none focus:border-action"
                style={{ fontFamily: "var(--font-sans)", fontSize: "15px", resize: "vertical" }}
              />
            </label>

            <Button variant="primary" onClick={() => void run()} disabled={!form.company.trim() || running}>
              {running ? (
                <>
                  <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                  Screening…
                </>
              ) : (
                <>
                  <Search size={16} strokeWidth={1.5} />
                  Run screen
                </>
              )}
            </Button>

            <div className="text-caption text-muted">
              Try:{" "}
              {EXAMPLES.map((name, i) => (
                <span key={name}>
                  {i > 0 && " · "}
                  <button
                    type="button"
                    className="text-action hover:underline"
                    onClick={() => setForm({ company: name })}
                    disabled={running}
                  >
                    {name}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* Result */}
        <div>
          {error && <p className="mb-4 text-small text-danger-text">{error}</p>}

          {running && (
            <Card>
              <div className="flex items-center gap-3 text-muted">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-action" />
                <span>
                  Researching <b className="text-body">{form.company}</b> on the web and screening — this takes about
                  30–60 seconds.
                </span>
              </div>
            </Card>
          )}

          {!running && !result && !error && (
            <Card>
              <p className="text-muted">
                Run a company to see the full screen: the verdict, the three calls that decide a client
                (can commercial work move the dominant risk · is there a fee-able event · genuine need), and the
                researched facts behind them.
              </p>
            </Card>
          )}

          {result && !running && (
            <div className="flex flex-col gap-6">
              {/* Verdict header */}
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-h3 font-medium text-black">{result.company}</h2>
                    <Badge role={verdictRole(result.verdict)}>{result.verdict}</Badge>
                  </div>
                  <Badge role="neutral">{result.engagementType}</Badge>
                </div>
                <p className="mt-3 text-body">{result.verdictReason}</p>
                {result.read && <p className="mt-2 text-muted">{result.read}</p>}
              </Card>

              {/* The three calls that decide a client */}
              <Card title="The three calls that decide a client">
                <div className="flex flex-col gap-4">
                  <div>
                    <Field label="Dominant risk" value={result.dominantRisk} />
                    <div className="mt-3">
                      <Field label="Can commercial work move it?" value={result.commercialMovability} />
                    </div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <Field label="Fee-able commercial event" value={result.feeEvent} />
                  </div>
                  <div className="border-t border-border pt-4">
                    <Field label="Client fit / genuine need" value={result.clientFit} />
                  </div>
                </div>
              </Card>

              {/* Context behind the call */}
              <Card title="What the screener found">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Sector fit" value={result.sectorFit} />
                  <Field label="Stage" value={result.stage} />
                  <Field label="First buyer" value={result.firstBuyer} />
                  <Field label="Company or feature" value={result.companyOrFeature} />
                  <div className="sm:col-span-2">
                    <Field label="Facts (researched)" value={result.facts} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Incumbent alternative" value={result.incumbent} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Proof that would change everything" value={result.proof} />
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
