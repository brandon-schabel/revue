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

app = Flask(__name__, static_folder='../client/dist', static_url_path='/')

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
        thumbnail_path TEXT NOT NULL
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
        hasher.update(file_path.encode())
        hasher.update(f.read())
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

def index_directory(path, reindex=False):
    conn = create_connection()
    cursor = conn.cursor()


    logger.info(f"Indexing directory: {path}")
    logger.info(f"Reindex flag: {reindex}")

    print({
        conn, cursor,
        path, reindex
    })

    for root, _, files in os.walk(path):
        for file in files:
            file_path = os.path.join(root, file)
            file_hash = create_image_hash(file_path)

            logger.debug(f"Processing file: {file_path}")
            logger.debug(f"File hash: {file_hash}")

            cursor.execute("SELECT id FROM files WHERE file_name = ? AND hash = ?", (file, file_hash))
            existing_file = cursor.fetchone()

            if existing_file:
                logger.info(f"File with same name and hash already exists; skipping: {file_path}")
                continue

            logger.info(f"Adding new file to database: {file_path}")

            try:
                thumbnail_path = generate_thumbnail(file_path)
            except Exception as e:
                print(f"Error processing file {file_path}: {e}")
                continue

            file_stat = os.stat(file_path)
            meta = {
                'file_name': file,
                'file_path': file_path,
                'file_size': file_stat.st_size,
                'file_format': os.path.splitext(file)[1],
                'date_created': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(file_stat.st_ctime)),
                'date_modified': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(file_stat.st_mtime)),
                'hash': file_hash,
                'thumbnail_path': thumbnail_path,
            }

            cursor.execute('''
            INSERT INTO files (file_name, file_path, file_size, file_format, date_created, date_modified, hash, thumbnail_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (meta['file_name'], meta['file_path'], meta['file_size'], meta['file_format'],
                  meta['date_created'], meta['date_modified'], meta['hash'], meta['thumbnail_path']))

    conn.commit()
    conn.close()

@app.route('/')
def serve_react_app():
    create_table()
    return app.send_static_file('index.html')

@app.route('/index', methods=['POST'])
def index_files_handler():
    data = request.json
    path = data.get('path')
    reindex = data.get('reindex', False)

    print({
        path, 
        reindex
    })

    if not path:
        return jsonify({"error": "No path provided"}), 400

    try:
        index_directory(path, reindex)
        return jsonify({"message": "Indexing complete"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/images', methods=['GET'])
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

@app.route('/list-directories', methods=['POST'])
def list_directories_handler():
    data = request.json
    path = data.get('path')

    if not path or not os.path.isdir(path):
        return jsonify({"error": "Invalid directory path"}), 400

    directories = []
    for root, dirs, _ in os.walk(path):
        directories.extend([os.path.join(root, d) for d in dirs])

    return jsonify(directories)

@app.route('/clear-files-index', methods=['POST'])
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

@app.route('/get-duplicate-images', methods=['GET'])
def get_duplicate_images():
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

@app.route('/thumbnails/<path:filename>')
def serve_thumbnail(filename):
    return send_from_directory(THUMBNAIL_DIR, filename)

if __name__ == '__main__':
    app.run(port=8080, debug=True)