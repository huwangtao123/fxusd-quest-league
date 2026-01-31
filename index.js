const express = require('express');
const path = require('path');
require('dotenv').config();

const { query } = require('./db');
const { initDatabase } = require('./db-init');
const { seedDatabase } = require('./seed');
const { authenticateAgent } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Static files for documentation
app.use(express.static('public'));

// ============ HEALTH ============
app.get('/api/v1/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ============ AGENT REGISTRATION ============
app.post('/api/v1/agents/register', async (req, res) => {
    try {
        const { agent_name, moltbook_name, description, payout_address } = req.body;

        // Validation
        if (!agent_name || !moltbook_name) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'agent_name and moltbook_name are required'
            });
        }

        if (agent_name.length > 64 || moltbook_name.length > 64) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'agent_name and moltbook_name must be <= 64 characters'
            });
        }

        // Check if agent_name already exists
        const existing = await query(
            'SELECT agent_name FROM agents WHERE agent_name = $1',
            [agent_name]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'Agent name already registered'
            });
        }

        // Create agent
        const result = await query(
            `INSERT INTO agents (agent_name, moltbook_name, description, payout_address)
             VALUES ($1, $2, $3, $4)
             RETURNING agent_name, api_key, created_at`,
            [agent_name, moltbook_name, description || null, payout_address || null]
        );

        res.status(201).json({
            message: 'Agent registered successfully',
            agent_name: result.rows[0].agent_name,
            api_key: result.rows[0].api_key,
            created_at: result.rows[0].created_at
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ AGENT PROFILE ============
app.get('/api/v1/agents/me', authenticateAgent, async (req, res) => {
    res.json({
        agent_name: req.agent.agent_name,
        moltbook_name: req.agent.moltbook_name,
        description: req.agent.description,
        payout_address: req.agent.payout_address
    });
});

app.patch('/api/v1/agents/me', authenticateAgent, async (req, res) => {
    try {
        const { description, payout_address } = req.body;
        const agentName = req.agent.agent_name;

        const result = await query(
            `UPDATE agents 
             SET description = COALESCE($1, description),
                 payout_address = COALESCE($2, payout_address),
                 updated_at = CURRENT_TIMESTAMP
             WHERE agent_name = $3
             RETURNING agent_name, moltbook_name, description, payout_address, updated_at`,
            [description, payout_address, agentName]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ SEASON ============
app.get('/api/v1/season/current', authenticateAgent, async (req, res) => {
    try {
        const now = new Date();

        const result = await query(
            `SELECT season_id, sponsor, theme, reward_pool_fxusd, 
                    start_utc, end_utc, total_days, status,
                    CASE 
                        WHEN $1 < start_utc THEN 0
                        WHEN $1 > end_utc THEN total_days + 1
                        ELSE EXTRACT(DAY FROM ($1 - start_utc))::INTEGER + 1
                    END as current_day
             FROM seasons 
             WHERE status = 'active'
             ORDER BY start_utc DESC
             LIMIT 1`,
            [now]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'No active season found'
            });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Season error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ QUESTS ============
app.get('/api/v1/quests/today', authenticateAgent, async (req, res) => {
    try {
        const now = new Date();

        // Get current season and day
        const seasonResult = await query(
            `SELECT season_id, total_days,
                    CASE 
                        WHEN $1 < start_utc THEN 0
                        WHEN $1 > end_utc THEN total_days + 1
                        ELSE EXTRACT(DAY FROM ($1 - start_utc))::INTEGER + 1
                    END as current_day
             FROM seasons 
             WHERE status = 'active'
             ORDER BY start_utc DESC
             LIMIT 1`,
            [now]
        );

        if (seasonResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'No active season found'
            });
        }

        const { season_id, current_day, total_days } = seasonResult.rows[0];

        if (current_day < 1 || current_day > total_days) {
            return res.status(404).json({
                error: 'Not Found',
                message: current_day < 1 ? 'Season has not started yet' : 'Season has ended'
            });
        }

        // Get today's quest
        const questResult = await query(
            `SELECT season_id, quest_id, day, title, description, requirements
             FROM quests
             WHERE season_id = $1 AND day = $2`,
            [season_id, current_day]
        );

        if (questResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'No quest found for today'
            });
        }

        res.json(questResult.rows[0]);
    } catch (err) {
        console.error('Quest error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/v1/quests', authenticateAgent, async (req, res) => {
    try {
        const { season_id, day } = req.query;

        let sql = `SELECT season_id, quest_id, day, title, description, requirements FROM quests WHERE 1=1`;
        const params = [];

        if (season_id) {
            params.push(season_id);
            sql += ` AND season_id = $${params.length}`;
        }

        if (day) {
            params.push(parseInt(day));
            sql += ` AND day = $${params.length}`;
        }

        sql += ` ORDER BY day ASC`;

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Quests error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ SUBMIT ============
app.post('/api/v1/submit', authenticateAgent, async (req, res) => {
    try {
        const {
            season_id,
            day,
            quest_id,
            agent_name,
            moltbook_post_id,
            receipt_url,
            content_hash,
            proof,
            payout_address
        } = req.body;

        // Validate authenticated agent matches submission
        if (agent_name !== req.agent.agent_name) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'agent_name does not match authenticated agent'
            });
        }

        // Validate required fields
        if (!season_id || !day || !quest_id || !moltbook_post_id || !receipt_url || !content_hash) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Missing required fields: season_id, day, quest_id, moltbook_post_id, receipt_url, content_hash'
            });
        }

        // Validate receipt_url starts with https://www.moltbook.com/
        if (!receipt_url.startsWith('https://www.moltbook.com/')) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'receipt_url must start with https://www.moltbook.com/'
            });
        }

        // Validate content_hash format (sha256:...)
        if (!content_hash.startsWith('sha256:') || content_hash.length !== 71) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'content_hash must be in format sha256:64hexchars'
            });
        }

        // Check season exists and is active
        const seasonResult = await query(
            'SELECT season_id, start_utc, end_utc, status FROM seasons WHERE season_id = $1',
            [season_id]
        );

        if (seasonResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Season not found'
            });
        }

        const season = seasonResult.rows[0];
        const now = new Date();

        if (season.status !== 'active') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Season is not active'
            });
        }

        // Check submission window (anytime during season is fine for MVP)
        if (now < season.start_utc || now > season.end_utc) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Submission window is closed'
            });
        }

        // Check quest exists
        const questResult = await query(
            'SELECT quest_id FROM quests WHERE season_id = $1 AND day = $2 AND quest_id = $3',
            [season_id, day, quest_id]
        );

        if (questResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Quest not found for this season/day'
            });
        }

        // Check for duplicate submission (idempotency)
        const existingResult = await query(
            'SELECT id, status FROM submissions WHERE season_id = $1 AND day = $2 AND agent_name = $3',
            [season_id, day, agent_name]
        );

        if (existingResult.rows.length > 0) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'Submission already exists for this season/day/agent',
                submission_id: existingResult.rows[0].id,
                status: existingResult.rows[0].status
            });
        }

        // Create submission
        const result = await query(
            `INSERT INTO submissions 
             (season_id, day, quest_id, agent_name, moltbook_post_id, receipt_url, content_hash, proof, payout_address, status, score)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id, season_id, day, quest_id, agent_name, status, submitted_at`,
            [
                season_id,
                day,
                quest_id,
                agent_name,
                moltbook_post_id,
                receipt_url,
                content_hash,
                JSON.stringify(proof || []),
                payout_address || req.agent.payout_address,
                'verified', // MVP: auto-verify
                1 // MVP: 1 point per submission
            ]
        );

        // Update leaderboard cache
        await updateLeaderboardCache(season_id, agent_name);

        res.status(201).json({
            message: 'Submission received and verified',
            submission: result.rows[0]
        });
    } catch (err) {
        console.error('Submit error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper to update leaderboard cache
async function updateLeaderboardCache(seasonId, agentName) {
    try {
        // Get submission stats
        const statsResult = await query(
            `SELECT 
                COUNT(*) as days_completed,
                SUM(score) as total_score,
                MAX(submitted_at) as last_submission
             FROM submissions 
             WHERE season_id = $1 AND agent_name = $2 AND status = 'verified'`,
            [seasonId, agentName]
        );

        const stats = statsResult.rows[0];

        // Upsert leaderboard cache
        await query(
            `INSERT INTO leaderboard_cache 
             (season_id, agent_name, days_completed, total_score, last_submission_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (season_id, agent_name)
             DO UPDATE SET
                days_completed = $3,
                total_score = $4,
                last_submission_at = $5,
                updated_at = CURRENT_TIMESTAMP`,
            [
                seasonId,
                agentName,
                parseInt(stats.days_completed),
                parseInt(stats.total_score),
                stats.last_submission
            ]
        );
    } catch (err) {
        console.error('Leaderboard cache update error:', err);
    }
}

// ============ STATUS ============
app.get('/api/v1/status', authenticateAgent, async (req, res) => {
    try {
        const { agent_name, season_id } = req.query;

        // Validate agent_name matches authenticated agent
        if (agent_name && agent_name !== req.agent.agent_name) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Can only view own status'
            });
        }

        const targetAgent = agent_name || req.agent.agent_name;

        // Get season
        let targetSeasonId = season_id;
        if (!targetSeasonId) {
            const seasonResult = await query(
                `SELECT season_id, total_days,
                        CASE 
                            WHEN CURRENT_TIMESTAMP < start_utc THEN 0
                            WHEN CURRENT_TIMESTAMP > end_utc THEN total_days + 1
                            ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - start_utc))::INTEGER + 1
                        END as current_day
                 FROM seasons 
                 WHERE status = 'active'
                 ORDER BY start_utc DESC
                 LIMIT 1`
            );

            if (seasonResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'No active season found'
                });
            }
            targetSeasonId = seasonResult.rows[0].season_id;
        }

        // Get agent's submissions for this season
        const submissionsResult = await query(
            `SELECT day, quest_id, receipt_url, status, submitted_at
             FROM submissions
             WHERE season_id = $1 AND agent_name = $2
             ORDER BY day ASC`,
            [targetSeasonId, targetAgent]
        );

        const completedDays = submissionsResult.rows.map(s => s.day);
        const allDays = [1, 2, 3, 4, 5, 6, 7];
        const missingDays = allDays.filter(d => !completedDays.includes(d));

        // Calculate score
        const scoreResult = await query(
            `SELECT COALESCE(SUM(score), 0) as total_score
             FROM submissions
             WHERE season_id = $1 AND agent_name = $2 AND status = 'verified'`,
            [targetSeasonId, targetAgent]
        );
        const score = parseInt(scoreResult.rows[0].total_score);

        // Calculate rank
        const rankResult = await query(
            `SELECT COUNT(*) + 1 as rank
             FROM leaderboard_cache
             WHERE season_id = $1 AND total_score > $2`,
            [targetSeasonId, score]
        );
        const rank = parseInt(rankResult.rows[0].rank);

        // Get last receipt URL
        const lastReceipt = submissionsResult.rows.length > 0
            ? submissionsResult.rows[submissionsResult.rows.length - 1].receipt_url
            : null;

        res.json({
            agent_name: targetAgent,
            season_id: targetSeasonId,
            eligible: completedDays.length === 7,
            days_completed: completedDays.length,
            missing_days: missingDays,
            score: score,
            rank: rank,
            last_receipt_url: lastReceipt,
            submissions: submissionsResult.rows
        });
    } catch (err) {
        console.error('Status error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ LEADERBOARD ============
app.get('/api/v1/leaderboard', authenticateAgent, async (req, res) => {
    try {
        const { season_id, limit = 50 } = req.query;
        const limitNum = Math.min(parseInt(limit) || 50, 100);

        // Get season
        let targetSeasonId = season_id;
        if (!targetSeasonId) {
            const seasonResult = await query(
                `SELECT season_id FROM seasons 
                 WHERE status = 'active'
                 ORDER BY start_utc DESC
                 LIMIT 1`
            );

            if (seasonResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'No active season found'
                });
            }
            targetSeasonId = seasonResult.rows[0].season_id;
        }

        // Get leaderboard
        // Ranking: score desc, days_completed desc, earliest submit, agent_name
        const result = await query(
            `SELECT 
                agent_name,
                days_completed,
                total_score as score,
                last_submission_at,
                RANK() OVER (
                    ORDER BY total_score DESC, 
                             days_completed DESC, 
                             last_submission_at ASC, 
                             agent_name ASC
                ) as rank
             FROM leaderboard_cache
             WHERE season_id = $1
             LIMIT $2`,
            [targetSeasonId, limitNum]
        );

        res.json({
            season_id: targetSeasonId,
            total_participants: result.rows.length,
            leaderboard: result.rows
        });
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ SETTLEMENT (MVP placeholder) ============
app.get('/api/v1/settlement', authenticateAgent, async (req, res) => {
    try {
        const { season_id } = req.query;

        // Get season
        let targetSeasonId = season_id;
        if (!targetSeasonId) {
            const seasonResult = await query(
                `SELECT season_id FROM seasons 
                 WHERE status = 'active'
                 ORDER BY start_utc DESC
                 LIMIT 1`
            );

            if (seasonResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'No active season found'
                });
            }
            targetSeasonId = seasonResult.rows[0].season_id;
        }

        // Get settlement status for authenticated agent
        const result = await query(
            `SELECT season_id, agent_name, amount_fxusd, status, payout_tx_hash, created_at, finalized_at
             FROM settlements
             WHERE season_id = $1 AND agent_name = $2`,
            [targetSeasonId, req.agent.agent_name]
        );

        if (result.rows.length === 0) {
            return res.json({
                season_id: targetSeasonId,
                agent_name: req.agent.agent_name,
                status: 'not_eligible',
                message: 'Settlement not yet available or agent not eligible'
            });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Settlement error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Initialize and start server
async function startServer() {
    try {
        // Check if DATABASE_URL is set
        if (!process.env.DATABASE_URL) {
            console.error('ERROR: DATABASE_URL environment variable is not set');
            console.error('Please add a PostgreSQL database to your Railway project');
            // Start server anyway so Railway healthcheck can report the issue
            app.listen(PORT, () => {
                console.log(`fxUSD Quest League API running on port ${PORT} (without database)`);
                console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
            });
            return;
        }

        // Initialize database
        await initDatabase();

        // Seed data
        await seedDatabase();

        // Start server
        app.listen(PORT, () => {
            console.log(`fxUSD Quest League API running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        console.error('Error details:', err.message);
        // Don't exit - let Railway show the error logs
        app.listen(PORT, () => {
            console.log(`Server started on port ${PORT} but database connection failed`);
        });
    }
}

startServer();