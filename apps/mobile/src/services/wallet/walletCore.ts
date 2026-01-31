import { ethers } from 'ethers';
import * as ExpoCrypto from 'expo-crypto';

// Derivation paths for different chains (BIP44)
const DERIVATION_PATHS = {
  evm: "m/44'/60'/0'/0/0",      // Ethereum, BSC, Polygon, etc.
  solana: "m/44'/501'/0'/0'",   // Solana
  sui: "m/44'/784'/0'/0'/0'",   // SUI
  tron: "m/44'/195'/0'/0/0",    // TRON
};

// TRON address prefix
const TRON_PREFIX = 0x41;

export interface DerivedWallet {
  address: string;
  publicKey: string;
  chainType: 'evm' | 'solana' | 'sui' | 'tron';
  path: string;
}

export interface WalletAccount {
  index: number;
  evm?: DerivedWallet;
  solana?: DerivedWallet;
  sui?: DerivedWallet;
  tron?: DerivedWallet;
}

// Base58 alphabet for TRON
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buffer: Uint8Array): string {
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  
  let result = '';
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result += BASE58_ALPHABET[0];
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hashHex = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    Array.from(data).map(b => String.fromCharCode(b)).join(''),
    { encoding: ExpoCrypto.CryptoEncoding.HEX }
  );
  return new Uint8Array(hashHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
}

async function doubleSha256(data: Uint8Array): Promise<Uint8Array> {
  const first = await sha256(data);
  return sha256(first);
}

async function base58CheckEncode(payload: Uint8Array): Promise<string> {
  const checksum = await doubleSha256(payload);
  const buffer = new Uint8Array(payload.length + 4);
  buffer.set(payload);
  buffer.set(checksum.slice(0, 4), payload.length);
  return base58Encode(buffer);
}

class WalletCore {
  /**
   * Generate a new mnemonic phrase (12 or 24 words)
   */
  generateMnemonic(words: 12 | 24 = 12): string {
    // ethers v6: Mnemonic is now a class with static methods
    const entropy = ExpoCrypto.getRandomBytes(words === 12 ? 16 : 32);
    const mnemonic = ethers.Mnemonic.fromEntropy(entropy);
    return mnemonic.phrase;
  }

  /**
   * Validate a mnemonic phrase
   */
  validateMnemonic(mnemonic: string): boolean {
    try {
      const words = mnemonic.trim().split(/\s+/);
      if (words.length !== 12 && words.length !== 24) {
        return false;
      }
      // ethers v6: Use Mnemonic.isValidMnemonic
      return ethers.Mnemonic.isValidMnemonic(mnemonic.trim());
    } catch {
      return false;
    }
  }

  /**
   * Get word count from mnemonic
   */
  getWordCount(mnemonic: string): number {
    return mnemonic.trim().split(/\s+/).length;
  }

  /**
   * Derive all chain wallets from mnemonic
   */
  async deriveWallets(mnemonic: string, accountIndex: number = 0): Promise<WalletAccount> {
    const account: WalletAccount = { index: accountIndex };

    // Derive EVM wallet
    account.evm = this.deriveEVMWallet(mnemonic, accountIndex);

    // Derive Solana wallet (simplified - uses deterministic derivation)
    account.solana = await this.deriveSolanaWallet(mnemonic);

    // Derive SUI wallet (simplified - uses deterministic derivation)
    account.sui = await this.deriveSUIWallet(mnemonic);

    // Derive TRON wallet
    account.tron = await this.deriveTRONWallet(mnemonic, accountIndex);

    return account;
  }

  /**
   * Derive EVM wallet (Ethereum, BSC, Polygon, etc.)
   */
  deriveEVMWallet(mnemonic: string, accountIndex: number = 0): DerivedWallet {
    const path = DERIVATION_PATHS.evm.replace(/\/0$/, `/${accountIndex}`);
    // ethers v6: HDNodeWallet.fromPhrase
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
    
    return {
      address: hdNode.address,
      publicKey: hdNode.publicKey,
      chainType: 'evm',
      path,
    };
  }

