// // const express = require('express');
// // const { createClient } = require('@supabase/supabase-js');
// // const admin = require('firebase-admin');
// // const dotenv = require('dotenv');
// // const cors = require('cors');

// // dotenv.config();

// // const app = express();
// // app.use(cors());
// // app.use(express.json());

// // // ------------------ SUPABASE CONFIG ------------------
// // const supabaseUrl = process.env.SUPABASE_URL;
// // const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// // const supabase = createClient(supabaseUrl, supabaseServiceKey);

// // // ------------------ FIREBASE ADMIN CONFIG ------------------
// // // Note: Ensure the serviceAccountKey.json is present or use env vars
// // try {
// //     const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// //     admin.initializeApp({
// //         credential: admin.credential.cert(serviceAccount)
// //     });
// //     console.log('🔥 Firebase Admin initialized');
// // } catch (err) {
// //     console.warn('⚠️ Firebase Admin failed to initialize. Check FIREBASE_SERVICE_ACCOUNT env var.');
// // }

// // // ------------------ AUTH MIDDLEWARE ------------------
// // const authenticate = async (req, res, next) => {
// //     try {
// //         const authHeader = req.headers.authorization;
// //         if (!authHeader) return res.status(401).json({ error: 'No token provided' });

// //         const token = authHeader.split(' ')[1];
// //         const { data: { user }, error } = await supabase.auth.getUser(token);

// //         if (error || !user) {
// //             return res.status(401).json({ error: 'Invalid token' });
// //         }

// //         req.user = user;
// //         next();
// //     } catch (err) {
// //         console.error("AUTH ERROR:", err);
// //         res.status(401).json({ error: 'Authentication failed' });
// //     }
// // };

// // // ------------------ NOTIFICATION HELPER ------------------
// // const sendPushNotification = async (fcmToken, title, body) => {
// //     if (!fcmToken) return;
// //     try {
// //         const message = {
// //             notification: { title, body },
// //             token: fcmToken,
// //         };
// //         await admin.messaging().send(message);
// //     } catch (err) {
// //         console.error('Error sending notification:', err);
// //     }
// // };

// // // ------------------ ROUTES ------------------

// // app.get('/api/health', (req, res) => {
// //     res.send('KPR OD Server is running');
// // });

// // // Get user profile (either staff or student)
// // app.get('/api/profile', authenticate, async (req, res) => {
// //     try {
// //         const email = req.user.email;

// //         // Check staff table
// //         const { data: staff, error: staffError } = await supabase
// //             .from('staff')
// //             .select('*, departments(dept_name)')
// //             .eq('email', email)
// //             .maybeSingle();

// //         if (staff) {
// //             return res.json({ type: 'staff', profile: staff });
// //         }

// //         // Check student table
// //         const { data: student, error: studentError } = await supabase
// //             .from('students')
// //             .select('*, departments(dept_name)')
// //             .eq('email', email)
// //             .maybeSingle();

// //         if (student) {
// //             return res.json({ type: 'student', profile: student });
// //         }

// //         res.json({ type: 'unknown', email });
// //     } catch (err) {
// //         res.status(500).json({ error: err.message });
// //     }
// // });

// // // Onboard Student
// // app.post('/api/student/onboard', authenticate, async (req, res) => {
// //     try {
// //         const { name, roll_no, dept_id, batch_year, current_year, semester, mentor_id, chief_mentor_id, hod_id, fcm_token } = req.body;
// //         const email = req.user.email;

// //         const { data, error } = await supabase
// //             .from('students')
// //             .upsert({
// //                 email, name, roll_no, dept_id, batch_year, current_year, semester, mentor_id, chief_mentor_id, hod_id, fcm_token
// //             }, { onConflict: 'email' })
// //             .select()
// //             .single();

// //         if (error) throw error;
// //         res.json(data);
// //     } catch (err) {
// //         res.status(500).json({ error: err.message });
// //     }
// // });

// // // Update FCM Token for Staff
// // app.post('/api/staff/update-fcm', authenticate, async (req, res) => {
// //     try {
// //         const { fcm_token } = req.body;
// //         const email = req.user.email;

