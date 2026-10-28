export type AnswerMode = "workspace" | "general";
export interface KnowledgeSource {
  source_id?: string;
  table: string;
  id: string;
  label: string;
  location?: string;
  version?: string;
  page_number?: number;
  chunk_id?: string;
  source_path?: string;
  mime_type?: string;
  recorded_at?: string;
  excerpt?: string;
  preview_recommended?: boolean;
}
export interface KnowledgeAnswer {
  content: string;
  citations: KnowledgeSource[];
  response_mode?: string;
  engine?: string;
  evidence?: { retrieved_at?: string; warnings?: string[] };
}
export interface KnowledgeMessage extends Partial<KnowledgeAnswer> {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
export interface KnowledgeConversation {
  id: string;
  title: string;
  mode: AnswerMode;
  site_id: string;
  asset_id: string;
  messages: KnowledgeMessage[];
}
export interface IndexProgress {
  message: string;
  chunks?: number;
  embedded?: number;
  remaining?: number;
  embedding_pending?: boolean;
  embedding_status?: string;
  paused?: boolean;
}
