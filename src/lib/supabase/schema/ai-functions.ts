import type { Json } from "./json"

export type AiCreditFunctions = {
  read_workspace_ai_usage: { Args: { p_org_id: string; p_actor_id: string; p_member_id: string | null; p_task: string | null; p_before_at: string | null; p_before_id: string | null }; Returns: Json }
  find_ai_credit_payment: { Args: { p_payment: string; p_mode: string }; Returns: Json }
  record_ai_credit_payment_restriction: { Args: { p_order_id: string; p_payment: string; p_mode: string; p_kind: string; p_provider_id: string; p_status: string; p_amount: number; p_currency: string; p_operation_key: string; p_event_created: number }; Returns: undefined }
  read_ai_credit_limits: { Args: { p_org_id: string; p_actor_id: string }; Returns: Json }
  set_ai_credit_limit: { Args: { p_org_id: string; p_actor_id: string; p_member_id: string | null; p_limit: number | null; p_revision: string | null; p_operation_id: string }; Returns: Json }
  read_ai_credit_purchases: { Args: { p_org_id: string; p_actor_id: string; p_mode: string }; Returns: Json }
  prepare_ai_credit_purchase: { Args: { p_id: string; p_org_id: string; p_actor_id: string; p_pack: string; p_mode: string; p_return_url: string }; Returns: Json }
  read_ai_credit_purchase_order: { Args: { p_id: string }; Returns: Json }
  bind_ai_credit_checkout: { Args: { p_id: string; p_session: string }; Returns: undefined }
  fulfill_ai_credit_purchase: { Args: { p_id: string; p_session: string; p_payment: string; p_mode: string; p_amount: number; p_currency: string }; Returns: string }
  commit_workspace_ai_document: {
    Args: { p_id:string; p_org_id:string; p_actor_id:string; p_expected_updated_at:string; p_expected_section_revision:string | null; p_profile:Json; p_section:Json; p_content_hash:string; p_reviewed_revision?:string }
    Returns: Json
  }
  can_use_workspace_ai: { Args: { p_org_id: string; p_actor_id: string }; Returns: boolean }
  reserve_workspace_ai_plan_run: {
    Args: { p_id: string; p_org_id: string; p_actor_id: string; p_hash: string; p_target: Json; p_prompt: string; p_tariff: Json; p_max_credits: number; p_max_cost: number }
    Returns: Json
  }
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