// //         const { error } = await supabase
// //             .from('staff')
// //             .update({ fcm_token })
// //             .eq('email', email);

// //         if (error) throw error;
// //         res.json({ success: true });
// //     } catch (err) {
// //         res.status(500).json({ error: err.message });
// //     }
// // });

// // // Submit OD Request (Student)
// // app.post('/api/od/request', authenticate, async (req, res) => {
// //     try {
// //         const { student_id, category_id, reason, od_date, periods } = req.body;

// //         const { data, error } = await supabase
// //             .from('od_requests')
// //             .insert({ student_id, category_id, reason, od_date, periods, status: 'pending' })
// //             .select('*, students(name, mentor_id)')
// //             .single();

// //         if (error) throw error;

// //         // Notify Mentor
// //         if (data.students && data.students.mentor_id) {
// //             const { data: mentor } = await supabase.from('staff').select('fcm_token').eq('staff_id', data.students.mentor_id).single();
// //             if (mentor?.fcm_token) {
// //                 sendPushNotification(mentor.fcm_token, 'New OD Request', `New request from ${data.students.name}`);
// //             }
// //         }

// //         res.status(201).json(data);
// //     } catch (err) {
// //         res.status(500).json({ error: err.message });
// //     }
// // });

// // // Get OD History (Student)
// // app.get('/api/od/history/:studentId', authenticate, async (req, res) => {
// //     try {
// //         const { data, error } = await supabase
// //             .from('od_requests')
// //             .select('*, od_categories(name)')
// //             .eq('student_id', req.params.studentId)
// //             .order('created_at', { ascending: false });

// //         if (error) throw error;
// //         res.json(data);
// //     } catch (err) {
// //         res.status(500).json({ error: err.message });
// //     }
// // });

// // // Get Requests for Staff
// // app.get('/api/staff/requests', authenticate, async (req, res) => {
// //     try {
// //         const email = req.user.email;
// //         const { data: staff } = await supabase.from('staff').select('*').eq('email', email).single();
// //         if (!staff) return res.status(403).json({ error: 'Staff access required' });

// //         let query = supabase.from('od_requests').select('*, students(*), od_categories(name)');

// //         if (staff.role === 'mentor') {
// //             query = query.eq('students.mentor_id', staff.staff_id);
// //         } else if (staff.role === 'chief_mentor') {
// //             query = query.eq('students.chief_mentor_id', staff.staff_id);
// //         } else if (staff.role === 'hod') {
// //             query = query.eq('students.dept_id', staff.dept_id);
// //         }

// //         const { data, error } = await query.order('created_at', { ascending: false });
// //         // Filter out null students if join failed (though it shouldn't)
// //         const filtered = (data || []).filter(r => r.students !== null);

// //         if (error) throw error;
// //         res.json(filtered);
// //     } catch (err) {
// //         res.status(500).json({ error: err.message });
// //     }
// // });

// // // Approve/Reject OD Request
// // app.post('/api/od/review', authenticate, async (req, res) => {
// //     try {
// //         const { od_id, status, remarks } = req.body;
// //         const email = req.user.email;
// //         const { data: staff } = await supabase.from('staff').select('*').eq('email', email).single();
// //         if (!staff) return res.status(403).json({ error: 'Staff access required' });

// //         const { data, error } = await supabase
// //             .from('od_requests')
// //             .update({
// //                 status,
// //                 remarks,
// //                 approved_by: staff.staff_id,
// //                 approved_role: staff.role
// //             })
// //             .eq('od_id', od_id)
// //             .select('*, students(name, fcm_token)')
// //             .single();

// //         if (error) throw error;

// //         // Notify Student
// //         if (data.students?.fcm_token) {
// //             sendPushNotification(data.students.fcm_token, `OD Request ${status.toUpperCase()}`, `Your request has been ${status} by ${staff.name} (${staff.role})`);
// //         }

// //         res.json(data);
// //     } catch (err) {
// //         res.status(500).json({ error: err.message });
// //     }
// // });

