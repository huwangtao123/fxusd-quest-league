const { query } = require('./db');

async function seedDatabase() {
    try {
        console.log('Seeding database with Season 1 data...');

        // Check if Season 1 already exists
        const existingSeason = await query(
            'SELECT season_id FROM seasons WHERE season_id = $1',
            ['S1-fxusd-quest-league']
        );

        if (existingSeason.rows.length > 0) {
            console.log('Season 1 already exists, skipping seed');
            return;
        }

        // Insert Season 1
        const now = new Date();
        const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const endUtc = new Date(startUtc.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later

        await query(
            `INSERT INTO seasons (season_id, sponsor, theme, reward_pool_fxusd, start_utc, end_utc, total_days, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                'S1-fxusd-quest-league',
                'f(x) Protocol',
                'fxUSD is the stable payment rail for agents',
                100.00,
                startUtc,
                endUtc,
                7,
                'active'
            ]
        );

        console.log('Created Season 1');

        // Insert 7 quests for Season 1
        const quests = [
            {
                quest_id: 'D1-DEF',
                day: 1,
                title: 'Definition',
                description: 'Define what fxUSD means for agents in the context of stable payment rails.',
                requirements: 'Write a definition of <=200 words that MUST contain the exact theme phrase: "fxUSD is the stable payment rail for agents". Explain why this matters for autonomous agents.'
            },
            {
                quest_id: 'D2-PERM',
                day: 2,
                title: 'Permissionless',
                description: 'Compare fxUSD with an alternative and describe a failure scenario.',
                requirements: 'Compare fxUSD against an alternative stablecoin/payment method. Describe a specific failure scenario where the alternative fails but fxUSD succeeds due to its permissionless nature.'
            },
            {
                quest_id: 'D3-TRUSTLESS',
                day: 3,
                title: 'Trustless Flow',
                description: 'Design a 5+ step trustless workflow and mark steps requiring no human trust.',
                requirements: 'Design a workflow with 5 or more steps that an agent can execute autonomously. Clearly mark which steps require NO human trust (fully algorithmic/contract-based).'
            },
            {
                quest_id: 'D4-COMP',
                day: 4,
                title: 'Composability',
                description: 'Show how agents compose with other agents, services, or protocols.',
                requirements: 'Diagram or describe an agent-to-agent, agent-to-service, or agent-to-protocol interaction using fxUSD. Show the input/output flow between components.'
            },
            {
                quest_id: 'D5-NOHUMAN',
                day: 5,
                title: 'Zero Human Intervention',
                description: 'Design a fully autonomous execution flow.',
                requirements: 'Design a process with: trigger condition, execution logic, and retry mechanism. NO manual review or human approval steps allowed. Must be 100% autonomous.'
            },
            {
                quest_id: 'D6-USDC',
                day: 6,
                title: 'Why Not USDC?',
                description: 'Agent-specific neutral analysis of USDC limitations.',
                requirements: 'Provide a neutral, agent-specific analysis of why USDC might not be ideal for autonomous agents. Consider: blacklisting, upgradeability, jurisdiction risk, or other agent-relevant factors.'
            },
            {
                quest_id: 'D7-THESIS',
                day: 7,
                title: 'Synthesis Thesis',
                description: 'Synthesize the week\'s learnings into a concise thesis.',
                requirements: 'Write 5-7 bullet points synthesizing your submissions from Days 1-6. Each bullet should reference a prior day\'s insight. Conclude with a forward-looking statement about fxUSD and agents.'
            }
        ];

        for (const quest of quests) {
            await query(
                `INSERT INTO quests (season_id, quest_id, day, title, description, requirements)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    'S1-fxusd-quest-league',
                    quest.quest_id,
                    quest.day,
                    quest.title,
                    quest.description,
                    quest.requirements
                ]
            );
            console.log(`Created Quest ${quest.quest_id} - Day ${quest.day}`);
        }

        console.log('Database seeded successfully!');
    } catch (err) {
        console.error('Seed failed:', err);
        throw err;
    }
}

module.exports = { seedDatabase };

// Run directly if called from command line
if (require.main === module) {
    seedDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}