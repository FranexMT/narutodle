const API_BASE = 'https://dattebayo-api.onrender.com';
const MAX_ATTEMPTS = 6;

const GAME_MODES = {
    character: { name: 'Personaje', icon: '🥷' },
    jutsu: { name: 'Jutsu', icon: '⚡' },
    eyes: { name: 'Ojos', icon: '👁️' },
    relation: { name: 'Relacion', icon: '🔗' }
};

const STATUS_UNLOCK_ATTEMPT = 3;

const ACHIEVEMENTS = [
    { id: 'first_win', name: 'Primer Paso 🥷', desc: 'Gana tu primera partida', check: s => s.won >= 1 },
    { id: 'streak_5', name: 'Racha de Fuego 🔥', desc: '5 victorias seguidas', check: s => s.streak >= 5 },
    { id: 'streak_10', name: 'Shinobi Dedicado 💪', desc: '10 victorias seguidas', check: s => s.streak >= 10 },
    { id: 'total_10', name: 'Veterano 🏅', desc: 'Gana 10 partidas', check: s => s.won >= 10 },
    { id: 'total_50', name: 'Legendario 🌟', desc: 'Gana 50 partidas', check: s => s.won >= 50 },
    { id: 'speed_demon', name: 'Demasiado Rapido ⚡', desc: 'Gana en 2 intentos', check: s => s.distribution[0] + s.distribution[1] >= 1 },
    { id: 'rank_jonin', name: 'Jōnin 📜', desc: 'Alcanza 300 LP', check: s => s.lp >= 300 },
    { id: 'rank_kage', name: 'El Kage 👑', desc: 'Alcanza 3000 LP', check: s => s.lp >= 3000 }
];

let unlockedAchievements = [];

const LOCAL_IMAGES = {
    'Naruto Uzumaki': 'images/Naruto_Uzumaki.png',
    'Sasuke Uchiha': 'images/Sasuke_Uchiha.png',
    'Kakashi Hatake': 'images/Kakashi_Hatake.png',
    'Madara Uchiha': 'images/Madara_Uchiha.png',
    'Orochimaru': 'images/Orochimaru.png',
    'Itachi Uchiha': 'images/Itachi_Uchiha.png',
    'Jiraiya': 'images/Jiraiya.png'
};

const FALLBACK_IMAGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#111" width="100" height="100"/><path d="M50 20c-8.3 0-15 6.7-15 15s6.7 15 15 15 15-6.7 15-15-6.7-15-15-15zM30 75c0-11 9-20 20-20s20 9 20 20v5H30v-5z" fill="#333"/></svg>');

const VILLAGE_ICONS = {
    'Konoha': '🏯', 'Konohagakure': '🏯', 'Suna': '🏜️', 'Sunagakure': '🏜️',
    'Kiri': '🌊', 'Kirigakure': '🌊', 'Kumo': '⚡', 'Kumogakure': '⚡',
    'Iwa': '🪨', 'Iwagakure': '🪨', 'Oto': '🏭', 'Otogakure': '🏭', 'Unknown': '❓'
};

const CLAN_ICONS = {
    'Uzumaki': '🔴', 'Uchiha': '🖤', 'Senju': '🌳', 'Hyuga': '👁️',
    'Aburame': '🪲', 'Inuzuka': '🐺', 'Akimichi': '🐻', 'Yamanaka': '🌸',
    'Nara': '🦌', 'Sarutobi': '🐒', 'Hatake': '⚔️', 'None': '—'
};

let allCharacters = [];
let searchableCharacters = [];
let searchableByName = new Map();
let allJutsus = [];
let allKekkeiGenkai = [];
let targetCharacter = null;
let currentGameType = localStorage.getItem('narutoDLE_gameType') || 'character';
let attempts = 0;
let gameOver = false;
let guessedNames = [];
let currentGuess = null;

let gameMode = localStorage.getItem('narutoDLE_gameMode') || 'daily';
let gameCategory = 'all';
let hardMode = localStorage.getItem('narutoDLE_hardMode') === 'true';
let visualHints = localStorage.getItem('narutoDLE_visualHints') !== 'false';
let shinobiName = localStorage.getItem('narutoDLE_username');

let stats = { played: 0, won: 0, streak: 0, bestStreak: 0, lp: 0, distribution: [0, 0, 0, 0, 0, 0] };
let hintsUsed = { village: false, clan: false, rank: false, element: false, debut: false, birthday: false, height: false, tools: false };
let revealedHints = [];
let toastTimeout = null;
let debounceTimer = null;

function cleanImageUrl(url) {
    if (!url) return FALLBACK_IMAGE;
    if (url.startsWith('images/') || url.startsWith('data:')) return url;
    let cleanUrl = url;
    if (url.includes('wikia.nocookie.net')) {
        cleanUrl = url.split('/revision/')[0];
    }
    return `https://i0.wp.com/${cleanUrl.replace(/^https?:\/\//, '')}`;
}

function handleImageError(img) {
    if (img.dataset.errorAttempted) { img.src = FALLBACK_IMAGE; return; }
    const currentSrc = img.src;
    if (currentSrc.includes('.png')) {
        img.dataset.errorAttempted = "true";
        img.src = currentSrc.replace('.png', '.PNG');
    } else {
        img.src = FALLBACK_IMAGE;
    }
}

function loadStats() {
    const saved = localStorage.getItem('narutoDLE_stats');
    if (saved) stats = JSON.parse(saved);
    const achSaved = localStorage.getItem('narutoDLE_achievements');
    if (achSaved) unlockedAchievements = JSON.parse(achSaved);
    updateStatsDisplay();
}