// // // Get Students under Staff
// // app.get('/api/staff/my-students', authenticate, async (req, res) => {
// //     try {
// //         const email = req.user.email;
// //         const { data: staff } = await supabase.from('staff').select('*').eq('email', email).single();
// //         if (!staff) return res.status(403).json({ error: 'Staff access required' });

// //         let query = supabase.from('students').select('*');

// //         if (staff.role === 'mentor') {
// //             query = query.eq('mentor_id', staff.staff_id);
// //         } else if (staff.role === 'chief_mentor') {
// //             query = query.eq('chief_mentor_id', staff.staff_id);
// //         } else if (staff.role === 'hod') {
// //             query = query.eq('dept_id', staff.dept_id);
// //         }

// //         const { data, error } = await query.order('current_year').order('roll_no');
// //         if (error) throw error;
// //         res.json(data);
// //     } catch (err) {
// //         res.status(500).json({ error: err.message });
// //     }
// // });

// // // General Helpers
// // app.get('/api/departments', async (req, res) => {
// //     const { data, error } = await supabase.from('departments').select('*').order('dept_name');
// //     if (error) return res.status(500).json(error);
// //     res.json(data);
// // });

// // app.get('/api/categories', async (req, res) => {
// //     const { data, error } = await supabase.from('od_categories').select('*').order('name');
// //     if (error) return res.status(500).json(error);
// //     res.json(data);
// // });

// // app.get('/api/staff-list', async (req, res) => {
// //     const { data, error } = await supabase.from('staff').select('staff_id, name, role, dept_id');
// //     if (error) return res.status(500).json(error);
// //     res.json(data);
// // });

// // const PORT = process.env.PORT || 3000;
// // app.listen(PORT, () => {
// //     console.log(`🚀 KPR OD Server running on port ${PORT}`);
// // });


// const express = require('express');
// const { createClient } = require('@supabase/supabase-js');
// const admin = require('firebase-admin');
// const dotenv = require('dotenv');
// const cors = require('cors');

// dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json());

// // ------------------ SUPABASE CONFIG ------------------
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// const supabase = createClient(supabaseUrl, supabaseServiceKey);

// // ------------------ FIREBASE ADMIN CONFIG ------------------
// try {
//     if (process.env.FIREBASE_SERVICE_ACCOUNT) {
//         const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
//         admin.initializeApp({
//             credential: admin.credential.cert(serviceAccount)
//         });
//         console.log('🔥 Firebase Admin initialized');
//     }
// } catch (err) {
//     console.warn('⚠️ Firebase Admin failed to initialize. Check FIREBASE_SERVICE_ACCOUNT env var.');
// }

// // ------------------ AUTH MIDDLEWARE ------------------
// const authenticate = async (req, res, next) => {
//     try {
//         const authHeader = req.headers.authorization;
//         if (!authHeader) return res.status(401).json({ error: 'No token provided' });

//         const token = authHeader.split(' ')[1];
//         const { data: { user }, error } = await supabase.auth.getUser(token);

//         if (error || !user) {
//             return res.status(401).json({ error: 'Invalid token' });
//         }

//         req.user = user;
//         next();
//     } catch (err) {
//         console.error("AUTH ERROR:", err);
//         res.status(401).json({ error: 'Authentication failed' });
//     }
// };

// const isAdmin = async (req, res, next) => {
//     try {
//         const { data: staff, error } = await supabase
//             .from('staff')
//             .select('role')
//             .eq('email', req.user.email)
//             .single();

//         if (error || !staff || staff.role !== 'admin') {
//             return res.status(403).json({ error: 'Admin access required' });
//         }
//         next();
//     } catch (err) {
//         res.status(403).json({ error: 'Admin check failed' });
//     }
// };

// // ------------------ VALIDATION HELPERS ------------------
// const validateTableData = (table, data) => {
//     const required = {
//         departments: ['dept_name'],
//         od_categories: ['name'],
//         staff: ['name', 'role', 'dept_id', 'email'],
//         students: ['name', 'roll_no', 'dept_id', 'batch_year', 'current_year', 'semester', 'email'],
//         od_requests: ['student_id', 'category_id', 'reason', 'od_date', 'periods']
//     };

