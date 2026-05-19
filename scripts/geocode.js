#!/usr/bin/env node

// Usage: node scripts/geocode.js data/paris.json

const fs = require('fs');
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DELAY_MS = 1100;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocode(address, city) {
  const query = `${address}, ${city}`;
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1'
  });

  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': 'PocketPins/1.0 (personal trip planner)' }
  });

  if (!res.ok) throw new Error(`Nominatim returned ${res.status} for "${query}"`);

  const data = await res.json();
  if (data.length === 0) return null;

  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/geocode.js <city-file.json>');
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const db = JSON.parse(raw);
  const cityName = db.name || 'unknown city';
  let updated = 0;
  let failed = [];

  for (const collection of db.collections) {
    for (const place of collection.places) {
      if (place.lat && place.lng) {
        console.log(`  skip: ${place.name} (already geocoded)`);
        continue;
      }

      await sleep(DELAY_MS);
      console.log(`  geocoding: ${place.name} — ${place.address}`);

      const coords = await geocode(place.address, cityName);
      if (coords) {
        place.lat = coords.lat;
        place.lng = coords.lng;
        updated++;
        console.log(`    -> ${coords.lat}, ${coords.lng}`);
      } else {
        failed.push(place.name);
        console.log(`    -> FAILED`);
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(db, null, 2) + '\n');
  console.log(`\nDone. Updated ${updated} places in ${cityName}.`);
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
}

main().catch(err => { console.error(err); process.exit(1); });
