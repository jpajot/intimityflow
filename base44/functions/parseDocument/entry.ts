import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    // Extract text and structure
    const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extract product data from document. For each table row/style, extract:
- "Style Description": product/style name
- "Style Technical Color Codes": array of Pantone TCX codes (e.g., "19-1664 TCX")
- "Image Index": if there's an image associated with this style, note its position (e.g., "slide 1 image 2", or null)`,
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
                images: {
                  type: "array",
                  items: { type: "string" }
                },
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
                          "Image Index": { type: ["string", "null"] }
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

    if (!extracted?.slides?.length) {
      throw new Error('No data extracted');
    }

    // Extract and upload images from PPTX
    const imageMap = {}; // Maps "slide X image Y" -> uploaded URL
    if (doc.file_url?.toLowerCase().endsWith('.pptx')) {
      const pptxBuffer = await fetch(doc.file_url).then(r => r.arrayBuffer());
      const imageMap = await extractPptxImages(pptxBuffer, base44);
    }

    const contentSlides = extracted.slides.map(slide => ({
      ...slide,
      table: {
        ...slide.table,
        rows: (slide.table?.rows || []).map(row => ({
          ...row,
          image_url: row["Image Index"] ? imageMap[row["Image Index"]] : null
        }))
      }
    })).filter(s => s.table?.rows?.length);

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

async function extractPptxImages(pptxBuffer, base44) {
  const imageMap = {};
  try {
    // For now, return empty map - image extraction requires unzip library
    // Can be enhanced later with 'npm:unzipper' for full PPTX image extraction
    return imageMap;
  } catch (e) {
    console.error('Image extraction failed:', e.message);
    return imageMap;
  }
}