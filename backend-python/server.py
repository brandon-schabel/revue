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
from dotenv import load_dotenv
import requests  
import base64
from anthropic import Anthropic
import io
import re


app = Flask(__name__, static_folder='static', static_url_path='/')
# configure proper cors 
# all localhost:3000 request in development 
# if os.environ.get('FLASK_ENV') == 'development':
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
load_dotenv()

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


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
    
    # Create files table (unchanged)
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

    # Check if image_analysis table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='image_analysis'")
    table_exists = cursor.fetchone()

    if table_exists:
        # Alter existing table
        try:
            cursor.execute('ALTER TABLE image_analysis RENAME COLUMN category TO categories')
        except sqlite3.OperationalError:
            # Column might already be renamed, ignore the error
            pass
    else:
        # Create new table with updated schema
        cursor.execute('''
        CREATE TABLE image_analysis (
            hash TEXT PRIMARY KEY,
            description TEXT,
            subjects TEXT,
            colors TEXT,
            mood TEXT,
            composition TEXT,
            visible_text TEXT,
            tags TEXT,
            categories TEXT,
            quality TEXT,
            unique_features TEXT
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

def prepare_image_for_analysis(file_path):
    with Image.open(file_path) as img:
        # Convert image to RGB if it's not
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize image if it's too large
        max_size = 1024
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size))
        
        # Convert image to base64
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG")
        base64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    return base64_image

def get_image_analysis(image_id):
    conn = create_connection()
    cursor = conn.cursor()
    
    # Get the image hash and path
    cursor.execute('SELECT hash, file_path FROM files WHERE id = ?', (image_id,))
    result = cursor.fetchone()
    
    if not result:
        raise ValueError(f"No image found with id {image_id}")
    
    image_hash, file_path = result
    
    # Check if analysis already exists
    cursor.execute('''
    SELECT description, subjects, colors, mood, composition, visible_text, tags, categories, quality, unique_features
    FROM image_analysis 
    WHERE hash = ?
    ''', (image_hash,))
    existing_analysis = cursor.fetchone()
    
    conn.close()
    
    if existing_analysis:
        return {
            'description': existing_analysis['description'],
            'subjects': json.loads(existing_analysis['subjects']) if existing_analysis['subjects'] else None,
            'colors': json.loads(existing_analysis['colors']) if existing_analysis['colors'] else None,
            'mood': json.loads(existing_analysis['mood']) if existing_analysis['mood'] else None,
            'composition': existing_analysis['composition'],
            'visible_text': json.loads(existing_analysis['visible_text']) if existing_analysis['visible_text'] else [],
            'tags': json.loads(existing_analysis['tags']) if existing_analysis['tags'] else None,
            'categories': json.loads(existing_analysis['categories']) if existing_analysis['categories'] else None,
            'quality': existing_analysis['quality'],
            'unique_features': json.loads(existing_analysis['unique_features']) if existing_analysis['unique_features'] else None
        }
    
    return None, image_hash, file_path

def store_image_analysis(image_hash, analysis):
    conn = None
    try:
        conn = create_connection()
        cursor = conn.cursor()
        
        # Log the incoming data
        logging.info(f"Attempting to store analysis for image hash: {image_hash}")
        logging.info(f"Analysis data: {json.dumps(analysis, indent=2)}")
        
        cursor.execute('''
            INSERT INTO image_analysis 
            (hash, description, subjects, colors, mood, composition, visible_text, tags, categories, quality, unique_features)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                image_hash,
                analysis.get('description', ''),
                json.dumps(analysis.get('subjects', [])),
                json.dumps(analysis.get('colors', [])),
                json.dumps(analysis.get('mood', [])),
                analysis.get('composition', ''),
                json.dumps(analysis.get('text', [])),
                json.dumps(analysis.get('tags', [])),
                json.dumps(analysis.get('categories', [])),
                analysis.get('quality', ''),
                json.dumps(analysis.get('unique_features', []))
          ))

        conn.commit()
        logging.info(f"Successfully stored analysis for image hash: {image_hash}")
        return True, "Analysis stored successfully"
    except sqlite3.IntegrityError as e:
        logging.error(f"Integrity error while storing analysis for image hash {image_hash}: {str(e)}")
        return False, f"Integrity error: {str(e)}"
    except sqlite3.Error as e:
        logging.error(f"Database error while storing analysis for image hash {image_hash}: {str(e)}")
        logging.error(f"SQL query: {cursor.statement}")
        return False, f"Database error: {str(e)}"
    except json.JSONDecodeError as e:
        logging.error(f"JSON encoding error while storing analysis for image hash {image_hash}: {str(e)}")
        return False, f"JSON encoding error: {str(e)}"
    except Exception as e:
        logging.error(f"Unexpected error while storing analysis for image hash {image_hash}: {str(e)}")
        logging.error(f"Analysis data: {json.dumps(analysis, indent=2)}")
        return False, f"Unexpected error: {str(e)}"
    finally:
        if conn:
            conn.close()

