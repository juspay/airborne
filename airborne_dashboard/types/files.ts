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

// Named file groups — a file group is a peer of a file: a named, reusable
// collection of files. Membership references rows in the files table, so a file
// does not belong to a group and may appear in any number of groups, or none.
export type FileGroupFile = {
  id: string;
  file_path: string;
  version: number;
  tag?: string | null;
  url: string;
  size: number;
  checksum: string;
};

export type FileGroupVersion2 = {
  version: number;
  metadata: Record<string, unknown>;
  files: FileGroupFile[];
  created_at: string;
};

export type NamedFileGroup = {
  /** Unique within the application — the group's identity */
  name: string;
  total_versions: number;
  latest?: FileGroupVersion2 | null;
  created_at: string;
  updated_at: string;
};

export type NamedFileGroupDetail = {
  name: string;
  versions: FileGroupVersion2[];
  created_at: string;
  updated_at: string;
};

export type NamedFileGroupsResponse = {
  data: NamedFileGroup[];
  total_items: number;
  total_pages: number;
};
