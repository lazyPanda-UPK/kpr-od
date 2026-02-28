const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    const { data, error } = await supabase.from('admin_whitelist').select('*').limit(1);
    if (error) {
        console.error('Error fetching admin_whitelist:', error);
    } else {
        console.log('Sample row from admin_whitelist:', data[0]);
        console.log('Columns found:', Object.keys(data[0] || {}));
    }
}

checkSchema();
