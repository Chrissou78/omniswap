// test-rpc.js
const address = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'; // UNI token
const rpcUrl = 'https://eth.llamarpc.com';

async function test() {
  const nameSelector = '0x06fdde03';
  const symbolSelector = '0x95d89b41';
  const decimalsSelector = '0x313ce567';

  console.log('Testing RPC calls for UNI token...\n');

  for (const [name, selector] of [['name', nameSelector], ['symbol', symbolSelector], ['decimals', decimalsSelector]]) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to: address, data: selector }, 'latest'],
        }),
      });
      
      const json = await response.json();
      console.log(`${name}:`, json.result);
      
      if (name === 'decimals') {
        console.log(`  decoded: ${parseInt(json.result, 16)}`);
      } else {
        // Decode string
        const hex = json.result.slice(2);
        const offset = parseInt(hex.slice(0, 64), 16) * 2;
        const length = parseInt(hex.slice(offset, offset + 64), 16);
        const strHex = hex.slice(offset + 64, offset + 64 + length * 2);
        let str = '';
        for (let i = 0; i < strHex.length; i += 2) {
          const code = parseInt(strHex.slice(i, i + 2), 16);
          if (code >= 32 && code < 127) str += String.fromCharCode(code);
        }
        console.log(`  decoded: "${str}"`);
      }
    } catch (error) {
      console.log(`${name} error:`, error.message);
    }
  }
}

test();
