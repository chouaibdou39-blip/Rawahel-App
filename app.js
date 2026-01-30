/* ============================================
   RAWAHEL PLATFORM - SAFE VERSION
   ============================================ */

// 1. إعدادات الاتصال (⚠️ ضع مفاتيحك الحقيقية هنا)
const SUPABASE_URL = 'https://utlbdcebtcjnjzljcaqg.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bGJkY2VidGNqbmp6bGpjYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjE1NTcsImV4cCI6MjA4NDk5NzU1N30.uw5pMDEQz1jUNNwktcKnb2Kflrl9JycnvCCozcDYDY0'; // <--- المفتاح هنا

// لقد غيرنا الاسم إلى 'sb' لمنع تضارب الأسماء
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== متغيرات النظام ==========
let currentUser = null;
let userProfile = null;
let selectedGroup = 'bunyan';
let isAdmin = false;

// ========== التشغيل التلقائي ==========
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    initApp();
});

// ========== 1. نظام التنقل (Navigation) ==========
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // إخفاء الكل
            sections.forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
            
            // إظهار المطلوب
            const targetId = item.dataset.section;
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
                targetSection.style.display = 'block';
                targetSection.classList.remove('fade-in');
                void targetSection.offsetWidth; 
                targetSection.classList.add('fade-in');
            }

            // تلوين الزر
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });

    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedGroup = btn.dataset.group;
            updateGroupTabs();
            loadNews();
            loadEvents();
        });
    });

    // تشغيل الرئيسية
    const newsSection = document.getElementById('newsSection');
    if(newsSection) {
        newsSection.style.display = 'block';
        newsSection.classList.add('active');
    }
}

function updateGroupTabs() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.group === selectedGroup);
    });
}

// ========== 2. الاتصال (Auth) ==========
async function initApp() {
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (session) await handleAuthentication(session.user);
        else showAuthScreen();

        sb.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) await handleAuthentication(session.user);
            else if (event === 'SIGNED_OUT') showAuthScreen();
        });

        const authForm = document.getElementById('authForm');
        if(authForm) authForm.addEventListener('submit', handleLogin);

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('active');
            });
        });

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

        if (!isAdmin) selectedGroup = userProfile.group_level;
        updateGroupTabs();

        hideLoading();
        showApp();

    } catch (err) {
        console.error('Auth error:', err);
        hideLoading();
        showAuthScreen();
    }
}

// ========== 3. العرض (Display) ==========
async function showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appShell').style.display = 'block';

    if (isAdmin) {
        const badge = document.getElementById('adminBadge');
        const nav = document.getElementById('adminNavItem');
        if(badge) badge.classList.remove('hidden');
        if(nav) nav.classList.remove('hidden');
    }

    await loadNews();
    await loadEvents();
}

