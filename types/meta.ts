export type MetaConnectionStatus = 'active' | 'expired' | 'revoked';

export interface MetaConnection {
  id: string;
  clerk_user_id: string;
  fb_user_id: string;
  fb_user_name: string | null;
  token_expires_at: string | null;
  default_ad_account_id: string | null;
  scopes: string[] | null;
  status: MetaConnectionStatus;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaAdAccount {
  id: string;            // e.g. act_1234567890
  account_id: string;    // numeric portion
  name: string;
  currency?: string;
  business_name?: string | null;
}

export type MetaUploadStatus = 'pending' | 'uploading' | 'processing' | 'ready' | 'failed';

export type MetaAssetType = 'image' | 'video';

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
  created_at: string;
  updated_at: string;
}

export interface BulkUploadRequest {
  generationIds: string[];
  adAccountId: string;
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
  fb_user_name: string | null;
}

export interface RequiresReconnectResponse {
  requiresReconnect: true;
  error?: string;
}
