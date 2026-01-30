/* ============================================
   RAWAHEL PLATFORM - FINAL COMPLETE JS
   (Navigation + Data + Admin + Groups)
   ============================================ */

// 1. إعدادات الاتصال (⚠️ استبدل المفاتيح ببياناتك الحقيقية)
const SUPABASE_URL = 'https://utlbdcebtcjnjzljcaqg.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bGJkY2VidGNqbmp6bGpjYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjE1NTcsImV4cCI6MjA4NDk5NzU1N30.uw5pMDEQz1jUNNwktcKnb2Kflrl9JycnvCCozcDYDY0'; // <--- ضع المفتاح هنا

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== متغيرات النظام ==========
let currentUser = null;
let userProfile = null;
let selectedGroup = 'bunyan';
let isAdmin = false;

// ========== التشغيل التلقائي ==========
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation(); // تشغيل واجهة التنقل
    initApp();         // الاتصال بقاعدة البيانات
});

// ========== 1. نظام التنقل (UI Logic) ==========
function setupNavigation() {
    // التنقل السفلي (بين الصفحات)
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // إخفاء كل الأقسام
            sections.forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
            
            // إظهار القسم المطلوب
            const targetId = item.dataset.section;
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
                targetSection.style.display = 'block';
                // إعادة تشغيل الحركة
                targetSection.classList.remove('fade-in');
                void targetSection.offsetWidth; 
                targetSection.classList.add('fade-in');
            }

            // تلوين الزر
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // التنقل العلوي (بين الأفواج)
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedGroup = btn.dataset.group;
            updateGroupTabs(); // تحديث الألوان
            loadNews();        // جلب أخبار الفوج
            loadEvents();      // جلب أحداث الفوج
        });
    });

    // تفعيل الرئيسية افتراضياً
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

// ========== 2. الاتصال والمصادقة (Auth Logic) ==========
async function initApp() {
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (session) await handleAuthentication(session.user);
        else showAuthScreen();

        sb.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) await handleAuthentication(session.user);
            else if (event === 'SIGNED_OUT') showAuthScreen();
        });

        // تشغيل زر الدخول
        const authForm = document.getElementById('authForm');
        if(authForm) authForm.addEventListener('submit', handleLogin);

        // إغلاق المودال عند الضغط خارجه
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
        // التحقق من القائمة البيضاء
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

        // نجاح الدخول
        currentUser = user;
        userProfile = profile;
        isAdmin = profile.role === 'admin';

        // تحديد الفوج الخاص بالعضو
        if (!isAdmin) {
            selectedGroup = userProfile.group_level;
        }
        updateGroupTabs();

        hideLoading();
        showApp();

    } catch (err) {
        console.error('Auth error:', err);
        hideLoading();
        showAuthScreen();
    }
}

// ========== 3. عرض التطبيق (Display Logic) ==========
async function showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appShell').style.display = 'block';

    // إظهار أدوات المشرف
    if (isAdmin) {
        const adminBadge = document.getElementById('adminBadge');
        const adminNav = document.getElementById('adminNavItem');
        if(adminBadge) adminBadge.classList.remove('hidden');
        if(adminNav) adminNav.classList.remove('hidden');
    }

    // تحميل البيانات الأولية
    await loadNews();
    await loadEvents();
}

// ========== 4. إدارة الأخبار (News) ==========
async function loadNews() {
    const container = document.getElementById('newsList');
    if(!container) return;
    container.innerHTML = '<div style="text-align:center; padding:20px;">جارٍ التحميل...</div>';

    try {
        let query = sb.from('posts').select('*').order('created_at', { ascending: false });
        
        // الفلترة: المشرف يرى الفوج المختار، العضو يرى فوجه فقط
        if (!isAdmin) {
            query = query.or(`group_level.eq.${userProfile.group_level},group_level.eq.all`);
        } else {
            query = query.or(`group_level.eq.${selectedGroup},group_level.eq.all`);
        }

        const { data: posts, error } = await query;
        if (error) throw error;

        if (!posts || posts.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">لا توجد أخبار لهذا الفوج</div>';
            return;
        }

        // رسم البطاقات
        container.innerHTML = posts.map(post => `
            <div class="card ${post.pinned ? 'pinned' : ''}">
                <div class="card-header">
                    <span>${post.author_name || 'الإدارة'}</span>
                    <span>${new Date(post.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
                <h3>${escapeHtml(post.title)}</h3>
                <div class="card-content">${escapeHtml(post.content)}</div>
                ${isAdmin ? `<button onclick="deletePost('${post.id}')" style="color:red; background:none; border:none; margin-top:10px; cursor:pointer; font-size:0.8rem;">🗑️ حذف الخبر</button>` : ''}
            </div>
        `).join('');

    } catch (err) { 
        console.error(err);
        container.innerHTML = 'خطأ في التحميل';
    }
}

async function submitPost() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const group = document.getElementById('postGroup').value;
    const pinned = document.getElementById('postPinned').checked;

    if(!title || !content) return alert('يرجى ملء العنوان والتفاصيل');

    try {
        const { error } = await sb.from('posts').insert({
            title, content, group_level: group, pinned,
            author_name: userProfile.full_name,
            author_email: currentUser.email
        });
        
        if(error) throw error;
        
        closeModal('postModal');
        // تفريغ الحقول
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
        
        showSnackbar('تم النشر بنجاح ✅');
        loadNews(); 
    } catch(err) { alert('خطأ: ' + err.message); }
}

async function deletePost(id) {
    if(!confirm('هل أنت متأكد من حذف هذا الخبر؟')) return;
    const { error } = await sb.from('posts').delete().eq('id', id);
    if(!error) {
        showSnackbar('تم الحذف');
        loadNews();
    }
}

// ========== 5. إدارة الرزنامة (Events) ==========
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
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">لا توجد فعاليات قادمة</div>';
            return;
        }

        container.innerHTML = events.map(ev => `
            <div class="card" style="border-right: 4px solid var(--primary);">
                <h3>${escapeHtml(ev.title)}</h3>
                <div style="font-size:0.9rem; color:#666; margin-top:5px;">
                    📅 ${ev.event_date} <br> 
                    ⏰ ${ev.event_time || '--:--'} <br>
                    📍 ${ev.location || 'المقر'}
                </div>
                ${isAdmin ? `<button onclick="deleteEvent('${ev.id}')" style="color:red; background:none; border:none; margin-top:10px; cursor:pointer; font-size:0.8rem;">🗑️ حذف الحدث</button>` : ''}
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

    try {
        const { error } = await sb.from('calendar_events').insert({
            title, event_date: date, event_time: time, location: loc, group_level: group,
            author_email: currentUser.email
        });

        if(error) throw error;

        closeModal('eventModal');
        document.getElementById('eventTitle').value = '';
        showSnackbar('تمت إضافة الحدث ✅');
        loadEvents();
    } catch(err) { alert('خطأ: ' + err.message); }
}

async function deleteEvent(id) {
    if(!confirm('حذف هذا الحدث؟')) return;
    const { error } = await sb.from('calendar_events').delete().eq('id', id);
    if(!error) {
        showSnackbar('تم الحذف');
        loadEvents();
    }
}

// ========== 6. إدارة الأعضاء (Admin) ==========
async function submitUser() {
    const email = document.getElementById('newUserEmail').value.trim().toLowerCase();
    const name = document.getElementById('newUserName').value;
    const group = document.getElementById('newUserGroup').value;
    const role = document.getElementById('newUserRole').value;

    if(!email) return alert('البريد مطلوب');
