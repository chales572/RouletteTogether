import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 5173;

// Serve static files from dist folder
app.use(express.static(join(__dirname, 'dist')));

// Handle client-side routing - return index.html for all routes
app.use((req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nClient running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://10.145.164.94:${PORT}\n`);
});
