#!/bin/bash
# RunPod PostgreSQL Backup Script
# Save this to /workspace/pg-backup.sh on RunPod
# Usage: bash /workspace/pg-backup.sh
#
# This dumps the 'grc' database to /workspace/grc-backup.sql
# The /workspace directory persists across pod restarts.

set -e

BACKUP_FILE="/workspace/grc-backup.sql"
BACKUP_TEMP="/workspace/grc-backup.sql.tmp"

echo "=== Backing up GRC database ==="

# Dump to temp file first (atomic write)
su - postgres -c "pg_dump -p 11324 grc" > "$BACKUP_TEMP"

# Move temp to final (overwrites previous backup)
mv "$BACKUP_TEMP" "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
echo "Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"
echo "Timestamp: $(date)"
