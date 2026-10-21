export type DocumentCollaborationRoomsTable = {
  Row: {
    id: string; org_id: string; file_id: string; generation: string;
    base_revision: string; base_updated_at: string; checkpoint: string;
    checkpoint_sequence: number; last_sequence: number; canonical_sequence: number; recovery_bytes: number;
    created_by: string; created_at: string; updated_at: string;
  }
  Insert: {
    id?: string; org_id: string; file_id: string; generation?: string;
    base_revision: string; base_updated_at: string; checkpoint: string;
    checkpoint_sequence?: number; last_sequence?: number; canonical_sequence?: number; recovery_bytes?: number;
    created_by: string; created_at?: string; updated_at?: string;
  }
  Update: Partial<DocumentCollaborationRoomsTable["Insert"]>
  Relationships: [
    { foreignKeyName: "document_collaboration_rooms_file_id_fkey"; columns: ["file_id"]; referencedRelation: "organization_document_files"; referencedColumns: ["id"] },
    { foreignKeyName: "document_collaboration_rooms_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organizations"; referencedColumns: ["user_id"] },
  ]
}
export type DocumentCollaborationUpdatesTable = {
  Row: {
    room_id: string; sequence: number; batch_id: string; generation: string; actor_id: string;
    payload: string | null; payload_hash: string; created_at: string;
  }
  Insert: { room_id: string; sequence: number; batch_id: string; generation: string; actor_id: string; payload?: string | null; payload_hash: string; created_at?: string }
  Update: Partial<DocumentCollaborationUpdatesTable["Insert"]>
  Relationships: [
    { foreignKeyName: "document_collaboration_updates_room_id_fkey"; columns: ["room_id"]; referencedRelation: "document_collaboration_rooms"; referencedColumns: ["id"] },
  ]
}

export type DocumentFileVersionsTable = {
  Row: {
    id: string; file_id: string; org_id: string; request_id: string | null; actor_id: string;
    storage_path: string; name: string; mime_type: string; size_bytes: number;
    content_hash: string; revision: string; source_updated_at: string; generation: string;
    sequence: number; restored_from: string | null; request_fingerprint: string | null;
    request_context: import("../json").Json | null; created_at: string;
  }
  Insert: Omit<DocumentFileVersionsTable["Row"], "id" | "created_at"> & { id?: string; created_at?: string }
  Update: Partial<DocumentFileVersionsTable["Insert"]>
  Relationships: []
}

export type DocumentVersionOperationsTable = {
  Row: { file_id: string; request_id: string; org_id: string; actor_id: string; fingerprint: string;
    staged_bytes: number; state: "staged" | "committed" | "abandoned" | "cleaned"; created_at: string }
  Insert: Omit<DocumentVersionOperationsTable["Row"], "state" | "created_at"> & {
    state?: DocumentVersionOperationsTable["Row"]["state"]; created_at?: string }
  Update: Partial<DocumentVersionOperationsTable["Insert"]>
  Relationships: []
}
