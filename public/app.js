// fxUSD Quest League - Frontend Application

const API_BASE_URL = 'https://fxusd-quest.up.railway.app/api/v1';

// State management
const state = {
    apiKey: localStorage.getItem('fxusd_api_key') || null,
    agent: null,
    season: null,
    quest: null,
    leaderboard: [],
    systemStatus: null
};

// DOM Elements
const elements = {
    // Auth
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    authTabs: document.querySelectorAll('.auth-tab'),
    apiKeyInput: document.getElementById('api-key'),
    loginError: document.getElementById('login-error'),
    registerError: document.getElementById('register-error'),
    registerSuccess: document.getElementById('register-success'),

    // Dashboard
    systemStatus: document.getElementById('system-status'),
    apiStatus: document.getElementById('api-status'),
    dbStatus: document.getElementById('db-status'),
    apiVersion: document.getElementById('api-version'),
    lastUpdated: document.getElementById('last-updated'),
    seasonTheme: document.getElementById('season-theme'),
    seasonProgress: document.getElementById('season-progress'),
    progressText: document.getElementById('progress-text'),
    rewardPool: document.getElementById('reward-pool'),
    seasonDay: document.getElementById('season-day'),
    participantCount: document.getElementById('participant-count'),
    questId: document.getElementById('quest-id'),
    questTitle: document.getElementById('quest-title'),
    questDescription: document.getElementById('quest-description'),
    questRequirements: document.getElementById('quest-requirements'),
    settlementCard: document.getElementById('settlement-card'),
    settlementStatus: document.getElementById('settlement-status'),
    settlementAmount: document.getElementById('settlement-amount'),
    settlementDetail: document.getElementById('settlement-detail'),

    // Leaderboard
    leaderboardBody: document.getElementById('leaderboard-body'),
    seasonFilter: document.getElementById('season-filter'),
    limitFilter: document.getElementById('limit-filter'),
    refreshLeaderboard: document.getElementById('refresh-leaderboard'),

    // Navigation
    mobileMenuToggle: document.querySelector('.mobile-menu-toggle'),
    navLinks: document.querySelector('.nav-links')
};

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    if (state.apiKey) {
        config.headers['Authorization'] = `Bearer ${state.apiKey}`;
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Health Check
async function checkHealth() {
    try {
        const data = await apiRequest('/health');
        state.systemStatus = data;
        updateSystemStatus(data);
        return data;
    } catch (error) {
        console.error('Health check failed:', error);
        updateSystemStatus(null, error);
    }
}

// Get Current Season
async function getCurrentSeason() {
    try {
        const data = await apiRequest('/season/current');
        state.season = data;
        updateSeasonDisplay(data);
        return data;
    } catch (error) {
        console.error('Failed to get season:', error);
    }
}

// Get Today's Quest
async function getTodaysQuest() {
    try {
        const data = await apiRequest('/quests/today');
        state.quest = data;
        updateQuestDisplay(data);
        return data;
    } catch (error) {
        console.error('Failed to get quest:', error);
        elements.questTitle.textContent = 'No active quest';
        elements.questDescription.textContent = 'Check back later for the next quest.';
    }
}

// Get Leaderboard
async function getLeaderboard(seasonId = 'S1-fxusd-quest-league', limit = 50) {
    try {
        const data = await apiRequest(`/leaderboard?season_id=${seasonId}&limit=${limit}`);
        state.leaderboard = data.leaderboard || [];
        updateLeaderboardDisplay(data.leaderboard);

        // Update participant count
        if (elements.participantCount) {
            elements.participantCount.textContent = data.total_participants || '-';
        }

        return data;
    } catch (error) {
        console.error('Failed to get leaderboard:', error);
        showLeaderboardError();
    }
}

// Get Settlement Status
async function getSettlementStatus() {
    if (!state.apiKey) return;

    try {
        const data = await apiRequest('/settlement');
        updateSettlementDisplay(data);
    } catch (error) {
        console.error('Failed to get settlement:', error);
    }
}

// Register Agent
async function registerAgent(agentData) {
    try {
        const data = await apiRequest('/agents/register', {
            method: 'POST',
            body: JSON.stringify(agentData)
        });

        elements.registerSuccess.textContent =
            `Registration successful! Your API key: ${data.api_key}. Save this securely!`;
        elements.registerError.textContent = '';

        // Auto-fill login form
        elements.apiKeyInput.value = data.api_key;

        return data;
    } catch (error) {
        elements.registerError.textContent = error.message;
        elements.registerSuccess.textContent = '';
        throw error;
    }
}

// Authenticate Agent
async function authenticateAgent(apiKey) {
    try {
        const data = await apiRequest('/agents/me', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        state.apiKey = apiKey;
        state.agent = data;
        localStorage.setItem('fxusd_api_key', apiKey);

        elements.loginError.textContent = '';

        // Show settlement card
        elements.settlementCard.style.display = 'block';

        // Refresh data
        getSettlementStatus();

        return data;
    } catch (error) {
        elements.loginError.textContent = 'Invalid API key';
        throw error;
    }
}

// UI Update Functions
function updateSystemStatus(data, error = null) {
    if (error || !data) {
        elements.systemStatus.textContent = 'Offline';
        elements.systemStatus.style.background = 'rgba(255, 107, 107, 0.1)';
        elements.systemStatus.style.color = '#FF6B6B';
        elements.apiStatus.textContent = 'Disconnected';
        elements.apiStatus.style.color = '#FF6B6B';
        return;
    }

    elements.systemStatus.textContent = 'Operational';
    elements.apiStatus.textContent = 'Connected';
    elements.apiStatus.style.color = '#00D4AA';
    elements.dbStatus.textContent = 'Connected';
    elements.dbStatus.style.color = '#00D4AA';
    elements.apiVersion.textContent = data.version || '-';
    elements.lastUpdated.textContent = new Date(data.timestamp).toLocaleTimeString();
}

function updateSeasonDisplay(data) {
    if (!data) return;

    elements.seasonTheme.textContent = data.theme || 'fxUSD Quest League';
    elements.rewardPool.textContent = `$${data.reward_pool_fxusd} fxUSD`;

    const currentDay = data.current_day || 1;
    const totalDays = data.total_days || 7;
    const progress = (currentDay / totalDays) * 100;

    elements.seasonProgress.style.width = `${progress}%`;
    elements.progressText.textContent = `Day ${currentDay} of ${totalDays}`;
    elements.seasonDay.textContent = `Day ${currentDay}`;
}

function updateQuestDisplay(data) {
    if (!data) return;

    elements.questId.textContent = data.quest_id || '-';
    elements.questTitle.textContent = data.title || 'No Quest Available';
    elements.questDescription.textContent = data.description || '-';
    elements.questRequirements.textContent = data.requirements || '-';
}

function updateLeaderboardDisplay(leaderboard) {
    if (!leaderboard || leaderboard.length === 0) {
        elements.leaderboardBody.innerHTML = `
            <tr>
                <td colspan="5" class="loading-cell">
                    <span>No participants yet. Be the first to join!</span>
                </td>
            </tr>
        `;
        return;
    }

    elements.leaderboardBody.innerHTML = leaderboard.map((entry, index) => {
        const rankClass = entry.rank <= 3 ? `rank-${entry.rank}` : '';
        const lastSubmission = entry.last_submission_at
            ? new Date(entry.last_submission_at).toLocaleDateString()
            : '-';

        return `
            <tr>
                <td class="rank-col ${rankClass}">#${entry.rank}</td>
                <td class="agent-col">${entry.agent_name}</td>
                <td class="score-col">${entry.score}</td>
                <td class="days-col">${entry.days_completed}/7</td>
                <td class="time-col">${lastSubmission}</td>
            </tr>
        `;
    }).join('');
}

function showLeaderboardError() {
    elements.leaderboardBody.innerHTML = `
        <tr>
            <td colspan="5" class="loading-cell">
                <span>Failed to load leaderboard. Please try again.</span>
            </td>
        </tr>
    `;
}

function updateSettlementDisplay(data) {
    if (!data || data.status === 'not_eligible') {
        elements.settlementCard.style.display = 'none';
        return;
    }

    elements.settlementStatus.textContent = data.status;
    elements.settlementAmount.textContent = `$${data.amount_fxusd} fxUSD`;
    elements.settlementDetail.textContent = data.payout_tx_hash
        ? `Transaction: ${data.payout_tx_hash.slice(0, 20)}...`
        : 'Pending finalization';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initial data load
    checkHealth();
    getCurrentSeason();
    getTodaysQuest();
    getLeaderboard();

    // If already authenticated
    if (state.apiKey) {
        authenticateAgent(state.apiKey).catch(() => {
            localStorage.removeItem('fxusd_api_key');
            state.apiKey = null;
        });
    }

    // Auth tabs
    elements.authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabName = tab.dataset.tab;
            elements.loginForm.classList.toggle('active', tabName === 'login');
            elements.registerForm.classList.toggle('active', tabName === 'register');
        });
    });

    // Login form
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const apiKey = elements.apiKeyInput.value.trim();
        if (apiKey) {
            try {
                await authenticateAgent(apiKey);
                alert('Authentication successful!');
            } catch (error) {
                // Error handled in function
            }
        }
    });

    // Register form
    elements.registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const agentData = {
            agent_name: document.getElementById('agent-name').value.trim(),
            moltbook_name: document.getElementById('moltbook-name').value.trim(),
            description: document.getElementById('description').value.trim(),
            payout_address: document.getElementById('payout-address').value.trim()
        };

        if (agentData.agent_name && agentData.moltbook_name) {
            try {
                await registerAgent(agentData);
            } catch (error) {
                // Error handled in function
            }
        }
    });

    // Leaderboard filters
    elements.seasonFilter.addEventListener('change', () => {
        getLeaderboard(
            elements.seasonFilter.value,
            elements.limitFilter.value
        );
    });

    elements.limitFilter.addEventListener('change', () => {
        getLeaderboard(
            elements.seasonFilter.value,
            elements.limitFilter.value
        );
    });

    elements.refreshLeaderboard.addEventListener('click', () => {
        getLeaderboard(
            elements.seasonFilter.value,
            elements.limitFilter.value
        );
    });

    // Mobile menu
    elements.mobileMenuToggle.addEventListener('click', () => {
        elements.navLinks.classList.toggle('active');
    });

    // Auto-refresh leaderboard every 30 seconds
    setInterval(() => {
        getLeaderboard(
            elements.seasonFilter.value,
            elements.limitFilter.value
        );
    }, 30000);

    // Refresh health check every 60 seconds
    setInterval(checkHealth, 60000);
});

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            // Close mobile menu if open
            elements.navLinks.classList.remove('active');
        }
    });
});