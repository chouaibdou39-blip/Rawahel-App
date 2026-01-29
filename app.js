/* ============================================
   RAWAHEL PLATFORM - Complete JavaScript
   Supabase Integration with Admin Features
   ============================================ */

// ========== SUPABASE CONFIG ==========
// IMPORTANT: Replace with your actual credentials
const SUPABASE_URL = 'https://utlbdcebtcjnjzljcaqg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bGJkY2VidGNqbmp6bGpjYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder';

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== APP STATE ==========
let currentUser = null;
let userProfile = null;
let selectedGroup = 'bunyan';
let isAdmin = false;

// Group info
const GROUPS = {
    bunyan: { name: 'بنيان', icon: 'fa-seedling', color: '#34A853' },
    rawasi: { name: 'رواسي', icon: 'fa-mountain', color: '#FBBC04' },
    rasukh: { name: 'رسوخ', icon: 'fa-graduation-cap', color: '#EA4335' },
    all: { name: 'الكل', icon: 'fa-users', color: '#1A73E8' }
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        await handleAuthentication(session.user);
    } else {
        // Check for magic link callback
        await handleAuthCallback();
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            await handleAuthentication(session.user);
        } else if (event === 'SIGNED_OUT') {
            showAuthScreen();
        }
    });

    // Setup event listeners
    setupEventListeners();
}

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
            // User not in whitelist
            await supabase.auth.signOut();
            hideLoading();
            showAuthError();
            return;
        }

        // User is allowed
        currentUser = user;
        userProfile = profile;
        isAdmin = profile.role === 'admin';

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

// ========== UI HELPERS ==========
function showLoading() {
    document.getElementById('loadingScreen').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingScreen').classList.add('hidden');
}

function showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.remove('active');
}

function showAuthError() {
    document.getElementById('authScreen').classList.remove('hidden');
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
    document.getElementById('appShell').classList.add('active');

    // Show admin elements if user is admin
    if (isAdmin) {
        document.getElementById('adminBadge').classList.remove('hidden');
        document.getElementById('adminNavItem').classList.remove('hidden');
        document.getElementById('fabBtn').classList.remove('hidden');
    }

    // Set initial group to user's group
    selectedGroup = userProfile.group_level;
    updateGroupTabs();

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

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Auth form
    document.getElementById('authForm').addEventListener('submit', handleLogin);

    // Group tabs
    document.querySelectorAll('.group-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            selectedGroup = tab.dataset.group;
            updateGroupTabs();
            loadNews();
            loadEvents();
        });
    });

    // Bottom nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            switchSection(sectionId);
            
            // Update active nav
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Modal close on outside click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });
}

function updateGroupTabs() {
    document.querySelectorAll('.group-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.group === selectedGroup);
    });

    // Update badges
    const groupInfo = GROUPS[selectedGroup];
    document.getElementById('newsGroupBadge').textContent = groupInfo.name;
    document.getElementById('newsGroupBadge').className = `group-badge ${selectedGroup}`;
    document.getElementById('calendarGroupBadge').textContent = groupInfo.name;
    document.getElementById('calendarGroupBadge').className = `group-badge ${selectedGroup}`;
}

function switchSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
}

// ========== AUTHENTICATION ==========
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('emailInput').value.trim();
    const loginBtn = document.getElementById('loginBtn');
    
    if (!email) return;

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الإرسال...';

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
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال رابط الدخول';
    }
}

async function handleLogout() {
    if (!confirm('هل تريد تسجيل الخروج؟')) return;
    
    await supabase.auth.signOut();
    currentUser = null;
    userProfile = null;
    isAdmin = false;
    
    // Reset UI
    document.getElementById('adminBadge').classList.add('hidden');
    document.getElementById('adminNavItem').classList.add('hidden');
    document.getElementById('fabBtn').classList.add('hidden');
    
    showAuthScreen();
    resetAuth();
}

