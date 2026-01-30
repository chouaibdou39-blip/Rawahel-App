/* ============================================
   RAWAHEL PLATFORM - Complete App JavaScript
   All functions exported to window for onclick
   ============================================ */

// ========== SUPABASE CONFIG ==========
// IMPORTANT: Replace with your actual credentials
const SUPABASE_URL = 'https://utlbdcebtcjnjzljcaqg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bGJkY2VidGNqbmp6bGpjYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjE1NTcsImV4cCI6MjA4NDk5NzU1N30.uw5pMDEQz1jUNNwktcKnb2Kflrl9JycnvCCozcDYDY0'; // Replace this!

// Initialize Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== APP STATE ==========
let currentUser = null;
let userProfile = null;
let selectedGroup = 'bunyan';
let isAdmin = false;

// Group definitions
const GROUPS = {
    bunyan: { name: 'بنيان', color: '#22c55e' },
    rawasi: { name: 'رواسي', color: '#f97316' },
    rasukh: { name: 'رسوخ', color: '#ef4444' },
    all: { name: 'الكل', color: '#2563eb' }
};

// Awrad content
const AWRAD_CONTENT = {
    morning: {
        title: 'أذكار الصباح',
        content: `
            <div style="text-align: center; padding: 20px;">
                <p style="font-size: 18px; line-height: 2; margin-bottom: 20px;">
                    أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ
                </p>
                <p style="font-size: 18px; line-height: 2; margin-bottom: 20px;">
                    اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذَا الْيَوْمِ فَتْحَهُ وَنَصْرَهُ وَنُورَهُ وَبَرَكَتَهُ وَهُدَاهُ
                </p>
                <p style="color: #6b7280; font-size: 14px;">تُقرأ صباحاً بعد صلاة الفجر</p>
            </div>
        `
    },
    evening: {
        title: 'أذكار المساء',
        content: `
            <div style="text-align: center; padding: 20px;">
                <p style="font-size: 18px; line-height: 2; margin-bottom: 20px;">
                    أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ
                </p>
                <p style="font-size: 18px; line-height: 2; margin-bottom: 20px;">
                    اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذِهِ اللَّيْلَةِ وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهَا
                </p>
                <p style="color: #6b7280; font-size: 14px;">تُقرأ مساءً بعد صلاة العصر</p>
            </div>
        `
    },
    quran: {
        title: 'الورد اليومي',
        content: `
            <div style="text-align: center; padding: 20px;">
                <p style="font-size: 48px; margin-bottom: 20px;">📖</p>
                <h3 style="margin-bottom: 16px;">اجعل لك ورداً يومياً</h3>
                <p style="font-size: 16px; line-height: 2; margin-bottom: 20px;">
                    صفحتان بعد كل صلاة = ختمة كل شهر
                </p>
                <p style="font-size: 16px; line-height: 2;">
                    جزء واحد يومياً = ختمة كل شهر
                </p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                    ﴿ إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ ﴾
                </p>
            </div>
        `
    }
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    console.log('🚀 Initializing Rawahel Platform...');

    // Setup navigation first
    setupNavigation();

    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        await handleAuthentication(session.user);
    } else {
        await handleAuthCallback();
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event);
        if (event === 'SIGNED_IN' && session) {
            await handleAuthentication(session.user);
        } else if (event === 'SIGNED_OUT') {
            showAuthScreen();
        }
    });
}

// ========== NAVIGATION SETUP ==========
function setupNavigation() {
    // Bottom nav - SPA section switching
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            switchSection(sectionId);

            // Update active nav item
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Group tabs
    document.querySelectorAll('.group-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            selectedGroup = tab.dataset.group;

            // Update active tab
            document.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Reload content with new filter
            loadNews();
            loadEvents();
        });
    });

    // Modal close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });

    console.log('✅ Navigation setup complete');
}

// ========== SECTION SWITCHING (SPA) ==========
function switchSection(sectionId) {
    // Hide ALL sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Show ONLY the target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    console.log('📍 Switched to section:', sectionId);
}

// ========== AUTH HANDLING ==========
async function handleAuthCallback() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        // Magic link callback - wait for onAuthStateChange
        return;
    }
    hideLoading();
    showAuthScreen();
}

async function handleAuthentication(user) {
    showLoading();

    try {
        // Check whitelist
        const { data: profile, error } = await supabase
            .from('allowed_users')
            .select('*')
            .eq('email', user.email)
            .single();

        if (error || !profile) {
            console.log('❌ User not in whitelist:', user.email);
            await supabase.auth.signOut();
            hideLoading();
            showAuthError();
            return;
        }

        // User is allowed
        currentUser = user;
        userProfile = profile;
        isAdmin = profile.role === 'admin';

        console.log('✅ User authenticated:', profile.full_name, '| Admin:', isAdmin);

        // Clear URL hash
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname);
        }

        hideLoading();
        showApp();

    } catch (err) {
        console.error('Auth error:', err);
        hideLoading();
        showAuthScreen();
    }
}

