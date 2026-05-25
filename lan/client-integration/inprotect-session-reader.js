'use strict';

const fs = require('fs');
const crypto = require('crypto');

function safeEqualHex(a, b) {
  const aa = Buffer.from(String(a || '').trim().toLowerCase(), 'utf8');
  const bb = Buffer.from(String(b || '').trim().toLowerCase(), 'utf8');
  if (aa.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function verifySessionSignature(rawJson, sigHex, secretHex) {
  const secret = String(secretHex || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(secret)) {
    return { ok: false, error: 'bridge_secret_invalid' };
  }
  const expected = crypto.createHmac('sha256', secret).update(rawJson, 'utf8').digest('hex');
  if (!safeEqualHex(sigHex, expected)) {
    return { ok: false, error: 'session_sig_mismatch' };
  }
  return { ok: true };
}

function readSessionFromEnv() {
  const p = String(process.env.INPROTECT_SESSION_PATH || '').trim();
  const sigPath = String(process.env.INPROTECT_SESSION_SIG_PATH || '').trim();
  const bridgeSecret = String(process.env.INPROTECT_BRIDGE_SECRET || '').trim();
  if (!p) {
    return { ok: false, error: 'session_path_missing' };
  }
  if (!sigPath) {
    return { ok: false, error: 'session_sig_path_missing' };
  }
  if (!bridgeSecret) {
    return { ok: false, error: 'bridge_secret_missing' };
  }
  if (!fs.existsSync(p)) {
    return { ok: false, error: 'session_file_missing' };
  }
  if (!fs.existsSync(sigPath)) {
    return { ok: false, error: 'session_sig_missing' };
  }
  let raw = '';
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch {
    return { ok: false, error: 'session_read_failed' };
  }
  let sig = '';
  try {
    sig = fs.readFileSync(sigPath, 'utf8');
  } catch {
    return { ok: false, error: 'session_sig_read_failed' };
  }
  const sigCheck = verifySessionSignature(raw, sig, bridgeSecret);
  if (!sigCheck.ok) {
    return { ok: false, error: sigCheck.error };
  }
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'session_json_invalid' };
  }
  if (data?.schema !== 'inprotect.launch.session.v1') {
    return { ok: false, error: 'session_schema_invalid' };
  }
  if (!/^[a-f0-9]{32}$/i.test(String(data?.nonce || ''))) {
    return { ok: false, error: 'session_nonce_invalid' };
  }
  const iat = new Date(String(data?.issuedAt || ''));
  if (Number.isNaN(iat.getTime())) {
    return { ok: false, error: 'session_issued_invalid' };
  }
  const exp = new Date(String(data?.expiresAt || ''));
  if (Number.isNaN(exp.getTime()) || exp.getTime() <= Date.now()) {
    return { ok: false, error: 'session_expired', session: data };
  }
  // Reject abnormally long tokens to reduce replay windows.
  if (exp.getTime() - iat.getTime() > 15 * 60 * 1000) {
    return { ok: false, error: 'session_ttl_too_long', session: data };
  }
  return { ok: true, session: data };
}

module.exports = { readSessionFromEnv };
