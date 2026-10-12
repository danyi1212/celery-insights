/** File metadata only, collected from this run's private volume on a read-only mount. */
export const storageSnapshotScript = `
import json
from pathlib import Path
root = Path('/data')
allocated = 0
files = []
for path in [root, *root.rglob('*')]:
    metadata = path.stat()
    allocated += metadata.st_blocks * 512
    if path.is_file():
        files.append({'path':str(path.relative_to(root)), 'logicalBytes':metadata.st_size,
            'allocatedBytes':metadata.st_blocks*512})
print(json.dumps({'allocatedBytes':allocated, 'logicalFileBytes':sum(f['logicalBytes'] for f in files),
    'files':len(files), 'largestFiles':sorted(files,key=lambda f:f['logicalBytes'],reverse=True)[:10]}))
`
