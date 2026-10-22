import type { Json } from "./json"

export type AiCreditFunctions = {
  commit_workspace_ai_document: {
    Args: { p_id:string; p_org_id:string; p_actor_id:string; p_expected_updated_at:string; p_expected_section_revision:string | null; p_profile:Json; p_section:Json; p_content_hash:string; p_reviewed_revision?:string }
    Returns: Json
  }
  can_use_workspace_ai: { Args: { p_org_id: string; p_actor_id: string }; Returns: boolean }
  reserve_workspace_ai_run: {
    Args: { p_id: string; p_org_id: string; p_actor_id: string; p_hash: string; p_target: Json; p_prompt: string; p_tariff: Json; p_max_credits: number; p_max_cost: number }
    Returns: Json
  }
  claim_workspace_ai_run: { Args: { p_id: string; p_actor_id: string }; Returns: boolean }
  settle_workspace_ai_run: {
    Args: { p_id: string; p_status: string; p_cost: number; p_credits: number; p_proposal: string | null; p_usage: Json; p_response_id: string | null }
    Returns: Json
  }
  correlate_workspace_ai_response: { Args: { p_id: string; p_response_id: string }; Returns: undefined }
  record_workspace_ai_result: AiCreditFunctions["settle_workspace_ai_run"] extends { Args: infer Args } ? { Args: Args; Returns: undefined } : never
  settle_recorded_workspace_ai_run: { Args: { p_id: string }; Returns: Json }
  recover_workspace_ai_runs: { Args: { p_org_id?: string }; Returns: number }
  read_workspace_ai_account: { Args: { p_org_id: string; p_actor_id: string }; Returns: Json }
  read_workspace_ai_run: { Args: { p_id: string; p_org_id: string; p_actor_id: string }; Returns: Json }
  reconcile_workspace_ai_run: { Args: { p_id: string; p_response_id: string | null }; Returns: undefined }
  cancel_workspace_ai_run: { Args: { p_id: string; p_org_id: string; p_actor_id: string }; Returns: boolean }
}
