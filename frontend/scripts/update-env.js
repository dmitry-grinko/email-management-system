const fs = require('fs');
const path = require('path');

const backendUrl = process.env.BACKEND_URL;
if (!backendUrl) {
    console.error('BACKEND_URL environment variable is not set');
    process.exit(1);
}

const googleClientId = process.env.GOOGLE_CLIENT_ID;
if (!googleClientId) {
    console.error('GOOGLE_CLIENT_ID environment variable is not set');
    process.exit(1);
}

console.log('backendUrl', backendUrl);
console.log('googleClientId', googleClientId);

const webSocketUrl = backendUrl.replace('https://', 'wss://');
const connectionsUrl = `${backendUrl}/@connections`;

const environments = ['environment.ts', 'environment.prod.ts'];
const envPath = path.join(__dirname, '..', 'src', 'environments');

environments.forEach(file => {
    const filePath = path.join(envPath, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the URLs
    content = content.replace(/apiUrl:.*,/g, `apiUrl: '${backendUrl}',`);
    content = content.replace(/webSocketUrl:.*,/g, `webSocketUrl: '${webSocketUrl}',`);
    content = content.replace(/webSocketConnectionsUrl:.*,/g, `webSocketConnectionsUrl: '${connectionsUrl}',`);
    content = content.replace(/googleClientId:.*,/g, `googleClientId: '${googleClientId}',`);

    console.log('content', content);

    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file} with new environment variables`);
});

