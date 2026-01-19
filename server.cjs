const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: { origin: "*" }
});

// Middleware
app.use(cors());
app.use(express.json());

// Helper to notify all clients
const notifyUpdate = () => {
    io.emit('data_updated');
};

// Database setup
const defaultDataDir = path.join(__dirname, 'data');
const dataDir = process.env.ELECTRON_DATA_PATH || defaultDataDir;

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'data.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY, name TEXT, classification TEXT, unit TEXT, quantity REAL, minThreshold REAL, 
    lastUpdated TEXT, workshop TEXT, origin TEXT, note TEXT
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY, receiptId TEXT, materialId TEXT, materialName TEXT, type TEXT, 
    quantity REAL, date TEXT, user TEXT, workshop TEXT, targetWorkshop TEXT, orderCode TEXT, note TEXT
  );
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY, orderCode TEXT, workshop TEXT, items TEXT, createdAt TEXT, lastUpdated TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT UNIQUE, password TEXT, fullName TEXT, email TEXT, role TEXT, 
    permissions TEXT, isActive INTEGER, createdAt TEXT, lastLogin TEXT, createdBy TEXT
  );
  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY, userId TEXT, username TEXT, action TEXT, entityType TEXT, entityId TEXT, 
    details TEXT, ipAddress TEXT, timestamp TEXT
  );
