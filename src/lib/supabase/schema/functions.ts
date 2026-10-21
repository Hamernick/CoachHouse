import type { Json } from "./json"
import type { ResourceMapPublicItemsView } from "./views"

export type PublicFunctions = {
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
  record_fiscal_email_delivery: { Args: { p_event_id: string; p_message_id: string; p_event_type: string; p_occurred_at: string }; Returns: undefined }
  get_fiscal_guest_email_status: { Args: { p_project_id: string; p_user_id: string }; Returns: Json }
  purge_fiscal_email_delivery_events: { Args: Record<string, never>; Returns: number }
  request_fiscal_guest_recovery: { Args: { p_reference: string; p_email: string; p_request_id: string }; Returns: Json }
  read_fiscal_guest_application: { Args: { p_reference: string; p_key_hash: string }; Returns: Json }
  resubmit_fiscal_guest_application: { Args: { p_reference: string; p_key_hash: string; p_request_id: string; p_version: string; p_application: Json }; Returns: Json }
  preview_fiscal_guest_profile: { Args: { p_reference: string; p_key_hash: string; p_user_id: string }; Returns: Json }
  save_fiscal_guest_profile: { Args: { p_reference: string; p_key_hash: string; p_user_id: string; p_request_id: string; p_version: string; p_fields: Json }; Returns: Json }
  prepare_fiscal_guest_email_proof: { Args: { p_job_id: string; p_lease_token: string; p_nonce: string; p_token_hash: string; p_expires_at: string }; Returns: Json }
  verify_fiscal_guest_email: { Args: { p_token_hash: string; p_key_hash: string; p_expires_at: string }; Returns: Json }
  purge_expired_fiscal_guest_proofs: { Args: Record<string, never>; Returns: number }
  read_fiscal_guest_draft: { Args: { p_key_hash: string; p_expires_at: string }; Returns: Json }
  save_fiscal_guest_draft: { Args: { p_key_hash: string; p_expires_at: string; p_version: number; p_request_id: string; p_draft: Json }; Returns: Json }
  purge_expired_fiscal_guest_drafts: { Args: Record<string, never>; Returns: number }
  submit_guest_fiscal_application: { Args: { p_submission_key_hash: string; p_application: Json }; Returns: Json }
  consume_fiscal_guest_limit: { Args: { p_key_hash: string; p_limit: number; p_window_seconds: number }; Returns: boolean }
  get_fiscal_guest_receipt: { Args: { p_key_hash: string }; Returns: Json }
  claim_fiscal_guest_emails: { Args: Record<string, never>; Returns: Json }
  finish_fiscal_guest_email: { Args: { p_id: string; p_lease_token: string; p_message_id: string | null; p_success: boolean }; Returns: boolean }

  get_fiscal_guest_notification_recipients: {
    Args: { p_project_id: string }
    Returns: Json
  }
  list_fiscal_guest_projects: { Args: { p_user_id: string }; Returns: Json }
  get_fiscal_guest_project_summary: { Args: { p_project_id: string; p_user_id: string }; Returns: Json }
  fiscal_guest_project_reviewer_access: {
    Args: { p_project_id: string; p_user_id: string }
    Returns: boolean | null
  }
  claim_fiscal_staff_emails: { Args: Record<string, never>; Returns: Json }
  finish_fiscal_staff_email: {
    Args: { p_event_id: string; p_lease_token: string; p_message_id: string | null; p_success: boolean }
    Returns: boolean
  }
  start_public_fiscal_intake: {
    Args: { p_organization_name: string }
    Returns: string
  }
  search_nonprofit_directory_v2: {
    Args: { p_query?: string; p_state?: string | null; p_category?: string | null; p_after?: string | null; p_limit?: number }
    Returns: Json
  }
  search_nonprofit_directory: {
    Args: { p_query?: string; p_state?: string | null; p_after?: string | null; p_limit?: number }
    Returns: Json
  }
  get_nonprofit_directory: { Args: { p_ein: string }; Returns: Json }
  coaching_credit_account: { Args: { p_user_id: string }; Returns: Json }
  issue_coaching_credits: { Args: { p_user_id: string; p_org_id: string | null; p_quantity: number; p_source_type: string; p_label: string; p_reason: string; p_expires_at: string | null; p_actor_id: string | null; p_request_key: string }; Returns: string }
  confirm_coaching_credit_booking: { Args: { p_booking_id: string; p_checkout_id: string | null; p_payment_id: string | null; p_customer_id: string | null }; Returns: undefined }
  restore_coaching_credit: { Args: { p_booking_id: string; p_actor_id: string | null; p_reason: string }; Returns: boolean }
  manage_coaching_credit_booking: { Args: { p_booking_id: string; p_actor_id: string | null; p_action: string; p_staff: boolean; p_reason: string | null; p_starts_at?: string; p_timezone?: string; p_request_id?: string; p_expected_starts_at?: string }; Returns: Json }

  create_guided_organization_project: {
    Args: { p_actor_id: string; p_org_id: string; p_request_id: string; p_setup: Json; p_member_labels: string[]; p_overview_html: string; p_overview_text: string }
    Returns: Json
  }

  public_handle_availability: {
    Args: { p_handle: string }
    Returns: Json
  }
  claim_person_public_handle: {
    Args: { p_handle: string }
    Returns: Json
  }
  save_public_person_profile: {
    Args: {
      p_display_name: string
      p_headline: string | null
      p_bio: string | null
      p_location_label: string | null
      p_website_url: string | null
      p_avatar_url: string | null
      p_is_public: boolean
      p_show_organizations: boolean
      p_show_program_activity: boolean
      p_show_saved_locations: boolean
    }
    Returns: Json
  }
  set_person_public_affiliation: {
    Args: {
      p_organization_id: string
      p_visible: boolean
    }
    Returns: Json
  }
  save_person_public_saved_collection: {
    Args: {
      p_collection_id: string | null
      p_name: string
      p_is_public: boolean
      p_item_kinds: string[]
      p_item_ids: string[]
    }
    Returns: Json
  }
  delete_person_public_saved_collection: {
    Args: { p_collection_id: string }
    Returns: Json
  }
  submit_public_map_claim_request: {
    Args: {
      p_target_kind: string
      p_target_id: string | null
      p_listing_name: string
      p_claimant_name: string
      p_claimant_email: string
      p_message: string | null
      p_submission_key: string
      p_risk_key: string
      p_email_target_key: string
    }
    Returns: Json
  }
  deliver_public_map_claim_request: {
    Args: {
      p_claim_id: string
      p_owner_id: string
      p_project_id?: string | null
    }
    Returns: Json
  }
  record_page_health_event: {
    Args: {
      p_event: Json
      p_user_id?: string | null
      p_org_id?: string | null
    }
    Returns: Json
  }
  record_public_roadmap_event: {
    Args: {
      p_org_id: string
      p_section_id: string | null
      p_event_type: "view" | "cta_click"
      p_duration_ms: number | null
      p_source: string | null
      p_referrer: string | null
    }
    Returns: Json
  }
  set_organization_coach_assignments: {
    Args: {
      p_organization_id: string
      p_coach_user_ids: string[]
    }
    Returns: Json
  }
  assign_all_coaches_to_all_organizations: {
    Args: Record<PropertyKey, never>
    Returns: Json
  }
  set_organization_coach_scope_enabled: {
    Args: {
      p_enabled: boolean
    }
    Returns: Json
  }
  complete_organization_finance_stripe_install: {
    Args: {
      p_state_sha256: string
      p_user_id: string
      p_org_id: string
      p_stripe_account_id: string
      p_stripe_user_id: string
      p_livemode: boolean
    }
    Returns: Json
  }
  import_organization_finance_stripe_records: {
    Args: {
      p_actor_id: string
      p_org_id: string
      p_stripe_account_id: string
      p_records: Json
    }
    Returns: Json
  }
  correct_organization_finance_record: {
    Args: {
      p_actor_id: string
      p_org_id: string
      p_original_record_id: string
      p_replacement_record_id: string
      p_program_id: string | null
      p_effective_at: string
      p_record_type: string
      p_direction: string
      p_source_kind: string | null
      p_source_label: string
      p_amount_cents: number
      p_currency_code: string
      p_reason: string
      p_external_reference: string
      p_storage_path: string
      p_file_name: string
      p_mime_type: string
      p_size_bytes: number
      p_file_sha256: string
    }
    Returns: Json
  }
  reconcile_organization_finance_record: {
    Args: {
      p_actor_id: string
      p_org_id: string
      p_record_id: string
      p_external_reference: string
      p_storage_path: string
      p_file_name: string
      p_mime_type: string
      p_size_bytes: number
      p_file_sha256: string
    }
    Returns: Json
  }
  complete_fiscal_sponsorship_w9_transition: {
    Args: {
      p_actor_id: string
      p_application_id: string
      p_document: Json
      p_expected_updated_at: string
    }
    Returns: Json
  }
  delete_organization_project_transition: {
    Args: {
      p_actor_id: string
      p_expected_org_id: string
      p_expected_updated_at: string
      p_project_id: string
    }
    Returns: Json
  }
  update_organization_project_schedule_transition: {
    Args: {
      p_actor_id: string
      p_end_date: string | null
      p_expected_org_id: string
      p_expected_updated_at: string
      p_project_id: string
      p_start_date: string | null
    }
    Returns: Json
  }
  update_organization_project_status_transition: {
    Args: {
      p_actor_id: string
      p_expected_org_id: string
      p_expected_updated_at: string
      p_project_id: string
      p_status: string
    }
    Returns: Json
  }
  load_shared_project_options: { Args: Record<string, never>; Returns: Json }
  manage_shared_project_option: {
    Args: { p_actor_id: string; p_action: string; p_kind: string; p_option: Json; p_expected_updated_at: string | null }
    Returns: Json
  }
  update_organization_project_with_options: {
    Args: {
      p_actor_id: string
      p_expected_org_id: string
      p_expected_updated_at: string
      p_has_overview_document: boolean
      p_overview_document_html: string | null
      p_overview_document_text: string | null
      p_project: Json
      p_project_id: string
    }
    Returns: Json
  }
  create_organization_project_with_options: {
    Args: {
      p_actor_id: string
      p_has_overview_document: boolean
      p_org_id: string
      p_overview_document_html: string | null
      p_overview_document_text: string | null
      p_project: Json
    }
    Returns: Json
  }
  update_organization_project_transition: {
    Args: {
      p_actor_id: string
      p_expected_org_id: string
      p_expected_updated_at: string
      p_has_overview_document: boolean
      p_overview_document_html: string | null
      p_overview_document_text: string | null
      p_project: Json
      p_project_id: string
    }
    Returns: Json
  }
  create_organization_project_transition: {
    Args: {
      p_actor_id: string
      p_has_overview_document: boolean
      p_org_id: string
      p_overview_document_html: string | null
      p_overview_document_text: string | null
      p_project: Json
    }
    Returns: Json
  }
  send_fiscal_sponsorship_form_b_transition: {
    Args: {
      p_actor_id: string
      p_applicant_signer_email: string
      p_applicant_signer_id: string
      p_applicant_signer_name: string
      p_application_id: string
      p_document_id: string
      p_expected_application_updated_at: string
      p_expected_document_updated_at: string
      p_fields: Json
      p_template_key: string
      p_template_sha256: string
      p_template_version: number
    }
    Returns: Json
  }
  generate_fiscal_sponsorship_form_b_transition: {
    Args: {
      p_actor_id: string
      p_application_id: string
      p_document: Json
      p_expected_updated_at: string
    }
    Returns: Json
  }
  delete_organization_task_transition: {
    Args: {
      p_actor_id: string
      p_expected_org_id: string
      p_expected_project_id: string
      p_task_id: string
    }
    Returns: Json
  }
  reorder_organization_tasks_transition: {
    Args: {
      p_actor_id: string
      p_expected_org_id: string
      p_ordered_task_ids: string[]
      p_project_id: string
    }
    Returns: Json
  }
  create_organization_task_transition: {
    Args: {
      p_actor_id: string
      p_assignee_id: string | null
      p_description: string | null
      p_end_date: string | null
      p_priority: string
      p_project_id: string
      p_start_date: string | null
      p_status: string
      p_tag_label: string | null
      p_task_type: string
      p_title: string
      p_workstream_name: string | null
    }
    Returns: Json
  }
  update_organization_task_transition: {
    Args: {
      p_actor_id: string
      p_assignee_id: string | null
      p_description: string | null
      p_end_date: string | null
      p_expected_org_id: string
      p_expected_project_id: string
      p_priority: string
      p_project_id: string
      p_start_date: string | null
      p_status: string
      p_tag_label: string | null
      p_task_id: string
      p_task_type: string
      p_title: string
      p_workstream_name: string | null
    }
    Returns: Json
  }
  save_fiscal_sponsorship_application_draft_transition: {
    Args: {
      p_actor_id: string
      p_allow_locked?: boolean
      p_budget_rows: Json
      p_budget_total_cents: number
      p_expected_updated_at: string | null
      p_has_budget_rows: boolean
      p_payload: Json
      p_project_id: string
      p_source_activity_id: string | null
    }
    Returns: Json
  }
  connect_fiscal_sponsorship_document_transition: {
    Args: {
      p_actor_id: string
      p_application_id: string
      p_asset_id: string
      p_document_key: string
      p_requirement_label: string
      p_title: string
    }
    Returns: Json
  }
  review_fiscal_sponsorship_document_transition: {
    Args: {
      p_actor_id: string
      p_application_id: string
      p_decision: string
      p_document_id: string
      p_expected_updated_at: string
      p_notes: string | null
    }
    Returns: Json
  }
  review_fiscal_sponsorship_application_transition: {
    Args: {
      p_actor_id: string
      p_application_id: string
      p_decision: string
      p_expected_updated_at: string
      p_notes: string | null
    }
    Returns: Json
  }
  submit_fiscal_sponsorship_application_transition: {
    Args: {
      p_actor_id: string
      p_application_id: string
      p_expected_updated_at: string
    }
    Returns: Json
  }
  finalize_fiscal_sponsorship_applicant_signature: {
    Args: {
      p_packet_id: string
      p_payload: Json
    }
    Returns: Json
  }
  finalize_fiscal_sponsorship_coach_signature: {
    Args: {
      p_packet_id: string
      p_payload: Json
    }
    Returns: Json
  }
  can_view_organization_finance: {
    Args: {
      target_org_id: string
    }
    Returns: boolean
  }
  is_admin: {
    Args: Record<string, never>
    Returns: boolean
  }
  is_platform_staff: {
    Args: Record<string, never>
    Returns: boolean
  }
  current_platform_access_level: {
    Args: Record<string, never>
    Returns: string | null
  }
  handle_updated_at: {
    Args: Record<string, never>
    Returns: unknown
  }
  apply_submission_to_organization: {
    Args: {
      p_user_id: string
      p_answers: Json
    }
    Returns: void
  }
  next_unlocked_module: {
    Args: {
      p_user_id: string
    }
    Returns: string | null
  }
  progress_for_class: {
    Args: {
      p_user_id: string
      p_class_id: string
    }
    Returns: {
      total: number | null
      completed: number | null
    }[]
  }
  search_global: {
    Args: {
      p_query: string
      p_user_id: string
      p_is_admin: boolean
      p_limit?: number | null
    }
    Returns: {
      id: string
      label: string
      subtitle: string | null
      href: string
      group_name: string
      rank: number | null
    }[]
  }
  get_resource_map_public_items: {
    Args: {
      p_query?: string | null
      p_category_keys?: string[] | null
      p_limit?: number | null
      p_latitude?: number | null
      p_longitude?: number | null
      p_radius_miles?: number | null
    }
    Returns: ResourceMapPublicItemsView["Row"][]
  }
  get_resource_map_public_items_page: {
    Args: {
      p_query?: string | null
      p_category_keys?: string[] | null
      p_limit?: number | null
      p_offset?: number | null
      p_latitude?: number | null
      p_longitude?: number | null
      p_radius_miles?: number | null
    }
    Returns: ResourceMapPublicItemsView["Row"][]
  }
  promote_resource_map_import_record: {
    Args: {
      p_import_record_id: string
      p_payload: Json
      p_publish?: boolean
    }
    Returns: {
      promotion_result: string
      organization_id: string | null
      service_id: string | null
      location_id: string | null
      contact_count: number
      link_count: number
      field_evidence_count: number
    }[]
  }
}
