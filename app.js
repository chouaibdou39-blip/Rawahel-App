/* ============================================
   RAWAHEL PLATFORM - Supabase Backend Integration
   ============================================ */

// ========== SUPABASE CONFIGURATION ==========
const SUPABASE_URL = 'https://utlbdcebtcjnjzljcaqg.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bGJkY2VidGNqbmp6bGpjYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjE1NTcsImV4cCI6MjA4NDk5NzU1N30.uw5pMDEQz1jUNNwktcKnb2Kflrl9JycnvCCozcDYDY0';

// Initialize Supabase client
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== APP STATE ==========
let currentUser = null;
let currentUserProfile = null;

// Group definitions
const GROUPS = {
    bunyan: { name: 'بنيان', level: 'الابتدائية', icon: 'fa-seedling' },
    rawasi: { name: 'رواسي', level: 'المتوسطة والثانوية', icon: 'fa-mountain' },
    rasukh: { name: 'رسوخ', level: 'الجامعية', icon: 'fa-graduation-cap' }
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Check for existing session
    const { data: { session }, error } = await sb.auth.getSession();

    if (session) {
        // User has a session, verify whitelist
        await handleAuthenticatedUser(session.user);
    } else {
        // No session, check for auth callback (Magic Link)
        await handleAuthCallback();
    }

    // Listen for auth state changes
    sb.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event);
        if (event === 'SIGNED_IN' && session) {
            await handleAuthenticatedUser(session.user);
        } else if (event === 'SIGNED_OUT') {
            showAuth();
        }
    });

    // Setup event listeners
    setupEventListeners();
}

async function handleAuthCallback() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');

    if (accessToken) {
        hideLoading();
        return;
    }
    hideLoading();
    showAuth();
}

async function handleAuthenticatedUser(user) {
    showLoading();

    try {
        const { data: allowedUser, error } = await sb
            .from('allowed_users')
            .select('*')
            .eq('email', user.email)
            .single();

        if (error || !allowedUser) {
            console.log('User not in whitelist:', user.email);
            await sb.auth.signOut();
            hideLoading();
            showAccessDenied();
            return;
        }

        currentUser = user;
        currentUserProfile = allowedUser;

        hideLoading();
        showApp();

        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname);
        }

    } catch (err) {
        console.error('Error checking whitelist:', err);
        hideLoading();
        showAuth();
    }
}

// ========== UI STATE FUNCTIONS ==========
function showLoading() {
    document.getElementById('loadingScreen').classList.remove('hidden');
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('visible');
}

function hideLoading() {
    document.getElementById('loadingScreen').classList.add('hidden');
}

function showAuth() {
    document.getElementById('authOverlay').classList.remove('hidden');
    document.getElementById('appContainer').classList.remove('visible');
    document.getElementById('authForm').classList.remove('hidden');
    document.getElementById('authSuccess').classList.add('hidden');
    document.getElementById('authDenied').classList.add('hidden');
}

function showAccessDenied() {
    document.getElementById('authOverlay').classList.remove('hidden');
    document.getElementById('authForm').classList.add('hidden');
    document.getElementById('authSuccess').classList.add('hidden');
    document.getElementById('authDenied').classList.remove('hidden');
}

function showMagicLinkSent() {
    document.getElementById('authForm').classList.add('hidden');
    document.getElementById('authDenied').classList.add('hidden');
    document.getElementById('authSuccess').classList.remove('hidden');
}

function resetAuthForm() {
    document.getElementById('authForm').classList.remove('hidden');
    document.getElementById('authSuccess').classList.add('hidden');
    document.getElementById('authDenied').classList.add('hidden');
    document.getElementById('userEmail').value = '';
}

async function showApp() {
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('appContainer').classList.add('visible');

    updateUserUI();

    await Promise.all([
        loadDashboard(),
        loadCalendar(),
        loadForum()
    ]);
}