//     const fields = required[table];
//     if (!fields) return null;

//     for (const field of fields) {
//         if (data[field] === undefined || data[field] === null || data[field] === '') {
//             return `Field '${field}' is required for table '${table}'`;
//         }
//     }
//     return null;
// };

// // ------------------ NOTIFICATION HELPER ------------------
// const sendPushNotification = async (fcmToken, title, body) => {
//     if (!fcmToken) return;
//     try {
//         const message = {
//             notification: { title, body },
//             token: fcmToken,
//         };
//         await admin.messaging().send(message);
//     } catch (err) {
//         console.error('Error sending notification:', err);
//     }
// };

// // ------------------ ROUTES ------------------

// app.get('/', (req, res) => res.send('KPR OD Service is active'));

// // Get user profile
// app.get('/api/profile', authenticate, async (req, res) => {
//     try {
//         const email = req.user.email;

//         const { data: staff } = await supabase
//             .from('staff')
//             .select('*, departments(dept_name)')
//             .eq('email', email)
//             .maybeSingle();

//         if (staff) return res.json({ type: 'staff', profile: staff });

//         const { data: student } = await supabase
//             .from('students')
//             .select('*, departments(dept_name)')
//             .eq('email', email)
//             .maybeSingle();

//         if (student) return res.json({ type: 'student', profile: student });

//         res.json({ type: 'unknown', email });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Onboard Student
// app.post('/api/student/onboard', authenticate, async (req, res) => {
//     try {
//         const validationError = validateTableData('students', req.body);
//         if (validationError) return res.status(400).json({ error: validationError });

//         const { name, roll_no, dept_id, batch_year, current_year, semester, mentor_id, chief_mentor_id, hod_id, fcm_token } = req.body;
//         const email = req.user.email;

//         const { data, error } = await supabase
//             .from('students')
//             .upsert({
//                 email, name, roll_no, dept_id, batch_year, current_year, semester, mentor_id, chief_mentor_id, hod_id, fcm_token
//             }, { onConflict: 'email' })
//             .select()
//             .single();

//         if (error) throw error;
//         res.json(data);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Submit OD Request
// app.post('/api/od/request', authenticate, async (req, res) => {
//     try {
//         const validationError = validateTableData('od_requests', req.body);
//         if (validationError) return res.status(400).json({ error: validationError });

//         const { student_id, category_id, reason, od_date, periods } = req.body;

//         const { data, error } = await supabase
//             .from('od_requests')
//             .insert({ student_id, category_id, reason, od_date, periods, status: 'pending' })
//             .select('*, students(name, mentor_id)')
//             .single();

//         if (error) throw error;

//         // Notify Mentor
//         if (data.students?.mentor_id) {
//             const { data: mentor } = await supabase.from('staff').select('fcm_token').eq('staff_id', data.students.mentor_id).single();
//             if (mentor?.fcm_token) {
//                 sendPushNotification(mentor.fcm_token, 'New OD Request', `New request from ${data.students.name}`);
//             }
//         }

//         res.status(201).json(data);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // OD History
// app.get('/api/od/history/:studentId', authenticate, async (req, res) => {
//     try {
//         const { data, error } = await supabase
//             .from('od_requests')
//             .select('*, od_categories(name)')
//             .eq('student_id', req.params.studentId)
//             .order('created_at', { ascending: false });

//         if (error) throw error;
//         res.json(data);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Staff Requests
// app.get('/api/staff/requests', authenticate, async (req, res) => {
//     try {
//         const email = req.user.email;
//         const { data: staff } = await supabase.from('staff').select('*').eq('email', email).single();
//         if (!staff) return res.status(403).json({ error: 'Staff access required' });

//         let query = supabase.from('od_requests').select('*, students(*), od_categories(name)');

//         if (staff.role === 'mentor') query = query.eq('students.mentor_id', staff.staff_id);
//         else if (staff.role === 'chief_mentor') query = query.eq('students.chief_mentor_id', staff.staff_id);
//         else if (staff.role === 'hod') query = query.eq('students.dept_id', staff.dept_id);

