// client/src/types/index.ts

export type RenderFormat = 'png' | 'svg' | 'jpg' | 'pdf';
export type ChangeStatus = 'baseline' | 'unchanged' | 'changed';

export interface Component {
  id: number;
  name: string;
  file_key: string;
  file_name?: string;
  node_id: string;
  node_type?: string;
  format: string;
  scale: number;
  figma_url?: string;
  folder_path?: string;
  created_at?: string;
  latestFetch?: FetchRecord | null;
  previousFetch?: FetchRecord | null;
  totalFetches?: number;
}

export interface FetchRecord {
  id: number;
  component_id: number;
  image_path: string;
  file_hash?: string;
  width?: number;
  height?: number;
  has_changes: number | boolean;
  change_status: ChangeStatus;
  diff_pixels?: number;
  diff_percentage?: number;
  diff_image_path?: string | null;
  diff_boxes_json?: string;
  previous_fetch_id?: number | null;
  figma_last_modified?: string | null;
  fetched_at: string;
}

export interface DiffResult {
  hasChanges: boolean;
  changeStatus: ChangeStatus;
  diffPixels: number;
  diffPercentage: number;
  diffImagePath?: string | null;
  boundingBoxes?: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface AppConfig {
  hasDefaultToken: boolean;
}

export type TokenStatusType = 'checking' | 'custom' | 'default' | 'missing';

export interface TokenStatusInfo {
  type: TokenStatusType;
  label: string;
  className: 'checking' | 'connected' | 'disconnected';
  placeholder: string;
}

export interface BatchResultItem {
  componentId: number;
  success: boolean;
  component?: Component;
  currentFetch?: FetchRecord;
  previousFetch?: FetchRecord | null;
  name?: string;
  nodeId?: string;
  error?: string;
}

export interface BatchSummary {
  total: number;
  changed: number;
  unchanged: number;
  baseline: number;
  errors: number;
}

export interface FetchRun {
  id: number;
  trigger_type: 'all' | 'folder' | 'single';
  target_name: string;
  status: 'running' | 'completed' | 'failed';
  total_items: number;
  changed_count: number;
  unchanged_count: number;
  baseline_count: number;
  error_count: number;
  started_at: string;
  completed_at?: string | null;
}

export interface RunItemRecord extends FetchRecord {
  component_name: string;
  file_name?: string;
  file_key?: string;
  node_id: string;
  folder_path?: string;
  prev_image_path?: string | null;
}

export interface RunDetailsResponse {
  success: boolean;
  run: FetchRun;
  items: RunItemRecord[];
}

export interface BatchResponse {
  success: boolean;
  summary?: BatchSummary;
  results: BatchResultItem[];
  error?: string;
}

export interface CreateComponentPayload {
  name?: string;
  fileKey: string;
  fileName?: string;
  nodeId: string;
  format?: string;
  scale?: number;
  figmaUrl?: string;
  folderPath?: string;
  fetchNow?: boolean;
  token?: string;
}

export interface UpdateComponentPayload {
  name?: string;
  fileKey?: string;
  fileName?: string;
  nodeId?: string;
  format?: string;
  scale?: number;
  figmaUrl?: string;
  folderPath?: string;
}

export interface DirectFetchPayload {
  token?: string;
  fileKey: string;
  fileName?: string;
  nodeId: string;
  format?: string;
  scale?: number;
  name?: string;
  figmaUrl?: string;
  folderPath?: string;
}

export interface FolderTreeNode {
  type: 'folder';
  path: string;
  name: string;
  depth: number;
  subfolders: FolderTreeNode[];
  components: Component[];
  totalComponentCount: number;
}

export interface TreeData {
  folders: FolderTreeNode[];
  rootComponents: Component[];
}

export interface ComponentFetchResponse {
  success: boolean;
  component: Component;
  currentFetch: FetchRecord;
  previousFetch: FetchRecord | null;
  imageUrl?: string;
  fileKey?: string;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  fileName?: string;
  format?: string;
  scale?: number;
  timestamp?: string;
  error?: string;
}

export interface ComponentHistoryResponse {
  success: boolean;
  component: Component;
  history: FetchRecord[];
  error?: string;
}

export interface CompareResult {
  component: Component;
  fetchA: FetchRecord | null;
  fetchB: FetchRecord;
}

export interface TransientStatus {
  status: 'queued' | 'loading';
  label?: string;
}

export interface CollabConfig {
  success: boolean;
  collabUrl: string;
  hasToken: boolean;
}

export interface VerifyParentResponse {
  success: boolean;
  pageId: string;
  title: string;
  spaceKey: string;
  spaceName: string;
  url: string;
  error?: string;
}

export interface PublishCollabPayload {
  runId: number;
  parentPageId: string;
  pageTitle?: string;
  collabUrl?: string;
  token?: string;
  attachWorkspace?: boolean;
}

export interface PublishCollabResponse {
  success: boolean;
  pageId: string;
  title: string;
  spaceKey: string;
  parentTitle: string;
  pageUrl: string;
  totalAttached: number;
  itemsCount: number;
  attachedWorkspace?: string | null;
  error?: string;
}

export interface DataSource {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string;
  isActive: boolean;
  sizeBytes?: number;
  componentCount?: number;
}

export interface DataSourcesResponse {
  success: boolean;
  datasources: DataSource[];
}


