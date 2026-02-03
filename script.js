// ---------------- 設定區 ----------------
// 請到 Supabase 後台 -> Settings -> API 複製這些資訊
const SUPABASE_URL = 'https://msailwslireueorwzwpd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ue2Vz6XGm37SnPA2nulo4w_OLN0LzKW';
// 你的資料表名稱
const TABLE_NAME = 'messages';

// 初始化 Supabase 客戶端
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// 選取 DOM 元素
const messageBox = document.getElementById('message-box');
const usernameInput = document.getElementById('username');
const contentInput = document.getElementById('content');
const sendBtn = document.getElementById('send-btn');

// ---------------- 功能邏輯 ----------------

// 1. 取得歷史訊息
async function fetchMessages() {
    // 從 Supabase 查詢資料，按時間排序 (舊的在上面)
    const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('讀取錯誤:', error);
        messageBox.innerHTML = '<p style="text-align:center">讀取失敗，請檢查 Console</p>';
    } else {
        // 清空載入中文字
        messageBox.innerHTML = '';
        // 顯示每一條訊息
        data.forEach(msg => displayMessage(msg));
        scrollToBottom();
    }
}

// 2. 顯示訊息到畫面上 (DOM 操作)
function displayMessage(msg) {
    const div = document.createElement('div');
    div.classList.add('message');
    
    // 格式化時間 (只取時:分)
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 使用 textContent 防止 XSS 攻擊 (不使用 innerHTML 直接插入使用者輸入)
    // 這裡我們手動構建 HTML 結構
    div.innerHTML = `
        <strong></strong>
        <span></span>
        <div class="time">${time}</div>
    `;
    
    // 安全地填入文字
    div.querySelector('strong').textContent = msg.username;
    div.querySelector('span').textContent = msg.content;

    messageBox.appendChild(div);
    scrollToBottom();
}

// 3. 發送訊息 (寫入資料庫)
async function sendMessage() {
    const user = usernameInput.value.trim() || '匿名';
    const text = contentInput.value.trim();

    if (!text) return; // 如果沒內容就不送

    // 寫入 Supabase (不需要手動更新畫面，因為有監聽器)
    const { error } = await supabaseClient
    .from(TABLE_NAME)
    .insert({ 
        username: user, 
        content: text,
        created_at: new Date().toISOString() // 手動加上時間
    });
    
    if (error) {
        alert('發送失敗: ' + error.message);
    } else {
        contentInput.value = ''; // 清空輸入框
    }
}

// 4. 即時監聽 (Realtime Subscription)
function setupRealtime() {
    supabaseClient
        .channel('public:messages') // 頻道名稱可以隨意取
        .on(
            'postgres_changes', 
            { event: 'INSERT', schema: 'public', table: TABLE_NAME }, 
            (payload) => {
                // 當有新資料 INSERT 進來時，這裡會收到通知
                console.log('收到新訊息:', payload.new);
                displayMessage(payload.new);
            }
        )
        .subscribe();
}

// ---------------- 輔助函式 ----------------

// 自動捲動到底部
function scrollToBottom() {
    messageBox.scrollTop = messageBox.scrollHeight;
}

// ---------------- 事件綁定與初始化 ----------------

// 按鈕點擊
sendBtn.addEventListener('click', sendMessage);

// 按 Enter 發送
contentInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// 程式啟動
fetchMessages(); // 載入舊訊息
setupRealtime(); // 啟動監聽