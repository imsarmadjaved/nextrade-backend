// test-cloudinary-config.js
require('dotenv').config();

console.log('🔧 Checking Cloudinary Configuration\n');

// Check if .env is loaded
console.log('📄 Environment Variables Loaded:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET');

// Try to require cloudinary
try {
    const cloudinary = require('cloudinary').v2;
    console.log('\n✅ Cloudinary module loaded successfully');

    // Try to configure
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    console.log('✅ Cloudinary configured');

    // Test with a simple upload
    console.log('\n🧪 Testing Cloudinary connection...');
    cloudinary.uploader.upload(
        'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        { folder: 'test' },
        function (error, result) {
            if (error) {
                console.error('❌ Cloudinary test failed:', error.message);

                if (error.message.includes('Invalid credentials')) {
                    console.log('\n🔑 INVALID CREDENTIALS DETECTED!');
                    console.log('Please check:');
                    console.log('1. Your .env file has correct values');
                    console.log('2. Values match your Cloudinary Dashboard');
                    console.log('3. .env file is in the correct directory');
                }
            } else {
                console.log('✅ Cloudinary connection successful!');
                console.log('Uploaded to:', result.secure_url);
            }
        }
    );

} catch (error) {
    console.error('❌ Error loading cloudinary:', error.message);
}