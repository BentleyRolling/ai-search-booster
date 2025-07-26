import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
const ensureLogsDir = async () => {
  try {
    await fs.access(logsDir);
  } catch {
    await fs.mkdir(logsDir, { recursive: true });
  }
};

// Log unknown questions for review
router.post('/unknown-question', async (req, res) => {
  try {
    await ensureLogsDir();
    
    const { question, bestMatch, confidence, timestamp } = req.body;
    
    const logEntry = {
      timestamp,
      question,
      bestMatch,
      confidence,
      needsReview: true
    };
    
    const logFile = path.join(logsDir, 'unknown-questions.jsonl');
    const logLine = JSON.stringify(logEntry) + '\n';
    
    await fs.appendFile(logFile, logLine);
    
    console.log('Unknown question logged:', question);
    res.json({ success: true, message: 'Question logged for review' });
  } catch (error) {
    console.error('Error logging unknown question:', error);
    res.status(500).json({ success: false, error: 'Failed to log question' });
  }
});

// Log user feedback on chatbot responses
router.post('/feedback', async (req, res) => {
  try {
    await ensureLogsDir();
    
    const { messageId, question, answer, isHelpful, timestamp } = req.body;
    
    const feedbackEntry = {
      timestamp,
      messageId,
      question,
      answer,
      isHelpful,
      needsReview: !isHelpful // Only review negative feedback
    };
    
    const logFile = path.join(logsDir, 'chatbot-feedback.jsonl');
    const logLine = JSON.stringify(feedbackEntry) + '\n';
    
    await fs.appendFile(logFile, logLine);
    
    console.log(`Feedback logged: ${isHelpful ? 'Positive' : 'Negative'} for question: "${question}"`);
    res.json({ success: true, message: 'Feedback recorded' });
  } catch (error) {
    console.error('Error logging feedback:', error);
    res.status(500).json({ success: false, error: 'Failed to log feedback' });
  }
});

// Get unknown questions for admin review (optional endpoint)
router.get('/unknown-questions', async (req, res) => {
  try {
    const logFile = path.join(logsDir, 'unknown-questions.jsonl');
    
    try {
      const data = await fs.readFile(logFile, 'utf8');
      const questions = data.trim().split('\n')
        .filter(line => line)
        .map(line => JSON.parse(line))
        .filter(entry => entry.needsReview)
        .slice(-50); // Last 50 questions
      
      res.json(questions);
    } catch (fileError) {
      // File doesn't exist yet
      res.json([]);
    }
  } catch (error) {
    console.error('Error reading unknown questions:', error);
    res.status(500).json({ error: 'Failed to read questions' });
  }
});

// Get feedback for admin review (optional endpoint)
router.get('/feedback', async (req, res) => {
  try {
    const logFile = path.join(logsDir, 'chatbot-feedback.jsonl');
    
    try {
      const data = await fs.readFile(logFile, 'utf8');
      const feedback = data.trim().split('\n')
        .filter(line => line)
        .map(line => JSON.parse(line))
        .slice(-100); // Last 100 feedback entries
      
      res.json(feedback);
    } catch (fileError) {
      // File doesn't exist yet
      res.json([]);
    }
  } catch (error) {
    console.error('Error reading feedback:', error);
    res.status(500).json({ error: 'Failed to read feedback' });
  }
});

export default router;