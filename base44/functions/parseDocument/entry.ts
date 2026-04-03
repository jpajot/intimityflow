import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  let base44;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    console.log('User:', user?.email);

    const body = await req.json();
    const { document_id } = body;
    console.log('Document ID:', document_id);

    await base44.asServiceRole.entities.UploadedDocument.update(document_id, { status: 'processing' });

    const docs = await base44.asServiceRole.entities.UploadedDocument.filter({ id: document_id });
    if (!docs.length) throw new Error('Document not found');
    const doc = docs[0];

    console.log('File URL:', doc.file_url?.slice(0, 50));

    const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extract product data from document. For each table, extract "Style Description" (product name) and "Style Technical Color Codes" (array of Pantone TCX codes like "19-1664 TCX").`,
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
                    rows: { type: "array", items: { type: "object" } }
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log('Extracted slides:', extracted?.slides?.length);

    if (!extracted?.slides?.length) {
      throw new Error('No data extracted');
    }

    const contentSlides = extracted.slides.filter(s => s.table?.rows?.length);
    const collectionName = contentSlides[0]?.title || 'Collection';

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