/**
 * AI Search Booster - Production Logging Utilities
 * Handles structured async logging for optimization sessions, warnings, rollbacks, and scoring
 * 
 * @author AI Search Booster Team
 * @version 1.0.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log levels for severity filtering
const LOG_LEVELS = {
  INFO: 'info',
  WARN: 'warn', 
  ERROR: 'error',
  EVENT: 'event',
  AUDIT: 'audit'
};

/**
 * Core logging function - handles all structured log writes
 * 
 * @param {string} level - Log level (info, warn, error, event, audit)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional structured data
 * @returns {Promise<void>}
 */
async function writeLog(level, message, metadata = {}) {
  try {
    // Ensure logs directory exists
    const logsDir = path.join(__dirname, '../logs');
    await fs.mkdir(logsDir, { recursive: true });
    
    const logFile = path.join(logsDir, 'appLog.json');
    
    // Create structured log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...metadata,
      processId: process.pid,
      nodeVersion: process.version
    };
    
    // Read existing log entries or create empty array
    let existingLogs = [];
    try {
      const existingData = await fs.readFile(logFile, 'utf8');
      existingLogs = JSON.parse(existingData);
    } catch (readError) {
      // File doesn't exist yet or is empty - will be created with first entry
      console.log(`[LOGGER] Creating new app log file: ${logFile}`);
    }
    
    // Ensure we have an array
    if (!Array.isArray(existingLogs)) {
      existingLogs = [];
    }
    
    // Append new log entry
    existingLogs.push(logEntry);
    
    // Rotate logs if file gets too large (keep last 1000 entries)
    if (existingLogs.length > 1000) {
      existingLogs = existingLogs.slice(-1000);
      console.log('[LOGGER] Log rotation performed - kept last 1000 entries');
    }
    
    // Write updated log file (non-blocking)
    await fs.writeFile(logFile, JSON.stringify(existingLogs, null, 2), 'utf8');
    
    // Also output to console for immediate visibility
    const consoleMessage = `[${level.toUpperCase()}] ${message}`;
    switch (level.toLowerCase()) {
      case 'error':
        console.error(consoleMessage, metadata);
        break;
      case 'warn':
        console.warn(consoleMessage, metadata);
        break;
      default:
        console.log(consoleMessage, metadata);
    }
    
  } catch (error) {
    // Never crash app for logging failures - output to console as fallback
    console.error('[LOGGER] Failed to write log entry:', error.message);
    console.error('[LOGGER] Original message:', level, message, metadata);
  }
}

/**
 * Log informational messages
 * 
 * @param {string} message - Info message
 * @param {Object} metadata - Additional structured data
 * @returns {Promise<void>}
 */
async function logInfo(message, metadata = {}) {
  return writeLog(LOG_LEVELS.INFO, message, metadata);
}

/**
 * Log warning messages
 * 
 * @param {string} message - Warning message
 * @param {Object} metadata - Additional structured data
 * @returns {Promise<void>}
 */
async function logWarning(message, metadata = {}) {
  return writeLog(LOG_LEVELS.WARN, message, metadata);
}

/**
 * Log error messages
 * 
 * @param {string} message - Error message
 * @param {Object} metadata - Additional structured data including error details
 * @returns {Promise<void>}
 */
async function logError(message, metadata = {}) {
  return writeLog(LOG_LEVELS.ERROR, message, metadata);
}

/**
 * Log application events (optimization started, completed, etc.)
 * 
 * @param {string} eventType - Type of event (optimization, rollback, scoring, etc.)
 * @param {Object} data - Event-specific data
 * @returns {Promise<void>}
 */
async function logEvent(eventType, data) {
  const metadata = {
    eventType,
    eventData: data,
    eventId: generateEventId()
  };
  
  return writeLog(LOG_LEVELS.EVENT, `Event: ${eventType}`, metadata);
}

/**
 * Log audit trail for important actions
 * 
 * @param {string} action - Action performed (create, update, delete, publish, etc.)
 * @param {string} userId - User or shop identifier
 * @param {string} resource - Resource affected (product, collection, etc.)
 * @param {Object} additionalData - Additional audit data
 * @returns {Promise<void>}
 */
async function logAudit(action, userId, resource, additionalData = {}) {
  const metadata = {
    action,
    userId,
    resource,
    auditId: generateAuditId(),
    ...additionalData
  };
  
  return writeLog(LOG_LEVELS.AUDIT, `Audit: ${action} on ${resource} by ${userId}`, metadata);
}

/**
 * Log optimization session with comprehensive metadata
 * 
 * @param {Object} sessionData - Complete optimization session data
 * @returns {Promise<void>}
 */
