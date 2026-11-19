// The list of methods shown in the app.
// To add a method: create methods/<name>.js (copy methods/_template.js) and add ONE import + ONE entry below.
import caesar from './methods/caesar.js';
import vigenere from './methods/vigenere.js';
import playfair from './methods/playfair.js';
import railfence from './methods/railfence.js';
import hill from './methods/hill.js';
import aes from './methods/aes.js';
import rsa from './methods/rsa.js';
import diffiehellman from './methods/diffiehellman.js';
import sha256 from './methods/sha256.js';
import base64 from './methods/base64.js';

export const methods = [
  caesar,
  vigenere,
  playfair,
  railfence,
  hill,
  aes,
  rsa,
  diffiehellman,
  sha256,
  base64,
];

// Display order of categories in the sidebar. Unknown categories are appended automatically.
export const categoryOrder = ['Classical', 'Symmetric', 'Asymmetric', 'Key Exchange', 'Hashing', 'Encoding'];
