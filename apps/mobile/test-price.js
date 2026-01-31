// test-price.js
async function testPrice() {
  // Test DexScreener API for ETH (WETH on Ethereum)
  const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  
  console.log('Testing DexScreener API...\n');
  
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${wethAddress}`);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Pairs found:', data.pairs?.length || 0);
    
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      console.log('\nFirst pair:');
      console.log('  Chain:', pair.chainId);
      console.log('  Price USD:', pair.priceUsd);
      console.log('  Base token:', pair.baseToken?.symbol);
    }
  } catch (error) {
    console.log('Error:', error.message);
  }

  // Test CoinGecko for ETH
  console.log('\n\nTesting CoinGecko API...\n');
  
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('ETH price:', data.ethereum?.usd);
  } catch (error) {
    console.log('Error:', error.message);
  }
}

testPrice();
