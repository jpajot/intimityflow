import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

const COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
];

function getColor(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name, email) {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const STALE_MS = 60_000; // 1 minute

export default function PresenceIndicator({ entityType, entityId }) {
  const [others, setOthers] = useState([]);
  const recordIdRef = useRef(null);
  const meRef = useRef(null);

  useEffect(() => {
    if (!entityId || entityId === "new") return;

    let intervalId;
    let unsubscribe;

    const register = async () => {
      const me = await base44.auth.me();
      meRef.current = me;

      // Upsert presence record
      const existing = await base44.entities.UserPresence.filter({
        entity_type: entityType,
        entity_id: entityId,
        user_email: me.email,
      });

      const payload = {
        entity_type: entityType,
        entity_id: entityId,
        user_email: me.email,
        user_name: me.full_name || "",
        last_seen: new Date().toISOString(),
      };

      if (existing.length > 0) {
        recordIdRef.current = existing[0].id;
        await base44.entities.UserPresence.update(existing[0].id, payload);
      } else {
        const created = await base44.entities.UserPresence.create(payload);
        recordIdRef.current = created.id;
      }

      // Load others
      await refreshOthers(me.email);

      // Heartbeat every 30s
      intervalId = setInterval(async () => {
        if (recordIdRef.current) {
          await base44.entities.UserPresence.update(recordIdRef.current, { last_seen: new Date().toISOString() }).catch(() => {});
          await refreshOthers(me.email).catch(() => {});
        }
      }, 30_000);

      // Subscribe to changes
      unsubscribe = base44.entities.UserPresence.subscribe(async () => {
        if (meRef.current) await refreshOthers(meRef.current.email).catch(() => {});
      });
    };

    const refreshOthers = async (myEmail) => {
      const all = await base44.entities.UserPresence.filter({
        entity_type: entityType,
        entity_id: entityId,
      });
      const cutoff = Date.now() - STALE_MS;
      const active = all.filter(
        (p) => p.user_email !== myEmail && new Date(p.last_seen).getTime() > cutoff
      );
      setOthers(active);
    };

    register().catch(() => {});

    return () => {
      clearInterval(intervalId);
      if (unsubscribe) unsubscribe();
      if (recordIdRef.current) {
        base44.entities.UserPresence.delete(recordIdRef.current).catch(() => {});
      }
    };
  }, [entityType, entityId]);

  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-1" title={others.map(o => o.user_name || o.user_email).join(", ")}>
      {others.slice(0, 5).map((p) => (
        <div
          key={p.id}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ring-2 ring-background ${getColor(p.user_email)}`}
          title={p.user_name || p.user_email}
        >
          {initials(p.user_name, p.user_email)}
        </div>
      ))}
    </div>
  );
}