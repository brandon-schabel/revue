export type Directory = {
    path: string
    redindex: boolean
  }
  
  
  export type FileMetadata = {
    file_name: string;
    file_path : string;
    file_size: number;
    file_format: string;
    date_created: string;
    date_modified: string;
    hash: string;
    thumbnail_path: string;
  }