import sys

# The script expects the user to pass the path to their zip file as an argument
# E.g., python scripts/setup_dataset.py path/to/videos.zip

def setup_dataset(zip_file_path):
    print("ZIP import is retired. Review and extract trusted media separately, then run "
          "`python scripts/manage_catalogue.py import <local_directory>` for a dry run. "
          "After verifying reuse permission, add --apply --permission-confirmed. "
          "No files were extracted or copied.", file=sys.stderr)
    raise SystemExit(2)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python setup_dataset.py <path_to_videos_zip>")
        print("Example: python scripts/setup_dataset.py C:\\Users\\Name\\Downloads\\videos.zip")
        sys.exit(1)
    setup_dataset(sys.argv[1])
