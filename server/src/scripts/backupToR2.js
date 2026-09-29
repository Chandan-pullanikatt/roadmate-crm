/**
 * Nightly database backup: mongodump the whole database into one gzipped
 * archive and upload it to Cloudflare R2, then delete backups older than
 * KEEP_DAYS. The Atlas free tier (M0) takes no backups of its own, so this is
 * the only copy of the data outside Atlas.
 *
 * Needs the MongoDB Database Tools (`mongodump`) on the PATH, and the R2_*
 * variables from .env. Backups go to R2_BACKUP_BUCKET if set, else to the
 * uploads bucket under db-backups/.
 *
 * Run by hand:   node src/scripts/backupToR2.js
 * Scheduled by:  the server's crontab (see docs/deploy-lightsail.md)
 *
 * Restore:  download the .archive.gz from R2, then
 *   mongorestore --uri="<MONGO_URI>" --gzip --archive=<file> --drop
 * (--drop replaces each collection with the backup's copy.)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client } = require('../config/r2');

const KEEP_DAYS = 14;
const PREFIX = 'db-backups/';
const BUCKET = process.env.R2_BACKUP_BUCKET || process.env.R2_BUCKET_NAME;

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  if (!BUCKET) throw new Error('Neither R2_BACKUP_BUCKET nor R2_BUCKET_NAME is set');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(os.tmpdir(), `roadmate-${stamp}.archive.gz`);

  try {
    execFileSync('mongodump', [`--uri=${process.env.MONGO_URI}`, `--archive=${file}`, '--gzip'], { stdio: 'inherit' });

    const key = `${PREFIX}roadmate-${stamp}.archive.gz`;
    await r2Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fs.readFileSync(file),
      ContentType: 'application/gzip',
    }));
    console.log(`[backup] uploaded ${key} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
  } finally {
    fs.rmSync(file, { force: true });
  }

  // Prune old backups. Never delete the newest one, whatever its age.
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const listed = await r2Client.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX }));
  const objects = (listed.Contents || []).sort((a, b) => b.LastModified - a.LastModified);
  for (const obj of objects.slice(1)) {
    if (obj.LastModified.getTime() < cutoff) {
      await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
      console.log(`[backup] pruned ${obj.Key}`);
    }
  }
};

run().catch((err) => {
  console.error('[backup] FAILED:', err.message);
  process.exit(1);
});
