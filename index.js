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
const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const jwt = require('jsonwebtoken');

// --- MIDDLEWARE ---

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, supabaseJwtSecret);
        req.user = decoded; // Contains sub (id), email, etc.
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const authorize = (role) => {
    return async (req, res, next) => {
        const email = req.user.email;
        const userId = req.user.sub;

        // Check if admin
        const { data: admin, error: adminError } = await supabase
            .from('admin_whitelist')
            .select('email, department')
            .eq('email', email)
            .single();

        const isAdmin = !!admin;

        if (role === 'admin') {
            if (isAdmin) {
                req.user.department = admin.department; // Attach dept if exists
                return next();
            }
            console.error(`Auth Error: User ${email} is not in admin_whitelist`);
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (role === 'user') {
            // User must not be an admin and must have kpriet domain
            const isUser = !isAdmin && email.endsWith('@kpriet.ac.in');
            if (isUser) return next();
            return res.status(403).json({ error: 'User access required (KPRIET domain)' });
        }

        next();
    };
};

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
    res.send('Server is running fine');
});

app.get('/api/timings/:year', authenticate, async (req, res) => {
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

app.get('/api/user/:id', authenticate, async (req, res) => {
    try {
        // Users can only view their own profile, admins can view any
        if (req.user.sub !== req.params.id) {
            const { data: admin } = await supabase.from('admin_whitelist').select('email').eq('email', req.user.email).single();
            if (!admin) return res.status(403).json({ error: 'Unauthorized' });
        }

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

app.post('/api/user', authenticate, async (req, res) => {
    try {
        // Ensure user is updating their own profile
        if (req.user.sub !== req.body.id) {
            return res.status(403).json({ error: 'Cannot update other users' });
        }

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

app.post('/api/od/request', authenticate, authorize('user'), async (req, res) => {
    try {
        const { year, periods, date } = req.body;

        // Security check: user_id in body must match authenticated user
        if (req.body.user_id !== req.user.sub) {
            return res.status(403).json({ error: 'User ID mismatch' });
        }

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

app.get('/api/od/history/:userId', authenticate, async (req, res) => {
    try {
        // User can only view their own history, admin can view all
        if (req.user.sub !== req.params.userId) {
            const { data: admin } = await supabase.from('admin_whitelist').select('email').eq('email', req.user.email).single();
            if (!admin) return res.status(403).json({ error: 'Unauthorized' });
        }

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

app.get('/api/od/pending', authenticate, authorize('admin'), async (req, res) => {
    try {
        let query = supabase
            .from('od_requests')
            .select('*, users!od_requests_user_id_fkey(name, email)')
            .eq('status', 'pending');

        // Apply department filter if admin has one
        if (req.user.department) {
            query = query.eq('department', req.user.department);
        }

        const { data, error } = await query.order('submitted_at', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error("PENDING ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/od/review/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { status, remarks, reviewedBy } = req.body;

        // Security: reviewer must be the authenticated admin
        if (reviewedBy !== req.user.sub) {
            return res.status(403).json({ error: 'Reviewer ID mismatch' });
        }

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

app.get('/api/reports/summary', authenticate, authorize('admin'), async (req, res) => {
    try {
        let query = supabase
            .from('od_requests')
            .select('status, department, od_category');

        // Apply department filter if admin has one
        if (req.user.department) {
            query = query.eq('department', req.user.department);
        }

        const { data, error } = await query;

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
        console.error("SUMMARY ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/export', authenticate, authorize('admin'), async (req, res) => {
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

// --- ADMIN MANAGEMENT ENDPOINTS ---

app.get('/api/admin/whitelist', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase.from('admin_whitelist').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/whitelist', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase.from('admin_whitelist').insert(req.body).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/whitelist/:email', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { error } = await supabase.from('admin_whitelist').delete().eq('email', req.params.email);
        if (error) throw error;
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/timings', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase.from('year_period_timings').upsert(req.body).select();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