function showToast(message, type = 'info', duration = 2500) {
    let existing = document.querySelector('.toast-container');
    if (existing) existing.remove();
    if (toastTimeout) clearTimeout(toastTimeout);
    const container = document.createElement('div');
    container.className = 'toast-container';
    container.innerHTML = `<div class="toast toast-${type}"><span>${message}</span></div>`;
    document.body.appendChild(container);
    requestAnimationFrame(() => container.classList.add('show'));
    toastTimeout = setTimeout(() => { container.classList.remove('show'); setTimeout(() => container.remove(), 300); }, duration);
}

function checkAchievements() {
    const newAchievements = [];
    ACHIEVEMENTS.forEach(ach => {
        if (!unlockedAchievements.includes(ach.id) && ach.check(stats)) {
            unlockedAchievements.push(ach.id);
            newAchievements.push(ach);
        }
    });
    if (newAchievements.length > 0) {
        localStorage.setItem('narutoDLE_achievements', JSON.stringify(unlockedAchievements));
        newAchievements.forEach(ach => {
            setTimeout(() => showToast(`🏆 Logro: ${ach.name}`, 'achievement', 4000), 500);
        });
    }
}

function saveStats() {
    localStorage.setItem('narutoDLE_stats', JSON.stringify(stats));
}

function updateStatsDisplay() {
    document.getElementById('streak-count').textContent = stats.streak;
    document.getElementById('best-streak').textContent = stats.bestStreak;
    document.getElementById('win-percent').textContent = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) + '%' : '0%';
    document.getElementById('games-played').textContent = stats.played;
    document.getElementById('lp-count').textContent = stats.lp;
    document.getElementById('stat-played').textContent = stats.played;
    document.getElementById('stat-win').textContent = stats.won;
    document.getElementById('stat-pct').textContent = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) + '%' : '0%';
    document.getElementById('stat-streak').textContent = stats.streak;
    document.getElementById('stat-best').textContent = stats.bestStreak;
    const rank = calculateRank(stats.lp);
    const rankEl = document.getElementById('stat-level');
    if (rankEl) { rankEl.textContent = rank.name; rankEl.style.color = rank.color; }
    const lpEl = document.getElementById('stat-lp-count');
    if (lpEl) lpEl.textContent = stats.lp + ' LP';
}

function calculateRank(lp) {
    const ranks = [
        { name: 'Kage 👑', start: 3000, color: '#ff4b4b' },
        { name: 'Sannin ⚔️', start: 2000, color: '#9c27b0' },
        { name: 'Jōnin 🧥', start: 300, color: '#f47521' },
        { name: 'Chūnin 📜', start: 100, color: '#facc15' },
        { name: 'Genin 🍃', start: 0, color: '#3ef07a' }
    ];
    for (const rank of ranks) { if (lp >= rank.start) return rank; }
    return { name: 'Genin 🍃', color: '#3ef07a' };
}