// ========== UI STATE FUNCTIONS ==========
function showLoading() {
    document.getElementById('loadingScreen').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingScreen').classList.add('hidden');
}

function showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden');
}

function showAuthError() {
    document.getElementById('authForm').classList.add('hidden');
    document.getElementById('authSuccess').classList.add('hidden');
    document.getElementById('authError').classList.remove('hidden');
}

function showAuthSuccess() {
    document.getElementById('authForm').classList.add('hidden');
    document.getElementById('authError').classList.add('hidden');
    document.getElementById('authSuccess').classList.remove('hidden');
}

function resetAuth() {
    document.getElementById('authForm').classList.remove('hidden');
    document.getElementById('authSuccess').classList.add('hidden');
    document.getElementById('authError').classList.add('hidden');
    document.getElementById('emailInput').value = '';
}

async function showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');

    // Show admin elements
    if (isAdmin) {
        document.getElementById('adminBadge').classList.remove('hidden');
        document.getElementById('adminNavItem').classList.remove('hidden');
        document.getElementById('fabBtn').classList.remove('hidden');
    }

    // Set initial group to user's group
    selectedGroup = userProfile.group_level;

    // Update active tab
    document.querySelectorAll('.group-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.group === selectedGroup);
    });

    // Load content
    await loadNews();
    await loadEvents();
}

function showSnackbar(message) {
    const snackbar = document.getElementById('snackbar');
    snackbar.textContent = message;
    snackbar.classList.add('show');
    setTimeout(() => snackbar.classList.remove('show'), 3000);
}

// ========== AUTH FORM ==========
document.getElementById('authForm').addEventListener('submit', handleLogin);

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('emailInput').value.trim();
    const btn = document.getElementById('loginBtn');

    if (!email) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الإرسال...';

    try {
        // Check whitelist first
        const { data: allowed, error: checkError } = await supabase
            .from('allowed_users')
            .select('email')
            .eq('email', email)
            .single();

        if (checkError || !allowed) {
            showAuthError();
            return;
        }

        // Send magic link
        const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: window.location.origin + window.location.pathname
            }
        });

        if (error) throw error;

        showAuthSuccess();

    } catch (err) {
        console.error('Login error:', err);
        showSnackbar('حدث خطأ، حاول مرة أخرى');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال رابط الدخول';
    }
}

async function handleLogout() {
    if (!confirm('هل تريد تسجيل الخروج؟')) return;

    await supabase.auth.signOut();
    currentUser = null;
    userProfile = null;
    isAdmin = false;

    // Hide admin elements
    document.getElementById('adminBadge').classList.add('hidden');
    document.getElementById('adminNavItem').classList.add('hidden');
    document.getElementById('fabBtn').classList.add('hidden');

    showAuthScreen();
    resetAuth();
}

// ========== NEWS / POSTS ==========
async function loadNews() {
    const container = document.getElementById('newsList');
    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جارٍ التحميل...</p></div>';

    try {
        // Query posts filtered by group
        const { data: posts, error } = await supabase
            .from('posts')
            .select('*')
            .or(`group_level.eq.${selectedGroup},group_level.eq.all`)
            .order('pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!posts || posts.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><p>لا توجد أخبار</p></div>';
            return;
        }

        container.innerHTML = posts.map(post => createPostCard(post)).join('');

    } catch (err) {
        console.error('Load news error:', err);
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>خطأ في التحميل</p></div>';
    }
}

