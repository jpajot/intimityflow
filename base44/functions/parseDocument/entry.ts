import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import JSZip from 'npm:jszip@3.10.1';

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
- "Image Index": if there's an image/photo for this style, note its position (e.g., "0" for first image on slide, "1" for second, etc., or null if no image)`,
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
                    rows: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          "Style Description": { type: "string" },
                          "Style Technical Color Codes": { type: "array", items: { type: "string" } },
                          "Image Index": { type: ["integer", "null"] }
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

    // Extract images from PPTX if applicable
    const imageUrls = [];
    if (doc.file_url?.toLowerCase().endsWith('.pptx')) {
      const pptxData = await fetch(doc.file_url).then(r => r.arrayBuffer());
      const zip = await JSZip.loadAsync(pptxData);
      
      // Extract all images from ppt/media folder
      const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/media/'));
      for (const mediaFile of mediaFiles) {
        const blob = await zip.file(mediaFile).async('blob');
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        imageUrls.push(uploadRes.file_url);
      }
    }

    const contentSlides = extracted.slides.map(slide => ({
      ...slide,
      table: {
        ...slide.table,
        rows: (slide.table?.rows || []).map(row => {
          const imgIdx = row["Image Index"];
          return {
            ...row,
            image_url: imgIdx !== null && imgIdx !== undefined && imageUrls[imgIdx] ? imageUrls[imgIdx] : null
          };
        })
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