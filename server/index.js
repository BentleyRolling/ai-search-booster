import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://admin.shopify.com',
    'https://*.myshopify.com',
    'https://ai-search-booster-frontend.onrender.com'
  ],
  credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.shopify.com https://admin.shopify.com https://*.myshopify.com");
  next();
});

app.get('/', (req, res) => {
  res.send('AI Search Booster backend is running!');
});

// Mount auth routes
import authRoutes from './routes/auth.js';
app.use('/api/auth', authRoutes);

import productRoutes from './routes/products.js';
app.use('/api/products', productRoutes);

app.get('/api/usage', (req, res) => {
  res.json({
    used: 0,
    limit: 500,
    plan: 'Pro'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
