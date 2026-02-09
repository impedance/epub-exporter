import fs from 'fs';
import path from 'path';
import dns from 'dns';
import DropboxClient from '../dropbox_client.js';

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2 && !line.trim().startsWith('#')) {
            const potentialKey = parts[0];
            if (potentialKey) {
                const key = potentialKey.trim();
                const value = parts.slice(1).join('=').trim();
                process.env[key] = value;
            }
        }
    });
}

console.log('Loaded env:', {
    APP_KEY: process.env.DROPBOX_APP_KEY,
    APP_SECRET: process.env.DROPBOX_APP_SECRET ? '***' : 'missing',
    REFRESH_TOKEN: process.env.DROPBOX_REFRESH_TOKEN ? '***' : 'missing'
});

async function run() {
    const client = new DropboxClient();
    try {
        console.log('Checking connection...');
        const isConnected = await client.isConnected();
        console.log('Is connected:', isConnected);

        if (isConnected) {
            console.log('Attempting upload...');
            const content = 'Hello Dropbox Unicode';
            const blob = new Blob([content], { type: 'text/plain' });
            const filename = `test-тест-${Date.now()}.txt`;

            const dropboxPath = await client.uploadFile(blob, filename);
            console.log('Upload success:', dropboxPath);
        } else {
            console.error('Dropbox not connected!');
        }
    } catch (error) {
        const err = /** @type {any} */ (error);
        console.error('Error during test:', err);
        if (err.cause) console.error('Cause:', err.cause);
    }
}

run();