//         const { data, error } = await query.order('created_at', { ascending: false });
//         if (error) throw error;
//         res.json((data || []).filter(r => r.students !== null));
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Review OD Request
// app.post('/api/od/review', authenticate, async (req, res) => {
//     try {
//         const { od_id, status, remarks } = req.body;
//         const email = req.user.email;
//         const { data: staff } = await supabase.from('staff').select('*').eq('email', email).single();
//         if (!staff) return res.status(403).json({ error: 'Staff access required' });

//         const { data, error } = await supabase
//             .from('od_requests')
//             .update({ status, remarks, approved_by: staff.staff_id, approved_role: staff.role })
//             .eq('od_id', od_id)
//             .select('*, students(name, fcm_token)')
//             .single();

//         if (error) throw error;

//         if (data.students?.fcm_token) {
//             sendPushNotification(data.students.fcm_token, `OD Request ${status.toUpperCase()}`, `Your request has been ${status} by ${staff.name}`);
//         }

//         res.json(data);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ------------------ ADMIN ROUTES ------------------

// app.get('/api/admin/stats', authenticate, isAdmin, async (req, res) => {
//     try {
//         const [{ count: students }, { count: staff }, { count: pendingOd }] = await Promise.all([
//             supabase.from('students').select('*', { count: 'exact', head: true }),
//             supabase.from('staff').select('*', { count: 'exact', head: true }),
//             supabase.from('od_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
//         ]);
//         res.json({ students, staff, pendingOd });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.get('/api/admin/table/:name', authenticate, isAdmin, async (req, res) => {
//     try {
//         const { data, error } = await supabase.from(req.params.name).select('*');
//         if (error) throw error;
//         res.json(data);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/api/admin/table/:name', authenticate, isAdmin, async (req, res) => {
//     try {
//         const validationError = validateTableData(req.params.name, req.body);
//         if (validationError) return res.status(400).json({ error: validationError });

//         const { data, error } = await supabase.from(req.params.name).insert(req.body).select().single();
//         if (error) throw error;
//         res.json(data);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.put('/api/admin/table/:name/:idField/:id', authenticate, isAdmin, async (req, res) => {
//     try {
//         const { data, error } = await supabase
//             .from(req.params.name)
//             .update(req.body)
//             .eq(req.params.idField, req.params.id)
//             .select()
//             .single();
//         if (error) throw error;
//         res.json(data);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.delete('/api/admin/table/:name/:idField/:id', authenticate, isAdmin, async (req, res) => {
//     try {
//         const { error } = await supabase.from(req.params.name).delete().eq(req.params.idField, req.params.id);
//         if (error) throw error;
//         res.json({ message: 'Deleted successfully' });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ------------------ HELPERS ------------------
// app.get('/api/departments', async (req, res) => {
//     const { data, error } = await supabase.from('departments').select('*').order('dept_name');
//     res.json(data || []);
// });

// app.get('/api/categories', async (req, res) => {
//     const { data, error } = await supabase.from('od_categories').select('*').order('name');
//     res.json(data || []);
// });

// app.get('/api/staff-list', async (req, res) => {
//     const { data, error } = await supabase.from('staff').select('staff_id, name, role, dept_id');
//     res.json(data || []);
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`🚀 KPR OD Server running on port ${PORT}`));


const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ------------------ SUPABASE CONFIG ------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ------------------ FIREBASE ADMIN CONFIG ------------------
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('🔥 Firebase Admin initialized');
    }
} catch (err) {
    console.warn('⚠️ Firebase Admin failed to initialize. Check FIREBASE_SERVICE_ACCOUNT env var.');
}

// ------------------ AUTH MIDDLEWARE ------------------
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No token provided' });

        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("AUTH ERROR:", err);
        res.status(401).json({ error: 'Authentication failed' });
    }
};

