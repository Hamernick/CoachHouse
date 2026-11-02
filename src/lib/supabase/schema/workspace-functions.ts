import type { Json } from "./json"

export type WorkspaceFunctions = {
  list_accessible_organization_forms: { Args: { p_actor_id: string; p_version_id: string; p_after?: string | null }; Returns: Json }
  list_organization_form_response_versions: { Args: { p_actor_id: string; p_version_id: string; p_before?: string | null }; Returns: Json }
  list_organization_form_versions: { Args: { p_actor_id: string; p_page_id: string; p_before?: string | null }; Returns: Json }
  organization_form_source_command: { Args: { p_actor_id: string; p_command: Json }; Returns: Json }
  organization_form_viewer_access: { Args: { p_actor_id: string; p_command: Json }; Returns: Json }
  organization_form_review_access: { Args: { p_actor_id: string; p_command: Json }; Returns: Json }
  organization_form_recovery: { Args: { p_actor_id: string; p_command: Json }; Returns: Json }
  organization_form_intake: { Args: { p_actor_id: string | null; p_command: Json }; Returns: Json }
  read_workspace_page_document: { Args: { p_asset_id: string; p_audience: string; p_actor_id?: string | null }; Returns: Json }
  read_workspace_page_image: { Args: { p_asset_id: string; p_audience: string; p_actor_id?: string | null }; Returns: Json }
  workspace_page_image_orphans: { Args: Record<never, never>; Returns: Json }
  workspace_page_guest_command: { Args: { p_actor_id: string; p_page_id: string; p_command: Json; p_hash: string }; Returns: Json }
  manage_resource_opportunity_matches: { Args: { p_action:string; p_org_id:string; p_actor_id:string; p_resource_id:string; p_revision:number; p_canvas_id:string|null; p_payload:Json }; Returns:Json }
  save_organization_profile_with_brand_kit: {
    Args: { p_org_id: string; p_expected_updated_at: string; p_expected_brand_revision: string | null; p_identity: Json; p_profile_patch: Json }
    Returns: boolean
  }
  workspace_canvas_storage_version: { Args: Record<never, never>; Returns: number }
  commit_workspace_page: {
    Args: {
      p_actor_id: string; p_org_id: string; p_page_id: string; p_operation_id: string;
      p_operation_hash: string; p_expected_revision: number; p_intent: string;
      p_draft: Json | null; p_snapshot: Json | null; p_expected_graph: Json | null;
      p_expected_org_updated_at: string | null
      p_expected_drive_sources?: Json; p_expected_profile?: Json | null
      p_canvas_id?: string | null
      p_image_assets?: Json
      p_document_assets?: Json
      p_form_versions?: Json
    }
    Returns: Json
  }
  read_workspace_page_public: {
    Args: { p_organization_slug: string; p_link_id: string }
    Returns: Json
  }
}
