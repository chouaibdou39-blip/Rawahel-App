/* ============================================
   RAWAHEL PLATFORM - FIXED NAVIGATION JS
   ============================================ */

// ⚠️ هام جداً: ضع روابطك الحقيقية هنا لكي يعمل الموقع
const SUPABASE_URL = 'https://utlbdcebtcjnjzljcaqg.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bGJkY2VidGNqbmp6bGpjYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjE1NTcsImV4cCI6MjA4NDk5NzU1N30.uw5pMDEQz1jUNNwktcKnb2Kflrl9JycnvCCozcDYDY0'; // <--- انسخ المفتاح من Supabase وألصقه هنا

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== متغيرات النظام ==========
let currentUser = null;
let userProfile = null;
let selectedGroup = 'bunyan';
let isAdmin = false;

// ========== التشغيل التلقائي ==========
document.addEventListener('DOMContentLoaded', () => {
    // 1. تشغيل نظام التنقل فوراً (حتى لو فشل الاتصال)
    setupNavigation();
    
    // 2. محاولة الاتصال بقاعدة البيانات
    initApp();
});

// ========== 📱 نظام التنقل (الحل لمشكلة التكدس) ==========
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // 1. إخفاء جميع الأقسام
            sections.forEach(section => {
                section.classList.remove('active');
                section.style.display = 'none'; // ضمان الإخفاء
            });

            // 2. إظهار القسم المطلوب
            const targetId = item.dataset.section;
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
                targetSection.style.display = 'block'; // ضمان الظهور
                // إعادة تشغيل الحركة
                targetSection.classList.remove('fade-in');
                void targetSection.offsetWidth; // trigger reflow
                targetSection.classList.add('fade-in');
            }

            // 3. تلوين الزر النشط
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // تفعيل القسم الرئيسي افتراضياً
    document.getElementById('newsSection').style.display = 'block';
    document.getElementById('newsSection').classList.add('active');
}

// ========== باقي كود التطبيق ==========

async function initApp() {
    try {
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

        setupOtherListeners(); // تشغيل باقي الأزرار
    } catch (err) {
        console.error("Critical Init Error:", err);
    }
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
function showLoading() { if(document.getElementById('loadingScreen')) document.getElementById('loadingScreen').classList.remove('hidden'); }
function hideLoading() { if(document.getElementById('loadingScreen')) document.getElementById('loadingScreen').classList.add('hidden'); }

function showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appShell').style.display = 'none'; // إخفاء التطبيق بالكامل
}

function showAuthError() {
    document.getElementById('authScreen').classList.remove('hidden');
    if(document.getElementById('authSuccess')) document.getElementById('authSuccess').classList.add('hidden');
    if(document.getElementById('authError')) document.getElementById('authError').classList.remove('hidden');
}

async function showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appShell').style.display = 'block'; // إظهار التطبيق

    // إعدادات المدير
    if (isAdmin) {
        if(document.getElementById('adminBadge')) document.getElementById('adminBadge').classList.remove('hidden');
        if(document.getElementById('adminNavItem')) document.getElementById('adminNavItem').classList.remove('hidden');
    }

    // تحميل البيانات
    selectedGroup = userProfile.group_level;
    updateGroupTabs();
    await loadNews();
    await loadEvents();
}

function setupOtherListeners() {
    // التبويبات العلوية
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            selectedGroup = tab.dataset.group;
            updateGroupTabs();
            loadNews();
            loadEvents();
        });
    });

    // إغلاق المودال
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
    
    // نموذج الدخول
    const authForm = document.getElementById('authForm');
    if(authForm) authForm.addEventListener('submit', handleLogin);
}

function updateGroupTabs() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.group === selectedGroup);
    });
}

// ========== تسجيل الدخول ==========
async function handleLogin(e) {
    e.preventDefault();
    const emailInput = document.getElementById('emailInput');
    if(!emailInput) return;
    
    const email = emailInput.value.trim().toLowerCase();
    const loginBtn = document.getElementById('loginBtn');
    
    if (!email) return;
    if(loginBtn) { loginBtn.disabled = true; loginBtn.innerHTML = 'جارٍ الإرسال...'; }

    try {
        const { data: allowed } = await sb.from('allowed_users').select('email').eq('email', email).single();
        if (!allowed) { showAuthError(); return; }

        const { error } = await sb.auth.signInWithOtp({
            email: email,
            options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        
        if(document.getElementById('authSuccess')) document.getElementById('authSuccess').classList.remove('hidden');
        if(document.getElementById('authForm')) document.getElementById('authForm').classList.add('hidden');
    } catch (err) {
        alert('حدث خطأ حاول مرة أخرى');
        console.error(err);
    } finally {
        if(loginBtn) { loginBtn.disabled = false; loginBtn.innerHTML = 'إرسال رابط الدخول'; }
    }
}

// ========== الدوال المساعدة (فارغة لملئها لاحقاً حسب الحاجة) ==========
async function loadNews() { console.log("News loaded for " + selectedGroup); }
async function loadEvents() { console.log("Events loaded for " + selectedGroup); }

// ========== المودال ==========
function openModal(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.add('active'); 
}
function closeModal(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.remove('active'); 
}
function resetAuth() { location.reload(); }
async function handleLogout() { await sb.auth.signOut(); location.reload(); }

// تصدير الدوال للـ HTML
window.openModal = openModal;
window.closeModal = closeModal;
window.resetAuth = resetAuth;
window.handleLogout = handleLogout;
window.loadUsersManagement = function() { alert('قريباً: إدارة الأعضاء'); };
