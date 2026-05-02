export type MetaConnectionStatus = 'active' | 'expired' | 'revoked';

export interface MetaConnection {
  id: string;
  clerk_user_id: string;
  fb_user_id: string;
  fb_user_name: string | null;
  token_expires_at: string | null;
  default_ad_account_id: string | null;
  default_page_id: string | null;
  default_page_name: string | null;
  default_instagram_id: string | null;
  default_instagram_username: string | null;
  scopes: string[] | null;
  status: MetaConnectionStatus;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaAdAccount {
  id: string;            // act_1234567890
  account_id: string;
  name: string;
  currency?: string;
  business_name?: string | null;
}

export interface MetaPage {
  id: string;
  name: string;
  category?: string | null;
  picture_url?: string | null;
  has_instagram?: boolean;
}

export interface MetaInstagramAccount {
  id: string;            // ig business id (used as instagram_actor_id in ad creatives)
  username: string;
  profile_picture_url?: string | null;
}

export type MetaUploadStatus = 'pending' | 'uploading' | 'processing' | 'ready' | 'failed';
export type MetaAssetType = 'image' | 'video';

export interface MetaAiFeatures {
  // Master toggle — opting into Advantage+ Creative globally for the ad
  advantage_creative_overall?: boolean;
  // Image
  standard_enhancements?: boolean;     // brillo / contraste auto
  image_touchups?: boolean;            // retoque automático
  image_animation?: boolean;           // anima imágenes estáticas
  // Text
  text_improvements?: boolean;         // re-escribe primary text
  description_visibility?: boolean;    // muestra descripciones automáticamente
  // Video
  music?: boolean;                     // agrega música a videos sin audio
  video_auto_crop?: boolean;
  // Layout / extensions
  site_extensions?: boolean;           // sitelinks
  cta_optimization?: boolean;          // rota el CTA dinámicamente
}

export interface MetaAdMetadata {
  name?: string;
  primary_text?: string;
  headline?: string;
  description?: string;
  link_url?: string;
  cta?: string;
  thumbnail_url?: string;

  // Multi-variante (Meta acepta hasta 5 de cada) — overrides los singulares cuando hay >0
  primary_texts?: string[];
  headlines?: string[];
  descriptions?: string[];

  // Tracking & display
  display_url?: string;
  url_params?: string;                 // "utm_source=meta&utm_campaign={{campaign.name}}"

  // Identity overrides (default: la cuenta)
  page_id_override?: string;
  instagram_actor_id_override?: string;

  // Advantage+ creative toggles
  ai_features?: MetaAiFeatures;
}

export interface MetaUpload {
  id: string;
  clerk_user_id: string;
  generation_id: string;
  ad_account_id: string;
  asset_type: MetaAssetType;
  meta_asset_id: string | null;
  meta_asset_hash: string | null;
  source_url: string;
  status: MetaUploadStatus;
  error_message: string | null;
  poll_attempts: number;
  last_polled_at: string | null;
  ad_metadata: MetaAdMetadata | null;
  created_at: string;
  updated_at: string;
}

export interface BulkUploadAssetMeta {
  generationId: string;
  metadata?: MetaAdMetadata;
}

export interface BulkUploadRequest {
  generationIds: string[];
  adAccountId: string;
  metadata?: Record<string, MetaAdMetadata>;
}

export interface BulkUploadResponseRow {
  id: string;
  generation_id: string;
  asset_type: MetaAssetType;
  status: MetaUploadStatus;
  meta_asset_id?: string | null;
  meta_asset_hash?: string | null;
  error_message?: string | null;
}

export interface BulkUploadResponse {
  uploads: BulkUploadResponseRow[];
}

export interface UploadStatusResponse {
  uploads: MetaUpload[];
  allDone: boolean;
}

export interface AccountsResponse {
  accounts: MetaAdAccount[];
  default_ad_account_id: string | null;
  default_page_id: string | null;
  default_page_name: string | null;
  default_instagram_id: string | null;
  default_instagram_username: string | null;
  fb_user_name: string | null;
}

export interface RequiresReconnectResponse {
  requiresReconnect: true;
  error?: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
  insights?: MetaInsightsRow | null;
}

export interface MetaInsightsRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  cpc?: string;
  reach?: string;
  purchases?: number;
  purchase_value?: number;
  roas?: number;
}

export type MetaAdMediaKind = 'image' | 'video' | 'carousel' | 'unknown';

export interface MetaAdSummary {
  id: string;                       // ad id
  name: string;
  status?: string;
  effective_status?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  creative_id?: string;
  media_kind: MetaAdMediaKind;
  thumbnail_url: string | null;
  effective_object_story_id?: string | null;
  video_id?: string | null;
  video_source_url?: string | null;
  video_permalink_url?: string | null;
  /** Facebook iframe URL for embed-style playback when the mp4 can't be extracted. */
  video_embed_url?: string | null;
  image_url?: string | null;
  /** Full-resolution original image URL from /act_X/adimages — used for downloads. */
  image_full_url?: string | null;
  primary_text?: string | null;
  headline?: string | null;
  cta?: string | null;
  link_url?: string | null;
  page_id?: string | null;
  insights?: MetaInsightsRow | null;
  intel?: MetaAdIntel | null;
}

export type MetaTranscriptStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed';