function extractAttributes(char) {
    const personal = char.personal || {};
    const rankObj = char.rank || {};
    const debut = char.debut || {};
    const family = char.family || {};

    let sex = personal.sex || 'Unknown';
    if (Array.isArray(sex)) sex = sex[0];

    let affiliation = personal.affiliation || [];
    if (!Array.isArray(affiliation)) affiliation = [affiliation];

    let village = 'Unknown';
    for (const aff of affiliation) {
        if (aff.includes('Konoha') || aff.includes('Leaf')) { village = 'Konoha'; break; }
        if (aff.includes('Suna') || aff.includes('Sand')) { village = 'Suna'; break; }
        if (aff.includes('Kiri') || aff.includes('Mist')) { village = 'Kiri'; break; }
        if (aff.includes('Kumo') || aff.includes('Cloud')) { village = 'Kumo'; break; }
        if (aff.includes('Iwa') || aff.includes('Stone')) { village = 'Iwa'; break; }
        if (aff.includes('Oto')) { village = 'Oto'; break; }
    }

    let clan = char.clan || personal.clan || 'None';
    if (Array.isArray(clan)) clan = clan[0];

    let rank = 'Unknown';
    if (rankObj.ninjaRank) rank = rankObj.ninjaRank['Part II'] || rankObj.ninjaRank['Part I'] || 'Ninja';
    else if (personal.occupation) rank = Array.isArray(personal.occupation) ? personal.occupation[0] : personal.occupation;

    let element = 'Unknown';
    const natureTypes = char.natureType || [];
    if (Array.isArray(natureTypes) && natureTypes.length > 0) {
        element = natureTypes[0].split(' ')[0].replace(' Release', '');
    }

    let status = personal.status || 'Alive';
    if (status === 'Deceased') status = 'Fallecido';
    else if (status === 'Incaptivated') status = 'Capturado';
    else if (status === 'Unknown') status = 'Desconocido';
    else status = 'Vivo';

    let debutArc = 'Unknown';
    let debutDetail = '';
    if (debut.manga) {
        const match = debut.manga.match(/Chapter #(\d+)/i);
        if (match) {
            const chapter = parseInt(match[1]);
            if (chapter <= 238) debutArc = 'Naruto';
            else if (chapter <= 699) debutArc = 'Shippuden';
            else debutArc = 'Boruto';
            debutDetail = chapter.toString();
        }
    }
    if (debutArc === 'Unknown' && debut.anime) {
        const matchAnime = debut.anime.match(/Episode #(\d+)/i);
        if (matchAnime) {
            const episode = parseInt(matchAnime[1]);
            if (episode <= 220) debutArc = 'Naruto';
            else if (episode <= 500) debutArc = 'Shippuden';
            else debutArc = 'Boruto';
            debutDetail = episode.toString();
        }
    }

    let kekkeiGenkai = personal.kekkeiGenkai || 'Ninguno';
    if (Array.isArray(kekkeiGenkai)) kekkeiGenkai = kekkeiGenkai.join(', ');
    if (kekkeiGenkai === '' || kekkeiGenkai === 'Unknown') kekkeiGenkai = 'Ninguno';

    let imgSrc = cleanImageUrl(char.images?.[0]);
    if (LOCAL_IMAGES[char.name]) imgSrc = LOCAL_IMAGES[char.name];

    let birthday = 'Desconocido';
    if (personal.birthdate) {
        const bd = personal.birthdate;
        if (typeof bd === 'object' && (bd.day || bd.month)) {
            birthday = `${bd.day || '?'}/${bd.month || '?'}`;
        } else if (typeof bd === 'string' && bd !== 'Unknown') {
            birthday = bd;
        }
    }

    const height = personal.height || {};
    let heightStr = 'Desconocido';
    if (height['Part II']) heightStr = height['Part II'].replace(' cm', '');
    else if (height['Part I']) heightStr = height['Part I'].replace(' cm', '');

    const tools = personal.toolkit || [];
    const toolsStr = Array.isArray(tools) ? tools.slice(0, 3).join(', ') : 'Ninguno';

    return {
        name: char.name, sex, village, villageIcon: VILLAGE_ICONS[village] || '❓',
        clan, clanIcon: CLAN_ICONS[clan] || '—', rank, element, status, debutArc, debutDetail, kekkeiGenkai, image: imgSrc,
        birthday, height: heightStr, tools: toolsStr,
        master: family['Master'] || null,
        students: (family['Student'] || []).flat().filter(Boolean),
        father: family['Father'], mother: family['Mother'],
        siblings: ((family['Brother'] || []).flat()).filter(Boolean)
    };
}

async function fetchCharacters() {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const gameArea = document.getElementById('game-area');

    try {
        const cached = localStorage.getItem('narutoDLE_characters');
        let data;
        
        if (cached) {
            const parsed = JSON.parse(cached);
            const cacheAge = Date.now() - parsed.timestamp;
            if (cacheAge < 24 * 60 * 60 * 1000) {
                data = parsed.data;
                loading.querySelector('p').textContent = 'Cargando desde cache...';
            }
        }
        
        if (!data) {
            loading.querySelector('p').textContent = 'Descargando personajes...';
            const response = await fetch(`${API_BASE}/characters?limit=1500`);
            if (!response.ok) throw new Error('Error loading');
            data = await response.json();
            localStorage.setItem('narutoDLE_characters', JSON.stringify({ data, timestamp: Date.now() }));
        }

        allCharacters = data.characters.filter(c => c.images?.length > 0 && c.name).map(c => ({ ...c, attrs: extractAttributes(c) }))
            .filter(c => c.attrs.debutArc !== 'Unknown');
        
        searchableCharacters = data.characters.filter(c => c.name).map(c => ({ ...c, attrs: extractAttributes(c) }))
            .filter(c => c.attrs.debutArc !== 'Unknown');

        // Build search index for fast lookup
        searchableByName = new Map();
        searchableCharacters.forEach(c => {
            searchableByName.set(c.name.toLowerCase(), c);
        });

        allJutsus = [];
        const jutsuSet = new Set();
        data.characters.forEach(c => {
            if (c.jutsu && Array.isArray(c.jutsu)) {
                c.jutsu.forEach(j => {
                    if (j && j.length < 50 && !jutsuSet.has(j.toLowerCase())) {
                        jutsuSet.add(j.toLowerCase());
                        allJutsus.push({ name: j, characterId: c.id, characterName: c.name });
                    }
                });
            }
        });

        allKekkeiGenkai = [];
        const kekkeiSet = new Set();
        data.characters.forEach(c => {
            if (c.personal?.kekkeiGenkai) {
                const kk = Array.isArray(c.personal.kekkeiGenkai) ? c.personal.kekkeiGenkai : [c.personal.kekkeiGenkai];
                kk.forEach(k => { if (k && k !== 'Unknown' && !kekkeiSet.has(k)) { kekkeiSet.add(k); allKekkeiGenkai.push({ name: k, characterName: c.name }); } });
            }
        });

        if (allCharacters.length === 0) throw new Error('No characters found');

        loadStats();
        setupEventListeners();
        setupModals();

        loading.classList.add('hidden');
        gameArea.classList.remove('hidden');

        selectTarget();
        updateDisplay();

        if (gameOver) document.getElementById('end-game-modal').classList.remove('hidden');
        if (gameMode === 'daily') startCountdown();
        checkShinobiIdentity();

    } catch (err) {
        console.error('Error loading:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

function selectTarget() {
    if (currentGameType === 'jutsu') {
        if (allJutsus.length === 0) return;
        if (gameMode === 'daily') {
            const seed = new Date().toDateString().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            currentGuess = allJutsus[seed % allJutsus.length];
        } else currentGuess = allJutsus[Math.floor(Math.random() * allJutsus.length)];
        targetCharacter = allCharacters.find(c => c.id === currentGuess.characterId) || allCharacters[0];
    } else if (currentGameType === 'eyes') {
        if (allKekkeiGenkai.length === 0) return;
        if (gameMode === 'daily') {
            const seed = new Date().toDateString().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            currentGuess = allKekkeiGenkai[seed % allKekkeiGenkai.length];
        } else currentGuess = allKekkeiGenkai[Math.floor(Math.random() * allKekkeiGenkai.length)];
        targetCharacter = allCharacters.find(c => c.personal?.kekkeiGenkai?.includes(currentGuess.name)) || allCharacters[0];
    } else if (currentGameType === 'relation') {
        const relations = [];
        allCharacters.forEach(c => {
            if (c.attrs.master) relations.push({ type: 'master', target: c.attrs.master, char: c });
            c.attrs.students.forEach(s => relations.push({ type: 'student', target: s, char: c }));
            if (c.attrs.father) relations.push({ type: 'father', target: c.attrs.father, char: c });
            if (c.attrs.mother) relations.push({ type: 'mother', target: c.attrs.mother, char: c });
            c.attrs.siblings.forEach(s => relations.push({ type: 'sibling', target: s, char: c }));
        });
        if (relations.length === 0) { currentGuess = null; targetCharacter = allCharacters[0]; return; }
        if (gameMode === 'daily') {
            const seed = new Date().toDateString().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            currentGuess = relations[seed % relations.length];
        } else currentGuess = relations[Math.floor(Math.random() * relations.length)];
        targetCharacter = currentGuess.char;
    } else {
        let pool = [...allCharacters];
        if (gameCategory === 'akatsuki') pool = pool.filter(c => (c.affiliation || []).some(a => a.includes('Akatsuki')));
        else if (gameCategory === 'classic') pool = pool.filter(c => c.attrs.debutArc === 'Naruto');
        else if (gameCategory === 'shippuden') pool = pool.filter(c => c.attrs.debutArc === 'Shippuden');
        else if (gameCategory === 'war') pool = pool.filter(c => c.attrs.debutArc === 'Shippuden' && parseInt(c.attrs.debutDetail || 0) >= 310);
        else if (gameCategory === 'boruto') pool = pool.filter(c => c.attrs.debutArc === 'Boruto');
        if (pool.length === 0) pool = allCharacters;
        if (gameMode === 'daily') {
            const seed = new Date().toDateString().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            targetCharacter = pool[seed % pool.length];
        } else targetCharacter = pool[Math.floor(Math.random() * pool.length)];
        currentGuess = null;
    }
}

function setupEventListeners() {
    document.getElementById('guess-btn').addEventListener('click', makeGuess);
    document.getElementById('guess-input').addEventListener('keypress', e => { if (e.key === 'Enter') makeGuess(); });
    document.getElementById('guess-input').addEventListener('input', e => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => handleInput(e.target.value), 50);
    });
    document.getElementById('play-again').addEventListener('click', nextRound);
    document.getElementById('retry-btn').addEventListener('click', () => location.reload());
    document.getElementById('share-btn-end').addEventListener('click', shareResults);

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameMode = btn.dataset.mode;
            localStorage.setItem('narutoDLE_gameMode', gameMode);
            resetGame();
        });
    });

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameCategory = btn.dataset.category;
            resetGame();
        });
    });

    document.querySelectorAll('.game-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.game-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentGameType = btn.dataset.type;
            localStorage.setItem('narutoDLE_gameType', currentGameType);
            document.body.classList.remove('mode-character', 'mode-jutsu', 'mode-eyes', 'mode-relation');
            document.body.classList.add(`mode-${currentGameType}`);
            resetGame();
        });
    });

    document.body.classList.add(`mode-${currentGameType}`);

    ['village', 'clan', 'rank', 'element', 'debut', 'birthday', 'height', 'tools'].forEach(type => {
        document.getElementById(`hint-${type}`).addEventListener('click', () => revealHint(type));
    });

    document.getElementById('menu-btn').addEventListener('click', () => toggleModal('menu'));
    document.getElementById('close-menu').addEventListener('click', () => toggleModal('menu'));
    document.getElementById('menu-stats').addEventListener('click', () => { toggleModal('menu'); toggleModal('stats'); });
    document.getElementById('menu-howto').addEventListener('click', () => { toggleModal('menu'); toggleModal('howto'); });
    document.getElementById('menu-credits').addEventListener('click', () => alert('Naruto DLE - Gracias por jugar!'));
    document.getElementById('achievements-btn').addEventListener('click', showAchievements);

    document.getElementById('save-username-btn').addEventListener('click', saveShinobiIdentity);

    const charImg = document.getElementById('character-image');
    charImg.style.cursor = 'zoom-in';
    charImg.addEventListener('click', () => {
        if (!targetCharacter) return;
        const modal = document.createElement('div');
        modal.className = 'image-zoom-modal';
        modal.innerHTML = `<button class="close-zoom">×</button><img src="${targetCharacter.attrs.image}" alt="${targetCharacter.name}" referrerpolicy="no-referrer">`;
        document.body.appendChild(modal);
        modal.addEventListener('click', () => modal.remove());
    });

    document.addEventListener('click', e => {
        const suggestions = document.getElementById('suggestions');
        if (!e.target.closest('.input-section')) {
            suggestions.classList.add('hidden');
        }
    });
}

