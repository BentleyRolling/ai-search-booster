import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('AI Search Booster backend is running!');
});

// Mount auth routes
import authRoutes from './routes/auth.js';
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(\`🚀 Server is running on port \${PORT}\`);
});
