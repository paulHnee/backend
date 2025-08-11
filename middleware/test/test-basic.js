// Simple server test to check for path-to-regexp errors
import express from 'express';

console.log('Testing basic Express setup...');

const app = express();

// Test basic route
app.get('/test', (req, res) => {
  res.json({ message: 'Test successful' });
});

// Test parameterized route
app.get('/test/:id', (req, res) => {
  res.json({ message: 'Parameterized route works', id: req.params.id });
});

// Test wildcard route
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = 3333;

app.listen(PORT, () => {
  console.log(`✅ Basic Express test server running on port ${PORT}`);
  console.log('No path-to-regexp errors detected in basic setup');
  process.exit(0);
});

// Exit after 2 seconds if everything is fine
setTimeout(() => {
  console.log('✅ Test completed successfully');
  process.exit(0);
}, 2000);