function setupModals() {
    const modals = ['menu', 'stats', 'settings', 'howto', 'achievements'];
    const btns = {
        menu: ['menu-btn', 'menu-stats', 'close-menu'],
        stats: ['stats-btn', 'close-stats'],
        settings: ['settings-btn', 'close-settings'],
        howto: ['menu-howto', 'close-howto'],
        achievements: ['achievements-btn', 'close-achievements']
    };

    modals.forEach(m => {
        btns[m].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', () => {
                    if (m === 'achievements') showAchievements();
                    else toggleModal(m);
                });
            }
        });
    });

    document.getElementById('close-leaderboard').addEventListener('click', () => toggleModal('leaderboard'));
    document.getElementById('hard-mode-toggle').checked = hardMode;
    document.getElementById('hard-mode-toggle').addEventListener('change', e => { hardMode = e.target.checked; localStorage.setItem('narutoDLE_hardMode', hardMode); });
    document.getElementById('contrast-toggle').addEventListener('change', e => document.body.classList.toggle('high-contrast', e.target.checked));
    document.getElementById('visual-hints-toggle').checked = visualHints;
    document.getElementById('visual-hints-toggle').addEventListener('change', e => { visualHints = e.target.checked; localStorage.setItem('narutoDLE_visualHints', visualHints); updateBlurOverlay(); });
    document.getElementById('reset-progress').addEventListener('click', () => {
        if (confirm('Reiniciar progreso?')) {
            localStorage.removeItem('narutoDLE_stats');
            stats = { played: 0, won: 0, streak: 0, bestStreak: 0, distribution: [0, 0, 0, 0, 0, 0] };
            updateStatsDisplay();
            toggleModal('settings');
            showToast('Progreso reiniciado', 'success');
        }
    });
    document.getElementById('leaderboard-btn').addEventListener('click', () => toggleModal('leaderboard'));
}

