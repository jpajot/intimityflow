import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, ChevronDown, ChevronRight, MoreVertical, Mail, RefreshCw, XCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow, format, addDays, isPast, differenceInHours } from "date-fns";

function relativeTime(iso) {
  if (!iso) return "—";
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

function StatusBadge({ status }) {
  const cfg = {
    active:   "bg-green-100 text-green-700 border-green-200",
    disabled: "bg-gray-100 text-gray-500 border-gray-200",
    pending:  "bg-amber-100 text-amber-700 border-amber-200",
    accepted: "bg-green-100 text-green-700 border-green-200",
    revoked:  "bg-red-100 text-red-700 border-red-200",
    expired:  "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${cfg[status] || "bg-muted text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

function generateToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function PortalUsersPanel({ supplier, currentUser }) {
  const { toast } = useToast();
  const portalEnabled = !!supplier.portal_access_enabled;

  const [portalUsers, setPortalUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Invite dialog
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", roleLabel: "" });
  const [inviteErrors, setInviteErrors] = useState({});
  const [sendingInvite, setSendingInvite] = useState(false);

  // Confirm dialogs
  const [confirmDisable, setConfirmDisable] = useState(null); // user object
  const [confirmRevoke, setConfirmRevoke] = useState(null);   // invite object
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [users, inviteList] = await Promise.all([
      base44.entities.User.filter({ role: "supplier", linked_supplier_id: supplier.id }),
      base44.entities.SupplierPortalInvite.filter({ supplier_id: supplier.id }, "-invited_at", 500),
    ]);
    setPortalUsers(users);
    setInvites(inviteList);
    setLoading(false);
  }, [supplier.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const pendingInvites = invites.filter((i) => i.status === "pending");
  const historyInvites = invites.filter((i) => ["accepted", "revoked", "expired"].includes(i.status));

  // ── User actions ──────────────────────────────────────────────────────────
  const handleDisableUser = async () => {
    setActionLoading(true);
    await base44.entities.User.update(confirmDisable.id, { disabled: true });
    setConfirmDisable(null);
    setActionLoading(false);
    toast({ description: `Portal access disabled for ${confirmDisable.email}.` });
    loadData();
  };

  const handleReactivateUser = async (user) => {
    await base44.entities.User.update(user.id, { disabled: null });
    toast({ description: `Portal access reactivated for ${user.email}.` });
    loadData();
  };

  // ── Invite actions ────────────────────────────────────────────────────────
  const handleRevoke = async () => {
    setActionLoading(true);
    await base44.entities.SupplierPortalInvite.update(confirmRevoke.id, {
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: currentUser?.email || "",
    });
    setConfirmRevoke(null);
    setActionLoading(false);
    toast({ description: `Invite revoked for ${confirmRevoke.invited_email}.` });
    loadData();
  };

  const handleResend = async (invite) => {
    const token = generateToken();
    const expiresAt = addDays(new Date(), 14).toISOString();
    const now = new Date().toISOString();
    await base44.entities.SupplierPortalInvite.update(invite.id, {
      invite_token: token,
      expires_at: expiresAt,
      invited_at: now,
    });
    // Re-send email
    try {
      const origin = window.location.origin;
      const greeting = invite.invited_name ? ` ${invite.invited_name}` : "";
      await base44.integrations.Core.SendEmail({
        to: invite.invited_email,
        subject: `You're invited to IntimityFlow Supplier Portal — ${supplier.name}`,
        body: buildEmailBody(greeting, invite.invited_email, token, expiresAt, origin),
      });
      toast({ description: `Invite resent to ${invite.invited_email}.` });
    } catch {
      toast({ description: "Invite updated but email failed to send. Try resending again.", variant: "destructive" });
    }
    loadData();
  };

  // ── Send new invite ───────────────────────────────────────────────────────
  const validateInviteForm = async () => {
    const errs = {};
    const email = inviteForm.email.trim().toLowerCase();
    if (!email) { errs.email = "Email is required."; return errs; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errs.email = "Enter a valid email address."; return errs; }

    // Cross-supplier collision check
    const existingUsers = await base44.entities.User.filter({ email, role: "supplier" });
    if (existingUsers.length > 0) {
      const other = existingUsers[0];
      if (other.linked_supplier_id && other.linked_supplier_id !== supplier.id) {
        const sups = await base44.entities.Supplier.filter({ id: other.linked_supplier_id });
        const supName = sups[0]?.name || "another supplier";
        errs.email = `This email is already a portal user for ${supName}.`;
        return errs;
      }
    }

    // Duplicate pending invite check
    const dupInvite = pendingInvites.find((i) => i.invited_email?.toLowerCase() === email);
    if (dupInvite) { errs.email = "Invite already pending. Use 'Resend' instead."; return errs; }

    return errs;
  };

  const handleSendInvite = async () => {
    setSendingInvite(true);
    const errs = await validateInviteForm();
    if (Object.keys(errs).length > 0) {
      setInviteErrors(errs);
      setSendingInvite(false);
      return;
    }

    const email = inviteForm.email.trim().toLowerCase();
    const token = generateToken();
    const now = new Date().toISOString();
    const expiresAt = addDays(new Date(), 14).toISOString();
    const origin = window.location.origin;
    const greeting = inviteForm.name.trim() ? ` ${inviteForm.name.trim()}` : "";

    const invite = await base44.entities.SupplierPortalInvite.create({
      supplier_id: supplier.id,
      invited_email: email,
      invited_name: inviteForm.name.trim() || null,
      invited_role_label: inviteForm.roleLabel.trim() || null,
      status: "pending",
      invite_token: token,
      invited_at: now,
      invited_by: currentUser?.email || "",
      expires_at: expiresAt,
    });

    let emailOk = true;
    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `You're invited to IntimityFlow Supplier Portal — ${supplier.name}`,
        body: buildEmailBody(greeting, email, token, expiresAt, origin),
      });
    } catch {
      emailOk = false;
    }

    setShowInviteDialog(false);
    setInviteForm({ email: "", name: "", roleLabel: "" });
    setInviteErrors({});
    setSendingInvite(false);

    if (emailOk) {
      toast({ description: `Invite sent to ${email}.` });
    } else {
      toast({ description: "Invite created but email failed to send. You can resend manually from the list.", variant: "destructive" });
    }
    loadData();
  };

  function buildEmailBody(greeting, email, token, expiresAt, origin) {
    const formattedExpiry = format(new Date(expiresAt), "PPP 'at' p");
    const inviterName = currentUser?.full_name || currentUser?.email || "Your buyer";
    return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 16px">You're invited to the IntimityFlow Supplier Portal</h2>
<p>Hello${greeting},</p>
<p>${inviterName} has invited you to access the IntimityFlow Supplier Portal as a representative of <strong>${supplier.name}</strong>.</p>
<p>Click the link below to set up your account and sign in:</p>
<p style="margin:24px 0"><a href="${origin}/portal/invite/${token}" style="background:#e91e8c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Accept Invite &amp; Sign In</a></p>
<p style="color:#666;font-size:13px">This link expires on <strong>${formattedExpiry}</strong>.</p>
<p style="color:#666;font-size:13px">If you weren't expecting this invite, you can safely ignore this email.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
<p style="color:#999;font-size:12px">— IntimityFlow</p>
</div>`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const disabled = !portalEnabled;

  return (
    <div className={`space-y-5 ${disabled ? "opacity-60" : ""}`}>
      {/* Sub-section header */}
      <div className="border-t border-border pt-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-semibold">Portal Users</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Contacts at this supplier who can sign in to the portal.</p>
          </div>
        </div>

        {disabled && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span>Enable portal access above to invite portal users.</span>
          </div>
        )}
      </div>

      {/* ── Active Portal Users ─────────────────────────────────────────── */}
      <div className="space-y-2">
        {portalUsers.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No portal users yet. Use the invite action below.</p>
        ) : portalUsers.map((user) => {
          const isDisabled = !!user.disabled;
          return (
            <div key={user.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{user.full_name || user.email}</span>
                  <StatusBadge status={isDisabled ? "disabled" : "active"} />
                </div>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground">Last sign-in: —</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!isDisabled && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setConfirmDisable(user)}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-2" /> Deactivate
                    </DropdownMenuItem>
                  )}
                  {isDisabled && (
                    <DropdownMenuItem onClick={() => handleReactivateUser(user)}>
                      <RefreshCw className="w-3.5 h-3.5 mr-2" /> Reactivate
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      {/* ── Pending Invites ─────────────────────────────────────────────── */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Invites</p>
          {pendingInvites.map((invite) => {
            const isExpiringSoon = invite.expires_at &&
              (isPast(new Date(invite.expires_at)) || differenceInHours(new Date(invite.expires_at), new Date()) < 24);
            return (
              <div key={invite.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{invite.invited_email}</span>
                    {invite.invited_name && <span className="text-xs text-muted-foreground">({invite.invited_name})</span>}
                    <StatusBadge status="pending" />
                  </div>
                  {invite.invited_role_label && (
                    <p className="text-xs text-muted-foreground">{invite.invited_role_label}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Invited {relativeTime(invite.invited_at)}
                    {invite.invited_by ? ` by ${invite.invited_by}` : ""}
                  </p>
                  {invite.expires_at && (
                    <p className={`text-xs ${isExpiringSoon ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                      Expires {relativeTime(invite.expires_at)}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleResend(invite)}>
                      <Mail className="w-3.5 h-3.5 mr-2" /> Resend invite
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setConfirmRevoke(invite)}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-2" /> Revoke
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Invite button ───────────────────────────────────────────────── */}
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={disabled}
        onClick={() => { setInviteForm({ email: "", name: "", roleLabel: "" }); setInviteErrors({}); setShowInviteDialog(true); }}
      >
        <Plus className="w-3.5 h-3.5" /> Invite Portal User
      </Button>

      {/* ── Invite History ──────────────────────────────────────────────── */}
      {historyInvites.length > 0 && (
        <div className="border-t border-border pt-4 space-y-2">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showHistory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Invite History ({historyInvites.length})
          </button>
          {showHistory && (
            <div className="space-y-1.5">
              {historyInvites.map((invite) => (
                <div key={invite.id} className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 py-1.5 border-b border-border/50 last:border-0">
                  <span className="font-medium text-foreground">{invite.invited_email}</span>
                  {invite.invited_name && <span>· {invite.invited_name}</span>}
                  <StatusBadge status={invite.status} />
                  <span>· invited {relativeTime(invite.invited_at)}</span>
                  {invite.status === "accepted" && invite.accepted_at && (
                    <span>· accepted {relativeTime(invite.accepted_at)}</span>
                  )}
                  {invite.status === "revoked" && invite.revoked_at && (
                    <span>· revoked {relativeTime(invite.revoked_at)}{invite.revoked_by ? ` by ${invite.revoked_by}` : ""}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Invite Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showInviteDialog} onOpenChange={(o) => { if (!o) setShowInviteDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Portal User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => { setInviteForm((f) => ({ ...f, email: e.target.value })); setInviteErrors((er) => ({ ...er, email: undefined })); }}
                placeholder="contact@supplier.com"
                className={inviteErrors.email ? "border-destructive" : ""}
                autoFocus
              />
              {inviteErrors.email && <p className="text-xs text-destructive">{inviteErrors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Display Name</Label>
              <Input
                value={inviteForm.name}
                onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Anna Müller"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role Label</Label>
              <Input
                value={inviteForm.roleLabel}
                onChange={(e) => setInviteForm((f) => ({ ...f, roleLabel: e.target.value }))}
                placeholder="e.g. Sales contact, Account manager"
              />
              <p className="text-xs text-muted-foreground">Free-text label for context. Not a permission.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)} disabled={sendingInvite}>Cancel</Button>
            <Button onClick={handleSendInvite} disabled={sendingInvite} className="gap-2">
              {sendingInvite && <Loader2 className="w-4 h-4 animate-spin" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm disable user ────────────────────────────────────────── */}
      <AlertDialog open={!!confirmDisable} onOpenChange={(o) => { if (!o) setConfirmDisable(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable portal access?</AlertDialogTitle>
            <AlertDialogDescription>
              Disable portal access for <strong>{confirmDisable?.email}</strong>? They will not be able to sign in until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisableUser} disabled={actionLoading} className="bg-destructive text-destructive-foreground">
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm revoke invite ───────────────────────────────────────── */}
      <AlertDialog open={!!confirmRevoke} onOpenChange={(o) => { if (!o) setConfirmRevoke(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invite?</AlertDialogTitle>
            <AlertDialogDescription>
              Revoke invite for <strong>{confirmRevoke?.invited_email}</strong>? The invite link will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} disabled={actionLoading} className="bg-destructive text-destructive-foreground">
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}