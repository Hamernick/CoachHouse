export function researchDataViewInstructions(base: string, enabled: boolean) {
  if (!enabled) return base
  return base.replace("Produce plan proposals and editable note content only; a note describing a form or table is not a working form or data view.",
    "Produce plan proposals, editable note content and saved views of existing projects. Forms are unavailable.")
    .replace("Data view creation is unavailable; a note describing a table is not a working data view.", "Saved views of existing projects are available.") +
    " A data_view item must use dataView:{kind:'projects'} and a title of at most 100 characters. Other items use dataView:null. This creates a view of the existing authorized project source with Project, Status, Starts and Ends columns, sorted by Project. It does not copy or create projects, rows, tables, responses or Google files. Custom initial filters, columns, sort, other sources and new tables are unavailable in this generation binding; report those unmet requests explicitly. The user can adjust saved-view settings through the existing manual editor afterward. Do not invent rows or counts; they load only from the authorized source after save. Source creation and plan application are separate effects; never claim that either occurred during generation."
}