function toggleModal(name) {
    const modal = document.getElementById(`${name}-modal`);
    modal.classList.toggle('hidden');
    if (name === 'stats') updateDistributionChart();
    if (name === 'leaderboard' && !modal.classList.contains('hidden')) loadLeaderboard();
}

function showAchievements() {
    const modal = document.getElementById('achievements-modal');
    const list = document.getElementById('achievements-list');
    if (list) {
        list.innerHTML = ACHIEVEMENTS.map(ach => {
            const unlocked = unlockedAchievements.includes(ach.id);
            return `<div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}"><div class="achievement-icon">${unlocked ? '🏆' : '🔒'}</div><div class="achievement-info"><h4>${ach.name}</h4><p>${ach.desc}</p></div>${unlocked ? '<span class="achievement-check">✓</span>' : ''}</div>`;
        }).join('');
    }
    if (modal) modal.classList.remove('hidden');
}

function checkShinobiIdentity() {
    const savedUser = localStorage.getItem('narutoDLE_username');
    const savedPass = localStorage.getItem('narutoDLE_session');
    if (savedUser && savedPass) {
        shinobiName = savedUser;
        document.getElementById('login-modal').classList.add('hidden');
        syncPlayer(stats, shinobiName);
    } else {
        // Solo mostrar modal si no tiene sesion
        setTimeout(() => {
            document.getElementById('login-modal').classList.remove('hidden');
        }, 500);
    }
}

function saveShinobiIdentity() {
    const input = document.getElementById('username-input');
    const name = input.value.trim();
    if (name.length < 3) { alert('Minimo 3 caracteres'); return; }
    shinobiName = name;
    localStorage.setItem('narutoDLE_username', name);
    localStorage.setItem('narutoDLE_session', Math.random().toString(36) + Date.now());
    document.getElementById('login-modal').classList.add('hidden');
    syncPlayer(stats, shinobiName);
    showToast('Sesion iniciada!', 'success');
}

async function loadLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '<div class="loading-mini">Cargando...</div>';
    const data = await getLeaderboard();
    if (data.length === 0) { list.innerHTML = '<div class="loading-mini">Sin datos</div>'; return; }
    list.innerHTML = data.map((player, i) => {
        const rank = calculateRank(player.lp || 0);
        return `<div class="leaderboard-item"><div class="lb-left"><span class="lb-rank ${i === 0 ? 'first' : ''}">${i + 1}</span><div class="lb-info"><span class="lb-name">${player.username}</span><span class="lb-rank-name" style="color: ${rank.color}">${rank.name}</span></div></div><div class="lb-right"><div class="lb-stat"><span class="lb-lp-val">${player.lp || 0} LP</span></div></div></div>`;
    }).join('');
}

// Normalize string for search (remove accents, to lowercase)
function normalizeStr(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function handleInput(value) {
    const suggestions = document.getElementById('suggestions');
    if (value.length < 1) { suggestions.classList.add('hidden'); return; }

    const results = getSuggestions(value);
    suggestions.classList.remove('hidden');

    if (results.length === 0) {
        suggestions.innerHTML = '<div class="suggestion-item" style="justify-content: center; color: var(--text-secondary);">No hay coincidencias</div>';
        return;
    }

    let html = '';
    if (currentGameType === 'jutsu') {
        html = results.map(j => `<div class="suggestion-item" data-name="${j.name}"><span class="suggestion-icon">⚡</span><span class="suggestion-name">${j.name}</span><span class="char-tag">${j.characterName}</span></div>`).join('');
    } else if (currentGameType === 'eyes') {
        html = results.map(k => `<div class="suggestion-item" data-name="${k.name}"><span class="suggestion-icon">👁️</span><span class="suggestion-name">${k.name}</span><span class="char-tag">${k.characterName}</span></div>`).join('');
    } else {
        // Mostrar nombre inmediatamente, cargar imágenes en background
        html = results.map(c => {
            const img = LOCAL_IMAGES[c.name] || c.attrs.image || FALLBACK_IMAGE;
            return `<div class="suggestion-item" data-name="${c.name}" data-img="${img}">
                <div class="suggestion-img-placeholder">🥷</div>
                <span class="suggestion-name">${c.name}</span>
            </div>`;
        }).join('');
    }

    suggestions.innerHTML = html;

    // Cargar imágenes en background
    suggestions.querySelectorAll('.suggestion-item[data-img]').forEach(item => {
        const placeholder = item.querySelector('.suggestion-img-placeholder');
        if (!placeholder) return;
        
        const img = new Image();
        img.onload = () => {
            placeholder.outerHTML = `<img class="suggestion-img" src="${item.dataset.img}" referrerpolicy="no-referrer">`;
        };
        img.onerror = () => {
            placeholder.textContent = '❓';
            placeholder.style.opacity = '0.3';
        };
        img.src = item.dataset.img;
    });

    suggestions.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById('guess-input').value = item.dataset.name;
            suggestions.classList.add('hidden');
            makeGuess();
        });
    });
}