export interface MetaAdIntel {
  id: string;
  clerk_user_id: string;
  ad_account_id: string;
  meta_ad_id: string;
  meta_creative_id: string | null;
  asset_type: MetaAdMediaKind | null;
  asset_url: string | null;
  thumbnail_url: string | null;
  ad_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  page_id: string | null;
  primary_text: string | null;
  headline: string | null;
  cta: string | null;
  link_url: string | null;
  effective_status: string | null;
  transcript: string | null;
  transcript_status: MetaTranscriptStatus;
  transcript_error: string | null;
  is_winner: boolean | null;
  notes: string | null;
  insights: MetaInsightsRow | null;
  insights_synced_at: string | null;
  // Comments mining (#5)
  comments_summary: string | null;
  comments_insights: MetaCommentsInsights | null;
  comments_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Comments mining (#5)
// ---------------------------------------------------------------------------

export interface MetaCommentsInsights {
  total: number;
  sentiment: {
    positive: number;
    negative: number;
    question: number;
    neutral: number;
  };
  top_objections: string[];
  top_questions: string[];
  praise: string[];
}

// ---------------------------------------------------------------------------
// Winner DNA Lab (#1)
// ---------------------------------------------------------------------------

export interface MetaDnaPatterns {
  hooks: string[];
  lengths?: { median_seconds?: number; range?: [number, number] } | null;
  ctas: string[];
  angles: string[];
  common_phrases: string[];
}

export interface MetaDnaData {
  winner_patterns: MetaDnaPatterns;
  loser_patterns: MetaDnaPatterns;
  comparison: string;
  comments_themes?: string[];
}

export interface MetaBrandDna {
  id: string;
  clerk_user_id: string;
  ad_account_id: string;
  winner_count: number;
  loser_count: number;
  unmarked_count: number;
  dna_data: MetaDnaData;
  brief: string | null;
  generated_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Performance time-series (#7)
// ---------------------------------------------------------------------------

export interface AdTimeSeriesRow {
  date: string;            // ISO date YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  reach?: number;
  purchases?: number;
  purchase_value?: number;
  roas?: number;
}

export interface CreateCampaignRequest {
  adAccountId: string;
  pageId: string;
  instagramId?: string | null;
  campaignName: string;
  objective:
    | 'OUTCOME_SALES'
    | 'OUTCOME_TRAFFIC'
    | 'OUTCOME_ENGAGEMENT'
    | 'OUTCOME_LEADS'
    | 'OUTCOME_AWARENESS';
  dailyBudgetCents: number;          // smallest currency unit
  link: string;
  cta?: string;                       // SHOP_NOW etc.
  uploadIds: string[];                // meta_uploads ids
  countries?: string[];               // ['US'] etc.
  targetingAgeMin?: number;
  targetingAgeMax?: number;
}

export interface CreateCampaignResponse {
  campaign_id: string;
  adset_id: string;
  ad_ids: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Multi-campaign launch (Kitchn-style grid)
// ---------------------------------------------------------------------------

export type CampaignObjective =
  | 'OUTCOME_SALES'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_AWARENESS';

/**
 * Solo se trabaja sobre campañas/ad sets que YA existen en la cuenta de Meta.
 * No creamos nuevos desde el wizard — eso se hace en Ads Manager.
 */
export interface CampaignTarget {
  id: string;
  name?: string;
}

export interface AdSetTarget {
  id: string;
  name?: string;
}

export interface AdRowIdentity {
  page_id?: string;
  instagram_actor_id?: string;
}

export interface LaunchAdRow {
  rowId: string;                   // client-side id for response mapping
  uploadId: string;                // meta_uploads.id (resuelto antes del launch)
  metadata: MetaAdMetadata;
  campaign: CampaignTarget;
  adset: AdSetTarget;
  identity?: AdRowIdentity;
}

export interface LaunchRequest {
  adAccountId: string;
  rows: LaunchAdRow[];
}

export interface LaunchRowResult {
  rowId: string;
  uploadId: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  error?: string;
}

export interface LaunchResponse {
  rows: LaunchRowResult[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Pages + IG accounts (identidad por anuncio)
// ---------------------------------------------------------------------------

export interface MetaPageSummary {
  id: string;
  name: string;
  picture_url: string | null;
  instagram?: { id: string; username: string } | null;
}

export interface ListPagesResponse {
  pages: MetaPageSummary[];
  default_page_id: string | null;
  default_instagram_id: string | null;
}

// ---------------------------------------------------------------------------
// Existing campaigns / adsets listing (for the grid dropdowns)
// ---------------------------------------------------------------------------

export interface MetaCampaignSummary {
  id: string;
  name: string;
  status?: string;
  objective?: string;
}

export interface MetaAdSetSummary {
  id: string;
  name: string;
  status?: string;
  campaign_id?: string;
  daily_budget?: string;
}

export interface ListCampaignsResponse {
  campaigns: MetaCampaignSummary[];
}

export interface ListAdSetsResponse {
  adsets: MetaAdSetSummary[];
}

// ---------------------------------------------------------------------------
// Drafts (persistencia de la grilla)
// ---------------------------------------------------------------------------

export type AdDraftStatus = 'draft' | 'launching' | 'launched' | 'failed';

export interface AdDraftRow {
  rowId: string;
  generationId: string;
  metadata: MetaAdMetadata;
  campaign: CampaignTarget;
  adset: AdSetTarget;
  identity?: AdRowIdentity;
}

export interface AdDraft {
  id: string;
  clerk_user_id: string;
  ad_account_id: string;
  name: string;
  rows: AdDraftRow[];
  status: AdDraftStatus;
  launched_at: string | null;
  result: LaunchResponse | null;
  created_at: string;
  updated_at: string;
}
