import os
import shutil

next_dir = "/vercel/share/v0-project/.next"

if os.path.exists(next_dir):
    shutil.rmtree(next_dir)
    print(f"Deleted {next_dir} — Next.js will rebuild from scratch on next request.")
else:
    print(f"{next_dir} does not exist, nothing to clear.")
