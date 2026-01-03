// test-vars.js
const axios = require('axios');

const API_URL = 'https://nextrade-backend-production-a486.up.railway.app/api';

async function testVars() {
    console.log('🔍 Testing Environment Variables\n');

    try {
        const response = await axios.get(`${API_URL}/debug/vars`);
        console.log('✅ Debug endpoint response:');
        console.log(JSON.stringify(response.data, null, 2));

        const cloudName = response.data.specificVars.CLOUDINARY_CLOUD_NAME;

        if (cloudName === 'NOT FOUND') {
            console.log('\n❌ CLOUDINARY_CLOUD_NAME NOT FOUND!');
            console.log('Even though you set it, Railway is not injecting it.');
            console.log('\n🔧 Check:');
            console.log('1. Go to Railway Dashboard → Variables');
            console.log('2. Make sure CLOUDINARY_CLOUD_NAME is spelled EXACTLY');
            console.log('3. Make sure there are no spaces');
            console.log('4. Click "Redeploy" after saving');
        } else if (cloudName === 'dau4kgetn') {
            console.log('\n✅ Cloudinary cloud_name is correct!');
            console.log('The issue might be in your code reading the variables.');
        } else {
            console.log('\n⚠️  Cloudinary cloud_name is:', cloudName);
            console.log('Expected: dau4kgetn');
        }

    } catch (error) {
        console.log('❌ Could not reach debug endpoint:', error.message);
    }
}

testVars();