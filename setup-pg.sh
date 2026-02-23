#!/bin/bash
set -e

echo '=== Step 1: Install PostgreSQL ==='
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq postgresql postgresql-contrib > /dev/null 2>&1
echo 'PostgreSQL installed'

echo '=== Step 2: Clean and init ==='
rm -rf /workspace/pgdata
mkdir -p /workspace/pgdata
chown postgres:postgres /workspace/pgdata
su - postgres -c '/usr/lib/postgresql/12/bin/initdb -D /workspace/pgdata'

echo '=== Step 3: Verify init ==='
ls -la /workspace/pgdata/PG_VERSION
echo 'Init verified'

echo '=== Step 4: Configure remote access ==='
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /workspace/pgdata/postgresql.conf
sed -i "s/#port = 5432/port = 5432/" /workspace/pgdata/postgresql.conf
echo 'host all all 0.0.0.0/0 md5' >> /workspace/pgdata/pg_hba.conf
chown -R postgres:postgres /workspace/pgdata
echo 'Config updated'

echo '=== Step 5: Start PostgreSQL ==='
pg_ctlcluster 12 main stop 2>/dev/null || true
service postgresql stop 2>/dev/null || true
su - postgres -c '/usr/lib/postgresql/12/bin/pg_ctl -D /workspace/pgdata -l /workspace/pgdata/pg.log start'
sleep 2
su - postgres -c '/usr/lib/postgresql/12/bin/pg_ctl -D /workspace/pgdata status'
echo 'PostgreSQL started'

echo '=== Step 6: Create database ==='
su - postgres -c "psql -c \"ALTER USER postgres PASSWORD '1';\""
su - postgres -c "psql -c \"CREATE DATABASE grc;\""
echo 'Database created'

echo '=== Step 7: Verify ==='
su - postgres -c 'psql -l' | grep grc
echo '=== ALL DONE ==='
