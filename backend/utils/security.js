const crypto = require('crypto');

const hashApiKey = (apiKey) => crypto.createHash('sha256').update(apiKey).digest('hex');

const isSafeAvatarFilename = (filename) =>
  typeof filename === 'string' &&
  filename === require('path').basename(filename) &&
  /^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename);

module.exports = { hashApiKey, isSafeAvatarFilename };
