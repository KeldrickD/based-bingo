const https = require('https');

const data = JSON.stringify({
  address: "0x607ABc57c1EAdEd849198c91D00e2D8b2E680653",
  winTypes: ["row"],
  // gameId: Math.floor(Date.now() / 1000), // Test without gameId first
  dryRun: true
});

const options = {
  hostname: 'www.basedbingo.xyz',
  port: 443,
  path: '/api/award-wins',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:', body);
    try {
      const parsed = JSON.parse(body);
      console.log('Parsed response:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Could not parse JSON response');
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(data);
req.end();
