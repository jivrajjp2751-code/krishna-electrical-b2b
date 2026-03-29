/**
 * Security Utilities for Krishna Electrical Works
 * Handles password hashing, input sanitization, rate limiting, and session management
 */

// ── Password Hashing (SHA-256 via Web Crypto API) ──────────
// This avoids storing plaintext passwords in localStorage/Supabase

/**
 * Hash a password using SHA-256 with a salt
 * @param {string} password - The plaintext password
 * @param {string} salt - A unique salt per user (e.g., username)
 * @returns {Promise<string>} The hex-encoded hash
 */
export async function hashPassword(password, salt = 'krishna-electrical-salt') {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + ':' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash, salt = 'krishna-electrical-salt') {
  const computedHash = await hashPassword(password, salt);
  return computedHash === hash;
}


// ── Input Sanitization ─────────────────────────────────────
// Prevents XSS attacks from user-entered data

/**
 * Sanitize a string by removing HTML tags and dangerous characters
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize an object's string values recursively
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeInput(value);
    } else if (typeof value === 'object') {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}


// ── Rate Limiting (Brute Force Protection) ─────────────────

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a login attempt is allowed
 * @param {string} username
 * @returns {{ allowed: boolean, remainingAttempts: number, lockoutEnds: number|null }}
 */
export function checkRateLimit(username) {
  const key = username.toLowerCase().trim();
  const record = loginAttempts.get(key);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if lockout has expired
  if (record.lockedUntil && Date.now() > record.lockedUntil) {
    loginAttempts.delete(key);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Still locked out
  if (record.lockedUntil && Date.now() <= record.lockedUntil) {
    const remainingMs = record.lockedUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return {
      allowed: false,
      remainingAttempts: 0,
      lockoutEnds: record.lockedUntil,
      message: `Too many failed attempts. Account locked for ${remainingMin} minute(s).`
    };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - record.attempts
  };
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(username) {
  const key = username.toLowerCase().trim();
  const record = loginAttempts.get(key) || { attempts: 0, lockedUntil: null };

  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }

  loginAttempts.set(key, record);
  return record;
}

/**
 * Clear login attempts (call on successful login)
 */
export function clearLoginAttempts(username) {
  loginAttempts.delete(username.toLowerCase().trim());
}


// ── Session Management ─────────────────────────────────────

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity
let sessionTimer = null;
let lastActivity = Date.now();

/**
 * Start the session timeout watcher
 * @param {Function} onTimeout - Callback when session expires (should call logout)
 */
export function startSessionWatcher(onTimeout) {
  lastActivity = Date.now();

  // Track user activity
  const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
  const resetTimer = () => {
    lastActivity = Date.now();
  };

  activityEvents.forEach(event => {
    document.addEventListener(event, resetTimer, { passive: true });
  });

  // Check every minute
  if (sessionTimer) clearInterval(sessionTimer);
  sessionTimer = setInterval(() => {
    if (Date.now() - lastActivity > SESSION_TIMEOUT) {
      onTimeout();
      stopSessionWatcher();
    }
  }, 60000);

  return () => {
    activityEvents.forEach(event => {
      document.removeEventListener(event, resetTimer);
    });
    if (sessionTimer) clearInterval(sessionTimer);
  };
}

/**
 * Stop the session timeout watcher
 */
export function stopSessionWatcher() {
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
}


// ── Security Validation Helpers ────────────────────────────

/**
 * Validate password strength
 */
export function validatePasswordStrength(password) {
  const issues = [];
  if (password.length < 6) issues.push('Must be at least 6 characters');
  if (!/[A-Z]/.test(password)) issues.push('Should contain an uppercase letter');
  if (!/[0-9]/.test(password)) issues.push('Should contain a number');
  return {
    strong: issues.length === 0,
    issues,
    score: Math.max(0, 3 - issues.length) // 0-3 score
  };
}

/**
 * Generate a random token for CSRF or session ID
 */
export function generateSecureToken(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
