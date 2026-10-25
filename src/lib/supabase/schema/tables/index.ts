import type { OrganizationBrandKitsTable } from "./organization_brand_kits"
import type { DocumentCollaborationRoomsTable, DocumentCollaborationUpdatesTable, DocumentFileVersionsTable, DocumentVersionOperationsTable } from "./document_collaboration"
import type { CoachingCreditGrantsTable } from "./coaching_credit_grants"
import type { OrganizationDocumentFilesTable } from "./organization_document_files"
import type { GoogleCalendarConnectionsTable, GoogleCalendarOauthIntentsTable } from "./google_calendar_connections"
import type { OrganizationsTable } from "./organizations"
import type { PublicHandleReservationsTable } from "./public_handle_reservations"
import type { PublicHandlesTable } from "./public_handles"
import type { PublicPersonProfilesTable } from "./public_person_profiles"
import type { PublicPersonOrganizationAffiliationsTable } from "./public_person_organization_affiliations"
import type { PublicPersonSavedCollectionItemsTable } from "./public_person_saved_collection_items"
import type { PublicPersonSavedCollectionsTable } from "./public_person_saved_collections"
import type { PublicProfileActivityEventsTable } from "./public_profile_activity_events"
import type { PublicTrackedResourceLinkDailyOpensTable } from "./public_tracked_resource_link_daily_opens"
import type { PublicTrackedResourceLinksTable } from "./public_tracked_resource_links"
import type { AppPricingFeedbackResponsesTable } from "./app_pricing_feedback_responses"
import type { ModuleAssignmentsTable } from "./module_assignments"
import type { AssignmentSubmissionsTable } from "./assignment_submissions"
import type { AttachmentsTable } from "./attachments"
import type { EnrollmentInvitesTable } from "./enrollment_invites"
import type { ProfilesTable } from "./profiles"
import type { ProgramsTable } from "./programs"
import type { ClassesTable } from "./classes"
import type { ModulesTable } from "./modules"
import type { EnrollmentsTable } from "./enrollments"
import type { ModuleProgressTable } from "./module_progress"
import type { SubscriptionsTable } from "./subscriptions"
import type { StripeWebhookEventsTable } from "./stripe_webhook_events"
import type { ModuleContentTable } from "./module_content"
import type { OnboardingResponsesTable } from "./onboarding_responses"
import type { RoadmapEventsTable } from "./roadmap_events"
import type { RoadmapCalendarPublicEventsTable } from "./roadmap_calendar_public_events"
import type { RoadmapCalendarInternalEventsTable } from "./roadmap_calendar_internal_events"
import type { RoadmapCalendarPublicFeedsTable } from "./roadmap_calendar_public_feeds"
import type { RoadmapCalendarInternalFeedsTable } from "./roadmap_calendar_internal_feeds"
import type { SearchEventsTable } from "./search_events"
import type { ResourceMapSourcesTable } from "./resource_map_sources"
import type { ResourceMapImportBatchesTable } from "./resource_map_import_batches"
import type { ResourceMapIngestionRunsTable } from "./resource_map_ingestion_runs"
import type { ResourceMapEnrichmentRunsTable } from "./resource_map_enrichment_runs"
import type { ResourceMapRawIngestionRecordsTable } from "./resource_map_raw_ingestion_records"
import type { ResourceMapImportRecordsTable } from "./resource_map_import_records"
import type { ResourceMapCategoriesTable } from "./resource_map_categories"
import type { ResourceMapOrganizationsTable } from "./resource_map_organizations"
import type { ResourceMapServicesTable } from "./resource_map_services"
import type { ResourceMapServiceCategoriesTable } from "./resource_map_service_categories"
import type { ResourceMapLocationsTable } from "./resource_map_locations"
import type { ResourceMapContactsTable } from "./resource_map_contacts"
import type { ResourceMapLinksTable } from "./resource_map_links"
import type { ResourceMapImportRecordMatchesTable } from "./resource_map_import_record_matches"
import type { ResourceMapFieldEvidenceTable } from "./resource_map_field_evidence"
import type { ResourceMapCurationEventsTable } from "./resource_map_curation_events"
import type { PublicMapOrganizationCurationEventsTable } from "./public_map_organization_curation_events"
import type { PublicMapClaimRequestsTable } from "./public_map_claim_requests"
import type { AcceleratorPurchasesTable } from "./accelerator_purchases"
import type { ElectivePurchasesTable } from "./elective_purchases"
import type { OrganizationMembershipsTable } from "./organization_memberships"
import type { OrganizationFinanceAccessTable } from "./organization_finance_access"
import type { FinanceOpportunityScanRunsTable } from "./finance_opportunity_scan_runs"
import type { FinanceOpportunitySourcesTable } from "./finance_opportunity_sources"
import type { OrganizationFinanceEngagementEventsTable } from "./organization_finance_engagement_events"
import type { OrganizationFinanceOpportunitiesTable } from "./organization_finance_opportunities"
import type { OrganizationFinanceRecordCorrectionsTable } from "./organization_finance_record_corrections"
import type { OrganizationFinanceRecordEvidenceTable } from "./organization_finance_record_evidence"
import type { OrganizationFinanceRecordEventsTable } from "./organization_finance_record_events"
import type { OrganizationFinanceRecordProviderEvidenceTable } from "./organization_finance_record_provider_evidence"
import type { OrganizationFinanceRecordsTable } from "./organization_finance_records"
import type { OrganizationFinanceStripeConnectionsTable } from "./organization_finance_stripe_connections"
import type { OrganizationFinanceStripeInstallIntentsTable } from "./organization_finance_stripe_install_intents"
import type { OrganizationPeopleSegmentMembersTable } from "./organization_people_segment_members"
import type { OrganizationPeopleSegmentsTable } from "./organization_people_segments"
import type { OrganizationPeopleTagMembersTable } from "./organization_people_tag_members"
import type { OrganizationPeopleTagsTable } from "./organization_people_tags"
import type { OrganizationCoachAssignmentsTable } from "./organization_coach_assignments"
import type { OrganizationCoachScopeEventsTable } from "./organization_coach_scope_events"
import type { OrganizationCoachScopeSettingsTable } from "./organization_coach_scope_settings"
import type { OrganizationStaffKanbanPreferencesTable } from "./organization_staff_kanban_preferences"
import type { OrganizationInvitesTable } from "./organization_invites"
import type { OrganizationAccessRequestsTable } from "./organization_access_requests"
import type { OrganizationAccessSettingsTable } from "./organization_access_settings"
import type { OrganizationProjectAssetsTable } from "./organization_project_assets"
import type { OrganizationProjectNotesTable } from "./organization_project_notes"
import type { OrganizationProjectOverviewDocumentsTable } from "./organization_project_overview_documents"
import type { OrganizationProjectsTable } from "./organization_projects"
import type { OrganizationProjectQuickLinksTable } from "./organization_project_quick_links"
import type { OrganizationProjectActivityEventsTable } from "./organization_project_activity_events"
import type { OrganizationTaskAssigneesTable } from "./organization_task_assignees"
import type { OrganizationTasksTable } from "./organization_tasks"
import type { PlatformAdminProjectWorkstreamStatesTable } from "./platform_admin_project_workstream_states"
import type { PlatformAdminWorkstreamCategoriesTable } from "./platform_admin_workstream_categories"
import type { PlatformStaffMembersTable } from "./platform_staff_members"
import type { OrganizationWorkspaceBoardsTable } from "./organization_workspace_boards"
import type { OrganizationWorkspacePagesTable } from "./organization_workspace_pages"
import type { OrganizationWorkspaceCalendarRevisionsTable } from "./organization_workspace_calendar_revisions"
import type { OrganizationWorkspaceCommunicationChannelsTable } from "./organization_workspace_communication_channels"
import type { OrganizationWorkspaceCommunicationDeliveriesTable } from "./organization_workspace_communication_deliveries"
import type { OrganizationWorkspaceCommunicationsTable } from "./organization_workspace_communications"
import type { OrganizationWorkspaceInvitesTable } from "./organization_workspace_invites"
import type { OrganizationWorkspaceObjectiveActivityTable } from "./organization_workspace_objective_activity"
import type { OrganizationWorkspaceObjectiveAssigneesTable } from "./organization_workspace_objective_assignees"
import type { OrganizationWorkspaceObjectiveGroupsTable } from "./organization_workspace_objective_groups"
import type { OrganizationWorkspaceObjectiveLinksTable } from "./organization_workspace_objective_links"
import type { OrganizationWorkspaceObjectiveStepsTable } from "./organization_workspace_objective_steps"
import type { OrganizationWorkspaceObjectivesTable } from "./organization_workspace_objectives"
import type { OrganizationWorkspaceStarterStateTable } from "./organization_workspace_starter_state"
import type { NotificationsTable } from "./notifications"
import type { AppPageHealthEventsTable } from "./app_page_health_events"
import type { UserJourneyEventsTable } from "./user_journey_events"
import type { UserActivationCheckpointsTable } from "./user_activation_checkpoints"
import type { CoachingCoachesTable } from "./coaching_coaches"
import type { CoachingBookingsTable } from "./coaching_bookings"
import type { CoachingCreditLedgerTable } from "./coaching_credit_ledger"
import type { FiscalSponsorshipApplicationsTable } from "./fiscal_sponsorship_applications"
import type { FiscalProjectReviewersTable } from "./fiscal_project_reviewers"
import type { FiscalSponsorshipDocumentsTable } from "./fiscal_sponsorship_documents"
import type { FiscalSponsorshipEventsTable } from "./fiscal_sponsorship_events"
import type { FiscalSponsorshipReviewsTable } from "./fiscal_sponsorship_reviews"
import type { FiscalSponsorshipSignaturePacketsTable } from "./fiscal_sponsorship_signature_packets"
import type { FiscalSponsorshipSigningDraftsTable } from "./fiscal_sponsorship_signing_drafts"
import type { FiscalSponsorshipSignaturesTable } from "./fiscal_sponsorship_signatures"
import type { PlatformEmailCampaignsTable } from "./platform_email_campaigns"
import type { PlatformEmailDeliveriesTable } from "./platform_email_deliveries"
import type { PlatformEmailEventsTable } from "./platform_email_events"
import type { PlatformEmailSuppressionsTable } from "./platform_email_suppressions"
import type { PlatformEmailTopicsTable } from "./platform_email_topics"
import type { PlatformEmailPreferencesTable } from "./platform_email_preferences"
import type { PlatformEmailConsentEventsTable } from "./platform_email_consent_events"
import type { PlatformEmailLinksTable } from "./platform_email_links"
import type { PlatformEmailLinkClicksTable } from "./platform_email_link_clicks"
import type { PlatformLegalAcceptancesTable } from "./platform_legal_acceptances"
import type { GoogleDriveOauthIntentsTable } from "./google_drive_oauth_intents"
import type { GoogleDriveConnectionsTable } from "./google_drive_connections"
import type { OrganizationExternalDocumentsTable } from "./organization_external_documents"

