import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { document_id, is_sharepoint } = body;
    if (!document_id) return Response.json({ error: 'document_id required' }, { status: 400 });

    await base44.asServiceRole.entities.UploadedDocument.update(document_id, { status: 'processing' });

    const docs = await base44.asServiceRole.entities.UploadedDocument.filter({ id: document_id });
    if (!docs.length) return Response.json({ error: 'Document not found' }, { status: 404 });
    const doc = docs[0];

    // Resolve the file URL: download from SharePoint if needed, otherwise use stored file_url
    let fileUrl = doc.file_url;
    if (is_sharepoint && doc.file_url) {
      // Download from SharePoint by extracting the file ID from the web URL and using Graph API
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection("share_point");
        
        // Parse SharePoint web URL to extract drive and item IDs
        // Format: /sites/{site}/Shared Documents/{file} or similar
        const urlMatch = doc.file_url.match(/\/sites\/([^\/]+)/);
        if (urlMatch) {
          // Get the file details from Graph API
          const graphRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq '${encodeURIComponent(doc.original_filename)}'`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          const graphData = await graphRes.json();
          
          if (graphData.value && graphData.value.length > 0) {
            const fileId = graphData.value[0].id;
            // Download the file content
            const downloadRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (downloadRes.ok) {
              const blob = await downloadRes.blob();
              const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
              fileUrl = uploadResult.file_url;
              await base44.asServiceRole.entities.UploadedDocument.update(document_id, { file_url: fileUrl });
            }
          }
        }
      } catch (spErr) {
        console.warn('SharePoint download failed, using stored URL:', spErr.message);
      }
    }

    const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a data extraction assistant. Analyze this PowerPoint presentation file and extract all product/style information from slides that contain a data table.

For each slide that has a table with product data:
- Extract the slide number and title
- Extract all table rows, mapping them to: "Style Description" (the style/product name) and "Style Technical Color Codes" (array of Pantone TCX codes like "19-1664 TCX")
- Skip slides that are cover pages, mood boards, or don't contain product tables

Return the result as JSON matching this schema exactly:
{
  "fileName": "string",
  "slides": [
    {
      "slideNumber": 1,
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
      file_urls: [fileUrl],
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