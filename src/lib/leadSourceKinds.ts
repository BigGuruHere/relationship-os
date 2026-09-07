// PURPOSE: Keep operational import batches separate from ordinary lead-source taxonomy in the Leads UI.

export type LeadSourceSummary = {
  id: string;
  name: string;
  kind?: string | null;
};

export function splitLeadSourcesForFilters(items: LeadSourceSummary[]) {
  const sources: LeadSourceSummary[] = [];
  const importBatches: LeadSourceSummary[] = [];

  for (const item of items) {
    if (item.kind === 'IMPORT_BATCH') importBatches.push(item);
    else sources.push(item);
  }

  return { sources, importBatches };
}

export function isKnownImportBatch(batchId: unknown, importBatches: LeadSourceSummary[]) {
  const id = String(batchId || '').trim();
  return Boolean(id && importBatches.some((batch) => batch.id === id));
}
