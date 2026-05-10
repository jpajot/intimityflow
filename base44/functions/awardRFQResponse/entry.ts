import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { rfq_line_id, response_id, rfq_id } = await req.json();
    if (!rfq_line_id || !response_id || !rfq_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch line, response, and RFQ in parallel
    const [line, response, rfq] = await Promise.all([
      base44.entities.RFQLine.filter({ id: rfq_line_id }).then((r) => r[0]),
      base44.entities.RFQResponse.filter({ id: response_id }).then((r) => r[0]),
      base44.entities.RFQ.filter({ id: rfq_id }).then((r) => r[0]),
    ]);

    if (!line || !response || !rfq) {
      return Response.json({ error: 'Line, response, or RFQ not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // STEP 0 — Capture target response id (type-safe validation)
    const awardedResponseId = response.id;
    if (!awardedResponseId || typeof awardedResponseId !== 'string') {
      return Response.json({ error: 'Invalid response id' }, { status: 400 });
    }

    // STEP 1 — Demote ALL siblings FIRST (before promoting the target)
    // Use filtered update to ensure target is never touched
    const siblings = await base44.entities.RFQResponse.filter({
      rfq_line_id,
      id: { $ne: awardedResponseId },
    });
    const toReject = siblings.filter((s) => ['submitted', 'under_review', 'draft', 'awarded'].includes(s.status));
    await Promise.all(
      toReject.map((s) =>
        base44.entities.RFQResponse.update(s.id, { status: 'rejected', is_awarded: false })
      )
    );

    // STEP 2 — Promote the target response (AFTER sibling demotion)
    await base44.entities.RFQResponse.update(awardedResponseId, {
      is_awarded: true,
      status: 'awarded',
    });

    // STEP 3 — Update RFQLine
    await base44.entities.RFQLine.update(rfq_line_id, {
      awarded_response_id: response_id,
      awarded_at: now,
      awarded_by: user.email,
      status: 'awarded',
    });

    // STEP 4 — Find and supersede prior ProductCost
    const priorCosts = await base44.entities.ProductCost.filter({
      status: 'active',
      project_id: rfq.project_id,
      product_id: line.product_id,
      product_color_id: line.product_color_id || null,
      product_color_and_more_id: line.product_color_and_more_id || null,
      routing_step_id: line.routing_step_id,
      supplier_id: line.recipient_supplier_id,
    });

    let priorCostId = null;
    if (priorCosts.length > 0) {
      const prior = priorCosts[0];
      priorCostId = prior.id;
      await base44.entities.ProductCost.update(prior.id, {
        status: 'superseded',
        superseded_at: now,
      });
    }

    // STEP 5 — Create new ProductCost
    const newCost = await base44.entities.ProductCost.create({
      product_id: line.product_id,
      product_color_id: line.product_color_id || null,
      product_color_and_more_id: line.product_color_and_more_id || null,
      routing_step_id: line.routing_step_id,
      supplier_id: line.recipient_supplier_id,
      project_id: rfq.project_id,
      supplier_currency_id: response.supplier_currency_id,
      total_cost_supplier_ccy: response.total_cost_supplier_ccy,
      target_currency_id: rfq.target_currency_id,
      total_cost_target_ccy: response.total_cost_target_ccy,
      conversion_rate_used: response.conversion_rate_used,
      conversion_rate_id: response.conversion_rate_id,
      conversion_rate_date: response.conversion_rate_date,
      valid_from: response.valid_from,
      valid_until: response.valid_until,
      min_qty: response.min_qty,
      max_qty: response.max_qty,
      leadtime_days: response.leadtime_days,
      source_rfq_response_id: response_id,
      source_rfq_id: rfq_id,
      awarded_at: now,
      awarded_by: user.email,
      status: 'active',
      superseded_by_id: null,
    });

    // STEP 6 — Backfill prior superseded record
    if (priorCostId) {
      await base44.entities.ProductCost.update(priorCostId, {
        superseded_by_id: newCost.id,
      });
    }

    return Response.json({
      success: true,
      new_cost_id: newCost.id,
      prior_cost_superseded: !!priorCostId,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});