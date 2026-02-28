const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- HELPER FUNCTIONS ---

const validatePeriods = async (year, periods, dateStr) => {
    const { data: timings, error } = await supabase
        .from('year_period_timings')
        .select('*')
        .eq('year', year)
        .in('period_number', periods);

    if (error) throw error;

    const requestDate = new Date(dateStr);
    const now = new Date();

    // Normalize both dates to midnight local time for comparison
    const reqDateNormalized = new Date(requestDate.getFullYear(), requestDate.getMonth(), requestDate.getDate());
    const nowDateNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (reqDateNormalized < nowDateNormalized) {
        return { valid: false, errorMsg: 'Cannot apply for OD on past dates.' };
    }

    return { valid: true };
};

// --- API ENDPOINTS ---

app.get('/api/health', (req, res) => {
    res.send('Server is running');
});

app.get('/api/timings/:year', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('year_period_timings')
            .select('*')
            .eq('year', req.params.year)
            .order('period_number', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/user/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'User not found' });
            }
            throw error;
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/user', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .upsert(req.body)
            .select()
            .single();

        if (error) {
            console.error("UPSERT ERROR:", error);
            throw error;
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/od/request', async (req, res) => {
    try {
        const { year, periods, date } = req.body;
        const validation = await validatePeriods(year, periods, date);
        if (!validation.valid) {
            return res.status(400).json({
                error: validation.errorMsg
            });
        }

        const { data, error } = await supabase
            .from('od_requests')
            .insert(req.body)
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/od/history/:userId', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('od_requests')
            .select('*')
            .eq('user_id', req.params.userId)
            .order('submitted_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/od/pending', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('od_requests')
            .select('*, users!od_requests_user_id_fkey(name, email)')
            .eq('status', 'pending')
            .order('submitted_at', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/od/review/:id', async (req, res) => {
    try {
        const { status, remarks, reviewedBy } = req.body;
        const { data, error } = await supabase
            .from('od_requests')
            .update({
                status,
                remarks,
                reviewed_by: reviewedBy,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/summary', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('od_requests')
            .select('status, department, od_category');

        if (error) throw error;

        const stats = {
            total: data.length,
            approved: data.filter(r => r.status === 'approved').length,
            pending: data.filter(r => r.status === 'pending').length,
            rejected: data.filter(r => r.status === 'rejected').length,
            deptDistribution: {},
            categoryUsage: {}
        };

        data.forEach(r => {
            stats.deptDistribution[r.department] = (stats.deptDistribution[r.department] || 0) + 1;
            stats.categoryUsage[r.od_category] = (stats.categoryUsage[r.od_category] || 0) + 1;
        });

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/export', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('od_requests')
            .select('reg_number, department, year, od_category, date, status')
            .order('submitted_at', { ascending: false });

        if (error) throw error;

        const headers = 'Reg Number,Dept,Year,Category,Date,Status\n';
        const rows = data.map(r => `${r.reg_number},${r.department},${r.year},${r.od_category},${r.date},${r.status}`).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=od_reports.csv');
        res.send(headers + rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