// ========== NEWS FEED ==========
async function loadNews() {
    const container = document.getElementById('newsList');
    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جارٍ التحميل...</p></div>';

    try {
        let query = supabase
            .from('posts')
            .select('*')
            .order('pinned', { ascending: false })
            .order('created_at', { ascending: false });

        // Filter by group (admins see selected group, members see their group)
        if (!isAdmin) {
            query = query.or(`group_level.eq.${userProfile.group_level},group_level.eq.all`);
        } else {
            query = query.or(`group_level.eq.${selectedGroup},group_level.eq.all`);
        }

        const { data: posts, error } = await query;

        if (error) throw error;

        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-newspaper"></i>
                    <p>لا توجد أخبار حالياً</p>
                </div>
            `;
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
    
    return `
        <div class="card ${post.pinned ? 'pinned' : ''}" data-id="${post.id}">
            <div class="card-header">
                <div class="card-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="card-meta">
                    <div class="card-author">
                        ${post.author_name}
                        ${post.pinned ? '<span class="pin-badge">مثبت</span>' : ''}
                    </div>
                    <div class="card-date">${date}</div>
                </div>
                <span class="group-badge ${post.group_level}">${groupInfo.name}</span>
            </div>
            <div class="card-body">
                <h3 class="card-title">${escapeHtml(post.title)}</h3>
                <p class="card-content">${escapeHtml(post.content)}</p>
            </div>
            ${isAdmin ? `
                <div class="card-actions">
                    <button class="btn btn-text" onclick="deletePost('${post.id}')">
                        <i class="fas fa-trash"></i>
                        حذف
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
        showSnackbar('حدث خطأ، حاول مرة أخرى');
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
        let query = supabase
            .from('calendar_events')
            .select('*')
            .gte('event_date', new Date().toISOString().split('T')[0])
            .order('event_date', { ascending: true });

        // Filter by group
        if (!isAdmin) {
            query = query.or(`group_level.eq.${userProfile.group_level},group_level.eq.all`);
        } else {
            query = query.or(`group_level.eq.${selectedGroup},group_level.eq.all`);
        }

        const { data: events, error } = await query;

        if (error) throw error;

        if (!events || events.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar"></i>
                    <p>لا توجد فعاليات قادمة</p>
                </div>
            `;
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
                    <span class="group-badge ${event.group_level}">${groupInfo.name}</span>
                </div>
                ${event.description ? `<p style="margin-top: 8px; font-size: 13px; color: #5F6368;">${escapeHtml(event.description)}</p>` : ''}
            </div>
            ${isAdmin ? `
                <div class="event-actions">
                    <button class="btn-icon" onclick="deleteEvent('${event.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

async function submitEvent() {
    const title = document.getElementById('eventTitle').value.trim();
    const description = document.getElementById('eventDescription').value.trim();
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
            description: description || null,
            event_date: eventDate,
            event_time: eventTime || null,
            location: location || null,
            group_level: group,
            author_email: currentUser.email
        });

        if (error) throw error;

        closeModal('eventModal');
        document.getElementById('eventForm').reset();
        showSnackbar('تم إضافة الفعالية بنجاح');
        loadEvents();

    } catch (err) {
        console.error('Submit event error:', err);
        showSnackbar('حدث خطأ، حاول مرة أخرى');
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

// ========== USER MANAGEMENT ==========
async function loadUsersManagement() {
    const container = document.getElementById('usersManagement');
    const list = document.getElementById('usersList');
    
    container.classList.remove('hidden');
    list.innerHTML = '<div style="padding: 20px; text-align: center;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const { data: users, error } = await supabase
            .from('allowed_users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!users || users.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center;">لا يوجد أعضاء</div>';
            return;
        }

        list.innerHTML = users.map(user => createUserRow(user)).join('');

    } catch (err) {
        console.error('Load users error:', err);
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">خطأ في التحميل</div>';
    }
}

function createUserRow(user) {
    const initials = user.full_name.charAt(0);
    const groupInfo = GROUPS[user.group_level];

    return `
        <div class="user-row">
            <div class="user-avatar">${initials}</div>
            <div class="user-info">
                <div class="user-name">
                    ${escapeHtml(user.full_name)}
                    ${user.role === 'admin' ? '<span class="role-badge">مشرف</span>' : ''}
                </div>
                <div class="user-email">${user.email}</div>
            </div>
            <span class="group-badge ${user.group_level}">${groupInfo.name}</span>
            <div class="user-actions">
                <button class="btn-icon" onclick="editUser('${user.id}')" title="تعديل">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="deleteUser('${user.id}')" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

async function submitUser() {
    const email = document.getElementById('newUserEmail').value.trim();
    const name = document.getElementById('newUserName').value.trim();
    const group = document.getElementById('newUserGroup').value;
    const role = document.getElementById('newUserRole').value;

    if (!email || !name) {
        showSnackbar('يرجى ملء جميع الحقول');
        return;
    }

    try {
        const { error } = await supabase.from('allowed_users').insert({
            email: email,
            full_name: name,
            group_level: group,
            role: role
        });

        if (error) throw error;

        closeModal('userModal');
        document.getElementById('userForm').reset();
        showSnackbar('تم إضافة العضو بنجاح');
        loadUsersManagement();

    } catch (err) {
        console.error('Submit user error:', err);
        if (err.code === '23505') {
            showSnackbar('البريد الإلكتروني موجود مسبقاً');
        } else {
            showSnackbar('حدث خطأ، حاول مرة أخرى');
        }
    }
}

async function editUser(id) {
    try {
        const { data: user, error } = await supabase
            .from('allowed_users')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUserEmail').value = user.email;
        document.getElementById('editUserName').value = user.full_name;
        document.getElementById('editUserGroup').value = user.group_level;
        document.getElementById('editUserRole').value = user.role;

        openModal('editUserModal');

    } catch (err) {
        console.error('Edit user error:', err);
        showSnackbar('حدث خطأ');
    }
}

async function updateUser() {
    const id = document.getElementById('editUserId').value;
    const name = document.getElementById('editUserName').value.trim();
    const group = document.getElementById('editUserGroup').value;
    const role = document.getElementById('editUserRole').value;

    if (!name) {
        showSnackbar('يرجى إدخال الاسم');
        return;
    }

    try {
        const { error } = await supabase
            .from('allowed_users')
            .update({
                full_name: name,
                group_level: group,
                role: role,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        closeModal('editUserModal');
        showSnackbar('تم التحديث بنجاح');
        loadUsersManagement();

    } catch (err) {
        console.error('Update user error:', err);
        showSnackbar('حدث خطأ');
    }
}

async function deleteUser(id) {
    if (!confirm('هل تريد حذف هذا العضو؟')) return;

    try {
        const { error } = await supabase.from('allowed_users').delete().eq('id', id);
        if (error) throw error;

        showSnackbar('تم الحذف');
        loadUsersManagement();

    } catch (err) {
        console.error('Delete user error:', err);
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

function openQuickAction() {
    // Show post modal by default
    openModal('postModal');
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== EXPOSE FUNCTIONS GLOBALLY ==========
window.handleLogout = handleLogout;
window.resetAuth = resetAuth;
window.openModal = openModal;
window.closeModal = closeModal;
window.openQuickAction = openQuickAction;
window.submitPost = submitPost;
window.deletePost = deletePost;
window.submitEvent = submitEvent;
window.deleteEvent = deleteEvent;
window.loadUsersManagement = loadUsersManagement;
window.submitUser = submitUser;
window.editUser = editUser;
window.updateUser = updateUser;
window.deleteUser = deleteUser;
