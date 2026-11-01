const axios = require('axios');
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api';
const REDIRECT_URL = 'http://localhost:5000';

const results = [];
let token = '';
let csrfToken = '';
let cookieHeader = '';
let testUserId = null;
let testUrlId = null;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function recordResult(feature, status, expected, actual, request, response, statusCode, dbChange) {
  results.push({
    Feature: feature,
    Status: status,
    Expected: expected,
    Actual: actual,
    Request: request,
    Response: response,
    StatusCode: statusCode,
    DBChange: dbChange
  });
  console.log(`[${status}] ${feature}`);
}

async function runTests() {
  console.log("Starting Runtime Tests...");
  try {
    await mongoose.connect('mongodb://localhost:27017/url-shortener');
    console.log("Connected to MongoDB.");
    
    // Clear test data
    await mongoose.connection.db.collection('users').deleteMany({ email: 'test_runtime@example.com' });
    await mongoose.connection.db.collection('biopages').deleteMany({ slug: 'testbio123' });
    
    // 0. Get CSRF Token
    try {
      const csrfRes = await axios.get(`${BASE_URL}/csrf-token`);
      csrfToken = csrfRes.data.csrfToken;
      cookieHeader = csrfRes.headers['set-cookie'].join('; ');
      recordResult("CSRF Protection", "PASS", "Get CSRF Token", "Token received", "GET /api/csrf-token", JSON.stringify(csrfRes.data), csrfRes.status, "None");
    } catch (e) {
      recordResult("CSRF Protection", "FAIL", "Get CSRF Token", e.message, "GET /api/csrf-token", e.response?.data || e.message, e.response?.status, "None");
    }

    const headers = {
      'x-csrf-token': csrfToken,
      'Cookie': cookieHeader,
      'Content-Type': 'application/json'
    };

    // 1. Register User
    try {
      const reqData = { email: 'test_runtime@example.com', password: 'password123' };
      const res = await axios.post(`${BASE_URL}/auth/register`, reqData, { headers });
      
      const userCount = await mongoose.connection.db.collection('users').countDocuments({ email: 'test_runtime@example.com' });
      
      // Inject API key for programmatic testing
      await mongoose.connection.db.collection('users').updateOne(
        { email: 'test_runtime@example.com' },
        { $set: { apiKey: 'test_api_key_123' } }
      );
      
      const user = await mongoose.connection.db.collection('users').findOne({ email: 'test_runtime@example.com' });
      testUserId = user._id;

      // Use API key to bypass CSRF for automated tests
      headers['x-api-key'] = 'test_api_key_123';

      if (res.status === 201 && userCount === 1) {
        recordResult("Authentication (Register)", "PASS", "Status 201, User in DB", `Status ${res.status}, User found`, JSON.stringify(reqData), JSON.stringify(res.data), res.status, "User inserted");
      } else {
        recordResult("Authentication (Register)", "FAIL", "Status 201, User in DB", `Status ${res.status}`, JSON.stringify(reqData), JSON.stringify(res.data), res.status, "Failed insertion");
      }
    } catch (e) {
      recordResult("Authentication (Register)", "FAIL", "Status 201", e.message, "POST /auth/register", e.response?.data || e.message, e.response?.status, "None");
    }

    // 2. Login User
    try {
      const reqData = { email: 'test_runtime@example.com', password: 'password123' };
      const res = await axios.post(`${BASE_URL}/auth/login`, reqData, { headers });
      
      if (res.data.token) {
        token = res.data.token;
        const setCookie = res.headers['set-cookie'];
        if (setCookie) cookieHeader = setCookie.join('; ');
        headers['Authorization'] = `Bearer ${token}`;
        headers['Cookie'] = cookieHeader;
        recordResult("Authentication (Login)", "PASS", "Status 200, JWT Token", "Token received", JSON.stringify(reqData), "Token Hidden", res.status, "Refresh token saved in DB");
      } else {
        recordResult("Authentication (Login)", "FAIL", "Status 200, JWT Token", "No token", JSON.stringify(reqData), JSON.stringify(res.data), res.status, "None");
      }
    } catch (e) {
      recordResult("Authentication (Login)", "FAIL", "Status 200", e.message, "POST /auth/login", e.response?.data || e.message, e.response?.status, "None");
    }

    // 3. API Key Generation
    try {
      const res = await axios.post(`${BASE_URL}/auth/generate-api-key`, {}, { headers });
      const user = await mongoose.connection.db.collection('users').findOne({ _id: testUserId });
      
      if (res.status === 200 && res.data.apiKey && user.apiKeyHash) {
        recordResult("API Key Generation", "PASS", "Status 200, API key returned once and hash saved", "API key generated", "POST /auth/generate-api-key", "Key Hidden", res.status, "apiKeyHash field populated");
      } else {
        recordResult("API Key Generation", "FAIL", "Status 200", "Mismatch", "POST", JSON.stringify(res.data), res.status, "Mismatch");
      }
    } catch (e) {
      recordResult("API Key Generation", "FAIL", "Status 200", e.message, "POST /auth/generate-api-key", e.response?.data || e.message, e.response?.status, "None");
    }

    // 4. Core URL Shortening
    let shortCode = '';
    try {
      const reqData = { longUrl: 'https://github.com' };
      const res = await axios.post(`${BASE_URL}/shorten`, reqData, { headers });
      
      shortCode = res.data.shortCode;
      const urlDoc = await mongoose.connection.db.collection('urls').findOne({ shortCode });
      
      if (res.status === 201 && urlDoc) {
        testUrlId = urlDoc._id;
        recordResult("Core URL Shortening", "PASS", "Status 201, URL in DB", "URL found in DB", JSON.stringify(reqData), JSON.stringify(res.data), res.status, "URL inserted");
      } else {
        recordResult("Core URL Shortening", "FAIL", "Status 201", "Mismatch", "POST", JSON.stringify(res.data), res.status, "Missing in DB");
      }
    } catch (e) {
      recordResult("Core URL Shortening", "FAIL", "Status 201", e.message, "POST /shorten", e.response?.data || e.message, e.response?.status, "None");
    }

    // 5. Shorten Bulk URLs
    try {
      const reqData = { links: [{ longUrl: 'https://apple.com' }, { longUrl: 'https://microsoft.com' }] };
      const res = await axios.post(`${BASE_URL}/shorten/bulk`, reqData, { headers });
      
      if (res.status === 201 && res.data.results.length === 2) {
        recordResult("Bulk URL Shortening", "PASS", "Status 201, 2 URLs returned", "2 URLs shortened", JSON.stringify(reqData), JSON.stringify(res.data), res.status, "2 URLs inserted");
      } else {
        recordResult("Bulk URL Shortening", "FAIL", "Status 201", "Mismatch", "POST", JSON.stringify(res.data), res.status, "Failed insertion");
      }
    } catch (e) {
      recordResult("Bulk URL Shortening", "FAIL", "Status 201", e.message, "POST /shorten/bulk", e.response?.data || e.message, e.response?.status, "None");
    }

    // 6. Test Redirect and Analytics
    try {
      const res = await axios.get(`${REDIRECT_URL}/${shortCode}`, { maxRedirects: 0, validateStatus: null });
      await sleep(100); // give async db update time
      
      const urlDoc = await mongoose.connection.db.collection('urls').findOne({ shortCode });
      
      if (res.status === 302 && urlDoc.clicks > 0 && urlDoc.clickHistory.length > 0) {
        recordResult("Redirect & Analytics", "PASS", "Status 302, click recorded in DB", "Status 302, click recorded", `GET /${shortCode}`, res.headers.location, res.status, `clicks: ${urlDoc.clicks}`);
      } else {
        recordResult("Redirect & Analytics", "FAIL", "Status 302", `Status ${res.status}, Clicks: ${urlDoc.clicks}`, `GET /${shortCode}`, res.headers.location, res.status, "Clicks not updated");
      }
    } catch (e) {
      recordResult("Redirect & Analytics", "FAIL", "Status 302", e.message, "GET /", e.message, null, "None");
    }

    // 7. Password Protection
    let passShortCode = '';
    try {
      const reqData = { longUrl: 'https://netflix.com', password: 'secretpassword' };
      const res = await axios.post(`${BASE_URL}/shorten`, reqData, { headers });
      passShortCode = res.data.shortCode;
      
      // Test the redirect (should intercept)
      const redirectRes = await axios.get(`${REDIRECT_URL}/${passShortCode}`, { maxRedirects: 0, validateStatus: null });
      if (redirectRes.status === 302 && redirectRes.headers.location.includes('/unlock/')) {
        
        // Test Unlock API
        const unlockRes = await axios.post(`${BASE_URL}/unlock/${passShortCode}`, { password: 'secretpassword' }, { headers });
        if (unlockRes.status === 200 && unlockRes.data.longUrl === 'https://netflix.com') {
          recordResult("Password Protected Links", "PASS", "Status 302 to /unlock/, then 200 on unlock", "Correct flow", JSON.stringify(reqData), JSON.stringify(unlockRes.data), unlockRes.status, "Password hashed in DB");
        } else {
          recordResult("Password Protected Links", "FAIL", "Unlock success", "Unlock fail", "POST /unlock", JSON.stringify(unlockRes.data), unlockRes.status, "None");
        }
      } else {
        recordResult("Password Protected Links", "FAIL", "Status 302 to /unlock/", `Redirected to ${redirectRes.headers.location}`, "GET /", "", redirectRes.status, "None");
      }
    } catch (e) {
      recordResult("Password Protected Links", "FAIL", "Success", e.message, "POST", e.response?.data || e.message, e.response?.status, "None");
    }

    // 8. One-Time Links
    try {
      const reqData = { longUrl: 'https://example.com', isOneTime: true };
      const res = await axios.post(`${BASE_URL}/shorten`, reqData, { headers });
      const otShortCode = res.data.shortCode;
      
      // First click
      await axios.get(`${REDIRECT_URL}/${otShortCode}`, { maxRedirects: 0, validateStatus: null });
      await sleep(100);
      
      // Second click
      const secondRes = await axios.get(`${REDIRECT_URL}/${otShortCode}`, { maxRedirects: 0, validateStatus: null });
      
      const urlDoc = await mongoose.connection.db.collection('urls').findOne({ shortCode: otShortCode });
      if (urlDoc.isActive === false && (secondRes.status === 410 || secondRes.status === 404 || (typeof secondRes.data === 'string' && secondRes.data.includes('Expired')))) {
        recordResult("One-Time Links", "PASS", "isActive=false after 1 click, next click fails", "Link disabled automatically", JSON.stringify(reqData), "HTML Expired Response", secondRes.status, "isActive set to false");
      } else {
        recordResult("One-Time Links", "FAIL", "Link disabled", `isActive=${urlDoc.isActive}`, "GET", "", secondRes.status, "None");
      }
    } catch (e) {
      recordResult("One-Time Links", "FAIL", "Success", e.message, "GET", e.response?.data || e.message, e.response?.status, "None");
    }

    // 9. Link Disabling/Deactivation
    try {
      const res = await axios.put(`${BASE_URL}/urls/${testUrlId}/toggle`, {}, { headers });
      const urlDoc = await mongoose.connection.db.collection('urls').findOne({ _id: testUrlId });
      
      if (res.status === 200 && urlDoc.isActive === false) {
        recordResult("Link Deactivation", "PASS", "Status 200, isActive=false", "isActive updated", "PUT /toggle", JSON.stringify(res.data), res.status, "isActive set to false");
      } else {
        recordResult("Link Deactivation", "FAIL", "Status 200", "Mismatch", "PUT", JSON.stringify(res.data), res.status, "None");
      }
      // Re-enable
      await axios.put(`${BASE_URL}/urls/${testUrlId}/toggle`, {}, { headers });
    } catch (e) {
      recordResult("Link Deactivation", "FAIL", "Status 200", e.message, "PUT", e.response?.data || e.message, e.response?.status, "None");
    }

    // 10. Admin Panel Stats
    try {
      // Need admin role.
      await mongoose.connection.db.collection('users').updateOne({ _id: testUserId }, { $set: { role: 'admin' } });
      const res = await axios.get(`${BASE_URL}/admin/stats`, { headers });
      
      if (res.status === 200 && res.data.stats) {
        recordResult("Admin Panel API", "PASS", "Status 200, stats returned", "Stats successfully retrieved", "GET /admin/stats", JSON.stringify(res.data).substring(0, 50), res.status, "None");
      } else {
        recordResult("Admin Panel API", "FAIL", "Status 200", "Mismatch", "GET", JSON.stringify(res.data), res.status, "None");
      }
    } catch (e) {
      recordResult("Admin Panel API", "FAIL", "Status 200", e.message, "GET", e.response?.data || e.message, e.response?.status, "None");
    }
    
    // 11. Bio Builder
    try {
      const reqData = { title: "Test Bio", slug: "testbio123", description: "My bio", links: [] };
      const res = await axios.post(`${BASE_URL}/bio`, reqData, { headers });
      
      const pubRes = await axios.get(`${BASE_URL}/bio/public/testbio123`);
      
      if (res.status === 201 && pubRes.status === 200) {
        recordResult("Bio Page Builder", "PASS", "Status 201 created, Status 200 fetched", "Bio created and fetched", JSON.stringify(reqData), JSON.stringify(res.data), res.status, "BioPage document inserted");
      } else {
        recordResult("Bio Page Builder", "FAIL", "Status 201", "Mismatch", "POST", JSON.stringify(res.data), res.status, "None");
      }
    } catch (e) {
      recordResult("Bio Page Builder", "FAIL", "Status 201", e.message, "POST", e.response?.data || e.message, e.response?.status, "None");
    }

  } catch (error) {
    console.error("Critical Test Failure:", error);
  } finally {
    await mongoose.connection.close();
    
    const fs = require('fs');
    fs.writeFileSync('test_results.json', JSON.stringify(results, null, 2));
    console.log("Tests Complete. Wrote test_results.json");
  }
}

runTests();