function getSuggestions(query) {
    const q = normalizeStr(query);
    
    if (currentGameType === 'jutsu') {
        return allJutsus
            .filter(j => normalizeStr(j.name).includes(q))
            .sort((a, b) => {
                const aStarts = normalizeStr(a.name).startsWith(q);
                const bStarts = normalizeStr(b.name).startsWith(q);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return a.name.localeCompare(b.name);
            })
            .slice(0, 10);
    }
    
    if (currentGameType === 'eyes') {
        return allKekkeiGenkai
            .filter(k => normalizeStr(k.name).includes(q))
            .sort((a, b) => {
                const aStarts = normalizeStr(a.name).startsWith(q);
                const bStarts = normalizeStr(b.name).startsWith(q);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return a.name.localeCompare(b.name);
            })
            .slice(0, 10);
    }

    // Filter por categoria primero
    let pool = searchableCharacters;
    if (currentGameType === 'character') {
        pool = pool.filter(c => {
            if (gameCategory === 'akatsuki') return (c.affiliation || []).some(a => a.includes('Akatsuki'));
            if (gameCategory === 'classic') return c.attrs.debutArc === 'Naruto';
            if (gameCategory === 'shippuden') return c.attrs.debutArc === 'Shippuden';
            if (gameCategory === 'war') return c.attrs.debutArc === 'Shippuden' && parseInt(c.attrs.debutDetail || 0) >= 310;
            if (gameCategory === 'boruto') return c.attrs.debutArc === 'Boruto';
            return true;
        });
    }

    // Filter por ya adivinados
    if (guessedNames.length > 0) {
        pool = pool.filter(c => !guessedNames.includes(c.name));
    }

    // Buscar - priorizar los que empiezan con la letra
    const results = pool.filter(c => normalizeStr(c.name).includes(q));

    return results
        .sort((a, b) => {
            const aName = normalizeStr(a.name);
            const bName = normalizeStr(b.name);
            const aStarts = aName.startsWith(q);
            const bStarts = bName.startsWith(q);
            const aExact = aName === q;
            const bExact = bName === q;
            
            // Exact match primero
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            // Que empiecen con la letra
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            // Alfabético
            return aName.localeCompare(bName);
        })
        .slice(0, 10);
}

function makeGuess() {
    if (gameOver) return;
    const input = document.getElementById('guess-input');
    const name = input.value.trim();
    if (!name) return;

    if (currentGameType === 'jutsu') {
        const guessed = allJutsus.find(j => j.name.toLowerCase() === name.toLowerCase());
        if (!guessed) { showToast('Jutsu no encontrado', 'error'); return; }
        if (guessedNames.includes(guessed.name)) { showToast('Ya intentado', 'warning'); input.value = ''; return; }
        guessedNames.push(guessed.name);
        attempts++;
        input.value = '';
        const isCorrect = guessed.name === currentGuess.name;
        renderGuessRowJutsu(guessed, currentGuess, isCorrect);
        updateDisplay();
        if (isCorrect) { showToast(`¡Victoria en ${attempts}! ⚡`, 'success'); endGame(true); }
        else if (attempts >= MAX_ATTEMPTS) { showToast(`Era: ${currentGuess.name}`, 'info'); endGame(false); }
        return;
    }

    if (currentGameType === 'eyes') {
        const guessed = allKekkeiGenkai.find(k => k.name.toLowerCase() === name.toLowerCase());
        if (!guessed) { showToast('Kekkei no encontrado', 'error'); return; }
        if (guessedNames.includes(guessed.name)) { showToast('Ya intentado', 'warning'); input.value = ''; return; }
        guessedNames.push(guessed.name);
        attempts++;
        input.value = '';
        const isCorrect = guessed.name === currentGuess.name;
        renderGuessRowKekkei(guessed, currentGuess, isCorrect);
        updateDisplay();
        if (isCorrect) { showToast(`¡Victoria en ${attempts}! 👁️`, 'success'); endGame(true); }
        else if (attempts >= MAX_ATTEMPTS) { showToast(`Era: ${currentGuess.name}`, 'info'); endGame(false); }
        return;
    }

    if (currentGameType === 'relation') {
        const guessedChar = searchableByName.get(name.toLowerCase());
        if (!guessedChar) { showToast('Personaje no encontrado', 'error'); return; }
        if (guessedNames.includes(guessedChar.name)) { showToast('Ya intentado', 'warning'); input.value = ''; return; }
        
        let isCorrect = false;
        if (currentGuess.type === 'master' && guessedChar.name === currentGuess.target) isCorrect = true;
        else if (currentGuess.type === 'student' && guessedChar.attrs.students.includes(currentGuess.target)) isCorrect = true;
        else if (currentGuess.type === 'father' && guessedChar.name === currentGuess.target) isCorrect = true;
        else if (currentGuess.type === 'mother' && guessedChar.name === currentGuess.target) isCorrect = true;
        else if (currentGuess.type === 'sibling' && guessedChar.attrs.siblings.includes(currentGuess.target)) isCorrect = true;

        guessedNames.push(guessedChar.name);
        attempts++;
        input.value = '';
        renderGuessRowRelation(guessedChar, targetCharacter.attrs, currentGuess.type, currentGuess.target, isCorrect);
        updateDisplay();
        if (isCorrect) { showToast(`¡Victoria en ${attempts}! 🔗`, 'success'); endGame(true); }
        else if (attempts >= MAX_ATTEMPTS) { showToast(`Era: ${currentGuess.target}`, 'info'); endGame(false); }
        return;
    }

    const guessed = searchableByName.get(name.toLowerCase());
    if (!guessed) { showToast('Personaje no encontrado', 'error'); return; }
    if (guessedNames.includes(guessed.name)) { showToast('Ya intentado', 'warning'); input.value = ''; return; }

    guessedNames.push(guessed.name);
    attempts++;
    input.value = '';
    document.getElementById('suggestions').classList.add('hidden');

    renderGuessRow(guessed.attrs, targetCharacter.attrs);
    updateDisplay();

    if (guessed.id === targetCharacter.id) {
        showToast(`¡Victoria en ${attempts}! 🎉`, 'success');
        endGame(true);
    } else if (attempts >= MAX_ATTEMPTS) {
        showToast(`Era ${targetCharacter.name}`, 'info');
        endGame(false);
    }
}

