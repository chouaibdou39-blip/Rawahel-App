/* ============================================
   RAWAHEL PLATFORM - COMPLETE APP (Nav + Data)
   ============================================ */

// إعدادات الاتصال (مفاتيحك الحقيقية مدمجة هنا)
const SUPABASE_URL = 'https://utlbdcebtcjnjzljcaqg.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bGJkY2VidGNqbmp6bGpjYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjE1NTcsImV4cCI6MjA4NDk5NzU1N30.uw5pMDEQz1jUNNwktcKnb2Kflrl9JycnvCCozcDYDY0';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== متغيرات النظام ==========
let currentUser = null;
let userProfile = null;
let selectedGroup = 'bunyan';
let isAdmin = false;

const GROUPS = {
    bunyan: { name: 'بنيان' },
    rawasi: { name: 'رواسي' },
    rasukh: { name: 'رسوخ' },
    all: { name: 'الكل' }
};

// ========== التشغيل التلقائي ==========
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation(); // تشغيل التنقل فوراً
    initApp();         // الاتصال بالقاعدة
});

// ========== 1. نظام التنقل (لإصلاح التكدس) ==========
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            sections.forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
            
            const targetId = item.dataset.section;
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
                targetSection.style.display = 'block';
                targetSection.classList.remove('fade-in');
                void targetSection.offsetWidth; // trigger reflow
                targetSection.classList.add('fade-in');
            }

            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // تفعيل الرئيسية افتراضياً
    const newsSection = document.getElementById('newsSection');
    if(newsSection) {
        newsSection.style.display = 'block';
        newsSection.classList.add('active');
    }
}

// ========== 2. تهيئة التطبيق والمصادقة ==========
async function initApp() {
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (session) await handleAuthentication(session.user);
        else showAuthScreen();

        sb.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) await handleAuthentication(session.user);
            else if (event === 'SIGNED_OUT') showAuthScreen();
        });

        setupListeners();
    } catch (err) { console.error("Init Error:", err); }
}

async function handleAuthentication(user) {
    showLoading();
    try {
        const { data: profile, error } = await sb
            .from('allowed_users')
            .select('*')
            .eq('email', user.email)
            .single();

        if (error || !profile) {
            await sb.auth.signOut();
            hideLoading();
            showAuthError();
            return;
        }

        currentUser = user;
        userProfile = profile;
        isAdmin = profile.role === 'admin';

        hideLoading();
        showApp();

    } catch (err) {
        console.error('Auth error:', err);
        hideLoading();
        showAuthScreen();
    }
}

// ========== 3. دوال العرض والتحميل ==========
async function showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appShell').style.display = 'block';

    if (isAdmin) {
        if(document.getElementById('adminBadge')) document.getElementById('adminBadge').classList.remove('hidden');
        if(document.getElementById('adminNavItem')) document.getElementById('adminNavItem').classList.remove('hidden');
    }

    selectedGroup = userProfile.group_level;
    updateGroupTabs();
    await loadNews();
    await loadEvents();
}

