export type Directory = {
	name: string;
	path: string;
};

export type Drive = {
	path: string;
	device: string;
	fstype: string;
};

export type FileInfo = {
	name: string;
	path: string;
	size: number;
	lastModified: string;
	isDirectory: boolean;
};

export type DirectoryContents = {
	currentPath: string;
	parentPath: string | null;
	directories: Directory[];
	files: FileInfo[];
};

export type ImageAnalysis = {
  description: string;
  subjects: string[];
  colors: string[];
  mood: string[];
  composition: string;
  text: string[];
  tags: string[];
  categories: string[];
  quality: string;
  uniqueFeatures: string[];
};

export type IndexedFileMetadata = {
	id: number;
	file_name: string;
	file_path: string;
	file_size: number;
	file_format: string;
	date_created: string;
	date_modified: string;
	hash: string;
	thumbnail_path: string;
	analysis: ImageAnalysis | null;
};
