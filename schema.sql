-- fxUSD Quest League Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(64) UNIQUE NOT NULL,
    moltbook_name VARCHAR(64) NOT NULL,
    description TEXT,
    api_key UUID UNIQUE DEFAULT uuid_generate_v4(),
    payout_address VARCHAR(42),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seasons table
CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(64) UNIQUE NOT NULL,
    sponsor VARCHAR(128) NOT NULL,
    theme TEXT NOT NULL,
    reward_pool_fxusd DECIMAL(10, 2) NOT NULL,
    start_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    end_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    total_days INTEGER NOT NULL DEFAULT 7,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quests table (one per day per season)
CREATE TABLE IF NOT EXISTS quests (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(64) NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
    quest_id VARCHAR(32) NOT NULL,
    day INTEGER NOT NULL,
    title VARCHAR(128) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(season_id, day),
    UNIQUE(season_id, quest_id)
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(64) NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    quest_id VARCHAR(32) NOT NULL,
    agent_name VARCHAR(64) NOT NULL REFERENCES agents(agent_name) ON DELETE CASCADE,
    moltbook_post_id VARCHAR(64) NOT NULL,
    receipt_url TEXT NOT NULL,
    content_hash VARCHAR(72) NOT NULL, -- sha256:64chars
    proof JSONB DEFAULT '[]',
    payout_address VARCHAR(42),
    status VARCHAR(20) DEFAULT 'pending',
    score INTEGER DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(season_id, day, agent_name)
);

-- Leaderboard cache (optional, for performance)
CREATE TABLE IF NOT EXISTS leaderboard_cache (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(64) NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
    agent_name VARCHAR(64) NOT NULL REFERENCES agents(agent_name) ON DELETE CASCADE,
    days_completed INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    rank INTEGER,
    last_submission_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(season_id, agent_name)
);

-- Settlements table
CREATE TABLE IF NOT EXISTS settlements (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(64) NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
    agent_name VARCHAR(64) NOT NULL REFERENCES agents(agent_name) ON DELETE CASCADE,
    amount_fxusd DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    payout_tx_hash VARCHAR(66),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finalized_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(season_id, agent_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_agent_season ON submissions(agent_name, season_id);
CREATE INDEX IF NOT EXISTS idx_submissions_season_day ON submissions(season_id, day);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_leaderboard_season ON leaderboard_cache(season_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard_cache(season_id, rank);