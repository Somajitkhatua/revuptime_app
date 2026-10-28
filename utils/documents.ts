export function documentTypeLabel(value: unknown): string {
  const type = String(value || "document")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  const labels: Record<string, string> = {
    manual: "Manual",
    "user manual": "User Manual",
    "service manual": "Service Manual",
    datasheet: "Datasheet",
    procedure: "SOP",
    sop: "SOP",
    drawing: "Drawing",
    report: "Report",
    certificate: "Certificate",
  };
  return (
    labels[type] || type.replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function documentMatchesCategory(
  type: unknown,
  category: string,
): boolean {
  const label = documentTypeLabel(type);
  return (
    category === "All" ||
    (category === "Manuals" && /manual/i.test(label)) ||
    (category === "Datasheets" && label === "Datasheet") ||
    (category === "SOP" && label === "SOP")
  );
}

/** Same inclusive shared-document rules as workspace retrieval, within one org. */
export function documentInScope(
  document: {
    organization_id: string;
    asset_id?: string | null;
    site_id?: string | null;
    metadata?: Record<string, any>;
  },
  organization: string,
  asset = "",
  site = "",
): boolean {
  return (
    document.organization_id === organization &&
    !document.metadata?.archived &&
    (!asset || !document.asset_id || document.asset_id === asset) &&
    (!site || !document.site_id || document.site_id === site)
  );
}
