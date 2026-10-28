import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { extractText, getDocumentProxy } from "npm:unpdf@1.4.0";
import { createDocumentHandler } from "../_shared/documentProcessing.ts";
Deno.serve(createDocumentHandler({
  createClient,
  env: (key) => Deno.env.get(key),
  waitUntil: (task) => EdgeRuntime.waitUntil(task),
  extractPages: async (file, mime) => {
    if (mime === "application/pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      try {
        const result = await extractText(pdf, { mergePages: false });
        const pages = result.text as string[];
        if (pages.some((p) => p.trim())) return pages;
      } finally { await pdf.destroy(); }
    }
    const url = Deno.env.get("OCR_URL"), key = Deno.env.get("OCR_API_KEY");
    if (!url || !key) throw new Error("This file needs text recognition. Upload a searchable PDF or ask your administrator to enable OCR.");
    if (mime !== "application/pdf" && !mime.startsWith("image/")) throw new Error("Upload a PDF or image to process this document.");
    const form = new FormData();
    form.append("file", file, mime === "application/pdf" ? "document.pdf" : "image");
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error("Text recognition is temporarily unavailable. Please retry.");
    const result = await response.json();
    return result.pages?.map((p: { text: string }) => p.text) || [result.text];
  },
}));