function renderGuessRow(guess, target) {
    const list = document.getElementById('guesses-list');
    const row = document.createElement('div');
    row.className = 'guess-row';

    const formatDebut = (arc, detail) => detail ? `${arc} <span class="debut-detail">#${detail}</span>` : arc;
    const isStatusLocked = attempts < STATUS_UNLOCK_ATTEMPT;

    const cells = [
        { html: `<img src="${guess.image}" referrerpolicy="no-referrer" onerror="handleImageError(this)"><span>${guess.name}</span>`, className: 'name-cell' },
        { val: guess.sex, target: target.sex },
        { html: `<span class="attr-icon">${guess.villageIcon}</span> ${guess.village}`, target: target.village },
        { html: `<span class="attr-icon">${guess.clanIcon}</span> ${guess.clan}`, target: target.clan },
        { val: guess.rank, target: target.rank },
        { val: guess.element, target: target.element },
        { val: guess.debutArc, target: target.debutArc, html: formatDebut(guess.debutArc, guess.debutDetail) },
        { val: isStatusLocked ? '???' : guess.status, target: target.status, locked: isStatusLocked }
    ];

    cells.forEach((cell, i) => {
        const div = document.createElement('div');
        const isCorrect = !cell.locked && cell.val === cell.target;
        div.className = `guess-cell ${cell.className || (cell.locked ? 'locked' : (isCorrect ? 'correct' : 'incorrect'))}`;
        div.innerHTML = cell.html || cell.val || '';
        div.style.animationDelay = `${i * 0.1}s`;
        if (cell.locked) div.title = `Se desbloquea en intento ${STATUS_UNLOCK_ATTEMPT}`;
        row.appendChild(div);
    });

    list.prepend(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderGuessRowJutsu(guessed, target, isCorrect) {
    const list = document.getElementById('guesses-list');
    const row = document.createElement('div');
    row.className = 'guess-row jutsu-row';
    const char = allCharacters.find(c => c.id === guessed.characterId) || targetCharacter;
    row.innerHTML = `<div class="guess-cell name-cell"><img src="${char.attrs.image}" referrerpolicy="no-referrer" onerror="handleImageError(this)"><span>${guessed.characterName}</span></div><div class="guess-cell ${isCorrect ? 'correct' : 'incorrect'}" style="grid-column: span 2;"><span>${guessed.name}</span></div><div class="guess-cell ${char.attrs.village === targetCharacter.attrs.village ? 'correct' : 'incorrect'}">${char.attrs.village}</div>`;
    list.prepend(row);
}

function renderGuessRowKekkei(guessed, target, isCorrect) {
    const list = document.getElementById('guesses-list');
    const row = document.createElement('div');
    row.className = 'guess-row kekkei-row';
    const char = allCharacters.find(c => c.personal?.kekkeiGenkai?.includes(guessed.name));
    row.innerHTML = `<div class="guess-cell name-cell">${char ? `<img src="${char.attrs.image}" referrerpolicy="no-referrer">` : ''}<span>${guessed.characterName}</span></div><div class="guess-cell ${isCorrect ? 'correct' : 'incorrect'}">👁️ ${guessed.name}</div><div class="guess-cell ${char?.attrs.village === targetCharacter.attrs.village ? 'correct' : 'incorrect'}">${char?.attrs.village || ''}</div>`;
    list.prepend(row);
}

function renderGuessRowRelation(guessedChar, targetAttrs, relationType, correctPerson, isCorrect) {
    const list = document.getElementById('guesses-list');
    const row = document.createElement('div');
    row.className = 'guess-row relation-row';
    const relLabel = { master: '🎓 Maestro', student: '📚 Estudiante', father: '👨 Padre', mother: '👩 Madre', sibling: '👫 Hermano' };
    row.innerHTML = `<div class="guess-cell name-cell"><img src="${guessedChar.attrs.image}" referrerpolicy="no-referrer" onerror="handleImageError(this)"><span>${guessedChar.name}</span></div><div class="guess-cell ${isCorrect ? 'correct' : 'incorrect'}">${relLabel[relationType] || relationType}</div><div class="guess-cell ${isCorrect ? 'correct' : 'incorrect'}">${correctPerson}</div>`;
    list.prepend(row);
}

function revealHint(type) {
    if (gameOver || !targetCharacter) return;
    const attrs = targetCharacter.attrs;
    const labels = { village: 'Aldea', clan: 'Clan', rank: 'Rango', element: 'Elemento', debut: 'Estado', birthday: 'Cumple', height: 'Altura', tools: 'Armas' };
    const values = { village: attrs.village, clan: attrs.clan, rank: attrs.rank, element: attrs.element, debut: attrs.status, birthday: attrs.birthday, height: attrs.height + ' cm', tools: attrs.tools };
    const value = values[type];
    if (!value || value === 'Desconocido') { showToast('No hay info disponible', 'info'); return; }

    hintsUsed[type] = true;
    revealedHints.push({ type, value });
    const btn = document.getElementById(`hint-${type}`);
    btn.innerHTML = `<span class="hint-label">${labels[type]}:</span> <span class="hint-value">${value}</span>`;
    btn.classList.add('revealed');
    btn.disabled = true;

    stats.lp = Math.max(0, stats.lp - 2);
    updateStatsDisplay();
    saveStats();
    showToast(`Pista: ${labels[type]} = ${value}`, 'info', 2000);
}

function updateDisplay() {
    const overlay = document.getElementById('blur-overlay');
    const image = document.getElementById('character-image');
    const qMark = document.getElementById('question-mark');

    if (targetCharacter) {
        image.src = targetCharacter.attrs.image;
    }

    if (!visualHints || currentGameType !== 'character') {
        overlay.style.display = 'none';
        qMark.style.display = 'none';
    } else {
        overlay.className = 'blur-overlay';
        if (attempts > 0) overlay.classList.add(`level-${attempts}`);
    }

    document.querySelectorAll('.attempt-dot').forEach((dot, i) => {
        dot.classList.remove('active', 'used');
        if (i < attempts) dot.classList.add('used');
        else if (i === attempts) dot.classList.add('active');
    });

    if (gameOver) { overlay.classList.add('revealed'); qMark.style.display = 'none'; }
}

function updateBlurOverlay() {
    if (!visualHints) {
        document.getElementById('blur-overlay').style.display = 'none';
        document.getElementById('question-mark').style.display = 'none';
    }
}

function endGame(won) {
    gameOver = true;
    updateDisplay();

    let lpGained = 0;
    stats.played++;
    if (won) {
        stats.won++;
        stats.streak++;
        if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
        stats.distribution[attempts - 1]++;
        lpGained = Math.max(5, (7 - attempts) * 5);
        stats.lp += lpGained;
    } else {
        stats.streak = 0;
        lpGained = -15;
        stats.lp = Math.max(0, stats.lp + lpGained);
    }
    saveStats();
    updateStatsDisplay();
    checkAchievements();
    syncPlayer(stats, shinobiName);

    document.getElementById('end-game-modal').classList.remove('hidden');
    const emoji = currentGameType === 'jutsu' ? '⚡' : currentGameType === 'eyes' ? '👁️' : currentGameType === 'relation' ? '🔗' : '🍥';
    document.getElementById('end-title').textContent = won ? `¡VICTORIA! ${emoji}` : '¡DERROTA! 💔';
    document.getElementById('end-subtitle').textContent = won ? `Adivinado en ${attempts} ${attempts === 1 ? 'intento' : 'intentos'}` : 'Mejor suerte mañana';
    document.getElementById('end-subtitle').innerHTML += `<br><span style="color: ${won ? '#3ef07a' : '#ff4b4b'}">${won ? '+' : ''}${lpGained} LP</span>`;
    const rank = calculateRank(stats.lp);
    document.getElementById('end-subtitle').innerHTML += `<br><span style="color: ${rank.color}">Rango: ${rank.name}</span>`;

    let answerText = targetCharacter.name;
    if (currentGameType === 'relation' && currentGuess) {
        answerText = `${currentGuess.target} (${currentGuess.type} de ${targetCharacter.name})`;
    }
    document.getElementById('answer-name').textContent = answerText;
    document.getElementById('answer-image').src = targetCharacter.attrs.image;

    generateShareText(won);
    updateMiniDistribution();
}

function generateShareText(won) {
    const emoji = currentGameType === 'jutsu' ? '⚡' : currentGameType === 'eyes' ? '👁️' : currentGameType === 'relation' ? '🔗' : '🍥';
    const modeName = currentGameType === 'jutsu' ? 'Jutsu' : currentGameType === 'eyes' ? 'Ojos' : currentGameType === 'relation' ? 'Relacion' : 'Personaje';
    const lines = [`Naruto DLE - ${modeName} ${new Date().toLocaleDateString()}`, ''];
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (i < attempts) lines.push('🟩');
        else lines.push('⬜');
    }
    lines.push('', `${emoji} ${won ? attempts : 'X'}/${MAX_ATTEMPTS}`);
    document.getElementById('share-text').textContent = lines.join('\n');
}

function updateMiniDistribution() {
    const bar = document.getElementById('distribution-bar');
    const max = Math.max(...stats.distribution, 1);
    bar.innerHTML = stats.distribution.map((count, i) => {
        const pct = Math.max(Math.round((count / max) * 100), 8);
        const isCurrent = attempts === i + 1 && gameOver;
        return `<div class="dist-item"><span class="dist-num">${i + 1}</span><div class="dist-bar ${isCurrent ? 'highlight' : ''}" style="width: ${pct}%">${count}</div></div>`;
    }).join('');
}

function updateDistributionChart() {
    const container = document.getElementById('full-distribution');
    const max = Math.max(...stats.distribution, 1);
    container.innerHTML = stats.distribution.map((count, i) => {
        const pct = Math.max(Math.round((count / max) * 100), 8);
        return `<div class="dist-item"><span class="dist-num">${i + 1}</span><div class="dist-bar" style="width: ${pct}%">${count}</div></div>`;
    }).join('');
}

function shareResults() {
    const text = document.getElementById('share-text').textContent;
    if (navigator.share) {
        navigator.share({ text }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('share-btn-end');
            btn.textContent = '¡Copiado!';
            setTimeout(() => btn.textContent = '📤 Compartir', 2000);
        });
    }
}