  /**
   * Derive Solana wallet using deterministic method
   */
  async deriveSolanaWallet(mnemonic: string): Promise<DerivedWallet> {
    // For Solana, we use a deterministic derivation from the mnemonic
    // This creates a consistent address from the seed
    const seed = ethers.Mnemonic.fromPhrase(mnemonic).computeSeed();
    
    // Use first 32 bytes as the "private key" seed for address generation
    const seedBytes = ethers.getBytes(seed).slice(0, 32);
    
    // Create a deterministic "public key" hash for the address
    const hashHex = await ExpoCrypto.digestStringAsync(
      ExpoCrypto.CryptoDigestAlgorithm.SHA256,
      Array.from(seedBytes).map(b => String.fromCharCode(b)).join(''),
      { encoding: ExpoCrypto.CryptoEncoding.HEX }
    );
    
    const addressBytes = new Uint8Array(hashHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const address = base58Encode(addressBytes);
    
    return {
      address,
      publicKey: hashHex,
      chainType: 'solana',
      path: DERIVATION_PATHS.solana,
    };
  }

  /**
   * Derive SUI wallet using deterministic method
   */
  async deriveSUIWallet(mnemonic: string): Promise<DerivedWallet> {
    // For SUI, derive deterministically from mnemonic
    const seed = ethers.Mnemonic.fromPhrase(mnemonic).computeSeed();
    const seedBytes = ethers.getBytes(seed);
    
    // Use bytes 32-64 for SUI to get a different address than Solana
    const suiSeedBytes = seedBytes.slice(32, 64);
    
    const hashHex = await ExpoCrypto.digestStringAsync(
      ExpoCrypto.CryptoDigestAlgorithm.SHA256,
      Array.from(suiSeedBytes).map(b => String.fromCharCode(b)).join(''),
      { encoding: ExpoCrypto.CryptoEncoding.HEX }
    );
    
    // SUI addresses are 0x prefixed
    const address = '0x' + hashHex;
    
    return {
      address,
      publicKey: hashHex,
      chainType: 'sui',
      path: DERIVATION_PATHS.sui,
    };
  }

  /**
   * Derive TRON wallet
   */
  async deriveTRONWallet(mnemonic: string, accountIndex: number = 0): Promise<DerivedWallet> {
    const path = DERIVATION_PATHS.tron.replace(/\/0$/, `/${accountIndex}`);
    // ethers v6: HDNodeWallet.fromPhrase
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
    
    // Get the public key hash (last 20 bytes of keccak256)
    const publicKeyBytes = ethers.getBytes(hdNode.publicKey);
    const addressHash = ethers.keccak256(publicKeyBytes.slice(1)); // Remove 0x04 prefix
    const addressBytes = ethers.getBytes(addressHash).slice(-20);
    
    // Add TRON prefix and encode
    const tronAddressBytes = new Uint8Array(21);
    tronAddressBytes[0] = TRON_PREFIX;
    tronAddressBytes.set(addressBytes, 1);
    
    const address = await base58CheckEncode(tronAddressBytes);
    
    return {
      address,
      publicKey: hdNode.publicKey,
      chainType: 'tron',
      path,
    };
  }

  /**
   * Get EVM signer for transactions
   */
  getEVMSigner(mnemonic: string, accountIndex: number = 0): ethers.HDNodeWallet {
    const path = DERIVATION_PATHS.evm.replace(/\/0$/, `/${accountIndex}`);
    return ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
  }

  /**
   * Get EVM signer connected to a provider
   */
  getEVMSignerWithProvider(mnemonic: string, rpcUrl: string, accountIndex: number = 0): ethers.HDNodeWallet {
    const wallet = this.getEVMSigner(mnemonic, accountIndex);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return wallet.connect(provider) as ethers.HDNodeWallet;
  }

  /**
   * Get address for a specific chain type
   */
  getAddressForChain(account: WalletAccount, chainType: string): string | null {
    switch (chainType) {
      case 'evm':
        return account.evm?.address || null;
      case 'solana':
        return account.solana?.address || null;
      case 'sui':
        return account.sui?.address || null;
      case 'tron':
        return account.tron?.address || null;
      default:
        return account.evm?.address || null; // Default to EVM
    }
  }

  /**
   * Sign a message with EVM wallet
   */
  async signMessage(mnemonic: string, message: string, accountIndex: number = 0): Promise<string> {
    const signer = this.getEVMSigner(mnemonic, accountIndex);
    return signer.signMessage(message);
  }

  /**
   * Sign a transaction with EVM wallet
   */
  async signTransaction(mnemonic: string, tx: ethers.TransactionRequest, accountIndex: number = 0): Promise<string> {
    const signer = this.getEVMSigner(mnemonic, accountIndex);
    return signer.signTransaction(tx);
  }
}

export const walletCore = new WalletCore();
