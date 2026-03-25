import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import GroupBySelector from "../components/GroupBySelector";
import MatrixCell from "../components/MatrixCell";
import { Loader2, Grid3X3 } from "lucide-react";
import _ from "lodash";

export default function MatrixView() {
  const [products, setProducts] = useState([]);
  const [colorVariants, setColorVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rowCriteria, setRowCriteria] = useState("category");
  const [colCriteria, setColCriteria] = useState("customer_need");

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

  const rowGroups = _.groupBy(products, rowCriteria);
  const colGroups = _.groupBy(products, colCriteria);
  const rowKeys = Object.keys(rowGroups).sort();
  const colKeys = Object.keys(colGroups).sort();

  const getProductsAt = (rowKey, colKey) => {
    return products.filter((p) => p[rowCriteria] === rowKey && p[colCriteria] === colKey);
  };

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
          <h1 className="font-display text-3xl font-semibold tracking-tight">Matrix View</h1>
          <p className="text-muted-foreground mt-1">Cross-reference products by criteria</p>
        </div>
        <div className="flex gap-4 flex-wrap">
          <GroupBySelector
            label="Rows"
            value={rowCriteria}
            onChange={setRowCriteria}
            excludeValues={[colCriteria]}
          />
          <GroupBySelector
            label="Columns"
            value={colCriteria}
            onChange={setColCriteria}
            excludeValues={[rowCriteria]}
          />
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Grid3X3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No products to display</h3>
          <p className="text-sm text-muted-foreground mt-1">Create some products first</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="inline-block min-w-full">
            <table className="w-full border-separate" style={{ borderSpacing: "6px" }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-background min-w-[140px]">
                    <div className="px-3 py-2 text-xs text-muted-foreground text-right">
                      <span className="block font-semibold">{rowCriteria.replace("_", " ")}</span>
                      <span className="text-[10px]">↓ rows</span>
                      <span className="mx-1">|</span>
                      <span className="text-[10px]">columns →</span>
                      <span className="block font-semibold">{colCriteria.replace("_", " ")}</span>
                    </div>
                  </th>
                  {colKeys.map((colKey) => (
                    <th key={colKey} className="min-w-[160px]">
                      <div className="px-3 py-2 bg-muted rounded-lg text-xs font-semibold text-center">
                        {colKey || "—"}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowKeys.map((rowKey) => (
                  <tr key={rowKey}>
                    <td className="sticky left-0 z-10 bg-background">
                      <div className="px-3 py-2 bg-muted rounded-lg text-xs font-semibold">
                        {rowKey || "—"}
                      </div>
                    </td>
                    {colKeys.map((colKey) => {
                      const cellProducts = getProductsAt(rowKey, colKey);
                      return (
                        <td key={colKey} className="align-top">
                          <MatrixCell
                            products={cellProducts}
                            colorVariants={colorVariants}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}