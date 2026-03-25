import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Search, ChevronDown, ChevronRight } from "lucide-react";

const LANG_FIELDS = [
  { key: "en_description", label: "EN" },
  { key: "fr_description", label: "FR" },
  { key: "de_description", label: "DE" },
  { key: "sp_description", label: "SP" },
  { key: "it_description", label: "IT" },
];

const emptyForm = { size_code: "", name: "" };
const emptyLang = { en_description: "", fr_description: "", de_description: "", sp_description: "", it_description: "" };

export default function SizeLibrary() {
  const [sizes, setSizes] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [langForm, setLangForm] = useState(emptyLang);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [s, l] = await Promise.all([
      base44.entities.Size.list("size_code", 500),
      base44.entities.SizeLanguage.list("-created_date", 500),
    ]);
    setSizes(s);
    setLanguages(l);
    setLoading(false);
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setLangForm(emptyLang); setShowDialog(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ size_code: s.size_code, name: s.name });
    const lang = languages.find((l) => l.size_id === s.id) || {};
    setLangForm({
      en_description: lang.en_description || "",
      fr_description: lang.fr_description || "",
      de_description: lang.de_description || "",
      sp_description: lang.sp_description || "",
      it_description: lang.it_description || "",
    });
    setShowDialog(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    let sizeId;
    if (editing) {
      await base44.entities.Size.update(editing.id, form);
      setSizes((prev) => prev.map((s) => s.id === editing.id ? { ...s, ...form } : s));
      sizeId = editing.id;
    } else {
      const created = await base44.entities.Size.create(form);
      setSizes((prev) => [...prev, created]);
      sizeId = created.id;
    }
    // Upsert SizeLanguage
    const existingLang = languages.find((l) => l.size_id === sizeId);
    if (existingLang) {
      await base44.entities.SizeLanguage.update(existingLang.id, langForm);
      setLanguages((prev) => prev.map((l) => l.id === existingLang.id ? { ...l, ...langForm } : l));
    } else {
      const created = await base44.entities.SizeLanguage.create({ ...langForm, size_id: sizeId });
      setLanguages((prev) => [...prev, created]);
    }
    setSaving(false);
    setShowDialog(false);
  };

  const handleDelete = async (s) => {
    await base44.entities.Size.delete(s.id);
    setSizes((prev) => prev.filter((x) => x.id !== s.id));
    const lang = languages.find((l) => l.size_id === s.id);
    if (lang) {
      await base44.entities.SizeLanguage.delete(lang.id);
      setLanguages((prev) => prev.filter((l) => l.id !== lang.id));
    }
  };

  const filtered = sizes.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.size_code?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Size Library</h1>
          <p className="text-muted-foreground mt-1">{sizes.length} sizes</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Add Size</Button>
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter sizes…" className="pl-10" />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-8 px-4 py-3"></th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Code</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">EN</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">FR</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">DE</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden xl:table-cell">SP</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden xl:table-cell">IT</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">No sizes found.</td></tr>
            )}
            {filtered.map((s) => {
              const lang = languages.find((l) => l.size_id === s.id) || {};
              return (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{s.size_code}</td>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{lang.en_description || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{lang.fr_description || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{lang.de_description || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">{lang.sp_description || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">{lang.it_description || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={showDialog} onOpenChange={(o) => !o && setShowDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Size" : "New Size"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Size Code</Label>
                <Input value={form.size_code} onChange={(e) => setForm((f) => ({ ...f, size_code: e.target.value }))} placeholder="e.g. XS, 36" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Extra Small" required />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Localized Descriptions</p>
              {LANG_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs font-semibold w-6 text-muted-foreground shrink-0">{label}</span>
                  <Input value={langForm[key]} onChange={(e) => setLangForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={`${label} description…`} className="flex-1" />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}