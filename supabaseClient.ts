import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uluavkuupljlgbzawttc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdWF2a3V1cGxqbGdiemF3dHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzc1NjUsImV4cCI6MjA4MTY1MzU2NX0.1wcJ4FnVVLIajY1s3FQ4a7ot1sCs8qcnChOgo0ieYAs';

export const supabase = createClient(supabaseUrl, supabaseKey);