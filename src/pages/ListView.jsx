import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import GroupBySelector from "../components/GroupBySelector";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Loader2, LayoutList } from "lucide-react";
import _ from "lodash";

const MARKET_FLAGS = { Spain: "🇪🇸", France: "🇫🇷", Germany: "🇩🇪", Italy: "🇮🇹" };

export default function ListView() {
  const [products, setProducts] = useState([]);
  const [colorVariants, setColorVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState("category");
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [prods, colors] = await Promise.all([
      base44.entities.Product.list("-created_date", 200),
      base44.entities.ProductColor.list("-created_date", 1000),
    ]);
    setProducts(prods);
    setColorVariants(colors);
    setLoading(false);
  };

  const grouped = _.groupBy(products, groupBy);
  const sortedKeys = Object.keys(grouped).sort();

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getColorsForProduct = (productId) =>
    colorVariants.filter((cv) => cv.product_id === productId);

  const getGroupVolume = (prods) => {
    return prods.reduce((total, p) => {
      const colors = getColorsForProduct(p.id);
      return total + colors.reduce((s, cv) =>
        s + (cv.volume_spain || 0) + (cv.volume_france || 0) + (cv.volume_germany || 0) + (cv.volume_italy || 0), 0);
    }, 0);
  };

  const getGroupColors = (prods) => {
    return prods.reduce((total, p) => total + getColorsForProduct(p.id).length, 0);
  };

  // Expand all by default when groupBy changes
  useEffect(() => {
    const expanded = {};
    sortedKeys.forEach((k) => { expanded[k] = true; });
    setExpandedGroups(expanded);
  }, [groupBy, products.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">List View</h1>
          <p className="text-muted-foreground mt-1">Styles grouped by criteria</p>
        </div>
        <GroupBySelector label="Group by" value={groupBy} onChange={setGroupBy} />
      </div>

      {sortedKeys.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <LayoutList className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No styles to display</h3>
          <p className="text-sm text-muted-foreground mt-1">Create some styles first</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedKeys.map((key) => {
            const groupProducts = grouped[key];
            const isExpanded = expandedGroups[key] !== false;
            const vol = getGroupVolume(groupProducts);
            const colCount = getGroupColors(groupProducts);

            return (
              <div key={key} className="bg-card rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => toggleGroup(key)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-semibold flex-1">{key || "Unassigned"}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{groupProducts.length} style{groupProducts.length !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{colCount} color{colCount !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{vol.toLocaleString()} units</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Product</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Colors</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Markets</th>
                            <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">Volume</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupProducts.map((p) => {
                            const colors = getColorsForProduct(p.id);
                            const pVolume = colors.reduce((s, cv) =>
                              s + (cv.volume_spain || 0) + (cv.volume_france || 0) + (cv.volume_germany || 0) + (cv.volume_italy || 0), 0);
                            const allMarkets = [...new Set(colors.flatMap((cv) => cv.markets || []))];

                            return (
                              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="px-5 py-3">
                                  <Link to={`/products/${p.id}`} className="hover:text-primary transition-colors">
                                    <div className="font-medium">{p.name}</div>
                                    <div className="text-xs text-muted-foreground">{p.sub_category} · {p.customer_need}</div>
                                  </Link>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex gap-1">
                                    {colors.slice(0, 6).map((cv) => (
                                      <div
                                        key={cv.id}
                                        className="w-6 h-6 rounded-full border border-border"
                                        style={{ backgroundColor: cv.color_hex || "#ccc" }}
                                        title={cv.color_name}
                                      />
                                    ))}
                                    {colors.length > 6 && (
                                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                                        +{colors.length - 6}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex gap-1">
                                    {allMarkets.map((m) => (
                                      <span key={m} title={m}>{MARKET_FLAGS[m]}</span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-right font-medium tabular-nums">
                                  {pVolume.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}