const axios = require('axios');
const mongoose = require('mongoose');

async function runTests() {
    console.log("Running Backend/API Verification Tests...\n");
    try {
        await mongoose.connect('mongodb://localhost:27017/url-shortener');
        const email = 'test_api_' + Date.now() + '@example.com';
        const pass = 'password123';
        const apiKey = 'test_api_key_' + Date.now();
        const baseUrl = 'http://localhost:5000';
        
        let res = await axios.get(`${baseUrl}/api/csrf-token`);
        const csrfToken = res.data.csrfToken;
        let cookie = res.headers['set-cookie'].join('; ');
        
        await axios.post(`${baseUrl}/api/auth/register`, { email, password: pass }, {
            headers: { 'x-csrf-token': csrfToken, Cookie: cookie }
        });
        
        await mongoose.connection.db.collection('users').updateOne(
          { email },
          { $set: { apiKey } }
        );

        const authHeaders = {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
        };

        let itemId;
        let shortCode;

        console.log("TEST: Create shortened URL");
        try {
            const createRes = await axios.post(`${baseUrl}/root/item`, { longUrl: 'https://example.com' }, { headers: authHeaders });
            itemId = createRes.data.item_id || createRes.data._id;
            shortCode = createRes.data.shortCode;
            console.log(`[PASS] Created item_id: ${itemId}\n`);
        } catch (e) {
            console.log(`[FAIL] Create shortened URL: ${e.response?.data?.message || e.message}\n`);
            return;
        }

        console.log("TEST: List shortened URLs");
        try {
            const listRes = await axios.get(`${baseUrl}/root/item`, { headers: authHeaders });
            if (Array.isArray(listRes.data.urls) && listRes.data.urls.length > 0) {
                console.log(`[PASS] Found ${listRes.data.urls.length} URLs\n`);
            } else {
                console.log(`[FAIL] List shortened URLs: Empty array\n`);
            }
        } catch (e) {
            console.log(`[FAIL] List shortened URLs: ${e.response?.data?.message || e.message}\n`);
        }

        console.log("TEST: Retrieve shortened URL by id");
        try {
            const getRes = await axios.get(`${baseUrl}/${shortCode}`, { maxRedirects: 0, validateStatus: null });
            if (getRes.status === 302 && getRes.headers.location === 'https://example.com') {
                console.log(`[PASS] Retrieved and redirected properly\n`);
            } else {
                console.log(`[FAIL] Retrieve shortened URL by id: Status ${getRes.status}\n`);
            }
        } catch (e) {
            console.log(`[FAIL] Retrieve shortened URL by id: ${e.response?.data?.message || e.message}\n`);
        }

        console.log("TEST: Delete shortened URL");
        try {
            const delRes = await axios.delete(`${baseUrl}/api/urls/${itemId}`, { headers: authHeaders });
            if (delRes.status === 200) {
                console.log(`[PASS] Deleted successfully\n`);
            } else {
                console.log(`[FAIL] Delete shortened URL: Status ${delRes.status}\n`);
            }
        } catch (e) {
            console.log(`[FAIL] Delete shortened URL: ${e.response?.data?.message || e.message}\n`);
        }

        console.log("TEST: Shortened URL create-and-delete smoke test");
        try {
            const smokeCreate = await axios.post(`${baseUrl}/root/item`, { longUrl: 'https://smoke.com' }, { headers: authHeaders });
            const smokeId = smokeCreate.data.item_id || smokeCreate.data._id;
            const smokeDel = await axios.delete(`${baseUrl}/api/urls/${smokeId}`, { headers: authHeaders });
            if (smokeDel.status === 200) {
                console.log(`[PASS] Smoke test passed\n`);
            } else {
                console.log(`[FAIL] Smoke test failed\n`);
            }
        } catch (e) {
            console.log(`[FAIL] Shortened URL create-and-delete smoke test: ${e.response?.data?.message || e.message}\n`);
        }

        console.log("TEST: Shortened URL lifecycle");
        try {
            const lCreate = await axios.post(`${baseUrl}/root/item`, { longUrl: 'https://lifecycle.com' }, { headers: authHeaders });
            const lId = lCreate.data.item_id || lCreate.data._id;
            const lCode = lCreate.data.shortCode;
            
            await axios.get(`${baseUrl}/${lCode}`, { maxRedirects: 0, validateStatus: null }); 
            
            await axios.put(`${baseUrl}/api/urls/${lId}`, { longUrl: 'https://lifecycle-updated.com' }, { headers: authHeaders }); 
            
            const lDel = await axios.delete(`${baseUrl}/api/urls/${lId}`, { headers: authHeaders }); 
            if (lDel.status === 200) {
                console.log(`[PASS] Lifecycle completed\n`);
            } else {
                console.log(`[FAIL] Lifecycle failed\n`);
            }
        } catch (e) {
            console.log(`[FAIL] Shortened URL lifecycle: ${e.response?.data?.message || e.message}\n`);
        }

    } catch (e) {
        console.error("Setup failed:", e.message);
    } finally {
        await mongoose.connection.close();
    }
}
runTests();
