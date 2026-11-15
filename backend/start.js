const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { loadProductionSecrets } = require('./config/secrets');
const { loadEnv } = require('./config/env');

loadProductionSecrets()
  .then(() => loadEnv())
  .then(() => require('./server'))
  .catch((error) => {
    console.error(JSON.stringify({ event: 'startup_configuration_failed', message: error.message }));
    process.exit(1);
  });
