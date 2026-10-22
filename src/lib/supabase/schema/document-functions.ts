import type { Json } from "./json"

export type DocumentFunctions = {
  can_edit_uploaded_document: { Args: { p_file_id: string }; Returns: boolean }
  commit_uploaded_document_version: {
    Args: { p_file_id: string; p_actor_id: string; p_request_id: string; p_generation: string;
      p_expected_revision: string; p_expected_updated_at: string; p_sequence: number;
      p_previous_hash: string; p_new_hash: string; p_new_size: number;
      p_restore_version_id?: string; p_restore_checkpoint_base64?: string }
    Returns: Json
  }
  reserve_uploaded_document_version: {
    Args: { p_file_id: string; p_actor_id: string; p_request_id: string; p_generation: string;
      p_expected_revision: string; p_expected_updated_at: string; p_sequence: number;
      p_previous_hash: string; p_new_hash: string; p_new_size: number; p_restore_version_id?: string }
    Returns: boolean
  }
  abandon_uploaded_document_version: { Args: { p_file_id: string; p_actor_id: string; p_request_id: string }; Returns: boolean }
  finish_abandoned_document_version: { Args: { p_file_id: string; p_actor_id: string; p_request_id: string }; Returns: boolean }
  can_edit_document_room: { Args: { p_room_id: string }; Returns: boolean }
  initialize_document_room: { Args: { p_file_id: string; p_actor_id: string; p_base_revision: string; p_expected_updated_at: string; p_checkpoint_base64: string }; Returns: Json }
  append_document_room_update: { Args: { p_room_id: string; p_generation: string; p_batch_id: string; p_update_base64: string }; Returns: Json }
  compact_document_room: { Args: { p_room_id: string; p_generation: string; p_expected_sequence: number; p_checkpoint_base64: string }; Returns: boolean }
}
