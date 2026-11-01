const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Url = require('../models/Url');

const mongoUri = process.env.MONGO_TEST_URI;

const runIntegration = mongoUri ? test : test.skip;

runIntegration('one-time and max-click reservations are atomic', async () => {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const oneTimeCode = `test-one-${suffix}`;
  const limitedCode = `test-limit-${suffix}`;

  try {
    await Url.create([
      { longUrl: 'https://example.com/one', shortCode: oneTimeCode, isOneTime: true },
      { longUrl: 'https://example.com/limited', shortCode: limitedCode, maxClicks: 3 }
    ]);

    const reserve = (shortCode, oneTime = false) => Url.findOneAndUpdate(
      {
        shortCode,
        isActive: true,
        $or: [
          { maxClicks: null },
          { maxClicks: { $exists: false } },
          { $expr: { $lt: ['$clicks', '$maxClicks'] } }
        ]
      },
      {
        $inc: { clicks: 1 },
        ...(oneTime ? { $set: { isActive: false } } : {})
      },
      { new: true }
    );

    const oneTimeResults = await Promise.all(
      Array.from({ length: 10 }, () => reserve(oneTimeCode, true))
    );
    assert.equal(oneTimeResults.filter(Boolean).length, 1);

    const limitedResults = await Promise.all(
      Array.from({ length: 10 }, () => reserve(limitedCode))
    );
    assert.equal(limitedResults.filter(Boolean).length, 3);

    const saved = await Url.findOne({ shortCode: limitedCode }).lean();
    assert.equal(saved.clicks, 3);
  } finally {
    await Url.deleteMany({ shortCode: { $in: [oneTimeCode, limitedCode] } });
    await mongoose.disconnect();
  }
}, { timeout: 15000 });