// ========== 4. الأخبار (News) ==========
async function loadNews() {
    const container = document.getElementById('newsList');
    if(!container) return;
    container.innerHTML = '<div style="text-align:center; padding:20px;">جارٍ التحميل...</div>';

    try {
        let query = sb.from('posts').select('*').order('created_at', { ascending: false });
        
        if (!isAdmin) {
            query = query.or(`group_level.eq.${userProfile.group_level},group_level.eq.all`);
        } else {
            query = query.or(`group_level.eq.${selectedGroup},group_level.eq.all`);
        }

        const { data: posts, error } = await query;
        if (error) throw error;

        if (!posts || posts.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">لا توجد أخبار</div>';
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
                ${isAdmin ? `<button onclick="deletePost('${post.id}')" style="color:red; background:none; border:none; margin-top:10px; cursor:pointer;">🗑️ حذف</button>` : ''}
            </div>
        `).join('');

    } catch (err) { container.innerHTML = 'خطأ في التحميل'; }
}

async function submitPost() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const group = document.getElementById('postGroup').value;
    const pinned = document.getElementById('postPinned').checked;

    if(!title || !content) return alert('البيانات ناقصة');

    const { error } = await sb.from('posts').insert({
        title, content, group_level: group, pinned,
        author_name: userProfile.full_name,
        author_email: currentUser.email
    });
    
    if(error) alert('خطأ: ' + error.message);
    else {
        closeModal('postModal');
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
        loadNews();
        alert('تم النشر');
    }
}

async function deletePost(id) {
    if(!confirm('حذف؟')) return;
    const { error } = await sb.from('posts').delete().eq('id', id);
    if(!error) loadNews();
}

// ========== 5. الرزنامة (Events) ==========
async function loadEvents() {
    const container = document.getElementById('eventsList');
    if(!container) return;
    container.innerHTML = '<div style="text-align:center; padding:20px;">جارٍ التحميل...</div>';
    
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
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">لا توجد فعاليات</div>';
            return;
        }

        container.innerHTML = events.map(ev => `
            <div class="card" style="border-right: 4px solid var(--primary);">
                <h3>${escapeHtml(ev.title)}</h3>
                <div style="font-size:0.9rem; color:#666;">
                    📅 ${ev.event_date} | ⏰ ${ev.event_time || '--:--'} <br>
                    📍 ${ev.location || 'غير محدد'}
                </div>
                ${isAdmin ? `<button onclick="deleteEvent('${ev.id}')" style="color:red; background:none; border:none; margin-top:10px; cursor:pointer;">🗑️ حذف</button>` : ''}
            </div>
        `).join('');

    } catch(err) { console.error(err); }
}

async function submitEvent() {
    const title = document.getElementById('eventTitle').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    const loc = document.getElementById('eventLocation').value;
    const group = document.getElementById('eventGroup').value;

    if(!title || !date) return alert('العنوان والتاريخ مطلوبان');

    const { error } = await sb.from('calendar_events').insert({
        title, event_date: date, event_time: time, location: loc, group_level: group,
        author_email: currentUser.email
    });

    if(error) alert('خطأ: ' + error.message);
    else {
        closeModal('eventModal');
        document.getElementById('eventTitle').value = '';
        loadEvents();
        alert('تمت الإضافة');
    }
}

async function deleteEvent(id) {
    if(!confirm('حذف؟')) return;
    const { error } = await sb.from('calendar_events').delete().eq('id', id);
    if(!error) loadEvents();
}

// ========== 6. الأعضاء (Users) ==========
async function submitUser() {
    const email = document.getElementById('newUserEmail').value.trim().toLowerCase();
    const name = document.getElementById('newUserName').value;
    const group = document.getElementById('newUserGroup').value;
    const role = document.getElementById('newUserRole').value;

    if(!email) return alert('البريد مطلوب');

    const { error } = await sb.from('allowed_users').insert({
        email, full_name: name, group_level: group, role
    });

    if(error) alert('خطأ: ' + error.message);
    else {
        closeModal('userModal');
        document.getElementById('newUserEmail').value = '';
        loadUsersManagement();
        alert('تمت إضافة العضو');
    }
}

async function loadUsersManagement() {
    // كود بسيط لعرض الأعضاء (يمكن تطويره لاحقاً)
    alert('سيتم فتح قائمة الأعضاء قريباً');
}

// ========== 7. Login / Logout ==========
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('emailInput').value.trim().toLowerCase();
    const btn = document.getElementById('loginBtn');
    
    if(!email) return;
    btn.disabled = true; btn.innerHTML = '...';

    const { data } = await sb.from('allowed_users').select('email').eq('email', email).single();
    if(!data) { 
        showAuthError();
        btn.disabled = false; btn.innerHTML = 'إرسال الرابط';
        return; 
    }

    const { error } = await sb.auth.signInWithOtp({ 
        email, 
        options: { emailRedirectTo: window.location.origin }
    });

    if (error) alert('خطأ');
    else {
        document.getElementById('authSuccess').classList.remove('hidden');
        document.getElementById('authForm').classList.add('hidden');
    }
    btn.disabled = false;
}

async function handleLogout() {
    await sb.auth.signOut();
    location.reload();
}

// ========== 8. Helpers & Exports ==========
function showLoading() { if(document.getElementById('loadingScreen')) document.getElementById('loadingScreen').classList.remove('hidden'); }
function hideLoading() { if(document.getElementById('loadingScreen')) document.getElementById('loadingScreen').classList.add('hidden'); }
function showAuthScreen() { document.getElementById('authScreen').classList.remove('hidden'); document.getElementById('appShell').style.display = 'none'; }
function showAuthError() { document.getElementById('authError').classList.remove('hidden'); }
function resetAuth() { location.reload(); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function escapeHtml(text) { if (!text) return ''; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// تصدير الدوال (الآن نستخدم sb بدلاً من supabase)
window.openModal = openModal;
window.closeModal = closeModal;
window.resetAuth = resetAuth;
window.handleLogout = handleLogout;
window.submitPost = submitPost;
window.deletePost = deletePost;
window.submitEvent = submitEvent;
window.deleteEvent = deleteEvent;
window.submitUser = submitUser;
window.loadUsersManagement = loadUsersManagement;