function createPostCard(post) {
    const date = formatDate(post.created_at);
    const groupInfo = GROUPS[post.group_level];
    const canDelete = isAdmin || post.author_email === currentUser?.email;

    return `
        <div class="card ${post.pinned ? 'pinned' : ''}" data-id="${post.id}">
            <div class="card-header">
                <div class="card-avatar"><i class="fas fa-user"></i></div>
                <div class="card-meta">
                    <div class="card-author">
                        ${escapeHtml(post.author_name)}
                        ${post.pinned ? '<span class="badge badge-pin">مثبت</span>' : ''}
                    </div>
                    <div class="card-date">${date}</div>
                </div>
                <span class="badge badge-group ${post.group_level}">${groupInfo.name}</span>
            </div>
            <div class="card-body">
                <h3 class="card-title">${escapeHtml(post.title)}</h3>
                <p class="card-content">${escapeHtml(post.content)}</p>
            </div>
            ${canDelete ? `
                <div class="card-actions">
                    <button class="btn-icon" onclick="deletePost('${post.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

async function submitPost() {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const group = document.getElementById('postGroup').value;
    const pinned = document.getElementById('postPinned').checked;

    if (!title || !content) {
        showSnackbar('يرجى ملء جميع الحقول');
        return;
    }

    try {
        const { error } = await supabase.from('posts').insert({
            title: title,
            content: content,
            group_level: group,
            pinned: pinned,
            author_name: userProfile.full_name,
            author_email: currentUser.email
        });

        if (error) throw error;

        closeModal('postModal');
        document.getElementById('postForm').reset();
        showSnackbar('تم نشر الإعلان بنجاح');
        loadNews();

    } catch (err) {
        console.error('Submit post error:', err);
        showSnackbar('حدث خطأ');
    }
}

async function deletePost(id) {
    if (!confirm('هل تريد حذف هذا الإعلان؟')) return;

    try {
        const { error } = await supabase.from('posts').delete().eq('id', id);
        if (error) throw error;

        showSnackbar('تم الحذف');
        loadNews();

    } catch (err) {
        console.error('Delete post error:', err);
        showSnackbar('حدث خطأ');
    }
}

// ========== CALENDAR EVENTS ==========
async function loadEvents() {
    const container = document.getElementById('eventsList');
    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جارٍ التحميل...</p></div>';

    try {
        const { data: events, error } = await supabase
            .from('calendar_events')
            .select('*')
            .or(`group_level.eq.${selectedGroup},group_level.eq.all`)
            .gte('event_date', new Date().toISOString().split('T')[0])
            .order('event_date', { ascending: true });

        if (error) throw error;

        if (!events || events.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>لا توجد فعاليات قادمة</p></div>';
            return;
        }

        container.innerHTML = events.map(event => createEventCard(event)).join('');

    } catch (err) {
        console.error('Load events error:', err);
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>خطأ في التحميل</p></div>';
    }
}

function createEventCard(event) {
    const date = new Date(event.event_date);
    const day = date.getDate();
    const month = date.toLocaleDateString('ar', { month: 'short' });
    const groupInfo = GROUPS[event.group_level];
    const canDelete = isAdmin || event.author_email === currentUser?.email;

    return `
        <div class="event-card" data-id="${event.id}">
            <div class="event-date-box">
                <div class="event-day">${day}</div>
                <div class="event-month">${month}</div>
            </div>
            <div class="event-details">
                <h4 class="event-title">${escapeHtml(event.title)}</h4>
                <div class="event-info">
                    ${event.event_time ? `<span><i class="fas fa-clock"></i> ${event.event_time}</span>` : ''}
                    ${event.location ? `<span><i class="fas fa-map-marker-alt"></i> ${event.location}</span>` : ''}
                    <span class="badge badge-group ${event.group_level}">${groupInfo.name}</span>
                </div>
            </div>
            ${canDelete ? `
                <button class="btn-icon" onclick="deleteEvent('${event.id}')" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            ` : ''}
        </div>
    `;
}

async function submitEvent() {
    const title = document.getElementById('eventTitle').value.trim();
    const eventDate = document.getElementById('eventDate').value;
    const eventTime = document.getElementById('eventTime').value;
    const location = document.getElementById('eventLocation').value.trim();
    const group = document.getElementById('eventGroup').value;

    if (!title || !eventDate) {
        showSnackbar('يرجى ملء الحقول المطلوبة');
        return;
    }

    try {
        const { error } = await supabase.from('calendar_events').insert({
            title: title,
            event_date: eventDate,
            event_time: eventTime || null,
            location: location || null,
            group_level: group,
            author_email: currentUser.email
        });

        if (error) throw error;

        closeModal('eventModal');
        document.getElementById('eventForm').reset();
        showSnackbar('تم إضافة الفعالية');
        loadEvents();

    } catch (err) {
        console.error('Submit event error:', err);
        showSnackbar('حدث خطأ');
    }
}

async function deleteEvent(id) {
    if (!confirm('هل تريد حذف هذه الفعالية؟')) return;

    try {
        const { error } = await supabase.from('calendar_events').delete().eq('id', id);
        if (error) throw error;

        showSnackbar('تم الحذف');
        loadEvents();

    } catch (err) {
        console.error('Delete event error:', err);
        showSnackbar('حدث خطأ');
    }
}

// ========== MODALS ==========
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function openAwradModal(type) {
    const content = AWRAD_CONTENT[type];
    if (!content) return;

    document.getElementById('awradModalTitle').textContent = content.title;
    document.getElementById('awradModalContent').innerHTML = content.content;
    openModal('awradModal');
}

// ========== UTILITIES ==========
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days < 7) return `منذ ${days} يوم`;

    return date.toLocaleDateString('ar');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== EXPORT ALL FUNCTIONS TO WINDOW ==========
// CRITICAL: This makes onclick handlers work!
window.handleLogout = handleLogout;
window.resetAuth = resetAuth;
window.openModal = openModal;
window.closeModal = closeModal;
window.openAwradModal = openAwradModal;
window.submitPost = submitPost;
window.deletePost = deletePost;
window.submitEvent = submitEvent;
window.deleteEvent = deleteEvent;
window.switchSection = switchSection;
window.showSnackbar = showSnackbar;

console.log('✅ All functions exported to window');
