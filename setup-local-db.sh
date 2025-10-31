#!/bin/bash

echo "🔧 Setting up local PostgreSQL database for Beacon Flow..."

# Start PostgreSQL service
echo "1. Starting PostgreSQL service..."
brew services start postgresql@14 2>/dev/null || brew services start postgresql

# Wait for PostgreSQL to start
sleep 2

# Create database
echo "2. Creating 'beaconflow' database..."
createdb beaconflow 2>/dev/null || echo "   Database already exists, skipping..."

# Verify database exists
if psql -lqt | cut -d \| -f 1 | grep -qw beaconflow; then
    echo "   ✅ Database 'beaconflow' is ready"
else
    echo "   ❌ Failed to create database"
    exit 1
fi

# Update .env file
echo "3. Updating .env file..."
CURRENT_USER=$(whoami)
NEW_DB_URL="postgresql://$CURRENT_USER@localhost:5432/beaconflow"

if [ -f .env ]; then
    # Backup existing .env
    cp .env .env.backup
    echo "   Backed up .env to .env.backup"

    # Update DATABASE_URL
    if grep -q "^DATABASE_URL=" .env; then
        sed -i.tmp "s|^DATABASE_URL=.*|DATABASE_URL=\"$NEW_DB_URL\"|" .env && rm .env.tmp
        echo "   ✅ Updated DATABASE_URL in .env"
    else
        echo "DATABASE_URL=\"$NEW_DB_URL\"" >> .env
        echo "   ✅ Added DATABASE_URL to .env"
    fi
else
    echo "   ⚠️  .env file not found, creating it..."
    cp .env.example .env
    sed -i.tmp "s|^DATABASE_URL=.*|DATABASE_URL=\"$NEW_DB_URL\"|" .env && rm .env.tmp
    echo "   ✅ Created .env with DATABASE_URL"
fi

echo "4. Running database migrations..."
echo "   Creating base tables..."
psql beaconflow -f tables/table_v1.sql

echo "   Creating LinkedIn tables..."
psql beaconflow -f tables/linkedin_auth.sql

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Database connection details:"
echo "   Database: beaconflow"
echo "   URL: $NEW_DB_URL"
echo ""
echo "🚀 Next steps:"
echo "   1. Update any other missing .env variables (see .env.example)"
echo "   2. Run: npm run dev"
echo ""