export type { OrganizationsTable } from "./organizations"
export type { PublicHandleReservationsTable } from "./public_handle_reservations"
export type { PublicHandlesTable } from "./public_handles"
export type { PublicPersonProfilesTable } from "./public_person_profiles"
export type { PublicPersonOrganizationAffiliationsTable } from "./public_person_organization_affiliations"
export type { PublicPersonSavedCollectionItemsTable } from "./public_person_saved_collection_items"
export type { PublicPersonSavedCollectionsTable } from "./public_person_saved_collections"
export type { PublicProfileActivityEventsTable } from "./public_profile_activity_events"
export type { PublicTrackedResourceLinkDailyOpensTable } from "./public_tracked_resource_link_daily_opens"
export type { PublicTrackedResourceLinksTable } from "./public_tracked_resource_links"
export type { AppPricingFeedbackResponsesTable } from "./app_pricing_feedback_responses"
export type { ModuleAssignmentsTable } from "./module_assignments"
export type { AssignmentSubmissionsTable } from "./assignment_submissions"
export type { AttachmentsTable } from "./attachments"
export type { EnrollmentInvitesTable } from "./enrollment_invites"
export type { ProfilesTable } from "./profiles"
export type { ProgramsTable } from "./programs"
export type { ClassesTable } from "./classes"
export type { ModulesTable } from "./modules"
export type { EnrollmentsTable } from "./enrollments"
export type { ModuleProgressTable } from "./module_progress"
export type { SubscriptionsTable } from "./subscriptions"
export type { StripeWebhookEventsTable } from "./stripe_webhook_events"
export type { ModuleContentTable } from "./module_content"
export type { OnboardingResponsesTable } from "./onboarding_responses"
export type { RoadmapEventsTable } from "./roadmap_events"
export type { RoadmapCalendarPublicEventsTable } from "./roadmap_calendar_public_events"
export type { RoadmapCalendarInternalEventsTable } from "./roadmap_calendar_internal_events"
export type { RoadmapCalendarPublicFeedsTable } from "./roadmap_calendar_public_feeds"
export type { RoadmapCalendarInternalFeedsTable } from "./roadmap_calendar_internal_feeds"
export type { SearchEventsTable } from "./search_events"
export type { ResourceMapSourcesTable } from "./resource_map_sources"
export type { ResourceMapImportBatchesTable } from "./resource_map_import_batches"
export type { ResourceMapIngestionRunsTable } from "./resource_map_ingestion_runs"
export type { ResourceMapEnrichmentRunsTable } from "./resource_map_enrichment_runs"
export type { ResourceMapRawIngestionRecordsTable } from "./resource_map_raw_ingestion_records"
export type { ResourceMapImportRecordsTable } from "./resource_map_import_records"
export type { ResourceMapCategoriesTable } from "./resource_map_categories"
export type { ResourceMapOrganizationsTable } from "./resource_map_organizations"
export type { ResourceMapServicesTable } from "./resource_map_services"
export type { ResourceMapServiceCategoriesTable } from "./resource_map_service_categories"
export type { ResourceMapLocationsTable } from "./resource_map_locations"
export type { ResourceMapContactsTable } from "./resource_map_contacts"
export type { ResourceMapLinksTable } from "./resource_map_links"
export type { ResourceMapImportRecordMatchesTable } from "./resource_map_import_record_matches"
export type { ResourceMapFieldEvidenceTable } from "./resource_map_field_evidence"
export type { ResourceMapCurationEventsTable } from "./resource_map_curation_events"
export type { PublicMapOrganizationCurationEventsTable } from "./public_map_organization_curation_events"
export type { PublicMapClaimRequestsTable } from "./public_map_claim_requests"
export type { AcceleratorPurchasesTable } from "./accelerator_purchases"
export type { ElectivePurchasesTable } from "./elective_purchases"
export type { OrganizationMembershipsTable } from "./organization_memberships"
export type { OrganizationFinanceAccessTable } from "./organization_finance_access"
export type { FinanceOpportunityScanRunsTable } from "./finance_opportunity_scan_runs"
export type { FinanceOpportunitySourcesTable } from "./finance_opportunity_sources"
export type { OrganizationFinanceEngagementEventsTable } from "./organization_finance_engagement_events"
export type { OrganizationFinanceOpportunitiesTable } from "./organization_finance_opportunities"
export type { OrganizationFinanceRecordCorrectionsTable } from "./organization_finance_record_corrections"
export type { OrganizationFinanceRecordEvidenceTable } from "./organization_finance_record_evidence"
export type { OrganizationFinanceRecordEventsTable } from "./organization_finance_record_events"
export type { OrganizationFinanceRecordProviderEvidenceTable } from "./organization_finance_record_provider_evidence"
export type { OrganizationFinanceRecordsTable } from "./organization_finance_records"
export type { OrganizationFinanceStripeConnectionsTable } from "./organization_finance_stripe_connections"
export type { OrganizationFinanceStripeInstallIntentsTable } from "./organization_finance_stripe_install_intents"
export type { OrganizationPeopleSegmentMembersTable } from "./organization_people_segment_members"
export type { OrganizationPeopleSegmentsTable } from "./organization_people_segments"
export type { OrganizationPeopleTagMembersTable } from "./organization_people_tag_members"
export type { OrganizationPeopleTagsTable } from "./organization_people_tags"
export type { OrganizationCoachAssignmentsTable } from "./organization_coach_assignments"
export type { OrganizationCoachScopeEventsTable } from "./organization_coach_scope_events"
export type { OrganizationCoachScopeSettingsTable } from "./organization_coach_scope_settings"
export type { OrganizationStaffKanbanPreferencesTable } from "./organization_staff_kanban_preferences"
export type { OrganizationInvitesTable } from "./organization_invites"
export type { OrganizationAccessRequestsTable } from "./organization_access_requests"
export type { OrganizationAccessSettingsTable } from "./organization_access_settings"
export type { OrganizationProjectAssetsTable } from "./organization_project_assets"
export type { OrganizationProjectNotesTable } from "./organization_project_notes"
export type { OrganizationProjectOverviewDocumentsTable } from "./organization_project_overview_documents"
export type { OrganizationProjectsTable } from "./organization_projects"
export type { OrganizationProjectQuickLinksTable } from "./organization_project_quick_links"
export type { OrganizationProjectActivityEventsTable } from "./organization_project_activity_events"
export type { OrganizationTaskAssigneesTable } from "./organization_task_assignees"
export type { OrganizationTasksTable } from "./organization_tasks"
export type { PlatformAdminProjectWorkstreamStatesTable } from "./platform_admin_project_workstream_states"
export type { PlatformAdminWorkstreamCategoriesTable } from "./platform_admin_workstream_categories"
export type { PlatformStaffMembersTable } from "./platform_staff_members"
export type { OrganizationWorkspaceBoardsTable } from "./organization_workspace_boards"
export type { OrganizationWorkspacePagesTable } from "./organization_workspace_pages"
export type { OrganizationWorkspaceCalendarRevisionsTable } from "./organization_workspace_calendar_revisions"
export type { OrganizationWorkspaceCommunicationChannelsTable } from "./organization_workspace_communication_channels"
export type { OrganizationWorkspaceCommunicationDeliveriesTable } from "./organization_workspace_communication_deliveries"
export type { OrganizationWorkspaceCommunicationsTable } from "./organization_workspace_communications"
export type { OrganizationWorkspaceInvitesTable } from "./organization_workspace_invites"
export type { OrganizationWorkspaceObjectiveActivityTable } from "./organization_workspace_objective_activity"
export type { OrganizationWorkspaceObjectiveAssigneesTable } from "./organization_workspace_objective_assignees"
export type { OrganizationWorkspaceObjectiveGroupsTable } from "./organization_workspace_objective_groups"
export type { OrganizationWorkspaceObjectiveLinksTable } from "./organization_workspace_objective_links"
export type { OrganizationWorkspaceObjectiveStepsTable } from "./organization_workspace_objective_steps"
export type { OrganizationWorkspaceObjectivesTable } from "./organization_workspace_objectives"
export type { OrganizationWorkspaceStarterStateTable } from "./organization_workspace_starter_state"
export type { NotificationsTable } from "./notifications"
export type { AppPageHealthEventsTable } from "./app_page_health_events"
export type { UserJourneyEventsTable } from "./user_journey_events"
export type { UserActivationCheckpointsTable } from "./user_activation_checkpoints"
export type { CoachingCoachesTable } from "./coaching_coaches"
export type { CoachingBookingsTable } from "./coaching_bookings"
export type { CoachingCreditLedgerTable } from "./coaching_credit_ledger"
export type { FiscalSponsorshipApplicationsTable } from "./fiscal_sponsorship_applications"
export type { FiscalProjectReviewersTable } from "./fiscal_project_reviewers"
export type { FiscalSponsorshipDocumentsTable } from "./fiscal_sponsorship_documents"
export type { FiscalSponsorshipEventsTable } from "./fiscal_sponsorship_events"
export type { FiscalSponsorshipReviewsTable } from "./fiscal_sponsorship_reviews"
export type { FiscalSponsorshipSignaturePacketsTable } from "./fiscal_sponsorship_signature_packets"
export type { FiscalSponsorshipSigningDraftsTable } from "./fiscal_sponsorship_signing_drafts"
export type { FiscalSponsorshipSignaturesTable } from "./fiscal_sponsorship_signatures"
export type { PlatformEmailCampaignsTable } from "./platform_email_campaigns"
export type { PlatformEmailDeliveriesTable } from "./platform_email_deliveries"
export type { PlatformEmailEventsTable } from "./platform_email_events"
export type { PlatformEmailSuppressionsTable } from "./platform_email_suppressions"
export type { PlatformEmailTopicsTable } from "./platform_email_topics"
export type { PlatformEmailPreferencesTable } from "./platform_email_preferences"
export type { PlatformEmailConsentEventsTable } from "./platform_email_consent_events"
export type { PlatformEmailLinksTable } from "./platform_email_links"
export type { PlatformEmailLinkClicksTable } from "./platform_email_link_clicks"
export type { PlatformLegalAcceptancesTable } from "./platform_legal_acceptances"
export type { GoogleDriveOauthIntentsTable } from "./google_drive_oauth_intents"
export type { GoogleDriveConnectionsTable } from "./google_drive_connections"
export type { OrganizationExternalDocumentsTable } from "./organization_external_documents"

