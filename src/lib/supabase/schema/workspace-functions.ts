import type { Json } from "./json"

export type WorkspaceFunctions = {
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
    }
    Returns: Json
  }
  read_workspace_page_public: {
    Args: { p_organization_slug: string; p_link_id: string }
    Returns: Json
  }
}
