**Project:** Image Manager with SQLite Database using Go and React

**Summary:** Develop an image manager application that runs on the user's computer. The app will index images in a specified directory, store metadata in an SQLite database, and provide a web UI built with React for interacting with the images. The goal is to keep things simple and to use only what I know, avoid using third party libraries.

**Details**:

1. **User Input**:
   - Allow the user to specify a target directory containing images to be indexed.
   - At the top of the screen, provide an input field for the directory path and a submit button.

2. **Backend**:
   - Implement in Go, focusing on performance and simplicity.
   - Save image metadata such as:
     - **Basic Metadata**:
       - File Name
       - File Path
       - File Size
       - File Format
     - **Image Properties**:
       - Dimensions
       - Resolution
       - Color Depth
     - **Date and Time**:
       - Date Created
       - Date Modified`
       - Date Taken (from EXIF data)
     - **Camera and Lens Information** (EXIF Data):
       - Camera Make
       - Camera Model
       - Lens Make
       - Lens Model
       - Focal Length
       - Aperture
       - Shutter Speed
       - ISO
       - Exposure Compensation
       - Flash
     - **GPS Data (if available)**:
       - Latitude
       - Longitude
       - Altitude
     - **Image Content**:
       - Title
       - Tags/Keywords
       - Description
       - Categories
       - People
     - **Technical Details**:
       - Histogram Data
       - Compression
       - Color Profile
     - **User Data**:
       - Rating
       - Usage Rights
       - Comments
   - Use multi-threading for efficient indexing of images.
   - Use the hash of the image (e.g., SHA-256) as the unique ID for each image to detect duplicates.
   - Prevent re-indexing already indexed files by checking the database.
   - Handle nested directories and real-time updates if new images are added.
   - Store metadata in an SQLite database.

3. **Performance**:
   - Optimize for quick indexing of large directories with numerous images.
   - Set specific performance metrics (e.g., target indexing speed).

4. **Web UI**:
   - Use bun wiht Vite
   - Build a single-page application (SPA) using React and bundle with Vite for deployment.
   - Use `tanstack-query` for data fetching and synchronization.
   - Use `shadcn` for UI components, specifically the table component.
   - Use `tanstack-table` for core table logic and configuration.
   - Design the UI to include:
     - An input field and submit button for the directory path at the top of the screen.
     - A toolbar with options to perform actions on selected images (e.g., delete, move, categorize).
     - A table displaying the indexed images with the following features:
       - Checkboxes for selecting multiple files.
       - Sortable columns to sort images based on different metadata (e.g., file name, size, date).
       - Filterable columns to restrict the view based on criteria (e.g., file format, date range).
       - Indications of duplicates for each image.
       - Pagination for better handling of large image collections.
       - Search bar for quick access to specific images.
   - Display images in a table with relevant metadata and indicate duplicates.
   - Provide a simple search bar for easy navigation.
   - Focus on a responsive and user-friendly design.

5. **Security**:
   - Restrict the app to run only locally, without external access.
   - Consider database encryption if necessary for added security.

6. **Error Handling**:
   - Implement robust error handling for issues encountered during indexing, including:
     - File access issues (e.g., missing files, permission errors).
     - Corrupted or unsupported image files.
     - Database-related errors (e.g., write failures, connection issues).
     - Network errors (if any network services are used).
   - Provide clear feedback to the user on any errors or issues.
   - Use logging to keep track of errors for debugging purposes.

7. **Additional Features**:
   - Allow tagging or categorizing of images.
   - Support for multiple image formats, including common and raw image formats:
   
     **Common Image Formats:**
     - JPEG (.jpg, .jpeg)
     - PNG (.png)
     - GIF (.gif)
     - BMP (.bmp)
     - TIFF (.tiff, .tif)
     - WebP (.webp)
     - SVG (.svg)
     - HEIF (.heif, .heic)
     
     **Raw Image Formats:**
     - Sony (.arw, .srf, .sr2)
     - Canon (.crw, .cr2, .cr3)
     - Nikon (.nef, .nrw)
     - Fujifilm (.raf)
     - Olympus (.orf)
     - Panasonic (.rw2)
     - Pentax (.pef)
     - Leica (.rwl)
     - Phase One (.iiq)
     - Sigma (.x3f)
     
     **Additional Considerations:**
     - DNG (.dng): Digital Negative format, an open raw image format.
     - PSD (.psd): Adobe Photoshop format, for supporting layered image files.
   - Include advanced search options (e.g., by hash, size, date).
- **Testing**:
    
    - Outline the testing strategy, including unit tests, integration tests, and end-to-end tests.
    - Use Jest for React testing and Go testing framework for backend.
    - Specify coverage targets and testing environments.