function resetGame() {
    attempts = 0;
    gameOver = false;
    hintsUsed = { village: false, clan: false, rank: false, element: false, debut: false, birthday: false, height: false, tools: false };
    revealedHints = [];
    guessedNames = [];

    document.getElementById('end-game-modal').classList.add('hidden');
    document.getElementById('guesses-list').innerHTML = '';
    document.getElementById('guess-input').value = '';
    document.getElementById('question-mark').style.display = '';

    const originalIcons = { 'hint-village': '🏯', 'hint-clan': '👥', 'hint-rank': '⚔️', 'hint-element': '🔥', 'hint-debut': '📺', 'hint-birthday': '🎂', 'hint-height': '📏', 'hint-tools': '🗡️' };
    document.querySelectorAll('.hint-btn').forEach(btn => {
        btn.classList.remove('revealed');
        btn.disabled = false;
        if (originalIcons[btn.id]) btn.innerHTML = originalIcons[btn.id];
    });

    selectTarget();
    updateDisplay();

    document.getElementById('daily-countdown').style.display = gameMode === 'daily' ? '' : 'none';
    if (gameMode === 'daily') startCountdown();
}

function nextRound() {
    document.getElementById('end-game-modal').classList.add('hidden');
    if (gameMode === 'daily') return;
    resetGame();
}

function startCountdown() {
    const update = () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const diff = tomorrow - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        document.getElementById('countdown-timer').textContent = time;
        document.getElementById('modal-countdown').textContent = time;
    };
    update();
    setInterval(update, 1000);
}

document.addEventListener('DOMContentLoaded', fetchCharacters);
