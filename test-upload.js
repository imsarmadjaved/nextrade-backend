// test-upload-working.js
const axios = require('axios');
const FormData = require('form-data');

const API_URL = 'https://nextrade-backend-production-a486.up.railway.app/api';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjY0NjVmOWU0N2E1ZGZlNGExOGUxYyIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2NzQ2MTg0MSwiZXhwIjoxNzY3NTQ4MjQxfQ.I9fwtxCwQ5D22SR4A-5WCJklImlwnNT2e8BwC073LLQ';

async function testUpload() {
    console.log('📤 Testing Upload Endpoint\n');

    // Create a simple image buffer
    const imageBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0xFF, 0xC4, 0x00, 0x14, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF,
        0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xFF, 0xD9
    ]);

    try {
        const formData = new FormData();
        formData.append('image', imageBuffer, {
            filename: 'test-upload.jpg',
            contentType: 'image/jpeg'
        });

        console.log('Uploading test image...');

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

        console.log('\n✅ Upload response:');
        console.log(JSON.stringify(response.data, null, 2));

        const imageUrl = response.data.imageUrl;

        if (imageUrl.includes('cloudinary.com')) {
            console.log('\n🎉🎉🎉 CLOUDINARY SUCCESS! 🎉🎉🎉');
            console.log('Image uploaded to:', imageUrl);
        } else if (imageUrl.startsWith('/uploads/')) {
            console.log('\n⚠️  Still uploading locally to:', imageUrl);
            console.log('This means Cloudinary is not configured in Railway.');
        }

    } catch (error) {
        console.log('\n❌ Upload failed:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error:', error.response.data?.message);
        }
    }
}

testUpload();