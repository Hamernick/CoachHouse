import type { Json } from "./json"
export type ObjectivePlanFunctions = {
  read_workspace_objective_plans: { Args: { p_org_id: string }; Returns: Json }
  save_workspace_objective_plan: { Args: { p_org_id: string; p_draft: Json }; Returns: undefined }
}
