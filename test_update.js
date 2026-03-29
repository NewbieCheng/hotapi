
import handler from './api/activation_v2.js';
import crypto from 'crypto';

const API_SALT = "XHS_NO_996_SECURE_API_SALT_V2_888!@#";

function decryptPayload(encryptedBase64, ivBase64, deviceId) {
    if (!deviceId) deviceId = "default_device";
    const key = Buffer.from((deviceId + API_SALT).padEnd(32, '0').slice(0, 32));
    const iv = Buffer.from(ivBase64, 'base64');
    const fullBuffer = Buffer.from(encryptedBase64, 'base64');
    
    // GCM tag is the last 16 bytes
    const tag = fullBuffer.slice(fullBuffer.length - 16);
    const encrypted = fullBuffer.slice(0, fullBuffer.length - 16);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
}

async function runTest() {
    const deviceId = "test_device_123";
    const req = {
        method: "POST",
        query: { action: "check_update" },
        body: {
            device_id: deviceId,
            version: "1.0.0"
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };

    const res = {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.body = data;
            return this;
        },
        setHeader: function() {},
        end: function() {}
    };

    console.log("--- Testing check_update Action ---");
    await handler(req, res);

    if (res.statusCode === 200) {
        console.log("Success! Status Code:", res.statusCode);
        if (res.body.e && res.body.i) {
            try {
                const decrypted = decryptPayload(res.body.e, res.body.i, deviceId);
                console.log("Decrypted Data:", JSON.stringify(decrypted, null, 2));
            } catch (err) {
                console.error("Decryption failed:", err.message);
            }
        } else {
            console.log("Response Body:", res.body);
        }
    } else {
        console.error("Failed! Status Code:", res.statusCode);
        console.error("Error Response:", res.body);
    }
}

runTest().catch(console.error);
