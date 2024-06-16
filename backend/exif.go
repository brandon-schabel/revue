createExifTableQuery := `
CREATE TABLE IF NOT EXISTS exif_data (
	id INTEGER PRIMARY KEY,
	dimensions TEXT,
	resolution TEXT,
	color_depth TEXT,
	date_taken TEXT, -- This field can be NULL
	camera_make TEXT,
	camera_model TEXT,
	lens_make TEXT,
	lens_model TEXT,
	focal_length TEXT,
	aperture TEXT,
	shutter_speed TEXT,
	iso TEXT,
	exposure_comp TEXT,
	flash TEXT,
	latitude TEXT,
	longitude TEXT,
	altitude TEXT,
	title TEXT,
	tags TEXT,
	description TEXT,
	categories TEXT,
	people TEXT,
	histogram_data TEXT,
	compression TEXT,
	color_profile TEXT,
	rating INTEGER,
	usage_rights TEXT,
	comments TEXT
);`

createTableQuery := `
CREATE TABLE IF NOT EXISTS images (
	id INTEGER PRIMARY KEY,
	file_name TEXT NOT NULL,
	file_path TEXT NOT NULL,
	file_size INTEGER NOT NULL,
	file_format TEXT NOT NULL,
	date_created TEXT NOT NULL,
	date_modified TEXT NOT NULL,
	hash TEXT NOT NULL,
	thumbnail_path TEXT NOT NULL,
	exif_data_id INTEGER, -- New field
	FOREIGN KEY(exif_data_id) REFERENCES exif_data(id)
);`

type ExifData struct {
    ID            int        `json:"id"`
    Dimensions    *string    `json:"dimensions"`
    Resolution    *string    `json:"resolution"`
    ColorDepth    *string    `json:"color_depth"`
    DateTaken     sql.NullTime `json:"date_taken"` // Use sql.NullTime for nullable time fields
    CameraMake    *string    `json:"camera_make"`
    CameraModel   *string    `json:"camera_model"`
    LensMake      *string    `json:"lens_make"`
    LensModel     *string    `json:"lens_model"`
    FocalLength   *string    `json:"focal_length"`
    Aperture      *string    `json:"aperture"`
    ShutterSpeed  *string    `json:"shutter_speed"`
    ISO           *string    `json:"iso"`
    ExposureComp  *string    `json:"exposure_comp"`
    Flash         *string    `json:"flash"`
    Latitude      *string    `json:"latitude"`
    Longitude     *string    `json:"longitude"`
    Altitude      *string    `json:"altitude"`
    Title         *string    `json:"title"`
    Tags          []string   `json:"tags"`
    Description   *string    `json:"description"`
    Categories    []string   `json:"categories"`
    People        []string   `json:"people"`
    HistogramData *string    `json:"histogram_data"`
    Compression   *string    `json:"compression"`
    ColorProfile  *string    `json:"color_profile"`
    Rating        *int       `json:"rating"`
    UsageRights   *string    `json:"usage_rights"`
    Comments      []string   `json:"comments"`
}


type IndexedFile struct {
    FileName      string     `json:"file_name"`
    FilePath      string     `json:"file_path"`
    FileSize      int64      `json:"file_size"`
    FileFormat    string     `json:"file_format"`
    DateCreated   time.Time  `json:"date_created"`
    DateModified  time.Time  `json:"date_modified"`
    Hash          string     `json:"hash"`
    ThumbnailPath string     `json:"thumbnail_path"`
    ExifDataID    *int       `json:"exif_data_id"` // New field
}


