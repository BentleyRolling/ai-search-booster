import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(process.cwd(), 'client/dist')));

app.get('/', (req, res) => {
  res.send('AI Search Booster backend is running!');
});

// Mount auth routes
import authRoutes from './routes/auth.js';
app.use('/api/auth', authRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