export type PublicTables = {
  organizations: OrganizationsTable
  public_handle_reservations: PublicHandleReservationsTable
  public_handles: PublicHandlesTable
  public_person_profiles: PublicPersonProfilesTable
  public_person_organization_affiliations: PublicPersonOrganizationAffiliationsTable
  public_person_saved_collection_items: PublicPersonSavedCollectionItemsTable
  public_person_saved_collections: PublicPersonSavedCollectionsTable
  public_profile_activity_events: PublicProfileActivityEventsTable
  public_tracked_resource_link_daily_opens: PublicTrackedResourceLinkDailyOpensTable
  public_tracked_resource_links: PublicTrackedResourceLinksTable
  app_pricing_feedback_responses: AppPricingFeedbackResponsesTable
  module_assignments: ModuleAssignmentsTable
  assignment_submissions: AssignmentSubmissionsTable
  attachments: AttachmentsTable
  enrollment_invites: EnrollmentInvitesTable
  profiles: ProfilesTable
  programs: ProgramsTable
  classes: ClassesTable
  modules: ModulesTable
  enrollments: EnrollmentsTable
  module_progress: ModuleProgressTable
  subscriptions: SubscriptionsTable
  stripe_webhook_events: StripeWebhookEventsTable
  module_content: ModuleContentTable
  onboarding_responses: OnboardingResponsesTable
  roadmap_events: RoadmapEventsTable
  roadmap_calendar_public_events: RoadmapCalendarPublicEventsTable
  roadmap_calendar_internal_events: RoadmapCalendarInternalEventsTable
  roadmap_calendar_public_feeds: RoadmapCalendarPublicFeedsTable
  roadmap_calendar_internal_feeds: RoadmapCalendarInternalFeedsTable
  search_events: SearchEventsTable
  resource_map_sources: ResourceMapSourcesTable
  resource_map_import_batches: ResourceMapImportBatchesTable
  resource_map_ingestion_runs: ResourceMapIngestionRunsTable
  resource_map_enrichment_runs: ResourceMapEnrichmentRunsTable
  resource_map_raw_ingestion_records: ResourceMapRawIngestionRecordsTable
  resource_map_import_records: ResourceMapImportRecordsTable
  resource_map_categories: ResourceMapCategoriesTable
  resource_map_organizations: ResourceMapOrganizationsTable
  resource_map_services: ResourceMapServicesTable
  resource_map_service_categories: ResourceMapServiceCategoriesTable
  resource_map_locations: ResourceMapLocationsTable
  resource_map_contacts: ResourceMapContactsTable
  resource_map_links: ResourceMapLinksTable
  resource_map_import_record_matches: ResourceMapImportRecordMatchesTable
  resource_map_field_evidence: ResourceMapFieldEvidenceTable
  resource_map_curation_events: ResourceMapCurationEventsTable
  public_map_organization_curation_events: PublicMapOrganizationCurationEventsTable
  public_map_claim_requests: PublicMapClaimRequestsTable
  accelerator_purchases: AcceleratorPurchasesTable
  elective_purchases: ElectivePurchasesTable
  organization_memberships: OrganizationMembershipsTable
  organization_finance_access: OrganizationFinanceAccessTable
  finance_opportunity_scan_runs: FinanceOpportunityScanRunsTable
  finance_opportunity_sources: FinanceOpportunitySourcesTable
  organization_finance_engagement_events: OrganizationFinanceEngagementEventsTable
  organization_finance_opportunities: OrganizationFinanceOpportunitiesTable
  organization_finance_record_corrections: OrganizationFinanceRecordCorrectionsTable
  organization_finance_record_evidence: OrganizationFinanceRecordEvidenceTable
  organization_finance_record_events: OrganizationFinanceRecordEventsTable
  organization_finance_record_provider_evidence: OrganizationFinanceRecordProviderEvidenceTable
  organization_finance_records: OrganizationFinanceRecordsTable
  organization_finance_stripe_connections: OrganizationFinanceStripeConnectionsTable
  organization_finance_stripe_install_intents: OrganizationFinanceStripeInstallIntentsTable
  organization_people_segment_members: OrganizationPeopleSegmentMembersTable
  organization_people_segments: OrganizationPeopleSegmentsTable
  organization_people_tag_members: OrganizationPeopleTagMembersTable
  organization_people_tags: OrganizationPeopleTagsTable
  organization_coach_assignments: OrganizationCoachAssignmentsTable
  organization_coach_scope_events: OrganizationCoachScopeEventsTable
  organization_coach_scope_settings: OrganizationCoachScopeSettingsTable
  organization_staff_kanban_preferences: OrganizationStaffKanbanPreferencesTable
  organization_invites: OrganizationInvitesTable
  organization_access_requests: OrganizationAccessRequestsTable
  organization_access_settings: OrganizationAccessSettingsTable
  organization_project_assets: OrganizationProjectAssetsTable
  organization_project_notes: OrganizationProjectNotesTable
  organization_project_overview_documents: OrganizationProjectOverviewDocumentsTable
  organization_projects: OrganizationProjectsTable
  organization_project_quick_links: OrganizationProjectQuickLinksTable
  organization_project_activity_events: OrganizationProjectActivityEventsTable
  organization_task_assignees: OrganizationTaskAssigneesTable
  organization_tasks: OrganizationTasksTable
  platform_admin_project_workstream_states: PlatformAdminProjectWorkstreamStatesTable
  platform_admin_workstream_categories: PlatformAdminWorkstreamCategoriesTable
  platform_staff_members: PlatformStaffMembersTable
  organization_brand_kits: OrganizationBrandKitsTable
  organization_workspace_boards: OrganizationWorkspaceBoardsTable
  organization_workspace_pages: OrganizationWorkspacePagesTable
  organization_workspace_calendar_revisions: OrganizationWorkspaceCalendarRevisionsTable
  organization_workspace_communication_channels: OrganizationWorkspaceCommunicationChannelsTable
  organization_workspace_communication_deliveries: OrganizationWorkspaceCommunicationDeliveriesTable
  organization_workspace_communications: OrganizationWorkspaceCommunicationsTable
  organization_workspace_invites: OrganizationWorkspaceInvitesTable
  organization_workspace_objective_activity: OrganizationWorkspaceObjectiveActivityTable
  organization_workspace_objective_assignees: OrganizationWorkspaceObjectiveAssigneesTable
  organization_workspace_objective_groups: OrganizationWorkspaceObjectiveGroupsTable
  organization_workspace_objective_links: OrganizationWorkspaceObjectiveLinksTable
  organization_workspace_objective_steps: OrganizationWorkspaceObjectiveStepsTable
  organization_workspace_objectives: OrganizationWorkspaceObjectivesTable
  organization_workspace_starter_state: OrganizationWorkspaceStarterStateTable
  notifications: NotificationsTable
  app_page_health_events: AppPageHealthEventsTable
  user_journey_events: UserJourneyEventsTable
  user_activation_checkpoints: UserActivationCheckpointsTable
  coaching_coaches: CoachingCoachesTable
  coaching_bookings: CoachingBookingsTable
  coaching_credit_grants: CoachingCreditGrantsTable
  coaching_accelerator_credit_receipts: { Row: { user_id: string; created_at: string }; Insert: { user_id: string; created_at?: string }; Update: { user_id?: string; created_at?: string }; Relationships: [] }
  coaching_credit_ledger: CoachingCreditLedgerTable
  fiscal_sponsorship_applications: FiscalSponsorshipApplicationsTable
  fiscal_project_reviewers: FiscalProjectReviewersTable
  fiscal_sponsorship_documents: FiscalSponsorshipDocumentsTable
  fiscal_sponsorship_events: FiscalSponsorshipEventsTable
  fiscal_sponsorship_reviews: FiscalSponsorshipReviewsTable
  fiscal_sponsorship_signature_packets: FiscalSponsorshipSignaturePacketsTable
  fiscal_sponsorship_signing_drafts: FiscalSponsorshipSigningDraftsTable
  fiscal_sponsorship_signatures: FiscalSponsorshipSignaturesTable
  platform_email_campaigns: PlatformEmailCampaignsTable
  platform_email_deliveries: PlatformEmailDeliveriesTable
  platform_email_events: PlatformEmailEventsTable
  platform_email_suppressions: PlatformEmailSuppressionsTable
  platform_email_topics: PlatformEmailTopicsTable
  platform_email_preferences: PlatformEmailPreferencesTable
  platform_email_consent_events: PlatformEmailConsentEventsTable
  platform_email_links: PlatformEmailLinksTable
  platform_email_link_clicks: PlatformEmailLinkClicksTable
  platform_legal_acceptances: PlatformLegalAcceptancesTable
  google_drive_oauth_intents: GoogleDriveOauthIntentsTable
  document_version_operations: DocumentVersionOperationsTable
  document_file_versions: DocumentFileVersionsTable
  document_collaboration_rooms: DocumentCollaborationRoomsTable
  document_collaboration_updates: DocumentCollaborationUpdatesTable
  organization_document_files: OrganizationDocumentFilesTable
  google_calendar_oauth_intents: GoogleCalendarOauthIntentsTable
  google_calendar_connections: GoogleCalendarConnectionsTable
  google_drive_connections: GoogleDriveConnectionsTable
  organization_external_documents: OrganizationExternalDocumentsTable
}

export type { OrganizationDocumentFilesTable } from "./organization_document_files"
