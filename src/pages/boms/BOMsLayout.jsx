import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ClipboardList, GitCompare } from "lucide-react";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";

const SECTIONS = [
  { id: "list",    label: "BOM Lists",   icon: ClipboardList, path: "/boms" },
  { id: "compare", label: "BOM Compare", icon: GitCompare,    path: "/boms/compare" },
];

function pathToId(pathname) {
  if (pathname.startsWith("/boms/compare")) return "compare";
  return "list";
}

export default function BOMsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = pathToId(location.pathname);

  const [bomCount, setBomCount] = useState(null);

  useEffect(() => {
    base44.entities.BOM.list("-created_date", 500)
      .then((boms) => setBomCount(boms.length))
      .catch(() => {});
  }, []);

  const subNavItems = SECTIONS.map((s) => ({
    id: s.id,
    label: s.label,
    icon: s.icon,
    count: s.id === "list" ? bomCount : undefined,
  }));

  useRegisterSubNav(
    subNavItems,
    activeId,
    (id) => {
      const section = SECTIONS.find((s) => s.id === id);
      if (section) navigate(section.path);
    },
    "BOMs"
  );

  return <Outlet />;
}