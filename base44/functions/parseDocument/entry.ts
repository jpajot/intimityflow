import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Schema matching the actual PPTX extraction output structure
const EXTRACTION_SCHEMA = {
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
                    "Style Technical Color Codes": {
                      type: "array",
                      items: { type: "string" }
                    }
                  }
                }
              }
            }
          },
          images: { type: "array", items: { type: "string" } }
        }
      }
    }
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { document_id } = await req.json();
    if (!document_id) return Response.json({ error: 'document_id required' }, { status: 400 });

    await base44.asServiceRole.entities.UploadedDocument.update(document_id, { status: 'processing' });

    const docs = await base44.asServiceRole.entities.UploadedDocument.filter({ id: document_id });
    if (!docs.length) return Response.json({ error: 'Document not found' }, { status: 404 });
    const doc = docs[0];

    const result = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: doc.file_url,
      json_schema: EXTRACTION_SCHEMA
    });

    if (result.status !== 'success' || !result.output) {
      await base44.asServiceRole.entities.UploadedDocument.update(document_id, {
        status: 'error',
        error_message: result.details || 'Extraction failed'
      });
      return Response.json({ error: result.details || 'Extraction failed' }, { status: 500 });
    }

    const extracted = result.output;

    // Filter to only slides with a table (skip Front Page, Spec, etc.)
    const contentSlides = (extracted.slides || []).filter(s => s.table && s.table.rows && s.table.rows.length > 0);

    // Collection name = title of first content slide
    const collectionName = contentSlides[0]?.title || extracted.fileName?.replace('.pptx', '') || '';

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
    return Response.json({ error: error.message }, { status: 500 });
  }
});