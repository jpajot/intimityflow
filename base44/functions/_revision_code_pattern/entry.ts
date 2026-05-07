/**
 * _revision_code_pattern.js
 *
 * REFERENCE IMPLEMENTATION — Canonical spreadsheet-column letter revision code algorithm.
 *
 * This file is a documentation-only reference (like generateEntityCodeInline).
 * It returns HTTP 405 on all requests and MUST NOT be used as an API endpoint.
 *
 * ANY function that creates a ProductRevision row must INLINE a copy of the
 * codeToNum / numToCode / nextRevisionCode logic below. No cross-function imports
 * are possible in the Deno deploy runtime.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ALGORITHM: Spreadsheet-column naming (Excel-style)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sequence: A, B, C, …, Z, AA, AB, …, AZ, BA, …, ZZ, AAA, …
 *
 * This is a "base-26 with no zero digit" number system:
 *   A=1, B=2, …, Z=26, AA=27, AB=28, …, AZ=52, BA=53, …
 *
 * Sort order:
 *   - Shorter codes always sort BEFORE longer codes.
 *   - Within the same length, alphabetical order.
 *   So: Z < AA < AB < AZ < BA < ZZ < AAA
 *
 * CANONICAL IMPLEMENTATION:
 *
 *   function codeToNum(code) {
 *     let n = 0;
 *     for (let i = 0; i < code.length; i++) {
 *       n = n * 26 + (code.charCodeAt(i) - 64); // 'A'=65 → 1
 *     }
 *     return n;
 *   }
 *
 *   function numToCode(n) {
 *     let result = '';
 *     while (n > 0) {
 *       n -= 1;
 *       result = String.fromCharCode((n % 26) + 65) + result;
 *       n = Math.floor(n / 26);
 *     }
 *     return result;
 *   }
 *
 *   function nextRevisionCode(existingCodes) {
 *     if (!existingCodes || existingCodes.length === 0) return 'A';
 *     // Sort: shorter first, then alphabetical within same length
 *     const sorted = [...existingCodes].sort((a, b) => {
 *       if (a.length !== b.length) return a.length - b.length;
 *       return a.localeCompare(b);
 *     });
 *     const latest = sorted[sorted.length - 1];
 *     return numToCode(codeToNum(latest) + 1);
 *   }
 *
 * USAGE (when creating a ProductRevision):
 *
 *   const existing = await svc.entities.ProductRevision.filter({
 *     product_id, target_type, target_id
 *   });
 *   const existingCodes = existing.map(r => r.revision_code).filter(Boolean);
 *   const revision_code = nextRevisionCode(existingCodes);
 *
 * EXAMPLES:
 *   nextRevisionCode([])         → "A"
 *   nextRevisionCode(["A"])      → "B"
 *   nextRevisionCode(["A","B"])  → "C"
 *   nextRevisionCode(["Z"])      → "AA"
 *   nextRevisionCode(["AZ"])     → "BA"
 *   nextRevisionCode(["ZZ"])     → "AAA"
 *   codeToNum("A")  = 1
 *   codeToNum("Z")  = 26
 *   codeToNum("AA") = 27
 *   codeToNum("AZ") = 52
 *   codeToNum("BA") = 53
 *   numToCode(1)  = "A"
 *   numToCode(26) = "Z"
 *   numToCode(27) = "AA"
 *   numToCode(52) = "AZ"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Functions that MUST inline this pattern:
 *   - functions/createProductRevision  (Task 3)
 *   - Future: any ECO-applied path (Prompt #13b) that creates ProductRevision rows
 * ─────────────────────────────────────────────────────────────────────────────
 */

// This file serves HTTP 405 for all requests.
// It is a documentation reference only — never call it as an API endpoint.
Deno.serve(async (_req) => {
  return Response.json(
    { error: 'This file is a documentation reference only. Do not call it as an endpoint.' },
    { status: 405 }
  );
});