#!/bin/bash
# RunPod PostgreSQL Startup & Restore Script
# Save this to /workspace/pg-startup.sh on RunPod and run after pod restart
# Usage: bash /workspace/pg-startup.sh

set -e

echo "=== RunPod PostgreSQL Startup Script ==="

# Install PostgreSQL if not present
if ! command -v psql &> /dev/null; then
    echo "[1/6] Installing PostgreSQL..."
    apt-get update -qq && apt-get install -y -qq postgresql postgresql-client > /dev/null 2>&1
    echo "       PostgreSQL installed."
else
    echo "[1/6] PostgreSQL already installed."
fi

# Get the PostgreSQL version and cluster info
PG_VERSION=$(pg_lsclusters -h | awk '{print $1}' | head -1)
PG_CLUSTER=$(pg_lsclusters -h | awk '{print $2}' | head -1)

if [ -z "$PG_VERSION" ]; then
    PG_VERSION=$(ls /etc/postgresql/ | head -1)
    PG_CLUSTER="main"
fi

PG_CONF="/etc/postgresql/${PG_VERSION}/${PG_CLUSTER}/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/${PG_CLUSTER}/pg_hba.conf"

echo "[2/6] Using PostgreSQL ${PG_VERSION} cluster '${PG_CLUSTER}'"

# Configure remote access
echo "[3/6] Configuring remote access..."
if ! grep -q "listen_addresses = '\*'" "$PG_CONF" 2>/dev/null; then
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
    sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
    echo "       listen_addresses set to '*'"
else
    echo "       listen_addresses already configured"
fi

# Configure port to 11324
if ! grep -q "^port = 11324" "$PG_CONF" 2>/dev/null; then
    sed -i "s/^port = .*/port = 11324/" "$PG_CONF"
    echo "       Port set to 11324"
else
    echo "       Port already set to 11324"
fi

# Allow remote connections in pg_hba.conf
if ! grep -q "0.0.0.0/0" "$PG_HBA" 2>/dev/null; then
    echo "host    all    all    0.0.0.0/0    md5" >> "$PG_HBA"
    echo "       Added remote access rule to pg_hba.conf"
else
    echo "       Remote access rule already exists"
fi

# Start PostgreSQL
echo "[4/6] Starting PostgreSQL..."
pg_ctlcluster ${PG_VERSION} ${PG_CLUSTER} stop 2>/dev/null || true
pg_ctlcluster ${PG_VERSION} ${PG_CLUSTER} start
echo "       PostgreSQL started on port 11324"

# Set postgres password
echo "[5/6] Setting postgres password..."
su - postgres -c "psql -p 11324 -c \"ALTER USER postgres PASSWORD '1';\"" 2>/dev/null || true
echo "       Password set."

# Create database and restore if backup exists
echo "[6/6] Setting up 'grc' database..."
su - postgres -c "psql -p 11324 -c 'CREATE DATABASE grc;'" 2>/dev/null || echo "       Database 'grc' already exists."

BACKUP_FILE="/workspace/grc-backup.sql"
if [ -f "$BACKUP_FILE" ]; then
    echo "       Found backup at ${BACKUP_FILE}, restoring..."
    su - postgres -c "psql -p 11324 grc < ${BACKUP_FILE}" 2>/dev/null
    echo "       Database restored from backup!"
else
    echo "       No backup found at ${BACKUP_FILE}. Database is empty."
    echo "       Run prisma db push and seed from your local machine."
fi

echo ""
echo "=== PostgreSQL is ready! ==="
echo "Connection: postgresql://postgres:1@$(hostname -I | awk '{print $1}'):11324/grc"
echo ""