async function logOptimizationSession(sessionData) {
  const {
    shop,
    contentType,
    title,
    modelUsed,
    promptVersion,
    riskScore,
    visibilityScore,
    rollbackTriggered,
    tokenEstimate,
    processingTime,
    success
  } = sessionData;
  
  const metadata = {
    optimizationSession: {
      shop: shop || 'unknown',
      contentType: contentType || 'unknown', 
      title: title || 'untitled',
      modelUsed: modelUsed || 'unknown',
      promptVersion: promptVersion || 'unknown',
      riskScore: riskScore || 0,
      visibilityScore: visibilityScore || 0,
      rollbackTriggered: rollbackTriggered || false,
      tokenEstimate: tokenEstimate || 0,
      processingTime: processingTime || 0,
      success: success !== false // Default to true unless explicitly false
    },
    sessionId: generateSessionId()
  };
  
  return writeLog(LOG_LEVELS.EVENT, 'Optimization session completed', metadata);
}

/**
 * Generate unique event ID for traceability
 * 
 * @returns {string} Unique event identifier
 */
function generateEventId() {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique audit ID for compliance tracking
 * 
 * @returns {string} Unique audit identifier
 */
function generateAuditId() {
  return `aud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique session ID for optimization tracking
 * 
 * @returns {string} Unique session identifier
 */
function generateSessionId() {
  return `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get recent log entries for monitoring
 * 
 * @param {number} limit - Maximum number of entries to return
 * @param {string} level - Filter by log level (optional)
 * @returns {Promise<Array>} Recent log entries
 */
async function getRecentLogs(limit = 50, level = null) {
  try {
    const logFile = path.join(__dirname, '../logs/appLog.json');
    const data = await fs.readFile(logFile, 'utf8');
    const logs = JSON.parse(data);
    
    let filteredLogs = Array.isArray(logs) ? logs : [];
    
    // Filter by level if specified
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level?.toLowerCase() === level.toLowerCase());
    }
    
    // Return most recent entries
    return filteredLogs.slice(-limit).reverse();
    
  } catch (error) {
    console.error('[LOGGER] Error reading recent logs:', error.message);
    return [];
  }
}

/**
 * Get log statistics for monitoring dashboard
 * 
 * @returns {Promise<Object>} Log statistics
 */
async function getLogStats() {
  try {
    const logFile = path.join(__dirname, '../logs/appLog.json');
    const data = await fs.readFile(logFile, 'utf8');
    const logs = JSON.parse(data);
    
    if (!Array.isArray(logs) || logs.length === 0) {
      return {
        totalLogs: 0,
        errorCount: 0,
        warningCount: 0,
        eventCount: 0,
        auditCount: 0,
        lastLogTime: null
      };
    }
    
    const stats = {
      totalLogs: logs.length,
      errorCount: logs.filter(log => log.level === 'ERROR').length,
      warningCount: logs.filter(log => log.level === 'WARN').length,
      eventCount: logs.filter(log => log.level === 'EVENT').length,
      auditCount: logs.filter(log => log.level === 'AUDIT').length,
      lastLogTime: logs.length > 0 ? logs[logs.length - 1].timestamp : null
    };
    
    return stats;
    
  } catch (error) {
    console.error('[LOGGER] Error getting log stats:', error.message);
    return {
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0,
      eventCount: 0,
      auditCount: 0,
      lastLogTime: null
    };
  }
}

/**
 * Clear old log entries older than specified days
 * 
 * @param {number} daysToKeep - Number of days to retain logs
 * @returns {Promise<number>} Number of entries removed
 */
async function cleanupOldLogs(daysToKeep = 30) {
  try {
    const logFile = path.join(__dirname, '../logs/appLog.json');
    const data = await fs.readFile(logFile, 'utf8');
    const logs = JSON.parse(data);
    
    if (!Array.isArray(logs)) {
      return 0;
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const originalCount = logs.length;
    const filteredLogs = logs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate > cutoffDate;
    });
    
    if (filteredLogs.length < originalCount) {
      await fs.writeFile(logFile, JSON.stringify(filteredLogs, null, 2), 'utf8');
      const removedCount = originalCount - filteredLogs.length;
      console.log(`[LOGGER] Cleaned up ${removedCount} old log entries`);
      return removedCount;
    }
    
    return 0;
    
  } catch (error) {
    console.error('[LOGGER] Error cleaning up old logs:', error.message);
    return 0;
  }
}

export {
  logInfo,
  logWarning,
  logError,
  logEvent,
  logAudit,
  logOptimizationSession,
  getRecentLogs,
  getLogStats,
  cleanupOldLogs,
  LOG_LEVELS
};