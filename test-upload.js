// test-redeployed.js
const axios = require('axios');
const FormData = require('form-data');

const API_URL = 'https://nextrade-backend-production-a486.up.railway.app/api';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjY0NjVmOWU0N2E1ZGZlNGExOGUxYyIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2NzQ2MTg0MSwiZXhwIjoxNzY3NTQ4MjQxfQ.I9fwtxCwQ5D22SR4A-5WCJklImlwnNT2e8BwC073LLQ';

async function testRedeployed() {
    console.log('🚀 Testing Redeployed Project\n');
    console.log('API URL:', API_URL);

    // Test 1: Check server health
    console.log('\n1️⃣ Checking server health...');
    try {
        const health = await axios.get(`${API_URL}/categories`, { timeout: 5000 });
        console.log('✅ Server responding');
        console.log('   Categories found:', health.data.length);
    } catch (error) {
        console.log('❌ Server not responding:', error.message);
        return;
    }

    // Test 2: Test OLD upload endpoint (should show if updated)
    console.log('\n2️⃣ Testing OLD upload endpoint (should show if updated)...');
    try {
        // Create minimal test image
        const imageBuffer = Buffer.from([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0xFF, 0xC4, 0x00, 0x14, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF,
            0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xFF, 0xD9
        ]);

        const formData = new FormData();
        formData.append('image', imageBuffer, {
            filename: 'redeploy-test.jpg',
            contentType: 'image/jpeg'
        });

        const response = await axios.post(
            `${API_URL}/upload/categories/single`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${TEST_TOKEN}`
                },
                timeout: 15000
            }
        );

        console.log('✅ Upload endpoint responded');
        console.log('   Message:', response.data.message);
        console.log('   Image URL:', response.data.imageUrl);

        // Check which version is running
        if (response.data.message.includes('Cloudinary')) {
            console.log('🎉 NEW VERSION DETECTED!');
            if (response.data.imageUrl.includes('cloudinary.com')) {
                console.log('✅✅✅ CLOUDINARY SUCCESS! ✅✅✅');
                console.log('   Cloudinary URL:', response.data.imageUrl);
            } else {
                console.log('⚠️  New version but not Cloudinary URL');
            }
        } else if (response.data.message === 'Category image uploaded successfully') {
            console.log('⚠️  OLD VERSION STILL RUNNING');
            console.log('   Got local path:', response.data.imageUrl);
        }

    } catch (error) {
        console.log('❌ Upload test failed:', error.message);
        if (error.response) {
            console.log('   Status:', error.response.status);
            console.log('   Error:', error.response.data?.message);
        }
    }

    // Test 3: Check if new test endpoints exist
    console.log('\n3️⃣ Checking for new test endpoints...');

    const testEndpoints = [
        '/upload/test-version',
        '/test/cloudinary-test',
        '/upload/v2/categories'
    ];

    for (const endpoint of testEndpoints) {
        try {
            await axios.get(`${API_URL}${endpoint}`, { timeout: 3000 });
            console.log(`✅ ${endpoint} - EXISTS`);
        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`❌ ${endpoint} - NOT FOUND`);
            } else if (error.response?.status === 401) {
                console.log(`✅ ${endpoint} - EXISTS (needs auth)`);
            } else {
                console.log(`❓ ${endpoint} - Error: ${error.message}`);
            }
        }
    }

    console.log('\n🔍 Analysis Complete');
}

testRedeployed();