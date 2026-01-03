// test-deps-fix.js
const axios = require('axios');

async function testDepsFix() {
    console.log('🔧 Testing after dependency fix\n');

    try {
        const response = await axios.get('https://nextrade-backend-production-a486.up.railway.app/api/categories');
        console.log('✅ Server is up');
        console.log('Categories:', response.data.length);

        // Try to trigger a rebuild
        console.log('\n📦 Dependencies should now install correctly');
        console.log('Check Railway logs for successful npm install');

    } catch (error) {
        console.log('❌ Server error:', error.message);
    }
}

testDepsFix();