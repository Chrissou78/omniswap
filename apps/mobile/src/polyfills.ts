// React Native polyfills - must be imported first
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Global Buffer polyfill
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// TextEncoder/TextDecoder are available in React Native 0.70+
// No need for external polyfill

export {};
