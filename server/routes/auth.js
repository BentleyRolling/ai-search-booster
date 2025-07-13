import express from 'express';

const router = express.Router();

// Add any auth-related routes here
router.get('/callback', (req, res) => {
  res.send('Auth callback reached');
});

export default router;
