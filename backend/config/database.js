const mongoose = require('mongoose');

let connectionPromise;

const connectDatabase = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: Number.parseInt(process.env.MONGO_MAX_POOL_SIZE || '20', 10),
      minPoolSize: Number.parseInt(process.env.MONGO_MIN_POOL_SIZE || '2', 10),
      maxIdleTimeMS: 60000,
      socketTimeoutMS: 45000,
      family: 4
    }).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }
  return connectionPromise;
};

module.exports = { connectDatabase };
