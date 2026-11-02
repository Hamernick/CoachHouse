\set ON_ERROR_STOP on
\ir workspace-response-data-views-fixture.sql
\ir ../migrations/20261102235600_project_data_view_creation_receipt.sql
\ir ../migrations/20261103020000_linked_sheet_data_views.sql
\ir ../migrations/20261103050000_saved_data_view_composition.sql
\ir ../migrations/20261103060000_linked_sheet_view_composition.sql
-- Inherits actual Google connection schema and canonical source/closure owners.
-- Hosted auth, Google transport and independent backup/restore are not qualified here.
