package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/nfnt/resize"
	"github.com/rwcarlsen/goexif/exif"
)

func main() {
	fs := http.FileServer(http.Dir("../client/dist"))

	http.HandleFunc("/index", indexImagesHandler)
	http.HandleFunc("/images", getImagesHandler)
	http.Handle("/", fs)

	log.Println("Listening on :8080...")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal(err)
	}
}

/******* handlers  *********/

func indexImagesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	body, err := ioutil.ReadAll(r.Body)
	// log body
	log.Println("Body:", string(body))

	if err != nil {
		http.Error(w, "Error reading request body", http.StatusInternalServerError)
		return
	}

	var dir Directory
	err = json.Unmarshal(body, &dir)
	if err != nil {
		http.Error(w, "Error parsing request body", http.StatusBadRequest)
		return
	}

	err = indexDirectory(dir.Path, dir.Reindex)
	if err != nil {
		http.Error(w, "Error indexing directory", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func getImagesHandler(w http.ResponseWriter, r *http.Request) {
    db, err := sql.Open("sqlite3", "./imagedb.db")
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    defer db.Close()

    query := `SELECT
                id, file_name, file_path, file_size, file_format, date_created, date_modified, 
                hash, thumbnail_path, dimensions, resolution, color_depth, date_taken, 
                camera_make, camera_model, lens_make, lens_model, focal_length, aperture, 
                shutter_speed, iso, exposure_comp, flash, latitude, longitude, altitude, 
                title, tags, description, categories, people, histogram_data, compression, 
                color_profile, rating, usage_rights, comments 
              FROM images`

    rows, err := db.Query(query)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    var images []ImageMetadata
    for rows.Next() {
        var img ImageMetadata
        var id int              // Temporary variable for the id field
        var dateCreated, dateModified string // Temporary strings for dates
        var tags, categories, people, comments string

        err = rows.Scan(
            &id, &img.FileName, &img.FilePath, &img.FileSize, &img.FileFormat, 
            &dateCreated, &dateModified, &img.Hash, &img.ThumbnailPath, 
            &img.Dimensions, &img.Resolution, &img.ColorDepth, &img.DateTaken,
            &img.CameraMake, &img.CameraModel, &img.LensMake, &img.LensModel, 
            &img.FocalLength, &img.Aperture, &img.ShutterSpeed, &img.ISO, 
            &img.ExposureComp, &img.Flash, &img.Latitude, &img.Longitude, 
            &img.Altitude, &img.Title, &tags, &img.Description, 
            &categories, &people, &img.HistogramData, &img.Compression,
            &img.ColorProfile, &img.Rating, &img.UsageRights, &comments)
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }

        // Parse date strings into time.Time values
        img.DateCreated, err = time.Parse(time.RFC3339, dateCreated)
        if err != nil {
            http.Error(w, "Invalid date_created format", http.StatusInternalServerError)
            return
        }

        img.DateModified, err = time.Parse(time.RFC3339, dateModified)
        if err != nil {
            http.Error(w, "Invalid date_modified format", http.StatusInternalServerError)
            return
        }

        // No need to check for empty string, sql.NullTime will handle null values
        if img.DateTaken.Valid {
            img.DateTaken.Time = img.DateTaken.Time // DateTaken is already accessible through the time field
        }

        // Parse the string fields into slices
        img.Tags = strings.Split(tags, ",")
        img.Categories = strings.Split(categories, ",")
        img.People = strings.Split(people, ",")
        img.Comments = strings.Split(comments, ",")

        images = append(images, img)
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(images)
}


/*
****
FUNCTIONS
***
*/
func nilIfNullTime(t sql.NullTime) interface{} {
    if !t.Valid {
        return nil
    }
    return t.Time.Format(time.RFC3339)
}

func generateThumbnail(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return "", err
	}

	thumbnail := resize.Thumbnail(100, 100, img, resize.Lanczos3)

	// Generate a unique ID for the thumbnail
	b := make([]byte, 16)
	_, err = rand.Read(b)
	if err != nil {
		return "", err
	}
	uniqueID := fmt.Sprintf("%x", b)

	thumbnailPath := filepath.Join("thumbnails", uniqueID+"_"+filepath.Base(filePath))

	// Create the thumbnails directory if it does not exist
	if err := os.MkdirAll(filepath.Dir(thumbnailPath), 0755); err != nil {
		return "", err
	}

	thumbFile, err := os.Create(thumbnailPath)
	if err != nil {
		return "", err
	}
	defer thumbFile.Close()

	err = jpeg.Encode(thumbFile, thumbnail, nil)
	if err != nil {
		return "", err
	}

	return thumbnailPath, nil
}

func createImageHash(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	hasher := sha256.New()
	_, err = ioutil.ReadAll(f)
	if err != nil {
		return "", err
	}

	_, err = f.Seek(0, 0) // Reset the file pointer after reading its contents
	if err != nil {
		return "", err
	}

	if _, err := hasher.Write([]byte(filePath)); err != nil {
		return "", err
	}

	hash := hex.EncodeToString(hasher.Sum(nil))
	return hash, nil
}

func indexDirectory(path string, reindex bool) error {
    db, err := sql.Open("sqlite3", "./imagedb.db")
    if err != nil {
        return err
    }
    defer db.Close()

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

    _, err = db.Exec(createTableQuery)
    if err != nil {
        return err
    }

    err = filepath.Walk(path, func(filePath string, info os.FileInfo, err error) error {
        if err != nil {
            return err
        }

        if !info.IsDir() {
            hash, err := createImageHash(filePath)
            if err != nil {
                log.Println("Error creating hash for file:", err)
                return nil
            }

            var existingID int

            if !reindex {
                err = db.QueryRow("SELECT id FROM images WHERE hash = ?", hash).Scan(&existingID)

                if err == nil {
                    log.Println("Duplicate image found; skipping:", filePath)
                    return nil
                }

                if err != sql.ErrNoRows {
                    log.Println("Error checking for duplicate hash:", err)
                    return err
                }

            }

            thumbnailPath, err := generateThumbnail(filePath)
            if err != nil {
                log.Println("Error generating thumbnail for file:", err)
                return nil
            }

            f, err := os.Open(filePath)
            if err != nil {
                log.Println("Error opening file:", err)
                return nil
            }
            defer f.Close()

			meta := ImageMetadata{
				FileName:      info.Name(),
				FilePath:      filePath,
				FileSize:      info.Size(),
				FileFormat:    filepath.Ext(filePath),
				DateCreated:   info.ModTime(),
				DateModified:  info.ModTime(),
				Hash:          hash,
				ThumbnailPath: thumbnailPath,
			}
			
			exifData, err := exif.Decode(f)
			if err == nil {
				if camMake, err := exifData.Get(exif.Make); err == nil {
					makeStr := camMake.String()
					meta.CameraMake = &makeStr
				}
				if camModel, err := exifData.Get(exif.Model); err == nil {
					modelStr := camModel.String()
					meta.CameraModel = &modelStr
				}
				if dateTaken, err := exifData.DateTime(); err == nil {
					meta.DateTaken = sql.NullTime{Time: dateTaken, Valid: true}
				} else {
					meta.DateTaken = sql.NullTime{Valid: false}
				}
			} else {
				meta.DateTaken = sql.NullTime{Valid: false}
			}
			

		            insertQuery := `
		    INSERT INTO images (
		        file_name, file_path, file_size, file_format, date_created, date_modified, hash, thumbnail_path, dimensions, resolution, color_depth, 
		        date_taken, camera_make, camera_model, lens_make, lens_model, focal_length, aperture, shutter_speed, iso, exposure_comp, flash, 
		        latitude, longitude, altitude, title, tags, description, categories, people, histogram_data, compression, color_profile, rating, usage_rights, comments
		    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			
		_, err = db.Exec(insertQuery,
		    meta.FileName, meta.FilePath, meta.FileSize, meta.FileFormat,
		    meta.DateCreated.Format(time.RFC3339), meta.DateModified.Format(time.RFC3339),
		    meta.Hash, meta.ThumbnailPath,
		    meta.Dimensions, meta.Resolution, meta.ColorDepth, 
		    nilIfNullTime(meta.DateTaken),
		    meta.CameraMake, meta.CameraModel, meta.LensMake,
		    meta.LensModel, meta.FocalLength, meta.Aperture, meta.ShutterSpeed, meta.ISO,
		    meta.ExposureComp, meta.Flash, meta.Latitude, meta.Longitude, meta.Altitude, meta.Title, strings.Join(meta.Tags, ","),
		    meta.Description, strings.Join(meta.Categories, ","), strings.Join(meta.People, ","),
		    meta.HistogramData, meta.Compression, meta.ColorProfile, meta.Rating, meta.UsageRights,
		    strings.Join(meta.Comments, ","))

            if err != nil {
                log.Println("Error storing metadata in database:", err)
                return nil
            }
        }
        return nil
    })

    return err
}

/**** TYPES ****/
type ImageMetadata struct {
    FileName      string     `json:"file_name"`
    FilePath      string     `json:"file_path"`
    FileSize      int64      `json:"file_size"`
    FileFormat    string     `json:"file_format"`
    DateCreated   time.Time  `json:"date_created"`
    DateModified  time.Time  `json:"date_modified"`
    Hash          string     `json:"hash"`
    ThumbnailPath string     `json:"thumbnail_path"`
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

type Directory struct {
	Path    string `json:"path"`
	Reindex bool   `json:"reindex"`
}
