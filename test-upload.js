require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testUpload() {
    try {
        console.log('Testing Cloudinary configuration...');
        console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);

        // Test 1: Upload to categories folder
        console.log('\nTest 1: Uploading to categories folder...');
        const result1 = await cloudinary.uploader.upload(
            'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            {
                folder: 'categories',
                public_id: 'test-category-' + Date.now()
            }
        );
        console.log('✅ Categories upload successful:', result1.secure_url);

        // Test 2: Upload to products folder
        console.log('\nTest 2: Uploading to products folder...');
        const result2 = await cloudinary.uploader.upload(
            'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            {
                folder: 'products',
                public_id: 'test-product-' + Date.now()
            }
        );
        console.log('✅ Products upload successful:', result2.secure_url);

        // Test 3: List folders
        console.log('\nTest 3: Listing folders...');
        const folders = await cloudinary.api.root_folders();
        console.log('📁 Folders:', folders.folders);

        console.log('\n🎉 All tests passed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    }
}

testUpload();