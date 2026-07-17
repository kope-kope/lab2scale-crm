import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Card, Input } from "@/components/ds";
import { useAuth } from "@/auth/AuthProvider";
import { useDriveData } from "@/data/DriveDataProvider";
import { appendContact } from "@/lib/drive";
import { CONFIG } from "@/config";

/** Appends a contact row to the Contacts sheet, then reloads. */
export function AddContactForm({ defaultCompany }: { defaultCompany?: string }) {
  const { token } = useAuth();
  const { reload } = useDriveData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState(defaultCompany ?? "");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setCompany(defaultCompany ?? "");
    setEmail("");
    setTitle("");
    setError(null);
  }

  async function save() {
    if (!token || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await appendContact(
        token,
        CONFIG.driveFolderId,
        { name: name.trim(), company: company.trim(), email: email.trim(), title: title.trim() },
        () => `c-${Date.now()}`,
      );
      reset();
      setOpen(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the contact.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} strokeWidth={1.5} />
        Add contact
      </Button>
    );
  }

  return (
    <Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Name" placeholder="Ada Lovelace" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
        <Input label="Company" placeholder="Apollo Atomics" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Input label="Title" placeholder="Head of ops" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Email" placeholder="ada@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button onClick={() => void save()} disabled={saving || !name.trim()}>
          {saving ? "Adding…" : "Add contact"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="mt-2 text-small text-danger">{error}</p>}
    </Card>
  );
}