`);

const isTableEmpty = (tableName) => {
    return db.prepare(`SELECT count(*) as count FROM ${tableName}`).get().count === 0;
};

// Seed Data (Inlined)
const SEED_MATERIALS = [
    { id: '1', name: 'Xi măng Hà Tiên PC40', classification: 'Vật tư chính', unit: 'Bao', quantity: 150, minThreshold: 50, lastUpdated: '2024-05-15', workshop: 'OG', origin: 'Việt Nam', note: 'Vật tư nhập lô lớn' },
    { id: '2', name: 'Thép phi 10', classification: 'Vật tư chính', unit: 'Cây', quantity: 200, minThreshold: 30, lastUpdated: '2024-05-16', workshop: 'CK', origin: 'Hòa Phát' },
    { id: '3', name: 'Gỗ MDF An Cường', classification: 'Vật tư chính', unit: 'Tấm', quantity: 45, minThreshold: 10, lastUpdated: '2024-05-14', workshop: 'NT', origin: 'Việt Nam' },
    { id: '4', name: 'Bulong M10x50', classification: 'Vật tư phụ', unit: 'Cái', quantity: 500, minThreshold: 100, lastUpdated: '2024-05-17', workshop: 'CK', origin: 'Đài Loan', note: 'Dùng cho dự án PCCC' },
];

const SEED_USERS = [
    { id: 'u1', username: 'admin', password: '123', fullName: 'Quản trị viên', email: 'admin@smartstock.com', role: 'ADMIN', permissions: JSON.stringify(['VIEW_DASHBOARD', 'VIEW_INVENTORY', 'VIEW_HISTORY', 'VIEW_ORDERS', 'MANAGE_MATERIALS', 'CREATE_RECEIPT', 'DELETE_TRANSACTION', 'MANAGE_BUDGETS', 'TRANSFER_MATERIALS', 'EXPORT_DATA', 'MANAGE_USERS', 'VIEW_ACTIVITY_LOG', 'MANAGE_SETTINGS']), isActive: 1, createdAt: '2024-01-01', createdBy: 'SYSTEM' },
    { id: 'u2', username: 'manager', password: '123', fullName: 'Quản lý kho', email: 'manager@smartstock.com', role: 'MANAGER', permissions: JSON.stringify(['VIEW_DASHBOARD', 'VIEW_INVENTORY', 'VIEW_HISTORY', 'VIEW_ORDERS', 'MANAGE_MATERIALS', 'CREATE_RECEIPT', 'DELETE_TRANSACTION', 'MANAGE_BUDGETS', 'TRANSFER_MATERIALS', 'EXPORT_DATA', 'VIEW_ACTIVITY_LOG']), isActive: 1, createdAt: '2024-01-01', createdBy: 'SYSTEM' },
];

if (isTableEmpty('materials')) {
    const insert = db.prepare(`INSERT INTO materials (id, name, classification, unit, quantity, minThreshold, lastUpdated, workshop, origin, note) VALUES (@id, @name, @classification, @unit, @quantity, @minThreshold, @lastUpdated, @workshop, @origin, @note)`);
    SEED_MATERIALS.forEach(m => insert.run({ note: null, ...m }));
}

if (isTableEmpty('users')) {
    const insert = db.prepare(`INSERT INTO users (id, username, password, fullName, email, role, permissions, isActive, createdAt, lastLogin, createdBy) VALUES (@id, @username, @password, @fullName, @email, @role, @permissions, @isActive, @createdAt, @lastLogin, @createdBy)`);
    SEED_USERS.forEach(u => insert.run({ email: null, lastLogin: null, ...u }));
}

// API Endpoints
app.get('/api/materials', (req, res) => res.json(db.prepare('SELECT * FROM materials').all()));
app.get('/api/transactions', (req, res) => res.json(db.prepare('SELECT * FROM transactions ORDER BY date DESC').all()));
app.get('/api/users', (req, res) => res.json(db.prepare('SELECT * FROM users').all().map(u => ({ ...u, permissions: JSON.parse(u.permissions), isActive: Boolean(u.isActive) }))));
app.get('/api/budgets', (req, res) => res.json(db.prepare('SELECT * FROM budgets').all().map(b => ({ ...b, items: JSON.parse(b.items) }))));
app.get('/api/activity_logs', (req, res) => res.json(db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC').all()));

app.post('/api/materials/save', (req, res) => {
    const material = req.body;
    db.prepare(`INSERT INTO materials (id, name, classification, unit, quantity, minThreshold, lastUpdated, workshop, origin, note) VALUES (@id, @name, @classification, @unit, @quantity, @minThreshold, @lastUpdated, @workshop, @origin, @note) ON CONFLICT(id) DO UPDATE SET name=excluded.name, classification=excluded.classification, unit=excluded.unit, quantity=excluded.quantity, minThreshold=excluded.minThreshold, lastUpdated=excluded.lastUpdated, workshop=excluded.workshop, origin=excluded.origin, note=excluded.note`).run(material);
    notifyUpdate();
    res.json({ success: true });
});

app.post('/api/materials/delete', (req, res) => {
    db.prepare('DELETE FROM materials WHERE id = ?').run(req.body.id);
    notifyUpdate();
    res.json({ success: true });
});

app.post('/api/transactions/save', (req, res) => {
    const tx = req.body;
    db.prepare(`INSERT INTO transactions (id, receiptId, materialId, materialName, type, quantity, date, user, workshop, targetWorkshop, orderCode, note) VALUES (@id, @receiptId, @materialId, @materialName, @type, @quantity, @date, @user, @workshop, @targetWorkshop, @orderCode, @note)`).run({
        targetWorkshop: null,
        orderCode: null,
        note: null,
        ...tx
    });
    notifyUpdate();
    res.json({ success: true });
});

app.post('/api/transactions/delete', (req, res) => {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.body.id);
    notifyUpdate();
    res.json({ success: true });
});

app.post('/api/budgets/save', (req, res) => {
    const budget = req.body;
    db.prepare(`INSERT INTO budgets (id, orderCode, workshop, items, createdAt, lastUpdated) VALUES (@id, @orderCode, @workshop, @items, @createdAt, @lastUpdated) ON CONFLICT(id) DO UPDATE SET orderCode=excluded.orderCode, workshop=excluded.workshop, items=excluded.items, lastUpdated=excluded.lastUpdated`).run({ ...budget, items: JSON.stringify(budget.items) });
    notifyUpdate();
    res.json({ success: true });
});

app.post('/api/budgets/delete', (req, res) => {
    db.prepare('DELETE FROM budgets WHERE id = ?').run(req.body.id);
    notifyUpdate();
    res.json({ success: true });
});

app.post('/api/users/delete', (req, res) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.body.id);
    notifyUpdate();
    res.json({ success: true });
});

app.post('/api/users/save', (req, res) => {
    const user = req.body;
    db.prepare(`
        INSERT INTO users (id, username, password, fullName, email, role, permissions, isActive, createdAt, lastLogin, createdBy) 
        VALUES (@id, @username, @password, @fullName, @email, @role, @permissions, @isActive, @createdAt, @lastLogin, @createdBy)
        ON CONFLICT(id) DO UPDATE SET 
            username=excluded.username, 
            password=excluded.password, 
            fullName=excluded.fullName, 
            email=excluded.email, 
            role=excluded.role, 
            permissions=excluded.permissions, 
            isActive=excluded.isActive, 
            lastLogin=excluded.lastLogin
    `).run({
        email: null,
        lastLogin: null,
        createdBy: null,
        ...user,
        permissions: JSON.stringify(user.permissions || []),
        isActive: user.isActive ? 1 : 0
    });
    notifyUpdate();
    res.json({ success: true });
});

app.post('/api/activity_logs/save', (req, res) => {
    const log = req.body;
    db.prepare(`
        INSERT INTO activity_logs (id, userId, username, action, entityType, entityId, details, ipAddress, timestamp) 
        VALUES (@id, @userId, @username, @action, @entityType, @entityId, @details, @ipAddress, @timestamp)
    `).run({
        entityId: null,
        details: null,
        ipAddress: null,
        ...log
    });
    res.json({ success: true });
});

app.post('/api/activity_logs/delete', (req, res) => {
    db.prepare('DELETE FROM activity_logs WHERE id = ?').run(req.body.id);
    res.json({ success: true });
});

app.post('/api/activity_logs/clear', (req, res) => {
    db.prepare('DELETE FROM activity_logs').run();
    res.json({ success: true });
});

app.post('/api/backup', (req, res) => {
    try {
        const os = require('os');
        const desktopPath = path.join(os.homedir(), 'Desktop');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupName = `SmartStock_Backup_${timestamp}.db`;
        const backupPath = path.join(desktopPath, backupName);

        const dbPath = path.join(dataDir, 'data.db');
        if (fs.existsSync(dbPath)) {
            // Close DB properly before copy? 
            // Better-sqlite3 has a .backup() method which is safer while the DB is open
            db.backup(backupPath)
                .then(() => {
                    res.json({ success: true, path: backupPath });
                })
                .catch(err => {
                    res.status(500).json({ success: false, error: err.message });
                });
        } else {
            res.status(404).json({ success: false, error: 'Database file not found' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Serve static
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send('Frontend not built.');
});

function startServer(port = 3000) {
    server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`[SmartStock] Port ${port} is already in use. Assuming backend is running externally or from a previous session.`);
        } else {
            console.error('[SmartStock] Critical Server Error:', err);
        }
    });

    server.listen(port, '0.0.0.0', () => {
        console.log(`Backend server running on http://0.0.0.0:${port} with Socket.io`);
    });

    return server;
}
if (!process.versions.electron) startServer();

module.exports = { startServer };
