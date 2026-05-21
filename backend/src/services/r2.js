const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function getClient() {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error('r2_not_configured: missing R2_ACCOUNT_ID');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    // R2 doesn't fully support AWS SDK v3's auto-added CRC32 checksums in
    // presigned URLs — disable them so browser PUT signatures match.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

function buildKey(folder, contentType) {
  const ext = (String(contentType || '').split('/')[1] || 'bin')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase() || 'bin';
  const rand = Math.random().toString(36).slice(2, 10);
  return `${folder.replace(/^\/|\/$/g, '')}/${Date.now()}-${rand}.${ext}`;
}

async function createUploadUrl({ folder = 'haibien/invoices', contentType = 'image/jpeg' } = {}) {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBase = process.env.R2_PUBLIC_BASE_URL;
  if (!bucket) throw new Error('r2_not_configured: missing R2_BUCKET_NAME');
  if (!publicBase) throw new Error('r2_not_configured: missing R2_PUBLIC_BASE_URL');
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('r2_not_configured: missing R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY');
  }

  const key = buildKey(folder, contentType);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  const upload_url = await getSignedUrl(getClient(), command, { expiresIn: 600 });
  const public_url = `${publicBase.replace(/\/$/, '')}/${key}`;
  return { upload_url, public_url, key, content_type: contentType };
}

module.exports = { createUploadUrl };
