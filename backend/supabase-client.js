'use strict';

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Initialize database schema (run once on deployment)
 */
async function initializeDatabase() {
  async function runOptionalRpc(name) {
    try {
      const { error } = await supabase.rpc(name, {}, { count: 'exact' });
      if (error) {
        console.warn(`Optional database RPC skipped (${name}): ${error.message}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`Optional database RPC unavailable (${name}): ${err.message}`);
      return false;
    }
  }

  try {
    await runOptionalRpc('create_sessions_table');
    await runOptionalRpc('create_contacts_table');

    console.log('✓ Database initialized');
    return true;
  } catch (err) {
    console.error('Database initialization error (non-critical):', err.message);
    return false;
  }
}

/**
 * Save or update a session
 */
async function saveSession(sessionData) {
  const { sessionId, xp, level, visitedSections, rewardUnlocked } = sessionData;

  const { data, error } = await supabase
    .from('sessions')
    .upsert(
      {
        session_id: sessionId,
        xp: Math.max(0, Math.min(xp || 100, 10000)),
        level: Math.max(1, Math.min(level || 1, 10)),
        visited_sections: visitedSections || [],
        reward_unlocked: Boolean(rewardUnlocked),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'session_id' }
    );

  if (error) throw new Error(`Failed to save session: ${error.message}`);
  return data;
}

/**
 * Get a session by ID
 */
async function getSession(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error && error.code === 'PGRST116') {
    return null; // Not found
  }
  if (error) throw new Error(`Failed to get session: ${error.message}`);
  return data;
}

/**
 * Save a contact submission
 */
async function saveContactSubmission(submissionData) {
  const { sessionId, name, email, message, userAgent, ipAddress } = submissionData;

  const { data, error } = await supabase
    .from('contact_submissions')
    .insert({
      id: require('uuid').v4(),
      session_id: sessionId,
      name,
      email,
      message,
      user_agent: userAgent || null,
      ip_address: ipAddress || null,
      created_at: new Date().toISOString()
    });

  if (error) throw new Error(`Failed to save submission: ${error.message}`);
  return data;
}

/**
 * Get all contact submissions (admin only)
 */
async function getAllContactSubmissions(limit = 100) {
  const { data, error } = await supabase
    .from('contact_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch submissions: ${error.message}`);
  return data || [];
}

module.exports = {
  supabase,
  initializeDatabase,
  saveSession,
  getSession,
  saveContactSubmission,
  getAllContactSubmissions
};
