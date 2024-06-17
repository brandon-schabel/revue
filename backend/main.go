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
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/nfnt/resize"
)

func main() {
	fs := http.FileServer(http.Dir("../client/dist"))
	thumbnailServer := http.FileServer(http.Dir("./thumbnails"))

	http.HandleFunc("/index", indexFilesHandler)
	http.HandleFunc("/images", getImagesHandler)
	http.Handle("/", fs)
	http.Handle("/thumbnails/", http.StripPrefix("/thumbnails/", thumbnailServer))
	http.HandleFunc("/list-directories", listDirectoriesHandler)

	log.Println("Listening on :8080...")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal(err)
	}
}

/******* handlers  *********/

type IndexFileHandlerRequestBody struct {
	Path    string `json:"path"`
	Reindex bool   `json:"reindex"`
}

func indexFilesHandler(w http.ResponseWriter, r *http.Request) {
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
	var reindex bool

	var requestBody IndexFileHandlerRequestBody
	
	err = json.Unmarshal(body, &requestBody)
	dir.Path = requestBody.Path
	reindex = requestBody.Reindex

	if err != nil {
		http.Error(w, "Error parsing request body", http.StatusBadRequest)
		return
	}

	err = indexDirectory(dir.Path, reindex)
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
                hash, thumbnail_path
              FROM files`

	rows, err := db.Query(query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var files []IndexedFile
	for rows.Next() {
		var img IndexedFile
		var id int                           // Temporary variable for the id field
		var dateCreated, dateModified string // Temporary strings for dates

		err = rows.Scan(
			&id, &img.FileName, &img.FilePath, &img.FileSize, &img.FileFormat,
			&dateCreated, &dateModified, &img.Hash, &img.ThumbnailPath)
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

		files = append(files, img)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func listDirectoriesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	body, err := ioutil.ReadAll(r.Body)
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

	info, err := os.Stat(dir.Path)
	if err != nil {
		http.Error(w, "Error accessing path", http.StatusInternalServerError)
		return
	}

	if !info.IsDir() {
		http.Error(w, "Path is not a directory", http.StatusBadRequest)
		return
	}

	var directories []string

	err = filepath.Walk(dir.Path, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			directories = append(directories, path)
		}

		return nil
	})

	if err != nil {
		http.Error(w, "Error listing directories", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(directories)
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

	thumbnail := resize.Thumbnail(300, 300, img, resize.Lanczos3)

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
    CREATE TABLE IF NOT EXISTS files (
		id INTEGER PRIMARY KEY,
		file_name TEXT NOT NULL,
		file_path TEXT NOT NULL,
		file_size INTEGER NOT NULL,
		file_format TEXT NOT NULL,
		date_created TEXT NOT NULL,
		date_modified TEXT NOT NULL,
		hash TEXT NOT NULL,
		thumbnail_path TEXT NOT NULL
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

			meta := IndexedFile{
				FileName:      info.Name(),
				FilePath:      filePath,
				FileSize:      info.Size(),
				FileFormat:    filepath.Ext(filePath),
				DateCreated:   info.ModTime(),
				DateModified:  info.ModTime(),
				Hash:          hash,
				ThumbnailPath: thumbnailPath,
			}

			insertQuery := `
		    INSERT INTO files (
		        file_name, file_path, file_size, file_format, date_created, date_modified, hash, thumbnail_path
		    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

			_, err = db.Exec(insertQuery,
				meta.FileName, meta.FilePath, meta.FileSize, meta.FileFormat,
				meta.DateCreated.Format(time.RFC3339), meta.DateModified.Format(time.RFC3339),
				meta.Hash, meta.ThumbnailPath)

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
type IndexedFile struct {
	FileName      string    `json:"file_name"`
	FilePath      string    `json:"file_path"`
	FileSize      int64     `json:"file_size"`
	FileFormat    string    `json:"file_format"`
	DateCreated   time.Time `json:"date_created"`
	DateModified  time.Time `json:"date_modified"`
	Hash          string    `json:"hash"`
	ThumbnailPath string    `json:"thumbnail_path"`
}

type Directory struct {
	Path string `json:"path"`
}
