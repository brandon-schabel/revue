import os
import json
import time
import hashlib
import sqlite3
from flask import Flask, request, jsonify, send_from_directory
from PIL import Image
from PIL.ExifTags import TAGS
import secrets
import logging
import concurrent.futures
from functools import partial
import psutil
from flask_cors import CORS

app = Flask(__name__, static_folder='static', static_url_path='/')
# configure proper cors 
CORS(app) 

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


# Constants
THUMBNAIL_SIZE = (300, 300)
DB_NAME = 'imagedb.db'
THUMBNAIL_DIR = 'thumbnails'

def create_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def create_table():
    conn = create_connection()
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_format TEXT NOT NULL,
        date_created TEXT NOT NULL,
        date_modified TEXT NOT NULL,
        hash TEXT NOT NULL,
        thumbnail_path TEXT
    )
    ''')
    conn.commit()
    conn.close()

def generate_thumbnail(file_path):
    with Image.open(file_path) as img:
        img.thumbnail(THUMBNAIL_SIZE)
        if img.mode in ('RGBA', 'LA'):
            background = Image.new(img.mode[:-1], img.size, (255, 255, 255))
            background.paste(img, img.split()[-1])
            img = background.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        unique_id = secrets.token_hex(8)
        thumbnail_filename = f"{unique_id}_{os.path.splitext(os.path.basename(file_path))[0]}.jpg"
        thumbnail_path = os.path.join(THUMBNAIL_DIR, thumbnail_filename)
        os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)
        img.save(thumbnail_path, "JPEG")
    return thumbnail_path
    
def create_image_hash(file_path):
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        # Read and update in chunks of 4K
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def get_exif_data(image_path):
    with Image.open(image_path) as img:
        exif_data = {}
        if hasattr(img, '_getexif'):
            exif = img._getexif()
            if exif:
                for tag_id, value in exif.items():
                    tag = TAGS.get(tag_id, tag_id)
                    exif_data[tag] = str(value)  # Convert all values to strings for JSON serialization
    return exif_data


def index_directory(path):
    conn = create_connection()
    cursor = conn.cursor()

    logger.info(f"Indexing directory: {path}")

    # Create a set of existing file hashes for faster lookup
    cursor.execute("SELECT hash FROM files")
    existing_hashes = set(row[0] for row in cursor.fetchall())

    def process_files(files, root):
        for file in files:
            file_path = os.path.join(root, file)
            file_hash = create_image_hash(file_path)

            if file_hash in existing_hashes:
                logger.info(f"File with same hash already exists; skipping: {file_path}")
                continue

            logger.info(f"Adding new file to database: {file_path}")

            thumbnail_path = None
            try:
                # Attempt to open the file as an image
                with Image.open(file_path) as img:
                    # If successful, generate thumbnail
                    thumbnail_path = generate_thumbnail(file_path)
            except Exception as e:
                # If file is not an image or there's an error, log it and continue
                logger.info(f"Could not generate thumbnail for {file_path}: {e}")

            file_stat = os.stat(file_path)
            yield {
                'file_name': file,
                'file_path': file_path,
                'file_size': file_stat.st_size,
                'file_format': os.path.splitext(file)[1],
                'date_created': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(file_stat.st_ctime)),
                'date_modified': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(file_stat.st_mtime)),
                'hash': file_hash,
                'thumbnail_path': thumbnail_path,
            }

    with concurrent.futures.ThreadPoolExecutor() as executor:
        for root, _, files in os.walk(path):
            future_to_files = {executor.submit(process_files, files, root): files}
            for future in concurrent.futures.as_completed(future_to_files):
                try:
                    for meta in future.result():
                        cursor.execute('''
                        INSERT INTO files (file_name, file_path, file_size, file_format, date_created, date_modified, hash, thumbnail_path)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (meta['file_name'], meta['file_path'], meta['file_size'], meta['file_format'],
                              meta['date_created'], meta['date_modified'], meta['hash'], meta['thumbnail_path']))
                except Exception as exc:
                    logger.error(f'Generated an exception: {exc}')

    conn.commit()
    conn.close()


@app.route('/')
def serve_react_app():
    create_table()
    return app.send_static_file('index.html')

