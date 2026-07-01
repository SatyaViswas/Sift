require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase
        .from('journal_slates')
        .insert([{ text: 'test snippet', profile: 'test_user', is_snippet: true, is_voice: false }])
        .select()
        .single();
    if (error) {
        console.log('Error:', error);
    } else {
        console.log('Success:', data);
    }
}
test();
