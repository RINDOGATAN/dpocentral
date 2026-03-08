#!/usr/bin/env bash
# scripts/demo/setup-demo.sh
# Prepares the demo environment for video recording
#
# Usage:
#   ./scripts/demo/setup-demo.sh              # Seed Meridian only
#   ./scripts/demo/setup-demo.sh --all        # Seed Meridian + all verticals
#   ./scripts/demo/setup-demo.sh --vertical saas  # Seed Meridian + one vertical

set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║  DPO Central — Demo Setup                       ║"
echo "╚══════════════════════════════════════════════════╝"
echo

# Check prerequisites
if ! command -v npx &> /dev/null; then
  echo "Error: npx not found. Install Node.js first."
  exit 1
fi

if [ ! -f ".env" ] && [ ! -f ".env.local" ]; then
  echo "Warning: No .env or .env.local found. Make sure DATABASE_URL is set."
fi

# Step 1: Generate Prisma client
echo "Step 1: Generating Prisma client..."
npx prisma generate
echo "  ✓ Prisma client generated"
echo

# Step 2: Seed base data (jurisdictions, templates, questionnaire)
echo "Step 2: Seeding base data..."
npx tsx prisma/seed.ts
echo "  ✓ Base data seeded"
echo

# Step 3: Seed Meridian demo scenario
echo "Step 3: Seeding Meridian Retail Group demo..."
npx tsx scripts/seed-demo-scenario.ts
echo "  ✓ Meridian demo seeded"
echo

# Step 4: Optionally seed verticals
if [ "$1" = "--all" ]; then
  echo "Step 4: Seeding all vertical demos..."
  npx tsx scripts/demo/runner.ts --all
  echo "  ✓ All verticals seeded"
  echo
elif [ "$1" = "--vertical" ] && [ -n "$2" ]; then
  echo "Step 4: Seeding $2 demo..."
  npx tsx scripts/demo/runner.ts --vertical "$2"
  echo "  ✓ $2 demo seeded"
  echo
else
  echo "Step 4: Skipped (no --all or --vertical flag)"
  echo
fi

# Summary
echo "╔══════════════════════════════════════════════════╗"
echo "║  Setup Complete!                                ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║  Start the dev server:                           ║"
echo "║    npm run dev                                   ║"
echo "║                                                  ║"
echo "║  Login as demo user:                             ║"
echo "║    http://localhost:3001/api/auth/dev-login      ║"
echo "║      ?email=demo@privacysuite.example            ║"
echo "║                                                  ║"
echo "║  Demo script:                                    ║"
echo "║    scripts/demo/DEMO-SCRIPT.md                   ║"
echo "║                                                  ║"
echo "╚══════════════════════════════════════════════════╝"
