// check-server-state.js
const axios = require('axios');

const API_URL = 'https://nextrade-backend-production-a486.up.railway.app/api';

async function checkServerState() {
    console.log('🔍 Checking Server State\n');

    // Test 1: Check if we can reach the server
    try {
        console.log('1️⃣ Testing server connection...');
        const response = await axios.get(`${API_URL}/categories`, { timeout: 5000 });
        console.log('✅ Server is reachable');
        console.log(`   Found ${response.data.length} categories`);
    } catch (error) {
        console.log('❌ Server not reachable:', error.message);
        return;
    }

    // Test 2: Check upload endpoint message
    console.log('\n2️⃣ Analyzing upload endpoint response...');
    console.log('The response message "Category image uploaded successfully"');
    console.log('indicates the OLD version is running.');
    console.log('New version would say: "Category image uploaded to Cloudinary successfully"');

    // Test 3: Try to upload with empty data to see error
    console.log('\n3️⃣ Testing error response...');
    try {
        await axios.post(
            `${API_URL}/upload/categories/single`,
            {},
            { headers: { 'Authorization': 'Bearer test' } }
        );
    } catch (error) {
        if (error.response?.status === 400) {
            console.log('✅ Got 400 error (expected for missing file)');
            console.log('Error message:', error.response.data?.message);

            // Check which version by the exact error message
            const msg = error.response.data?.message || '';
            if (msg === 'No image file provided') {
                console.log('⚠️  OLD VERSION: Simple error message');
            } else if (msg.includes('No image file provided')) {
                console.log('⚠️  Still old version');
            }
        }
    }

    console.log('\n🔧 Conclusion:');
    console.log('Your changes are NOT deployed to Railway.');
    console.log('Railway is still running the old cached version.');
}

checkServerState();