// 🔥 دالة تحديث الواجهة (تم تعديلها لتظهر لوحة المدير)
function updateUserUI() {
    const profile = currentUserProfile;
    const groupInfo = GROUPS[profile.group_level];

    // Welcome message
    document.getElementById('welcomeName').textContent = profile.full_name;
    document.getElementById('welcomeGroup').textContent = groupInfo.name + ' - ' + groupInfo.level;
    document.getElementById('userEmailDisplay').textContent = currentUser.email;

    // Navigation user info
    const userBadge = document.getElementById('userGroupBadge');
    userBadge.textContent = groupInfo.name;
    userBadge.className = 'user-group-badge ' + profile.group_level;

    // Post form
    document.getElementById('postFormName').textContent = profile.full_name;

    // Forum group filter
    document.getElementById('forumGroupLabel').textContent = 'مجموعة ' + groupInfo.name;

    // ✅ إظهار رابط لوحة المدير إذا كان المستخدم Admin
    if (profile.role === 'admin') {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) {
            adminLink.classList.remove('hidden');
            
            // تفعيل مستمعات الأحداث الخاصة بالإدارة هنا للتأكد من وجود العناصر
            const addMemberForm = document.getElementById('addMemberForm');
            if (addMemberForm) {
                // إزالة المستمع القديم لتجنب التكرار
                const newForm = addMemberForm.cloneNode(true);
                addMemberForm.parentNode.replaceChild(newForm, addMemberForm);
                newForm.addEventListener('submit', handleAddMember);
            }
            
            // تحميل قائمة الأعضاء
            loadMembersList();
        }
    }
}

// ========== AUTH HANDLERS ==========
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('userEmail').value.trim();
    const loginBtn = document.getElementById('loginBtn');

    if (!email) {
        alert('يرجى إدخال البريد الإلكتروني');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الإرسال...';

    try {
        const { data: allowedUser, error: whitelistError } = await sb
            .from('allowed_users')
            .select('email')
            .eq('email', email)
            .single();

        if (whitelistError || !allowedUser) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال رابط الدخول';
            showAccessDenied();
            return;
        }

        const { error } = await sb.auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: window.location.origin + window.location.pathname
            }
        });

        if (error) throw error;
        showMagicLinkSent();

    } catch (err) {
        console.error('Login error:', err);
        alert('حدث خطأ أثناء إرسال رابط الدخول. يرجى المحاولة مرة أخرى.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال رابط الدخول';
    }
}

async function handleLogout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        await sb.auth.signOut();
        currentUser = null;
        currentUserProfile = null;
        showAuth();
    }
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    document.getElementById('authForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            if (section) navigateTo(section);
        });
    });

    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        document.getElementById('navLinks').classList.toggle('active');
        const icon = document.querySelector('#mobileMenuBtn i');
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    });

    document.getElementById('addSessionBtn').addEventListener('click', openSessionModal);
    document.getElementById('sessionForm').addEventListener('submit', handleAddSession);
    document.getElementById('submitPostBtn').addEventListener('click', handleAddPost);

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
    });
}

function navigateTo(section) {
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === section) {
            link.classList.add('active');
        }
    });

    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(section).classList.add('active');
    document.getElementById('navLinks').classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== DASHBOARD ==========
