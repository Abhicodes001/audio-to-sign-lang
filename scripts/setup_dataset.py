import os
import zipfile
import shutil
import sys
from pathlib import Path

# The script expects the user to pass the path to their zip file as an argument
# E.g., python scripts/setup_dataset.py path/to/videos.zip

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = PROJECT_ROOT / "datasets"

def setup_dataset(zip_file_path):
    if not os.path.exists(zip_file_path):
        print(f"Error: Could not find the zip file at {zip_file_path}")
        sys.exit(1)

    os.makedirs(DATASET_DIR, exist_ok=True)
    temp_extract_dir = PROJECT_ROOT / "temp_extracted_videos"
    
    print(f"Extracting {zip_file_path}...")
    with zipfile.ZipFile(zip_file_path, 'r') as zip_ref:
        zip_ref.extractall(temp_extract_dir)
        
    print("Moving and renaming files to lowercase...")
    count = 0
    for root, dirs, files in os.walk(temp_extract_dir):
        for file in files:
            if file.lower().endswith(('.mp4', '.mkv', '.avi', '.mov', '.webm', '.gif')):
                lower_filename = file.lower()
                source_path = os.path.join(root, file)
                dest_path = os.path.join(DATASET_DIR, lower_filename)
                shutil.move(source_path, dest_path)
                count += 1
                
    try:
        shutil.rmtree(temp_extract_dir)
    except OSError:
        pass
    print(f"Success! Extracted and renamed {count} videos to {DATASET_DIR}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python setup_dataset.py <path_to_videos_zip>")
        print("Example: python scripts/setup_dataset.py C:\\Users\\Name\\Downloads\\videos.zip")
        sys.exit(1)
    setup_dataset(sys.argv[1])
