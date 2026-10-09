const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

const { url, anonKey, serviceRoleKey } = config.supabase;
const isConfigured = Boolean(url && anonKey && serviceRoleKey);

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};

// Klien publik: dipakai untuk alur auth (sign up, login) atas nama pengguna.
const supabase = isConfigured ? createClient(url, anonKey, clientOptions) : null;

// Klien admin: melewati RLS. Hanya dipakai di server (webhook, penulisan data
// setelah identitas pengguna diverifikasi).
const supabaseAdmin = isConfigured ? createClient(url, serviceRoleKey, clientOptions) : null;

if (!isConfigured) {
  console.warn('[supabase] SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY belum diisi. Fitur database dinonaktifkan.');
}

module.exports = { supabase, supabaseAdmin, isConfigured };
