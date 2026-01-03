// test-cloudinary-config.js
require('dotenv').config();

// Test each import
console.log('🔧 Testing Cloudinary Configuration\n');

console.log('1. Testing config/cloudinary.js...');
try {
    const cloudinary1 = require('./config/cloudinary');
    console.log('✅ Config file loaded');
    console.log('Cloud Name:', cloudinary1.config().cloud_name);
} catch (error) {
    console.log('❌ Config file error:', error.message);
}

console.log('\n2. Testing middleware/upload.js...');
try {
    const middleware = require('./middleware/upload');
    console.log('✅ Middleware loaded');
} catch (error) {
    console.log('❌ Middleware error:', error.message);
}

console.log('\n3. Testing routes/uploadRoutes.js...');
try {
    const routes = require('./routes/uploadRoutes');
    console.log('✅ Routes loaded');
} catch (error) {
    console.log('❌ Routes error:', error.message);
}