@app.route('/api/v1/index-files', methods=['POST'])
def index_files_handler():
    data = request.json
    path = data.get('path')

    if not path:
        return jsonify({"error": "No path provided"}), 400

    try:
        index_directory(path)
        return jsonify({"message": "Indexing complete"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/images', methods=['GET'])
def get_images_handler():
    conn = create_connection()
    cursor = conn.cursor()
    cursor.execute('''
    SELECT id, file_name, file_path, file_size, file_format, date_created, date_modified, hash, thumbnail_path
    FROM files
    ''')
    
    rows = cursor.fetchall()
    print(f"Number of rows fetched: {len(rows)}")  # Debug print
    
    files = [dict(row) for row in rows]
    conn.close()
    
    print(f"Number of files processed: {len(files)}")  # Debug print
    return jsonify(files)

@app.route('/api/v1/list-directory', methods=['POST'])
def list_directory_handler():
    data = request.json
    path = data.get('path', '/')  # Default to root if no path is provided

    # Clean up the path
    path = os.path.normpath(path)

    logger.info(f"Listing directory contents for path: {path}")

    if not os.path.isdir(path):
        return jsonify({"error": "Invalid directory path"}), 400

    try:
        directories = []
        files = []
        with os.scandir(path) as entries:
            for entry in entries:
                if entry.is_dir():
                    directories.append({
                        "name": entry.name,
                        "path": entry.path
                    })
                else:
                    stat = entry.stat()
                    files.append({
                        "name": entry.name,
                        "path": entry.path,
                        "size": stat.st_size,
                        "lastModified": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(stat.st_mtime)),
                        "isDirectory": False
                    })
        
        return jsonify({
            "currentPath": path,
            "parentPath": os.path.dirname(path) if path != '/' else None,
            "directories": sorted(directories, key=lambda x: x['name'].lower()),
            "files": sorted(files, key=lambda x: x['name'].lower())
        }), 200
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    except Exception as e:
        return jsonify({"error": f"Failed to list directory contents: {str(e)}"}), 500

@app.route('/api/v1/list-drives', methods=['GET'])
def list_drives():
    try:
        drives = []
        partitions = psutil.disk_partitions(all=False)
        for partition in partitions:
            if partition.mountpoint != '/':
                drives.append({
                    "path": partition.mountpoint,
                    "device": partition.device,
                    "fstype": partition.fstype
                })
        return jsonify(drives), 200
    except Exception as e:
        return jsonify({"error": f"Failed to list drives: {str(e)}"}), 500

@app.route('/api/v1/clear-files-index', methods=['POST'])
def clear_files_index():
    try:
        conn = create_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM files')
        conn.commit()
        conn.close()
        return jsonify({"message": "All files cleared from the index"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to clear files index: {str(e)}"}), 500

@app.route('/api/v1/get-duplicate-files', methods=['GET'])
def get_duplicate_files():
    try:
        conn = create_connection()
        cursor = conn.cursor()
        
        # Query to find hashes that occur more than once and get all associated image data
        cursor.execute('''
        SELECT id, file_name, file_path, file_size, file_format, date_created, date_modified, hash, thumbnail_path
        FROM files
        WHERE hash IN (
            SELECT hash
            FROM files
            GROUP BY hash
            HAVING COUNT(*) > 1
        )
        ORDER BY hash, file_name
        ''')
        
        rows = cursor.fetchall()
        conn.close()
        
        # Group the results by hash
        duplicates = {}
        for row in rows:
            hash_value = row['hash']
            if hash_value not in duplicates:
                duplicates[hash_value] = []
            duplicates[hash_value].append(dict(row))
        
        # Convert to a list of groups for easier frontend processing
        result = list(duplicates.values())
        
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve duplicate images: {str(e)}"}), 500

@app.route('/api/v1/delete-file', methods=['POST'])
def delete_file():
    try:
        data = request.json
        file_path = data.get('filePath')

        if not file_path:
            return jsonify({"error": "No file path provided"}), 400

        # Check if file exists
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404

        # Delete the file
        os.remove(file_path)

        # Remove the file entry from the database
        conn = create_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM files WHERE file_path = ?', (file_path,))
        conn.commit()
        conn.close()

        # If there's an associated thumbnail, delete it too
        thumbnail_path = os.path.join(THUMBNAIL_DIR, os.path.basename(file_path))
        if os.path.exists(thumbnail_path):
            os.remove(thumbnail_path)

        return jsonify({"message": "File deleted successfully"}), 200
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return jsonify({"error": f"Failed to delete file: {str(e)}"}), 500

@app.route('/thumbnails/<path:filename>')
def serve_thumbnail(filename):
    return send_from_directory(THUMBNAIL_DIR, filename)

if __name__ == '__main__':
    app.run(port=8080, debug=True)