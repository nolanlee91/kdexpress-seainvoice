const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Trim — defensive against accidentally pasted newlines / whitespace in env vars
function env(name) {
  return (process.env[name] || '').trim();
}

function getClient() {
  const accountId = env('R2_ACCOUNT_ID');
  if (!accountId) throw new Error('r2_not_configured: missing R2_ACCOUNT_ID');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    },
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
  const bucket = env('R2_BUCKET_NAME');
  const publicBase = env('R2_PUBLIC_BASE_URL');
  if (!bucket) throw new Error('r2_not_configured: missing R2_BUCKET_NAME');
  if (!publicBase) throw new Error('r2_not_configured: missing R2_PUBLIC_BASE_URL');
  if (!env('R2_ACCESS_KEY_ID') || !env('R2_SECRET_ACCESS_KEY')) {
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
