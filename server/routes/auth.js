import express from 'express';
const router = express.Router();

// ✅ This route will confirm the backend is connected properly
router.get('/', (req, res) => {
  res.send('✅ Auth route reached successfully!');
});

// You can later add POST /auth or Shopify OAuth logic here

export default router;