// --- الأخبار (News) ---
async function loadNews() {
    const container = document.getElementById('newsList');
    if(!container) return;
    container.innerHTML = '<div style="text-align:center; padding:20px;">جارٍ التحميل...</div>';

    try {
        let query = sb.from('posts').select('*').order('created_at', { ascending: false });
        
        // الفلترة حسب المجموعة
        if (!isAdmin) {
            query = query.or(`group_level.eq.${userProfile.group_level},group_level.eq.all`);
        } else {
            // المدير يرى ما يحدده في التبويب
            query = query.or(`group_level.eq.${selectedGroup},group_level.eq.all`);
        }

        const { data: posts, error } = await query;
        if (error) throw error;

        if (!posts || posts.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">لا توجد أخبار</div>';
            return;
        }

        container.innerHTML = posts.map(post => `
            <div class="card ${post.pinned ? 'pinned' : ''}">
                <div class="card-header">
                    <span>${post.author_name || 'الإدارة'}</span>
                    <span>${new Date(post.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
                <h3>${escapeHtml(post.title)}</h3>
                <div class="card-content">${escapeHtml(post.content)}</div>
                ${isAdmin ? `<button onclick="deletePost('${post.id}')" style="color:red; background:none; border:none; margin-top:10px; cursor:pointer;">حذف</button>` : ''}
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

// --- حفظ خبر جديد ---
async function submitPost() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const group = document.getElementById('postGroup').value;
    const pinned = document.getElementById('postPinned').checked;

    if(!title || !content) return alert('يرجى ملء البيانات');

    try {
        const { error } = await sb.from('posts').insert({
            title, content, group_level: group, pinned,
            author_name: userProfile.full_name,
            author_email: currentUser.email
        });
        
        if(error) throw error;
        
        closeModal('postModal');
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
        showSnackbar('تم النشر بنجاح');
        loadNews(); // تحديث القائمة
    } catch(err) { alert('خطأ في النشر: ' + err.message); }
}

// --- حذف خبر ---
async function deletePost(id) {
    if(!confirm('حذف هذا الخبر؟')) return;
    const { error } = await sb.from('posts').delete().eq('id', id);
    if(!error) loadNews();
}

// --- الرزنامة (Events) ---
async function loadEvents() {
    const container = document.getElementById('eventsList');
    if(!container) return;
    
    try {
        let query = sb.from('calendar_events').select('*').order('event_date', { ascending: true });
         if (!isAdmin) {
            query = query.or(`group_level.eq.${userProfile.group_level},group_level.eq.all`);
        } else {
            query = query.or(`group_level.eq.${selectedGroup},group_level.eq.all`);
        }

        const { data: events, error } = await query;
        if(error) throw error;

        if (!events || events.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">لا توجد فعاليات قادمة</div>';
            return;
        }

        container.innerHTML = events.map(ev => `
            <div class="card" style="border-right: 4px solid var(--primary);">
                <h3>${escapeHtml(ev.title)}</h3>
                <div style="font-size:0.9rem; color:#666;">
                    📅 ${ev.event_date} | ⏰ ${ev.event_time || '--:--'} <br>
                    📍 ${ev.location || 'غير محدد'}
                </div>
                ${isAdmin ? `<button onclick="deleteEvent('${ev.id}')" style="color:red; background:none; border:none; margin-top:5px; cursor:pointer;">حذف</button>` : ''}
            </div>
        `).join('');

    } catch(err) { console.error(err); }
}

// --- حفظ حدث جديد ---
async function submitEvent() {
    const title = document.getElementById('eventTitle').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    const loc = document.getElementById('eventLocation').value;
    const group = document.getElementById('eventGroup').value;

    if(!title || !date) return alert('العنوان والتاريخ مطلوبان');

    try {
        const { error } = await sb.from('calendar_events').insert({
            title, event_date: date, event_time: time, location: loc, group_level: group,
            author_email: currentUser.email
        });

        if(error) throw error;

        closeModal('eventModal');
        document.getElementById('eventTitle').value = '';
        showSnackbar('تمت إضافة الحدث');
        loadEvents();
    } catch(err) { alert('خطأ: ' + err.message); }
}

// --- حذف حدث ---
async function deleteEvent(id) {
    if(!confirm('حذف هذا الحدث؟')) return;
    const { error } = await sb.from('calendar_events').delete().eq('id', id);
    if(!error) loadEvents();
}

// ========== 4. إدارة الأعضاء (سريعة) ==========
async function submitUser() {
    const email = document.getElementById('newUserEmail').value.toLowerCase();
    const name = document.getElementById('newUserName').value;
    const group = document.getElementById('newUserGroup').value;
    const role = document.getElementById('newUserRole').value;

    if(!email) return;

    const { error } = await sb.from('allowed_users').insert({
        email, full_name: name, group_level: group, role
    });

    if(error) alert('خطأ: ' + error.message);
    else {
        closeModal('userModal');
        showSnackbar('تمت إضافة العضو');
    }
}

// ========== 5. دوال مساعدة ==========
function setupListeners() {
    // التبويبات
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            selectedGroup = tab.dataset.group;
            updateGroupTabs();
            loadNews();
            loadEvents();
        });
    });
    // الدخول
    const authForm = document.getElementById('authForm');
    if(authForm) authForm.addEventListener('submit', handleLogin);
}

function updateGroupTabs() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.group === selectedGroup);
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('emailInput').value.trim().toLowerCase();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.innerHTML = '...';

    const { data } = await sb.from('allowed_users').select('email').eq('email', email).single();
    if(!data) { 
        document.getElementById('authError').classList.remove('hidden');
        btn.disabled = false; btn.innerHTML = 'دخول';
        return; 
    }

    await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin }});
    document.getElementById('authSuccess').classList.remove('hidden');
    document.getElementById('authForm').classList.add('hidden');
}

function showLoading() { if(document.getElementById('loadingScreen')) document.getElementById('loadingScreen').classList.remove('hidden'); }
function hideLoading() { if(document.getElementById('loadingScreen')) document.getElementById('loadingScreen').classList.add('hidden'); }
function showAuthScreen() { document.getElementById('authScreen').classList.remove('hidden'); document.getElementById('appShell').style.display = 'none'; }
function showAuthError() { document.getElementById('authError').classList.remove('hidden'); }

// المودال
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function showSnackbar(msg) {
    const snack = document.getElementById('snackbar');
    snack.textContent = msg;
    snack.classList.add('show');
    setTimeout(() => snack.classList.remove('show'), 3000);
}
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function resetAuth() { location.reload(); }
async function handleLogout() { await sb.auth.signOut(); location.reload(); }

// ========== تصدير الدوال للـ HTML (مهم جداً للـ onclick) ==========
window.openModal = openModal;
window.closeModal = closeModal;
window.resetAuth = resetAuth;
window.handleLogout = handleLogout;
window.submitPost = submitPost;     // <--- تم الإصلاح
window.deletePost = deletePost;     // <--- تم الإصلاح
window.submitEvent = submitEvent;   // <--- تم الإصلاح
window.deleteEvent = deleteEvent;   // <--- تم الإصلاح
window.submitUser = submitUser;
window.loadUsersManagement = function() { alert('قائمة الأعضاء (يمكنك إضافتها لاحقاً)'); };
