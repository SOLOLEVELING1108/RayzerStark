// src/shared/supabase.js
const { createClient } = require('@supabase/supabase-js');

// Você vai pegar esses dados lá no painel do novo Supabase em:
// Project Settings -> API -> Project URL e Project API Keys (anon / public)
const supabaseUrl = 'https://ujebdsehpowamayseitf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqZWJkc2VocG93YW1heXNlaXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMDkwMTgsImV4cCI6MjEwMzc4NTAxOH0.4-4PnwMU-F-A_FsiB9yhqVEKvpRwx3jAW3s2_uK8-yM';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;