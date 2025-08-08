const https = require('https');

// Test with fresh gameId
const testWithGameId = JSON.stringify({
  address: "0x607ABc57c1EAdEd849198c91D00e2D8b2E680653",
  winTypes: ["row"],
  gameId: Math.floor(Date.now() / 1000),
  dryRun: true
});

// Test without gameId
const testWithoutGameId = JSON.stringify({
  address: "0x607ABc57c1EAdEd849198c91D00e2D8b2E680653",
  winTypes: ["row"],
  dryRun: true
});

function runTest(data, label) {
  return new Promise((resolve) => {
    console.log(`\n=== ${label} ===`);
    console.log('Payload:', data);
    
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
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
          const parsed = JSON.parse(body);
          console.log('Response:', JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log('Raw response:', body);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`Error: ${e.message}`);
      resolve();
    });

    req.write(data);
    req.end();
  });
}

async function runTests() {
  await runTest(testWithGameId, 'WITH GAMEID');
  await runTest(testWithoutGameId, 'WITHOUT GAMEID');
}

runTests();
