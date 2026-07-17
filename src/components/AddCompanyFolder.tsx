import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Input } from "@/components/ds";
import { useAuth } from "@/auth/AuthProvider";
import { useDriveData } from "@/data/DriveDataProvider";
import { createCompanyFolder } from "@/lib/drive";
import { CONFIG } from "@/config";

/** Adds a company folder to Accounts/ or Leads/ — creates the folder, then reloads. */
export function AddCompanyFolder({ area }: { area: "accounts" | "leads" }) {
  const { token } = useAuth();
  const { reload } = useDriveData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = area === "accounts" ? "account" : "lead";

  async function save() {
    if (!token || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createCompanyFolder(token, CONFIG.driveFolderId, area, name);
      setName("");
      setOpen(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the folder.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} strokeWidth={1.5} />
        New {label}
      </Button>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="w-64">
          <Input
            placeholder="Company name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setOpen(false);
            }}
          />
        </div>
        <Button onClick={() => void save()} disabled={saving || !name.trim()}>
          {saving ? "Adding…" : "Add"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(false);
            setName("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="mt-2 text-small text-danger">{error}</p>}
    </div>
  );
}