const isAdmin = async (req, res, next) => {
    try {
        const { data: staff, error } = await supabase
            .from('staff')
            .select('role')
            .eq('email', req.user.email)
            .single();

        if (error || !staff || staff.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (err) {
        res.status(403).json({ error: 'Admin check failed' });
    }
};

// ------------------ VALIDATION HELPERS ------------------
const validateTableData = (table, data) => {
    const required = {
        departments: ['dept_name'],
        od_categories: ['name'],
        staff: ['name', 'role', 'dept_id', 'email'],
        students: ['name', 'roll_no', 'dept_id', 'batch_year', 'current_year', 'semester', 'email', 'ph_no'],
        od_requests: ['student_id', 'category_id', 'reason', 'od_date', 'periods']
    };

    const fields = required[table];
    if (!fields) return null;

    for (const field of fields) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            return `Field '${field}' is required for table '${table}'`;
        }
    }
    return null;
};

// ------------------ NOTIFICATION HELPER ------------------
const sendPushNotification = async (fcmToken, title, body) => {
    if (!fcmToken) return;
    try {
        const message = {
            notification: { title, body },
            token: fcmToken,
        };
        await admin.messaging().send(message);
    } catch (err) {
        console.error('Error sending notification:', err);
    }
};

// ------------------ ROUTES ------------------

app.get('/', (req, res) => res.send('KPR OD Service is active'));

// Submit OD Request
app.post('/api/od/request', authenticate, async (req, res) => {
    try {
        const validationError = validateTableData('od_requests', req.body);
        if (validationError) return res.status(400).json({ error: validationError });

        const { student_id, category_id, reason, od_date, periods } = req.body;

        const { data, error } = await supabase
            .from('od_requests')
            .insert({ student_id, category_id, reason, od_date, periods, status: 'pending' })
            .select('*, students(name, mentor_id)')
            .single();

        if (error) throw error;

        // Notify Mentor
        if (data.students?.mentor_id) {
            const { data: mentor } = await supabase.from('staff').select('fcm_token').eq('staff_id', data.students.mentor_id).single();
            if (mentor?.fcm_token) {
                sendPushNotification(mentor.fcm_token, 'New OD Request', `New request from ${data.students.name}`);
            }
        }

        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update FCM Token
app.post('/api/update-fcm-token', authenticate, async (req, res) => {
    try {
        const { fcm_token } = req.body;
        const email = req.user.email;

        // Try staff
        let { data: staff } = await supabase.from('staff').update({ fcm_token }).eq('email', email).select().maybeSingle();
        if (staff) return res.json({ message: 'Token updated for staff' });

        // Try student
        let { data: student } = await supabase.from('students').update({ fcm_token }).eq('email', email).select().maybeSingle();
        if (student) return res.json({ message: 'Token updated for student' });

        res.status(404).json({ error: 'User not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Review OD Request
app.post('/api/od/review', authenticate, async (req, res) => {
    try {
        const { od_id, status, remarks } = req.body;
        const email = req.user.email;
        const { data: staff } = await supabase.from('staff').select('*').eq('email', email).single();
        if (!staff) return res.status(403).json({ error: 'Staff access required' });

        const { data, error } = await supabase
            .from('od_requests')
            .update({ status, remarks, approved_by: staff.staff_id, approved_role: staff.role })
            .eq('od_id', od_id)
            .select('*, students(name, fcm_token)')
            .single();

        if (error) throw error;

        if (data.students?.fcm_token) {
            sendPushNotification(data.students.fcm_token, `OD Request ${status.toUpperCase()}`, `Your request has been ${status} by ${staff.name}`);
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Onboard Student
app.post('/api/student/onboard', authenticate, async (req, res) => {
    try {
        const validationError = validateTableData('students', req.body);
        if (validationError) return res.status(400).json({ error: validationError });

        const { name, roll_no, dept_id, batch_year, current_year, semester, ph_no, mentor_id, chief_mentor_id, hod_id, fcm_token } = req.body;
        const email = req.user.email;

        const { data, error } = await supabase
            .from('students')
            .upsert({
                email, name, roll_no, dept_id, batch_year, current_year, semester, ph_no, mentor_id, chief_mentor_id, hod_id, fcm_token
            }, { onConflict: 'email' })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 KPR OD Server running on port ${PORT}`));
