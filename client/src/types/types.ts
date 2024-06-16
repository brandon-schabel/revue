export type Directory = {
    path: string
    redindex: boolean
  }
  
  
  export type ImageMetadata = {
    FileName: string;
    FilePath: string;
    FileSize: number;
    FileFormat: string;
    DateCreated: string;
    DateModified: string;
    Hash: string;
    ThumbnailPath: string;
    Dimensions?: string;
    Resolution?: string;
    ColorDepth?: string;
    DateTaken?: string;
    CameraMake?: string;
    CameraModel?: string;
    LensMake?: string;
    LensModel?: string;
    FocalLength?: string;
    Aperture?: string;
    ShutterSpeed?: string;
    ISO?: string;
    ExposureComp?: string;
    Flash?: string;
    Latitude?: string;
    Longitude?: string;
    Altitude?: string;
    Title?: string;
    Tags?: string[];
    Description?: string;
    Categories?: string[];
    People?: string[];
    HistogramData?: string;
    Compression?: string;
    ColorProfile?: string;
    Rating?: number;
    UsageRights?: string;
    Comments?: string[];
  }