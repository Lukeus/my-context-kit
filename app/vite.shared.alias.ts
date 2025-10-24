import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const alias = {
  '@': path.resolve(__dirname, 'src/renderer'),
  '~main': path.resolve(__dirname, 'src/main')
};
