const axios = require('axios');

async function testAnonymousShorten() {
    console.log("TEST: Anonymous URL shortening (no auth)");
    try {
        const baseUrl = 'http://localhost:5000';
        const res = await axios.post(`${baseUrl}/api/shorten`, { longUrl: 'https://example.com/anonymous-test' }, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.status === 201 && res.data.shortCode) {
            console.log(`[PASS] Anonymous shortening succeeded. shortCode: ${res.data.shortCode}`);
            
            // Verify redirect works
            const redirectRes = await axios.get(`${baseUrl}/${res.data.shortCode}`, { maxRedirects: 0, validateStatus: null });
            if (redirectRes.status === 302 && redirectRes.headers.location === 'https://example.com/anonymous-test') {
                console.log(`[PASS] Anonymous short URL redirects correctly`);
            } else {
                console.log(`[FAIL] Anonymous redirect: Status ${redirectRes.status}, Location: ${redirectRes.headers.location}`);
            }
        } else {
            console.log(`[FAIL] Anonymous shortening: Status ${res.status}`);
        }
    } catch (e) {
        console.log(`[FAIL] Anonymous shortening: ${e.response?.status} ${e.response?.data?.message || e.message}`);
    }
}
testAnonymousShorten();
