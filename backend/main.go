package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"image"
    "image/jpeg"
	_ "image/png"
    "crypto/rand"
	"fmt"

	"github.com/nfnt/resize"
	"github.com/rwcarlsen/goexif/exif"
	_ "github.com/mattn/go-sqlite3"
)

type ImageMetadata struct {
    FileName      string    `json:"file_name"`
    FilePath      string    `json:"file_path"`
    FileSize      int64     `json:"file_size"`
    FileFormat    string    `json:"file_format"`
    Dimensions    string    `json:"dimensions"`
    Resolution    string    `json:"resolution"`
    ColorDepth    string    `json:"color_depth"`
    DateCreated   time.Time `json:"date_created"`
    DateModified  time.Time `json:"date_modified"`
    DateTaken     time.Time `json:"date_taken"`
    CameraMake    string    `json:"camera_make"`
    CameraModel   string    `json:"camera_model"`
    LensMake      string    `json:"lens_make"`
    LensModel     string    `json:"lens_model"`
    FocalLength   string    `json:"focal_length"`
    Aperture      string    `json:"aperture"`
    ShutterSpeed  string    `json:"shutter_speed"`
    ISO           string    `json:"iso"`
    ExposureComp  string    `json:"exposure_comp"`
    Flash         string    `json:"flash"`
    Latitude      string    `json:"latitude"`
    Longitude     string    `json:"longitude"`
    Altitude      string    `json:"altitude"`
    Title         string    `json:"title"`
    Tags          []string  `json:"tags"`
    Description   string    `json:"description"`
    Categories    []string  `json:"categories"`
    People        []string  `json:"people"`
    HistogramData string    `json:"histogram_data"`
    Compression   string    `json:"compression"`
    ColorProfile  string    `json:"color_profile"`
    Rating        int       `json:"rating"`
    UsageRights   string    `json:"usage_rights"`
    Comments      []string  `json:"comments"`
    Hash          string    `json:"hash"`
    ThumbnailPath string    `json:"thumbnail_path"`
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

    thumbnailPath := filepath.Join("thumbnails", uniqueID + "_" + filepath.Base(filePath))

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

type Directory struct {
	Path   string `json:"path"`
	Reindex bool   `json:"reindex"`
}

func main() {
	fs := http.FileServer(http.Dir("../client/dist"))
	
	http.HandleFunc("/index", indexHandler)
	http.Handle("/", fs)


	log.Println("Listening on :8080...")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal(err)
	}
}

func indexHandler(w http.ResponseWriter, r *http.Request) {
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
        file_name TEXT,
        file_path TEXT,
        file_size INTEGER,
        file_format TEXT,
        dimensions TEXT,
        resolution TEXT,
        color_depth TEXT,
        date_created TEXT,
        date_modified TEXT,
        date_taken TEXT,
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
        comments TEXT,
        hash TEXT UNIQUE,
        thumbnail_path TEXT
    )`

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

			if(!reindex) {
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
                ThumbnailPath: thumbnailPath, // Store the thumbnail path
            }

            x, err := exif.Decode(f)
            if err == nil {
                if camMake, err := x.Get(exif.Make); err == nil {
                    meta.CameraMake = camMake.String()
                }
                if camModel, err := x.Get(exif.Model); err == nil {
                    meta.CameraModel = camModel.String()
                }
            }

            insertQuery := `
            INSERT INTO images (
                file_name, file_path, file_size, file_format, dimensions, resolution, color_depth, 
                date_created, date_modified, date_taken, camera_make, camera_model, lens_make, 
                lens_model, focal_length, aperture, shutter_speed, iso, exposure_comp, flash, 
                latitude, longitude, altitude, title, tags, description, categories, people, 
                histogram_data, compression, color_profile, rating, usage_rights, comments, hash, 
                thumbnail_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            _, err = db.Exec(insertQuery, 
                meta.FileName, meta.FilePath, meta.FileSize, meta.FileFormat, meta.Dimensions, 
                meta.Resolution, meta.ColorDepth, meta.DateCreated, meta.DateModified, meta.DateTaken, 
                meta.CameraMake, meta.CameraModel, meta.LensMake, meta.LensModel, meta.FocalLength, 
                meta.Aperture, meta.ShutterSpeed, meta.ISO, meta.ExposureComp, meta.Flash, 
                meta.Latitude, meta.Longitude, meta.Altitude, meta.Title, strings.Join(meta.Tags, ","), 
                meta.Description, strings.Join(meta.Categories, ","), strings.Join(meta.People, ","), 
                meta.HistogramData, meta.Compression, meta.ColorProfile, meta.Rating, meta.UsageRights, 
                strings.Join(meta.Comments, ","), meta.Hash, meta.ThumbnailPath)
            if err != nil {
                log.Println("Error storing metadata in database:", err)
                return nil
            }
        }
        return nil
    })

    return err
}

