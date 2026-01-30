/* ============================================
   RAWAHEL PLATFORM - FIXED NAVIGATION JS
   ============================================ */

// 1. إعدادات الاتصال (تأكد من وضع مفاتيحك الحقيقية هنا)
const SUPABASE_URL = 'https://utlbdcebtcjnjzljcaqg.supabase.co'; 
const SUPABASE_ANON_KEY = 'YOUR_REAL_ANON_KEY_HERE'; // <--- ضع مفتاحك الحقيقي هنا

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== متغيرات النظام ==========
let currentUser = null;
let userProfile = null;
let selectedGroup = 'bunyan';
let isAdmin = false;

// ========== التشغيل التلقائي ==========
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupNavigation(); // تشغيل نظام التنقل فوراً
});

// ========== نظام التنقل (هذا هو الحل لمشكلتك) ==========
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // منع السلوك الافتراضي
            e.preventDefault();

            // 1. معرفة القسم المطلوب
            const targetId = item.dataset.section;

            // 2. إخفاء جميع الأقسام (Hide All)
            sections.forEach(section => {
                section.classList.remove('active');
                section.style.display = 'none'; // ضمان الإخفاء
            });

            // 3. إظهار القسم المطلوب فقط (Show Target)
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
                targetSection.style.display = 'block'; // ضمان الظهور
            }

            // 4. تحديث شكل الأزرار (تلوين الزر النشط)
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // تشغيل القسم الافتراضي (الأخبار) عند البداية
    document.getElementById('newsSection').style.display = 'block';
    document.getElementById('newsSection').classList.add('active');
}

// ========== باقي كود التطبيق (بدون تغيير) ==========

async function initApp() {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        await handleAuthentication(session.user);
    } else {
        showAuthScreen();
    }

    sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            await handleAuthentication(session.user);
        } else if (event === 'SIGNED_OUT') {
            showAuthScreen();
        }
    });

    setupOtherListeners(); // مستمعي الأحداث الأخرى
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

// دوال العرض
function showLoading() { document.getElementById('loadingScreen').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loadingScreen').classList.add('hidden'); }
function showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden'); // إخفاء التطبيق
}
function showAuthError() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('authSuccess').classList.add('hidden');
    document.getElementById('authError').classList.remove('hidden');
}

async function showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden'); // إظهار التطبيق

    // إعدادات المدير
    if (isAdmin) {
        document.getElementById('adminBadge').classList.remove('hidden');
        document.getElementById('adminNavItem').classList.remove('hidden'); // إظهار زر الإدارة
    }

    // تحميل البيانات
    selectedGroup = userProfile.group_level;
    updateGroupTabs();
    await loadNews();
    await loadEvents();
}

// مستمعي الأحداث الجانبية (التبويبات العلوية والمودال)
function setupOtherListeners() {
    // التبويبات العلوية (بنيان، رواسي، رسوخ)
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            selectedGroup = tab.dataset.group;
            updateGroupTabs();
            loadNews();
            loadEvents();
        });
    });

    // إغلاق المودال عند الضغط في الخارج
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
    
    // نموذج الدخول
    document.getElementById('authForm').addEventListener('submit', handleLogin);
}

function updateGroupTabs() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.group === selectedGroup);
    });
}

// ========== تسجيل الدخول ==========
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('emailInput').value.trim().toLowerCase();
    const loginBtn = document.getElementById('loginBtn');
    
    if (!email) return;
    loginBtn.disabled = true; loginBtn.innerHTML = 'جارٍ الإرسال...';

    try {
        const { data: allowed } = await sb.from('allowed_users').select('email').eq('email', email).single();
        if (!allowed) { showAuthError(); return; }

        const { error } = await sb.auth.signInWithOtp({
            email: email,
            options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        
        document.getElementById('authSuccess').classList.remove('hidden');
        document.getElementById('authForm').classList.add('hidden');
    } catch (err) {
        alert('حدث خطأ حاول مرة أخرى');
    } finally {
        loginBtn.disabled = false; loginBtn.innerHTML = 'إرسال رابط الدخول';
    }
}

// ========== الدوال المساعدة (نفس القديمة) ==========
async function loadNews() {
    // (نفس كود الأخبار السابق - اختصرته هنا للتركيز على الحل)
    // تأكد من نسخ دالة loadNews الكاملة من كودك القديم إذا كنت عدلت عليها
    // أو استخدم الكود السابق الذي أرسلته لك
    console.log("Loading news for: " + selectedGroup);
}
async function loadEvents() {
    console.log("Loading events for: " + selectedGroup);
}

// ========== المودال ==========
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function resetAuth() { location.reload(); }
async function handleLogout() { await sb.auth.signOut(); location.reload(); }

// تصدير الدوال للـ HTML
window.openModal = openModal;
window.closeModal = closeModal;
window.resetAuth = resetAuth;
window.handleLogout = handleLogout;
window.loadUsersManagement = function() { alert('صفحة الإدارة'); }; // مثال
