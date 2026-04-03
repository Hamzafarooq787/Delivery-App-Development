import os, shutil, sys

next_dir = "/vercel/share/v0-project/.next"

if os.path.isdir(next_dir):
    shutil.rmtree(next_dir)
    print(f"Deleted {next_dir}")
else:
    print(f"{next_dir} does not exist — nothing to clear")
