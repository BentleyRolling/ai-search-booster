/**
 * AI Search Booster - Production Rollback Utilities
 * Handles automatic rollback of high-risk AI-generated content
 * 
 * @author AI Search Booster Team
 * @version 1.0.0
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Determine if content should be rolled back based on risk score
 * 
 * @param {number} riskScore - Hallucination risk score (0.0-1.0)
 * @returns {boolean} True if rollback should be triggered
 */
function shouldRollback(riskScore) {
  return riskScore > 0.7;
}

/**
 * Rollback a draft to original content due to high hallucination risk
 * 
 * @param {string} draftId - Unique identifier for the draft
 * @param {Object} originalContent - Original Shopify content to restore
 * @param {Function} saveFn - Function to save the restored content
 * @returns {Promise<boolean>} True if rollback successful, false if failed
 */
async function rollbackDraft(draftId, originalContent, saveFn) {
  try {
    // Attempt to restore original content using provided save function
    await saveFn(draftId, originalContent);
    
    console.warn(`[ROLLBACK] Draft ${draftId} reverted due to high hallucination risk.`);
    console.warn(`[ROLLBACK] Original content restored for safety.`);
    
    return true;
    
  } catch (err) {
    console.error(`[ROLLBACK] Failed to restore original content for ${draftId}:`, err.message);
    console.error(`[ROLLBACK] Draft may contain high-risk AI content - manual review required`);
    
    // Never crash the app - fail silently but log the issue
    return false;
  }
}

/**
 * Log rollback event to structured log file
 * 
 * @param {Object} event - Rollback event data
 * @param {string} event.timestamp - ISO timestamp of rollback
 * @param {string} event.shop - Shop domain
 * @param {string} event.contentType - Type of content (product, collection, etc.)
 * @param {string} event.title - Content title
 * @param {number} event.riskScore - Risk score that triggered rollback
 * @param {boolean} event.rollbackTriggered - Whether rollback was triggered
 * @param {string} event.reason - Reason for rollback
 * @param {string} event.previousDraftId - ID of the rolled back draft
 * @returns {Promise<void>}
 */
async function logRollbackEvent(event) {
  try {
    // Ensure logs directory exists
    const logsDir = path.join(__dirname, '../logs');
    await fs.mkdir(logsDir, { recursive: true });
    
    const logFile = path.join(logsDir, 'rollbackLog.json');
    
    // Read existing log entries or create empty array
    let existing = '[]';
    try {
      existing = await fs.readFile(logFile, 'utf8');
    } catch (readError) {
      // File doesn't exist yet - will be created with first entry
      console.log('[ROLLBACK] Creating new rollback log file');
    }
    
    // Parse existing entries and add new event
    const entries = JSON.parse(existing);
    entries.push({
      ...event,
      loggedAt: new Date().toISOString() // Add log timestamp
    });
    
    // Write updated log file (non-blocking)
    await fs.writeFile(logFile, JSON.stringify(entries, null, 2), 'utf8');
    
    console.log(`[ROLLBACK] Event logged to rollback log: ${event.contentType} ${event.title}`);
    
  } catch (err) {
    console.error('[ROLLBACK] Failed to write rollback log:', err.message);
    // Never crash app for logging failures - fail silently
  }
}

/**
 * Create a rollback event object with required metadata
 * 
 * @param {Object} params - Event parameters
 * @param {string} params.shop - Shop domain
 * @param {string} params.contentType - Content type
 * @param {string} params.title - Content title
 * @param {number} params.riskScore - Risk score
 * @param {string} params.draftId - Draft ID
 * @param {string} params.reason - Rollback reason
 * @returns {Object} Structured rollback event
 */
function createRollbackEvent({ shop, contentType, title, riskScore, draftId, reason = 'Hallucination risk exceeded threshold' }) {
  return {
    timestamp: new Date().toISOString(),
    shop: shop || 'unknown',
    contentType: contentType || 'unknown',
    title: title || 'untitled',
    riskScore: riskScore || 0,
    rollbackTriggered: true,
    reason,
    previousDraftId: draftId || 'unknown'
  };
}

/**
 * Execute complete rollback process: check risk, rollback if needed, log event
 * 
 * @param {Object} params - Rollback parameters
 * @param {number} params.riskScore - Risk score to evaluate
 * @param {string} params.draftId - Draft identifier
 * @param {Object} params.originalContent - Original content to restore
 * @param {Function} params.saveFn - Save function for restoration
 * @param {string} params.shop - Shop domain
 * @param {string} params.contentType - Content type
 * @param {string} params.title - Content title
 * @returns {Promise<boolean>} True if rollback was executed, false otherwise
 */
async function executeRollbackIfNeeded(params) {
  const { riskScore, draftId, originalContent, saveFn, shop, contentType, title } = params;
  
  try {
    // Check if rollback is needed
    if (!shouldRollback(riskScore)) {
      return false; // No rollback needed
    }
    
    console.warn(`[ROLLBACK] High risk score detected (${riskScore}) - initiating rollback`);
    
    // Execute rollback
    const rollbackSuccess = await rollbackDraft(draftId, originalContent, saveFn);
    
    // Log rollback event regardless of success/failure
    const event = createRollbackEvent({
      shop,
      contentType,
      title,
      riskScore,
      draftId,
      reason: rollbackSuccess ? 
        'Hallucination risk exceeded threshold - content restored' : 
        'Rollback attempted but failed - manual review required'
    });
    
    await logRollbackEvent(event);
    
    return rollbackSuccess;
    
  } catch (error) {
    console.error('[ROLLBACK] Error during rollback execution:', error.message);
    
    // Log failed rollback attempt
    try {
      const failureEvent = createRollbackEvent({
        shop,
        contentType,
        title,
        riskScore,
        draftId,
        reason: `Rollback process failed: ${error.message}`
      });
      await logRollbackEvent(failureEvent);
    } catch (logError) {
      // Double failure - just log to console
      console.error('[ROLLBACK] Failed to log rollback failure:', logError.message);
    }
    
    return false;
  }
}

/**
 * Get rollback statistics from log file
 * 
 * @returns {Promise<Object>} Rollback statistics
 */
async function getRollbackStats() {
  try {
    const logFile = path.join(__dirname, '../logs/rollbackLog.json');
    const data = await fs.readFile(logFile, 'utf8');
    const entries = JSON.parse(data);
    
    return {
      totalRollbacks: entries.length,
      recentRollbacks: entries.filter(e => {
        const eventTime = new Date(e.timestamp);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return eventTime > oneDayAgo;
      }).length,
      averageRiskScore: entries.length > 0 ? 
        entries.reduce((sum, e) => sum + (e.riskScore || 0), 0) / entries.length : 0,
      lastRollback: entries.length > 0 ? entries[entries.length - 1].timestamp : null
    };
  } catch (error) {
    console.error('[ROLLBACK] Error getting rollback stats:', error.message);
    return {
      totalRollbacks: 0,
      recentRollbacks: 0,
      averageRiskScore: 0,
      lastRollback: null
    };
  }
}

export {
  shouldRollback,
  rollbackDraft,
  logRollbackEvent,
  createRollbackEvent,
  executeRollbackIfNeeded,
  getRollbackStats
};