@app.route('/')
def serve_react_app():
    return app.send_static_file('index.html')


analyze_image_prompt = """
Respond only in JSON format. Do not include any explanations or text outside of the JSON structure. Do not include additional json fields.
Analyze this image and provide a detailed description in the following JSON format:
{
    "description": "A brief overall description of the image",
    "subjects": ["List of main subjects or objects in the image"],
    "colors": ["Dominant colors in the image"],
    "mood": ["List of moods or atmospheres present in the image"],
    "composition": "Brief description of the image composition",
    "text": ["Any visible text in the image, each line of text"],
    "tags": ["Relevant tags for the image"],
    "categories": ["Best fitting categories (e.g., landscape, portrait, still life, action, abstract)"],
    "quality": "Image quality assessment (e.g., high, medium, low)",
    "unique_features": ["Any unique or standout features of the image"]
}
"""

def extract_json_from_markdown(text):
    # Try to find JSON block in markdown
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if json_match:
        return json_match.group(1)
    return text  # Return original text if no JSON block found

@app.route('/api/v1/analyze-image/<int:image_id>', methods=['POST'])
def analyze_image(image_id):
    try:
        data = request.json
        service = data.get('service', 'claude').lower()
        model = data.get('model', 'claude-3-5-sonnet-20240620' if service == 'claude' else 'llava')

        logging.info(f"Analyzing image with ID: {image_id}")
        logging.info(f"Service: {service}")
        logging.info(f"Model: {model}")

        existing_analysis, image_hash, file_path = get_image_analysis(image_id)
        
        if existing_analysis:
            return jsonify({"analysis": existing_analysis}), 200
        
        base64_image = prepare_image_for_analysis(file_path)
        
        if service == 'claude':
            response = anthropic_client.messages.create(
                model=model,
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": base64_image
                                }
                            },
                            {
                                "type": "text",
                                "text": analyze_image_prompt
                            }
                        ]
                    }
                ]
            )
            analysis_text = response.content[0].text
        elif service == 'ollama':
            ollama_url = "http://localhost:11434/api/generate"
            headers = {"Content-Type": "application/json"}
            payload = {
                "model": model,
                "stream": False,
                "prompt": analyze_image_prompt,
                "images": [base64_image]
            }
            response = requests.post(ollama_url, json=payload)
            response.raise_for_status()
            analysis_text = response.json()['response']
        else:
            return jsonify({"error": "Invalid service specified"}), 400

        logging.info(f"Raw analysis text: {analysis_text}")

        # Extract JSON from markdown if necessary
        json_text = extract_json_from_markdown(analysis_text)
        logging.info(f"Extracted JSON text: {json_text}")

        try:
            structured_analysis = json.loads(json_text)
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse JSON: {str(e)}")
            logging.error(f"Invalid JSON: {json_text}")
            return jsonify({"error": "Failed to parse analysis result"}), 500

        logging.info(f"Image hash: {image_hash}")
        logging.info(f"Analysis data before storage: {json.dumps(structured_analysis, indent=2)}")

        success, message = store_image_analysis(image_hash, structured_analysis)
        if not success:
            logging.error(f"Failed to store image analysis: {message}")

        return jsonify({"analysis": structured_analysis}), 200

    except Exception as e:
        logging.error(f"Error analyzing image: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

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

@app.route('/api/v1/files', methods=['GET'])
def get_files_handler():
    conn = create_connection()
    cursor = conn.cursor()
    cursor.execute('''
    SELECT f.id, f.file_name, f.file_path, f.file_size, f.file_format, f.date_created, f.date_modified, f.hash, f.thumbnail_path,
           ia.description, ia.subjects, ia.colors, ia.mood, ia.composition, ia.visible_text, ia.tags, ia.categories, ia.quality, ia.unique_features
    FROM files f
    LEFT JOIN image_analysis ia ON f.hash = ia.hash
    ''')
    
    rows = cursor.fetchall()
    
    def parse_json_field(field):
        if field:
            try:
                return json.loads(field)
            except json.JSONDecodeError:
                return None
        return None



    files = [{
        **dict(row),
        'analysis': {
            'description': row['description'],
            'subjects': parse_json_field(row['subjects']),
            'colors': parse_json_field(row['colors']),
            'mood': parse_json_field(row['mood']),
            'composition': row['composition'],
            'visible_text': parse_json_field(row['visible_text']),
            'tags': parse_json_field(row['tags']),
            'categories': parse_json_field(row['categories']),
            'quality': row['quality'],
            'unique_features': parse_json_field(row['unique_features'])
        } if row['description'] is not None else None
    } for row in rows]
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
    create_table()
    app.run(port=8080, debug=True)