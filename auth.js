const { query } = require('./db');

// Middleware to authenticate agents via Bearer token
async function authenticateAgent(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header. Use: Bearer <api_key>'
            });
        }

        const apiKey = authHeader.substring(7);

        // Validate UUID format before querying
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(apiKey)) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid API key format'
            });
        }

        const result = await query(
            'SELECT agent_name, moltbook_name, description, payout_address FROM agents WHERE api_key = $1',
            [apiKey]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid API key'
            });
        }

        req.agent = result.rows[0];
        next();
    } catch (err) {
        console.error('Auth error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Optional: Admin authentication middleware
async function authenticateAdmin(req, res, next) {
    const adminKey = req.headers['x-admin-key'];

    if (!adminKey || adminKey !== process.env.LEAGUE_ADMIN_KEY) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required'
        });
    }

    next();
}

module.exports = {
    authenticateAgent,
    authenticateAdmin
};