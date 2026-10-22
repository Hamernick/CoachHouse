import type { Json } from "./json"
export type ObjectivePlanFunctions = {
  read_workspace_ai_plan_application: { Args: { p_org_id: string; p_id: string }; Returns: Json }
  apply_workspace_ai_plan: { Args: { p_org_id: string; p_id: string }; Returns: Json }
  undo_workspace_ai_plan: { Args: { p_org_id: string; p_id: string }; Returns: Json }
  read_workspace_objective_plans_v2: { Args: { p_org_id: string }; Returns: Json }
  save_workspace_objective_plan_v2: { Args: { p_org_id: string; p_draft: Json }; Returns: undefined }
  read_workspace_objective_plans: { Args: { p_org_id: string }; Returns: Json }
  save_workspace_objective_plan: { Args: { p_org_id: string; p_draft: Json }; Returns: undefined }
}
