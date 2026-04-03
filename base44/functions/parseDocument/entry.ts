import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { document_id } = body;
    if (!document_id) return Response.json({ error: 'document_id required' }, { status: 400 });

    await base44.asServiceRole.entities.UploadedDocument.update(document_id, { status: 'processing' });

    const docs = await base44.asServiceRole.entities.UploadedDocument.filter({ id: document_id });
    if (!docs.length) return Response.json({ error: 'Document not found' }, { status: 404 });
    const doc = docs[0];

    const isPDF = doc.file_url.toLowerCase().endsWith('.pdf');
    const fileType = isPDF ? 'PDF' : 'PowerPoint PPTX';

    const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a data extraction assistant. Analyze this ${fileType} document and extract all product/style information from tables or structured data.

For each table or section:
- Extract the "Style Description" (the style/product name)
- Extract "Style Technical Color Codes" (array of Pantone TCX codes like "19-1664 TCX")

${isPDF ? 'The document is a PDF with tables.' : 'The document is a PowerPoint presentation with slides containing tables.'}

Return ONLY valid JSON:
{
  "fileName": "string",
  "slides": [
    {
      "slideNumber": number,
      "title": "string",
      "table": {
        "columns": ["string"],
        "rows": [
          {
            "Style Description": "string",
            "Style Technical Color Codes": ["string"]
          }
        ]
      }
    }
  ]
}`,
      file_urls: [doc.file_url],
      response_json_schema: {
        type: "object",
        properties: {
          fileName: { type: "string" },
          slides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                slideNumber: { type: "number" },
                title: { type: "string" },
                table: {
                  type: "object",
                  properties: {
                    columns: { type: "array", items: { type: "string" } },
                    rows: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          "Style Description": { type: "string" },
                          "Style Technical Color Codes": { type: "array", items: { type: "string" } }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!extracted || !extracted.slides) {
      await base44.asServiceRole.entities.UploadedDocument.update(document_id, {
        status: 'error',
        error_message: 'LLM extraction returned no data'
      });
      return Response.json({ error: 'LLM extraction returned no data' }, { status: 500 });
    }

    const contentSlides = (extracted.slides || []).filter(s => s.table && s.table.rows && s.table.rows.length > 0);
    const collectionName = contentSlides[0]?.title || extracted.fileName?.replace(/\.(pdf|pptx)$/i, '') || '';

    const staged = {
      fileName: extracted.fileName,
      collection: collectionName,
      slides: contentSlides
    };

    await base44.asServiceRole.entities.UploadedDocument.update(document_id, {
      status: 'staged',
      staged_data: staged,
      collection_name: collectionName
    });

    return Response.json({ success: true, data: staged });
  } catch (error) {
    if (body?.document_id) {
      await base44.asServiceRole.entities.UploadedDocument.update(body.document_id, {
        status: 'error',
        error_message: error.message
      });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});