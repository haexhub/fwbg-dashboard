export type SourceType = "csv" | "rest" | "websocket" | "database";

export interface FileInfo {
  name: string;
  size: number;
  modified: number;
}

export interface DataSourceBase {
  name: string;
  type: SourceType;
  description: string;
}

export interface CSVSource extends DataSourceBase {
  type: "csv";
  path: string;
  file_pattern: string;
  timeframe_map: Record<string, string>;
  file_count?: number;
  files?: FileInfo[];
  raw_file_count?: number;
  raw_files?: FileInfo[];
}

export interface RESTSource extends DataSourceBase {
  type: "rest";
  base_url: string;
  api_key: string;
  api_key_param: string;
  api_key_header: string;
  headers: Record<string, string>;
  endpoints: Record<string, string>;
  rate_limit: number;
  timeout: number;
}

export interface WebSocketSource extends DataSourceBase {
  type: "websocket";
  url: string;
  headers: Record<string, string>;
  subscribe_message: Record<string, unknown>;
  heartbeat_interval: number;
  reconnect_delay: number;
  max_reconnect_attempts: number;
}

export interface DBSource extends DataSourceBase {
  type: "database";
  connection_string: string;
  driver: string;
}

export type DataSource = CSVSource | RESTSource | WebSocketSource | DBSource;

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  csv: "CSV",
  rest: "REST API",
  websocket: "WebSocket",
  database: "Datenbank",
};

export const SOURCE_TYPE_ICONS: Record<SourceType, string> = {
  csv: "i-heroicons-document-text",
  rest: "i-heroicons-globe-alt",
  websocket: "i-heroicons-signal",
  database: "i-heroicons-circle-stack",
};
