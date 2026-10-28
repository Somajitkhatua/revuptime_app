export function verifiedPassages(rows: any[], documents: any[]) {
  const allowed = new Map(documents.filter((d) => d.metadata?.status === "Ready for AI" && String(d.metadata?.archived) !== "true").map((d) => [d.id, d]));
  return rows.filter((r) => allowed.has(r.document_id) && typeof r.content === "string" && r.content.trim() && Number.isInteger(r.page_number) && r.page_number > 0)
    .slice(0, 6).map((r) => ({ document_id: r.document_id, title: allowed.get(r.document_id).name, page: r.page_number, content: r.content.slice(0, 1200) }));
}
export function hasUnverifiedCitation(content: string, passages: ReturnType<typeof verifiedPassages>) {
  return [...content.matchAll(/\[([^\]\n]+),\s*page\s+(\d+)\]/gi)].some((match) =>
    !passages.some((p) => p.title === match[1].trim() && p.page === Number(match[2])));
}
