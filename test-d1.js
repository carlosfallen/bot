require('dotenv').config();
const https = require('https');

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

console.log('Testing D1 API...');
console.log(`Account: ${accountId}`);
console.log(`Database: ${databaseId}`);
console.log(`Token: ${apiToken?.substring(0, 10)}...`);

const data = JSON.stringify({
  sql: 'SELECT key, value FROM bot_config LIMIT 1'
});

const options = {
  hostname: 'api.cloudflare.com',
  path: `/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', err => console.error('Error:', err.message));
req.write(data);
req.end();
