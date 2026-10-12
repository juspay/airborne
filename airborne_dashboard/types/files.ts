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

// File sets — a file set is a peer of a file: a named, reusable
// collection of files. Membership references rows in the files table, so a file
// does not belong to a set and may appear in any number of sets, or none.
export type FileSetFile = {
  id: string;
  file_path: string;
  version: number;
  tag?: string | null;
  url: string;
  size: number;
  checksum: string;
};

export type FileSetVersion = {
  version: number;
  metadata: Record<string, unknown>;
  files: FileSetFile[];
  created_at: string;
};

export type FileSet = {
  /** Unique within the application — the set's identity */
  name: string;
  total_versions: number;
  latest?: FileSetVersion | null;
  created_at: string;
  updated_at: string;
};

export type FileSetDetail = {
  name: string;
  versions: FileSetVersion[];
  created_at: string;
  updated_at: string;
};

export type FileSetsResponse = {
  data: FileSet[];
  total_items: number;
  total_pages: number;
};
