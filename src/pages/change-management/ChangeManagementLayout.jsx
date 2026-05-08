import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { FileStack, Inbox, ClipboardList, FilePlus } from "lucide-react";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";

const SECTIONS = [
  { id: "ecos",    label: "All ECOs",        icon: FileStack,     path: "/change-management/ecos" },
  { id: "pending", label: "Pending Reviews", icon: Inbox,         path: "/change-management/pending" },
  { id: "ecrs",    label: "All ECRs",        icon: ClipboardList, path: "/change-management/ecrs" },
  { id: "manual",  label: "Manual ECO",      icon: FilePlus,      path: "/change-management/manual" },
];

function pathToId(pathname) {
  if (pathname.startsWith("/change-management/pending")) return "pending";
  if (pathname.startsWith("/change-management/ecrs")) return "ecrs";
  if (pathname.startsWith("/change-management/manual")) return "manual";
  return "ecos";
}

export default function ChangeManagementLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = pathToId(location.pathname);

  const [counts, setCounts] = useState({ ecos: null, pending: null, ecrs: null });

  useEffect(() => {
    Promise.all([
      base44.entities.ECO.list("-created_date", 500),
      base44.entities.ECOAffectedDownstream.filter(
        { propagation_status: { $in: ["pending", "notified", "under_review"] } },
        "-created_date",
        500
      ),
      base44.entities.ECR.list("-created_date", 500),
    ]).then(([ecos, pending, ecrs]) => {
      setCounts({ ecos: ecos.length, pending: pending.length, ecrs: ecrs.length });
    }).catch(() => {});
  }, []);

  const subNavItems = SECTIONS.map((s) => ({
    id: s.id,
    label: s.label,
    icon: s.icon,
    count: s.id === "ecos" ? counts.ecos
         : s.id === "pending" ? counts.pending
         : s.id === "ecrs" ? counts.ecrs
         : undefined,
    countVariant: s.id === "pending" && counts.pending > 0 ? "red" : undefined,
  }));

  useRegisterSubNav(
    subNavItems,
    activeId,
    (id) => {
      const section = SECTIONS.find((s) => s.id === id);
      if (section) navigate(section.path);
    },
    "Change Management"
  );

  return <Outlet />;
}