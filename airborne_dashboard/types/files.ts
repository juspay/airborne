// File Group Types - Shared across dashboard

export type FileGroupVersion = {
  version: number;
  url: string;
  size: number;
  checksum: string;
  created_at: string;
};

export type FileGroupTag = {
  tag: string;
  version: number;
};

export type FileGroup = {
  file_path: string;
  versions: FileGroupVersion[];
  tags: FileGroupTag[];
  total_versions: number;
};

export type FileGroupsResponse = {
  groups: FileGroup[];
  total_items: number;
  total_pages: number;
};

export type TagInfo = {
  tag: string;
  count: number;
};

export type TagsResponse = {
  data: TagInfo[];
  total_items: number;
  total_pages: number;
};

export type SelectedFile = {
  file_path: string;
  version: number;
  url: string;
  tag?: string;
};

// API Request Types
export type ListFileGroupsQuery = {
  page?: number;
  count?: number;
  search?: string;
  tags?: string;
};

export type ListTagsQuery = {
  page?: number;
  count?: number;
  search?: string;
};
