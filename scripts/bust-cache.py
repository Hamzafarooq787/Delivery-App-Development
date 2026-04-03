import shutil, os, pathlib

next_dir = pathlib.Path("/vercel/share/v0-project/.next")

if next_dir.exists():
    shutil.rmtree(next_dir)
    print("Deleted .next directory")
else:
    print(".next does not exist, nothing to delete")
