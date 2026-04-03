import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Languages, ChevronRight, Search } from "lucide-react";
import DataTable from "@/components/DataTable";
import ViewSelector from "@/components/ViewSelector";

// Entities and their translatable fields
const TRANSLATABLE_ENTITIES = [
  { type: "Product", label: "Product", fields: ["name", "description"], searchField: "name", displayField: "name" },
  { type: "TechnicalColor", label: "Technical Color", fields: ["name"], searchField: "name", displayField: "name" },
  { type: "CommercialColor", label: "Commercial Color", fields: ["color_name"], searchField: "color_name", displayField: "color_name" },
  { type: "Size", label: "Size", fields: ["name"], searchField: "name", displayField: "size_code" },
];

export default function Translations() {
  const [translations, setTranslations] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [records, setRecords] = useState({}); // { entityType: [records] }
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Picker state
  const [pickerEntityType, setPickerEntityType] = useState("");
  const [pickerRecordSearch, setPickerRecordSearch] = useState("");
  const [pickerRecord, setPickerRecord] = useState(null);
  const [pickerField, setPickerField] = useState("");
  const [showRecordDropdown, setShowRecordDropdown] = useState(false);

  // ViewSelector columns state
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ language_code: "", translated_text: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    const [trans, lovTypes] = await Promise.all([
      base44.entities.Translation.list("-created_date", 2000),
      base44.entities.TypeOfLOV.filter({ code: "language" }),
    ]);
    setTranslations(trans);

    if (lovTypes.length > 0) {
      const langs = await base44.entities.ListOfValues.filter({ type_of_lov_id: lovTypes[0].id });
      setLanguages(langs.sort((a, b) => a.name.localeCompare(b.name)));
    }
    setLoading(false);
  };

  // Load records for selected entity type
  useEffect(() => {
    if (!pickerEntityType) return;
    if (records[pickerEntityType]) return; // already loaded
    setLoadingRecords(true);
    const entity = TRANSLATABLE_ENTITIES.find((e) => e.type === pickerEntityType);
    base44.entities[pickerEntityType].list(entity.searchField, 2000).then((res) => {
      setRecords((prev) => ({ ...prev, [pickerEntityType]: res }));
      setLoadingRecords(false);
    });
  }, [pickerEntityType]);

  const entityDef = TRANSLATABLE_ENTITIES.find((e) => e.type === pickerEntityType);

  const filteredEntityRecords = useMemo(() => {
    if (!pickerEntityType || !records[pickerEntityType]) return [];
    const q = pickerRecordSearch.toLowerCase();
    if (!q) return records[pickerEntityType].slice(0, 50);
    const def = TRANSLATABLE_ENTITIES.find((e) => e.type === pickerEntityType);
    return records[pickerEntityType]
      .filter((r) => r[def.searchField]?.toLowerCase().includes(q) || r[def.displayField]?.toLowerCase().includes(q))
      .slice(0, 50);
  }, [pickerEntityType, pickerRecordSearch, records]);

  // Translations for current selection
  const contextTranslations = useMemo(() => {
    if (!pickerRecord || !pickerField) return translations;
    return translations.filter(
      (t) => t.parent_entity_type === pickerEntityType && t.parent_id === pickerRecord.id && t.field_name === pickerField
    );
  }, [translations, pickerEntityType, pickerRecord, pickerField]);

  const getLanguageName = (code) => languages.find((l) => l.name === code || l.name?.toLowerCase() === code?.toLowerCase())?.name || code;

  const getRecordLabel = (t) => {
    const entityRecords = records[t.parent_entity_type] || [];
    const rec = entityRecords.find((r) => r.id === t.parent_id);
    const def = TRANSLATABLE_ENTITIES.find((e) => e.type === t.parent_entity_type);
    if (!rec || !def) return t.parent_id;
    return rec[def.displayField] || rec[def.searchField] || t.parent_id;
  };

  // All columns definition
  const allColumns = [
    {
      id: "entity_type",
      label: "Entity",
      width: 140,
      sortKey: (t) => t.parent_entity_type || "",
      render: (t) => {
        const def = TRANSLATABLE_ENTITIES.find((e) => e.type === t.parent_entity_type);
        return <Badge variant="secondary" className="text-xs">{def?.label || t.parent_entity_type}</Badge>;
      },
    },
    {
      id: "record",
      label: "Record",
      width: 160,
      sortKey: (t) => getRecordLabel(t),
      render: (t) => <span className="font-medium text-sm">{getRecordLabel(t)}</span>,
    },
    {
      id: "field_name",
      label: "Field",
      width: 120,
      sortKey: (t) => t.field_name || "",
      render: (t) => <span className="font-mono text-xs text-muted-foreground">{t.field_name}</span>,
    },
    {
      id: "language_code",
      label: "Language",
      width: 120,
      sortKey: (t) => t.language_code || "",
      render: (t) => (
        <span className="font-medium text-sm">{t.language_code}</span>
      ),
    },
    {
      id: "translated_text",
      label: "Translation",
      width: 300,
      sortKey: (t) => t.translated_text || "",
      render: (t) => <span className="text-sm">{t.translated_text}</span>,
    },
    {
      id: "actions",
      label: "",
      width: 80,
      render: (t) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  useEffect(() => {
    setVisibleColumns(allColumns);
  }, [translations, records, languages]);

  const openNew = () => {
    setEditing(null);
    setForm({
      parent_entity_type: pickerEntityType || "",
      parent_id: pickerRecord?.id || "",
      field_name: pickerField || "",
      language_code: "",
      translated_text: "",
    });
    setShowDialog(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({
      parent_entity_type: t.parent_entity_type,
      parent_id: t.parent_id,
      field_name: t.field_name,
      language_code: t.language_code,
      translated_text: t.translated_text,
    });
    setShowDialog(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    // Preload records for the entity if not loaded
    if (!records[form.parent_entity_type]) {
      const res = await base44.entities[form.parent_entity_type].list("name", 2000);
      setRecords((prev) => ({ ...prev, [form.parent_entity_type]: res }));
    }
    if (editing) {
      await base44.entities.Translation.update(editing.id, form);
      setTranslations((prev) => prev.map((t) => t.id === editing.id ? { ...t, ...form } : t));
    } else {
      const created = await base44.entities.Translation.create(form);
      setTranslations((prev) => [created, ...prev]);
    }
    setSaving(false);
    setShowDialog(false);
  };

  const handleDelete = async (t) => {
    await base44.entities.Translation.delete(t.id);
    setTranslations((prev) => prev.filter((x) => x.id !== t.id));
  };

  const selectRecord = (rec) => {
    setPickerRecord(rec);
    setPickerRecordSearch(rec[entityDef?.searchField] || rec[entityDef?.displayField] || "");
    setShowRecordDropdown(false);
    setPickerField("");
  };

  const filterableFields = [
    { id: "parent_entity_type", label: "Entity", getValue: (t) => t.parent_entity_type },
    { id: "field_name", label: "Field", getValue: (t) => t.field_name },
    { id: "language_code", label: "Language", getValue: (t) => t.language_code },
  ];

  const displayRows = filteredRows.length > 0 || contextTranslations.length === 0 ? filteredRows : contextTranslations;

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Translations</h1>
          <p className="text-muted-foreground mt-1">{translations.length} translation{translations.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openNew} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Add Translation
        </Button>
      </div>

      {/* Picker */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filter by context</p>
        <div className="flex flex-wrap gap-3 items-end">
          {/* Step 1: Entity Type */}
          <div className="space-y-1.5 min-w-[180px]">
            <Label className="text-xs">Entity</Label>
            <Select
              value={pickerEntityType || "all"}
              onValueChange={(v) => {
                setPickerEntityType(v === "all" ? "" : v);
                setPickerRecord(null);
                setPickerRecordSearch("");
                setPickerField("");
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {TRANSLATABLE_ENTITIES.map((e) => (
                  <SelectItem key={e.type} value={e.type}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Record search */}
          {pickerEntityType && (
            <div className="space-y-1.5 min-w-[220px] relative">
              <Label className="text-xs flex items-center gap-1">
                <ChevronRight className="w-3 h-3" /> Record
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  className="h-8 text-xs pl-7"
                  placeholder={`Search ${entityDef?.label}…`}
                  value={pickerRecordSearch}
                  onChange={(e) => {
                    setPickerRecordSearch(e.target.value);
                    setPickerRecord(null);
                    setShowRecordDropdown(true);
                  }}
                  onFocus={() => setShowRecordDropdown(true)}
                />
              </div>
              {showRecordDropdown && pickerEntityType && (
                <div className="absolute z-20 top-full left-0 w-72 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                  <div className="max-h-52 overflow-y-auto">
                    {loadingRecords ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredEntityRecords.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No records found</p>
                    ) : (
                      filteredEntityRecords.map((rec) => (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => selectRecord(rec)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left transition-colors"
                        >
                          <span className="text-xs font-medium flex-1">{rec[entityDef.displayField]}</span>
                          {entityDef.displayField !== entityDef.searchField && (
                            <span className="text-[10px] text-muted-foreground font-mono">{rec[entityDef.searchField]}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-border p-1.5">
                    <button
                      type="button"
                      onClick={() => { setPickerRecord(null); setPickerRecordSearch(""); setShowRecordDropdown(false); }}
                      className="w-full text-xs text-muted-foreground hover:text-foreground py-1 text-center transition-colors"
                    >
                      Clear record filter
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Field */}
          {pickerRecord && entityDef && (
            <div className="space-y-1.5 min-w-[160px]">
              <Label className="text-xs flex items-center gap-1">
                <ChevronRight className="w-3 h-3" /> Field
              </Label>
              <Select
                value={pickerField || "all"}
                onValueChange={(v) => setPickerField(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All fields" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All fields</SelectItem>
                  {entityDef.fields.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(pickerEntityType || pickerRecord || pickerField) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs self-end text-muted-foreground"
              onClick={() => {
                setPickerEntityType("");
                setPickerRecord(null);
                setPickerRecordSearch("");
                setPickerField("");
              }}
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Active context summary */}
        {(pickerEntityType || pickerRecord) && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {pickerEntityType && (
              <Badge variant="outline" className="text-xs gap-1">
                <Languages className="w-3 h-3" />
                {entityDef?.label}
              </Badge>
            )}
            {pickerRecord && (
              <>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <Badge variant="secondary" className="text-xs">
                  {pickerRecord[entityDef?.displayField] || pickerRecord[entityDef?.searchField]}
                </Badge>
              </>
            )}
            {pickerField && (
              <>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <Badge className="text-xs">{pickerField}</Badge>
              </>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {contextTranslations.length} result{contextTranslations.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* List view */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <ViewSelector
            pageKey="translations"
            allColumns={allColumns}
            onColumnsChange={setVisibleColumns}
            filterableFields={filterableFields}
            rows={contextTranslations}
            onFilteredRowsChange={setFilteredRows}
          />
        </div>

        <DataTable
          columns={visibleColumns}
          rows={pickerRecord || pickerEntityType ? contextTranslations : translations}
          filterFields={[
            { getValue: (t) => t.parent_entity_type },
            { getValue: (t) => t.field_name },
            { getValue: (t) => t.language_code },
            { getValue: (t) => t.translated_text },
          ]}
        />
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => !o && setShowDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Translation" : "New Translation"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {/* Entity Type */}
            <div className="space-y-1.5">
              <Label className="text-xs">Entity</Label>
              <Select
                value={form.parent_entity_type || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, parent_entity_type: v === "none" ? "" : v, parent_id: "", field_name: "" }))}
              >
                <SelectTrigger><SelectValue placeholder="Select entity…" /></SelectTrigger>
                <SelectContent>
                  {TRANSLATABLE_ENTITIES.map((e) => (
                    <SelectItem key={e.type} value={e.type}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Record picker */}
            {form.parent_entity_type && (
              <DialogRecordPicker
                entityType={form.parent_entity_type}
                value={form.parent_id}
                records={records[form.parent_entity_type] || []}
                onLoadRecords={() => {
                  if (!records[form.parent_entity_type]) {
                    const def = TRANSLATABLE_ENTITIES.find((e) => e.type === form.parent_entity_type);
                    base44.entities[form.parent_entity_type].list(def.searchField, 2000).then((res) => {
                      setRecords((prev) => ({ ...prev, [form.parent_entity_type]: res }));
                    });
                  }
                }}
                onChange={(id) => setForm((f) => ({ ...f, parent_id: id }))}
              />
            )}

            {/* Field */}
            {form.parent_entity_type && (
              <div className="space-y-1.5">
                <Label className="text-xs">Field</Label>
                <Select
                  value={form.field_name || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, field_name: v === "none" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select field…" /></SelectTrigger>
                  <SelectContent>
                    {TRANSLATABLE_ENTITIES.find((e) => e.type === form.parent_entity_type)?.fields.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Language */}
            <div className="space-y-1.5">
              <Label className="text-xs">Language</Label>
              <Select
                value={form.language_code || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, language_code: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select language…" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {languages.map((l) => (
                    <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Text */}
            <div className="space-y-1.5">
              <Label className="text-xs">Translated Text</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.translated_text}
                onChange={(e) => setForm((f) => ({ ...f, translated_text: e.target.value }))}
                placeholder="Enter translated text…"
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.parent_entity_type || !form.parent_id || !form.field_name || !form.language_code} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component for record picker inside dialog
function DialogRecordPicker({ entityType, value, records, onLoadRecords, onChange }) {
  const [search, setSearch] = useState("");
  const def = TRANSLATABLE_ENTITIES.find((e) => e.type === entityType);

  useEffect(() => {
    onLoadRecords();
  }, [entityType]);

  const filtered = useMemo(() => {
    if (!records.length) return [];
    const q = search.toLowerCase();
    if (!q) return records.slice(0, 50);
    return records
      .filter((r) => r[def.searchField]?.toLowerCase().includes(q) || r[def.displayField]?.toLowerCase().includes(q))
      .slice(0, 50);
  }, [records, search, def]);

  const selected = records.find((r) => r.id === value);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Record</Label>
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
          <span className="flex-1 text-sm font-medium">{selected[def.displayField] || selected[def.searchField]}</span>
          <button type="button" onClick={() => onChange("")} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${def?.label}…`} className="h-8 text-xs" autoFocus />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No records found</p>
            ) : (
              filtered.map((rec) => (
                <button key={rec.id} type="button" onClick={() => onChange(rec.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left transition-colors">
                  <span className="text-sm font-medium flex-1">{rec[def.displayField]}</span>
                  {def.displayField !== def.searchField && (
                    <span className="text-xs text-muted-foreground font-mono">{rec[def.searchField]}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}