async function loadDashboard() {
    try {
        const { count: sessionCount } = await sb
            .from('calendar_events')
            .select('*', { count: 'exact', head: true })
            .or(`group_level.eq.${currentUserProfile.group_level},group_level.eq.all`);

        const { count: postCount } = await sb
            .from('forum_posts')
            .select('*', { count: 'exact', head: true })
            .eq('group_level', currentUserProfile.group_level);

        document.getElementById('totalSessions').textContent = sessionCount || 0;
        document.getElementById('totalPosts').textContent = postCount || 0;

    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

// ========== CALENDAR ==========
async function loadCalendar() {
    try {
        document.querySelectorAll('.day-column').forEach(col => col.innerHTML = '');

        const { data: events, error } = await sb
            .from('calendar_events')
            .select('*')
            .or(`group_level.eq.${currentUserProfile.group_level},group_level.eq.all`)
            .order('time', { ascending: true });

        if (error) throw error;

        events.forEach(event => addSessionToCalendar(event));

    } catch (err) {
        console.error('Error loading calendar:', err);
    }
}

function addSessionToCalendar(session) {
    const column = document.querySelector(`.day-column[data-day="${session.day}"]`);
    if (!column) return;

    const canDelete = session.created_by === currentUser.email || currentUserProfile.role === 'admin';

    const card = document.createElement('div');
    card.className = `session-card ${session.group_level}`;
    card.innerHTML = `
        <div class="session-time"><i class="fas fa-clock"></i> ${session.time}</div>
        <div class="session-subject">${session.subject}</div>
        <div class="session-teacher">${session.teacher || 'غير محدد'}</div>
        ${canDelete ? `<button class="session-delete" onclick="deleteSession('${session.id}')" title="حذف"><i class="fas fa-trash"></i></button>` : ''}
    `;
    column.appendChild(card);
}

function openSessionModal() {
    document.getElementById('sessionGroup').value = currentUserProfile.group_level;
    document.getElementById('sessionModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSessionModal() {
    document.getElementById('sessionModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('sessionForm').reset();
}

async function handleAddSession(e) {
    e.preventDefault();
    const session = {
        day: document.getElementById('sessionDay').value,
        time: document.getElementById('sessionTime').value,
        duration: parseInt(document.getElementById('sessionDuration').value) || 60,
        subject: document.getElementById('sessionSubject').value,
        teacher: document.getElementById('sessionTeacher').value,
        group_level: document.getElementById('sessionGroup').value,
        created_by: currentUser.email
    };

    try {
        const { error } = await sb.from('calendar_events').insert([session]);
        if (error) throw error;
        closeSessionModal();
        await loadCalendar();
        await loadDashboard();
    } catch (err) {
        console.error('Error adding session:', err);
        alert('حدث خطأ أثناء إضافة الحصة');
    }
}

async function deleteSession(id) {
    if (!confirm('هل تريد حذف هذه الحصة؟')) return;
    try {
        const { error } = await sb.from('calendar_events').delete().eq('id', id);
        if (error) throw error;
        await loadCalendar();
        await loadDashboard();
    } catch (err) {
        console.error('Error deleting session:', err);
        alert('حدث خطأ أثناء حذف الحصة');
    }
}

// ========== FORUM ==========
async function loadForum() {
    const container = document.getElementById('forumPosts');
    container.innerHTML = '<div class="loading-posts"><div class="loading-spinner small"></div><p>جارٍ تحميل المنشورات...</p></div>';

    try {
        const { data: posts, error } = await sb
            .from('forum_posts')
            .select('*')
            .eq('group_level', currentUserProfile.group_level)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!posts || posts.length === 0) {
            container.innerHTML = '<div class="no-posts"><i class="fas fa-comments"></i><p>لا توجد منشورات في مجموعتك حالياً<br>كن أول من يشارك!</p></div>';
            return;
        }

        container.innerHTML = posts.map(post => createPostHTML(post)).join('');

    } catch (err) {
        console.error('Error loading forum:', err);
        container.innerHTML = '<div class="no-posts"><i class="fas fa-exclamation-triangle"></i><p>حدث خطأ أثناء تحميل المنشورات</p></div>';
    }
}

function createPostHTML(post) {
    const groupInfo = GROUPS[post.group_level];
    const date = formatDate(post.created_at);
    const canDelete = post.author_email === currentUser.email;

    return `
        <div class="post-card" data-id="${post.id}">
            <div class="post-header">
                <div class="post-avatar"><i class="fas fa-user"></i></div>
                <div class="post-meta">
                    <div class="post-author">${post.author_name} <span class="post-group-badge ${post.group_level}">${groupInfo.name}</span></div>
                    <div class="post-date">${date}</div>
                </div>
                ${canDelete ? `<button class="post-delete-btn" onclick="deletePost('${post.id}')" title="حذف"><i class="fas fa-trash"></i></button>` : ''}
            </div>
            <div class="post-content">${post.content}</div>
        </div>
    `;
}

async function handleAddPost() {
    const content = document.getElementById('postContent').value.trim();
    if (!content) { alert('يرجى كتابة محتوى المنشور'); return; }

    const submitBtn = document.getElementById('submitPostBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ النشر...';

    const post = {
        content: content,
        author_name: currentUserProfile.full_name,
        author_email: currentUser.email,
        group_level: currentUserProfile.group_level
    };

    try {
        const { error } = await sb.from('forum_posts').insert([post]);
        if (error) throw error;
        document.getElementById('postContent').value = '';
        await loadForum();
        await loadDashboard();
    } catch (err) {
        console.error('Error adding post:', err);
        alert('حدث خطأ أثناء نشر المنشور');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> نشر';
    }
}

async function deletePost(id) {
    if (!confirm('هل تريد حذف هذا المنشور؟')) return;
    try {
        const { error } = await sb.from('forum_posts').delete().eq('id', id);
        if (error) throw error;
        await loadForum();
        await loadDashboard();
    } catch (err) {
        console.error('Error deleting post:', err);
        alert('حدث خطأ أثناء حذف المنشور');
    }
}

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
    return date.toLocaleDateString('ar-DZ');
}

// ========== AWRAD MODALS ==========
const modalMap = { morning: 'modalMorning', evening: 'modalEvening', wird: 'modalWird' };

function openAwrad(type) {
    const modalId = modalMap[type];
    const modal = document.getElementById(modalId);
    if (modal) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
}

// ========== ✅ ADMIN FUNCTIONS (NEW) ==========

async function loadMembersList() {
    const tbody = document.getElementById('membersTableBody');
    // التأكد من وجود الجدول قبل محاولة تعديله
    if (!tbody) return; 
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">جارٍ التحميل...</td></tr>';

    try {
        const { data: members, error } = await sb
            .from('allowed_users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';
        members.forEach(member => {
            const groupName = GROUPS[member.group_level] ? GROUPS[member.group_level].name : member.group_level;
            const row = `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${member.full_name} ${member.role === 'admin' ? '⭐' : ''}</td>
                    <td style="padding: 10px; font-size: 0.9em;">${member.email}</td>
                    <td style="padding: 10px;"><span class="post-group-badge ${member.group_level}">${groupName}</span></td>
                    <td style="padding: 10px;">
                        ${member.role !== 'admin' ? 
                        `<button onclick="deleteMember('${member.email}')" style="color: red; background: none; border: none; cursor: pointer;">
                            <i class="fas fa-trash"></i>
                        </button>` : ''}
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (err) {
        console.error('Error loading members:', err);
    }
}

async function handleAddMember(e) {
    e.preventDefault();
    const name = document.getElementById('newMemberName').value;
    const email = document.getElementById('newMemberEmail').value.trim().toLowerCase();
    const group = document.getElementById('newMemberGroup').value;

    if(!name || !email) return;

    if(confirm(`هل أنت متأكد من إضافة ${name}؟`)) {
        try {
            const { error } = await sb
                .from('allowed_users')
                .insert([{ email: email, full_name: name, group_level: group }]);

            if (error) throw error;

            alert('تمت إضافة العضو بنجاح!');
            document.getElementById('addMemberForm').reset();
            loadMembersList(); // تحديث القائمة
        } catch (err) {
            alert('حدث خطأ! ربما هذا الإيميل مسجل مسبقاً.');
            console.error(err);
        }
    }
}

async function deleteMember(email) {
    if(confirm(`هل أنت متأكد من حذف العضو ${email} ومنعه من الدخول؟`)) {
        try {
            const { error } = await sb
                .from('allowed_users')
                .delete()
                .eq('email', email);

            if (error) throw error;
            loadMembersList(); // تحديث القائمة
        } catch (err) {
            alert('حدث خطأ أثناء الحذف');
            console.error(err);
        }
    }
}

// ========== EXPOSE FUNCTIONS GLOBALLY ==========
window.navigateTo = navigateTo;
window.openAwrad = openAwrad;
window.closeModal = closeModal;
window.deleteSession = deleteSession;
window.deletePost = deletePost;
window.closeSessionModal = closeSessionModal;
window.resetAuthForm = resetAuthForm;
// Expose admin functions
window.deleteMember = deleteMember;
