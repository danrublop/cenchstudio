import { execFileSync } from 'child_process';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { db } from '../lib/db';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { seedBuiltInAssets } from '../lib/db/seeds/assets';
import { seedThreeDComponents } from '../lib/db/seeds/three-d-components';
import { seedTemplates } from '../lib/db/seeds/templates';

async function setup() {
  console.log('🎬 Cench Studio setup...\n');

  // 1. Check Docker if local mode
  if (process.env.STORAGE_MODE !== 'cloud') {
    console.log('📦 Starting local Postgres...');
    try {
      execFileSync('docker', ['compose', 'up', '-d', 'postgres'], { stdio: 'inherit' });
      let attempts = 0;
      while (attempts < 30) {
        try {
          execFileSync('docker', ['compose', 'exec', 'postgres', 'pg_isready', '-U', 'postgres'],
            { stdio: 'ignore' });
          break;
        } catch {
          await new Promise(r => setTimeout(r, 1000));
          attempts++;
        }
      }
      console.log('✅ Postgres ready\n');
    } catch (e) {
      console.error('❌ Docker not running. Install Docker Desktop and try again.');
      process.exit(1);
    }
  }

  // 2. Run migrations
  console.log('🗄️  Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✅ Migrations complete\n');

  // 3. Seed built-in data
  console.log('🌱 Seeding built-in assets...');
  await seedBuiltInAssets();
  await seedThreeDComponents();
  await seedTemplates();
  console.log('✅ Seeding complete\n');

  console.log('🚀 Setup complete! Run npm run dev to start.\n');
  process.exit(0);
}

setup().catch(e => {
  console.error('Setup failed:', e);
  process.exit(1);
});
