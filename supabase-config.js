const SUPABASE_URL = 'https://tpkoepqzchpmdphavlsd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_s15Dd7Ya32dgI9nKb3FnrA_JMdZpwcJ';

// Usamos un nombre diferente para evitar conflictos con el objeto global de la CDN
let sb = null;
try {
    if (SUPABASE_ANON_KEY !== 'INTRODUCE_AQUI_TU_ANON_KEY') {
        sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.warn('Supabase no pudo inicializarse:', e);
}

async function syncPlayer(stats, username) {
    if (!username || !sb) return;

    try {
        const { data, error } = await sb
            .from('players')
            .upsert({
                username: username,
                played: stats.played,
                won: stats.won,
                streak: stats.streak,
                best_streak: stats.bestStreak,
                lp: stats.lp || 0
            }, { onConflict: 'username' });

        if (error) throw error;
    } catch (err) {
        console.warn('No se pudo sincronizar en la nube:', err.message);
    }
}

async function getLeaderboard() {
    if (!sb) return [];

    try {
        const { data, error } = await sb
            .from('players')
            .select('*')
            .order('lp', { ascending: false })
            .limit(10);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error cargando ranking:', err.message);
        return [];
    }
}
