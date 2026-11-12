import type { OrganizationWorkspaceObjectivesTable } from "./tables/organization_workspace_objectives"
import type { Json } from "./json"
import type { OrganizationWorkspaceObjectiveGroupsTable } from "./tables/organization_workspace_objective_groups"

export type WorkspaceFunctions = {
  reorder_opportunity_feed: { Args: { p_org_id: string; p_previous: string[]; p_ordered: string[] }; Returns: Json }
  project_folder_access_review: { Args: { p_project_id: string; p_folder_id: string; p_actor_id: string; p_expected_revision?: number; p_members?: Json; p_workspace_changes?: Json }; Returns: Json }
  project_folder_access_control: { Args: { p_project_id: string; p_folder_id: string; p_actor_id: string; p_expected_revision?: number; p_members?: Json }; Returns: Json }
  list_retained_workspace_access: { Args: { p_org_id: string; p_actor_id: string; p_after?: string | null }; Returns: Json }
  workspace_access_control: { Args: { p_org_id: string; p_canvas_id: string; p_actor_id: string; p_expected_revision?: number; p_members?: Json }; Returns: Json }
  read_public_document_audiences: {
    Args: { p_org_ids: string[]; p_section_ids: string[]; p_audience?: string }
    Returns: Json
  }
  read_public_document_audience: { Args: { p_org_id: string; p_section_ids: string[]; p_audience?: string }; Returns: Json }
  read_organization_profile_for_projection: { Args: { p_org_id: string; p_actor_id: string }; Returns: Json }
  read_workspace_ai_document_sources: { Args: { p_org_id: string; p_actor_id: string; p_run_id: string }; Returns: Json }
  filter_workspace_ai_sources: { Args: { p_org_id: string; p_canvas_id: string; p_actor_id: string; p_file_ids: string[]; p_section_ids: string[] }; Returns: Json }
  read_workspace_ai_document_copy_sources: { Args: { p_org_id: string; p_actor_id: string; p_section_ids: string[] }; Returns: Json }
  commit_roadmap_profile: { Args: { p_org: string; p_expected_updated_at: string | null; p_profile: Json; p_support: boolean; p_require_storage: boolean }; Returns: boolean }
  commit_roadmap_publication: { Args: { p_org: string; p_expected_updated_at: string; p_public: boolean; p_support: boolean }; Returns: boolean }
  write_workspace_objective_island: { Args: { p_org_id: string; p_objective_id: string; p_step_id: string | null; p_expected_updated_at: string; p_title: string | null; p_description: string | null; p_status: string }; Returns: boolean }
  write_workspace_objective: { Args: { p_mode: string; p_org_id: string; p_objective_id: string | null; p_expected_updated_at: string | null; p_title: string | null; p_description: string | null; p_priority: string | null; p_due_at: string | null; p_group_id: string | null; p_status: string | null; p_user_ids: string[] | null }; Returns: OrganizationWorkspaceObjectivesTable["Row"] }
  write_workspace_objective_group: { Args: { p_org_id: string; p_group_id: string | null; p_expected_updated_at: string | null; p_title: string | null; p_archived: boolean | null }; Returns: OrganizationWorkspaceObjectiveGroupsTable["Row"] }
  replace_workspace_objective_assignees: { Args: { p_org_id: string; p_objective_id: string; p_expected_updated_at: string; p_user_ids: string[] }; Returns: string[] }
  commit_workspace_board: { Args: { p_org_id: string; p_actor_id: string; p_expected_revision: string | null; p_expected_state: Json; p_state: Json }; Returns: boolean }
  commit_workspace_catalog: { Args: { p_org_id: string; p_actor_id: string; p_expected_state: Json; p_state: Json }; Returns: boolean }
  filter_workspace_page_management_canvases: { Args: { p_org_id: string; p_actor_id: string; p_canvas_ids: string[] }; Returns: string[] }
  read_workspace_canvas_projection: { Args: { p_org_id: string; p_actor_id: string }; Returns: Json }
  read_workspace_particle_board_for_projection: { Args: { p_org_id: string; p_actor_id: string }; Returns: Json }
  read_workspace_particle_ai_files: { Args: { p_org_id: string; p_actor_id: string; p_record_ids: string[] }; Returns: Json }
  read_workspace_particle_ai_documents: { Args: { p_org_id: string; p_actor_id: string; p_record_ids: string[] }; Returns: Json }
  filter_document_activity_audience: { Args: { p_event_ids: string[]; p_actor_id: string }; Returns: string[] }
  filter_document_file_audience: { Args: { p_file_ids: string[]; p_actor_id: string }; Returns: string[] }
  read_project_asset_folders_for_actor: { Args: { p_project_id: string; p_actor_id: string }; Returns: Json }
  set_workspace_source_audience: { Args: { p_org_id: string; p_canvas_id: string; p_actor_id: string; p_expected_revision: number; p_members: Json }; Returns: number }
  set_project_folder_workspace_grants: { Args: { p_project_id: string; p_folder_id: string; p_actor_id: string; p_expected_revision: number; p_grants: Json }; Returns: number }
  read_project_asset_folders: { Args: { p_project_id: string }; Returns: Json }
  mutate_project_asset_folder: { Args: { p_project_id: string; p_org_id: string; p_actor_id: string; p_expected_updated_at: string; p_change: Json; p_new_id: string }; Returns: Json }
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
