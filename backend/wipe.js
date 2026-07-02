require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function wipe() {
    console.log("Wiping journal_slates in Supabase...");
    const { data, error } = await supabase
        .from('journal_slates')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
        console.error('Error wiping table:', error);
    } else {
        console.log('Successfully wiped journal_slates table.');
    }
}
wipe();
