import type { Json } from "./json"
export type AiRefillFunctions = {
  prepare_ai_credit_refill_setup: { Args: { p_input: Json }; Returns: Json }
  read_ai_credit_refill_setup: { Args: { p_id: string }; Returns: Json }
  bind_ai_credit_refill_setup: { Args: { p_id: string; p_session: string }; Returns: undefined }
  verify_ai_credit_refill_setup: { Args: { p_input: Json }; Returns: boolean }
  disable_ai_credit_refill: { Args: { p_input: Json }; Returns: undefined }
  read_ai_credit_refill: { Args: { p_input: Json }; Returns: Json }
  read_ai_credit_refill_attempt: { Args: { p_id: string }; Returns: Json }
  prepare_next_ai_credit_refill: { Args: { p_mode: string; p_target: string }; Returns: Json }
  start_ai_credit_refill_charge: { Args: { p_id: string; p_actor_id?: string }; Returns: boolean }
  record_ai_credit_refill_attempt: { Args: { p_input: Json }; Returns: undefined }
  list_ai_credit_refill_attempts: { Args: { p_mode: string; p_target: string }; Returns: Json }
}
