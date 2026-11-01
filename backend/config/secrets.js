const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

let loaded = false;

const loadProductionSecrets = async () => {
  if (process.env.NODE_ENV !== 'production' || !process.env.AWS_SECRET_ID) return;
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const result = await client.send(new GetSecretValueCommand({ SecretId: process.env.AWS_SECRET_ID }));
  let secrets;
  try {
    secrets = JSON.parse(result.SecretString || '{}');
  } catch {
    throw new Error('Production secret payload must be valid JSON');
  }
  if (!secrets || typeof secrets !== 'object' || Array.isArray(secrets)) {
    throw new Error('Production secret payload must be an object');
  }
  for (const [key, value] of Object.entries(secrets)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
    if (typeof value === 'string' && !process.env[key]) process.env[key] = value;
  }
  loaded = true;
};

const secretsLoaded = () => loaded;

module.exports = { loadProductionSecrets, secretsLoaded };
