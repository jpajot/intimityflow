import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Fallback hardcoded scheme (used only if no active scheme found for the document type)
const FALLBACK_PROMPT = `Extract product data from document. For each table row/style, extract:
- "Style Description": product/style name
- "Style Technical Color Codes": array of Pantone TCX codes (e.g., "19-1664 TCX")
- "image_url": if there's an associated image/photo for this style, include its URL or reference; otherwise null`;

const FALLBACK_SCHEMA = {
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
              rows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    "Style Description": { type: "string" },
                    "Style Technical Color Codes": { type: "array", items: { type: "string" } },
                    "image_url": { type: ["string", "null"] }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

Deno.serve(async (req) => {
  let base44;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const body = await req.json();
    const { document_id } = body;

    await base44.asServiceRole.entities.UploadedDocument.update(document_id, { status: 'processing' });

    const docs = await base44.asServiceRole.entities.UploadedDocument.filter({ id: document_id });
    if (!docs.length) throw new Error('Document not found');
    const doc = docs[0];

    // Look up active parsing scheme for this document type
    let extractionPrompt = FALLBACK_PROMPT;
    let jsonSchema = FALLBACK_SCHEMA;

    if (doc.document_type) {
      const schemes = await base44.asServiceRole.entities.DocumentParsingScheme.filter({
        document_type: doc.document_type,
        is_active: true,
      });
      if (schemes.length > 0) {
        const scheme = schemes[0];
        extractionPrompt = scheme.extraction_prompt || FALLBACK_PROMPT;
        jsonSchema = scheme.json_schema || FALLBACK_SCHEMA;
        console.log(`Using parsing scheme: ${scheme.name}`);
      } else {
        console.log(`No active scheme found for document type "${doc.document_type}", using fallback.`);
      }
    }

    // Extract text and structure using the scheme
    const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: extractionPrompt,
      file_urls: [doc.file_url],
      response_json_schema: jsonSchema,
    });

    if (!extracted?.slides?.length) {
      throw new Error('No data extracted');
    }

    const contentSlides = extracted.slides.filter(s => s.table?.rows?.length);
    const collectionName = contentSlides[0]?.title || 'Collection';

    // Resolve SharePoint image URLs → re-upload to Base44 public storage
    let spAccessToken = null;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('share_point');
      spAccessToken = conn?.accessToken || null;
    } catch (_) {
      // SharePoint not connected, skip image resolution
    }

    if (spAccessToken) {
      for (const slide of contentSlides) {
        for (const row of (slide.table?.rows || [])) {
          const url = row.image_url;
          if (!url || !url.includes('sharepoint.com')) continue;
          try {
            // Fetch the image from SharePoint using the access token
            const imgRes = await fetch(url, {
              headers: { Authorization: `Bearer ${spAccessToken}` }
            });
            if (!imgRes.ok) continue;
            const blob = await imgRes.blob();
            const ext = url.split('.').pop().split('?')[0] || 'png';
            const file = new File([blob], `sketch.${ext}`, { type: blob.type || 'image/png' });
            const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file });
            if (uploaded?.file_url) {
              row.image_url = uploaded.file_url;
            }
          } catch (_) {
            // If image resolution fails, keep original URL (will be broken but non-blocking)
          }
        }
      }
    }

    await base44.asServiceRole.entities.UploadedDocument.update(document_id, {
      status: 'staged',
      staged_data: { fileName: extracted.fileName, slides: contentSlides },
      collection_name: collectionName
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});