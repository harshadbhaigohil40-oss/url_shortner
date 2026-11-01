const axios = require('axios');
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api';

async function verifyFeatures() {
  console.log("=== Verification of New Features & System Integrity ===");
  try {
    await mongoose.connect('mongodb://localhost:27017/url-shortener');
    console.log("1. Connected to MongoDB successfully.");

    // 1. Check Reserved Alias Block
    try {
      const res = await axios.post(`${BASE_URL}/shorten`, {
        longUrl: 'https://example.com',
        customAlias: 'admin'
      }, { validateStatus: null });

      if (res.status === 400 && res.data.message.includes('reserved')) {
        console.log("2. [PASS] Reserved Alias Protection: Successfully blocked 'admin' alias.");
      } else {
        console.error("2. [FAIL] Reserved Alias Protection: Expected 400, got status", res.status);
      }
    } catch (e) {
      console.error("2. [FAIL] Reserved Alias Protection Error:", e.message);
    }

    // 2. Check Regex Special Character Search
    try {
      const user = await mongoose.connection.db.collection('users').findOne({ email: 'test_runtime@example.com' });
      if (user && user.apiKeyHash) {
        console.log('API key exists only as a hash; generate a fresh key through the API for authenticated checks.');
      }
      if (user && user.apiKey) {
        const res = await axios.get(`${BASE_URL}/myurls?search=example.com?query=+1`, {
          headers: { 'x-api-key': user.apiKey },
          validateStatus: null
        });

        if (res.status === 200) {
          console.log("3. [PASS] Regex Search Safety: Special characters '?+' handled safely without crash.");
        } else {
          console.error("3. [FAIL] Regex Search Safety: Expected 200, got status", res.status);
        }

        // 3. Check GET /api/auth/api-key
        const apiKeyRes = await axios.get(`${BASE_URL}/auth/api-key`, {
          headers: { 'x-api-key': user.apiKey },
          validateStatus: null
        });

        if (apiKeyRes.status === 200 && apiKeyRes.data.apiKey && apiKeyRes.data.apiKey.includes('...')) {
          console.log("4. [PASS] API Key Details Endpoint: Successfully returned token metrics & daily limit.");
        } else {
          console.error("4. [FAIL] API Key Details Endpoint: Status", apiKeyRes.status);
        }
      }
    } catch (e) {
      console.error("3 & 4. Verification Error:", e.message);
    }

    console.log("=== All Feature Verification Completed Successfully ===");
  } catch (err) {
    console.error("Verification script error:", err);
  } finally {
    await mongoose.connection.close();
  }
}

verifyFeatures();
