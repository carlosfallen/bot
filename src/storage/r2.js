// FILE: src/storage/r2.js
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

class R2Storage {
  constructor() {
    this.accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
    this.accessKeyId = process.env.R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucket = process.env.R2_BUCKET_NAME || 'bot';
    this.endpoint = process.env.R2_ENDPOINT || `https://${this.accountId}.r2.cloudflarestorage.com`;
    this.publicUrl = process.env.R2_PUBLIC_URL;

    this.client = null;
    
    if (this.isReady()) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: this.endpoint,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey
        }
      });
      console.log('✅ R2 Storage configurado');
    } else {
      console.log('⚠️ R2 Storage não configurado');
    }
  }

  isReady() {
    return !!(this.accountId && this.accessKeyId && this.secretAccessKey);
  }

  _generateKey(prefix, filename, mimetype) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const hash = crypto.randomBytes(8).toString('hex');
    const ext = this._getExtFromMime(mimetype) || this._getExtFromFilename(filename) || 'bin';
    
    return `${prefix}/${year}/${month}/${day}/${hash}.${ext}`;
  }

  _getExtFromMime(mime) {
    if (!mime) return null;
    const map = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'audio/ogg': 'ogg',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/wav': 'wav',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt'
    };
    return map[mime.split(';')[0]] || null;
  }

  _getExtFromFilename(filename) {
    if (!filename) return null;
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : null;
  }

  async upload(buffer, options = {}) {
    if (!this.client) throw new Error('R2 not configured');

    const { prefix = 'uploads', filename = '', contentType = 'application/octet-stream', metadata = {} } = options;
    
    const key = this._generateKey(prefix, filename, contentType);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: Object.fromEntries(
        Object.entries(metadata).map(([k, v]) => [k, String(v)])
      )
    });

    await this.client.send(command);

    // Construir URL pública
    const url = this.publicUrl ? `${this.publicUrl}/${key}` : null;

    return {
      key,
      url,
      size: buffer.length,
      contentType
    };
  }

  async getSignedUrl(key, expiresIn = 3600) {
    if (!this.client) throw new Error('R2 not configured');

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async delete(key) {
    if (!this.client) throw new Error('R2 not configured');

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    await this.client.send(command);
    return true;
  }
}

module.exports = new R2Storage();