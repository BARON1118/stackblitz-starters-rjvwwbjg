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


let mediaRecorder;
let audioChunks = [];

// 1. 檔案上傳至 Bucket
async function uploadToSupabase(file, typeFolder) {
    const fileName = `${typeFolder}/${Date.now()}-${file.name || 'record.webm'}`;
    const { data, error } = await supabaseClient.storage
        .from('2223127')
        .upload(fileName, file);

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
        .from('2223127')
        .getPublicUrl(fileName);
    
    return urlData.publicUrl;
}

// 2. 顯示訊息 (判斷檔案類型)
function displayMessage(msg) {
    const div = document.createElement('div');
    div.className = 'message';
    
    let mediaHTML = '';
    if (msg.image_url) {
        if (msg.file_type === 'image') mediaHTML = `<img src="${msg.image_url}" class="chat-media">`;
        else if (msg.file_type === 'video') mediaHTML = `<video src="${msg.image_url}" controls class="chat-media"></video>`;
        else if (msg.file_type === 'audio') mediaHTML = `<audio src="${msg.image_url}" controls></audio>`;
    }

    div.innerHTML = `
        <strong>${msg.username}</strong>
        ${msg.content ? `<div>${msg.content}</div>` : ''}
        ${mediaHTML}
        <small>${new Date(msg.created_at).toLocaleTimeString()}</small>
    `;
    messageBox.appendChild(div);
    messageBox.scrollTop = messageBox.scrollHeight;
}

// 3. 發送訊息至資料表
async function sendToDB(content, fileUrl = null, fileType = 'text') {
    const username = document.getElementById('username').value;
    await supabaseClient.from('message').insert({
        username, content, image_url: fileUrl, file_type: fileType
    });
}

// 4. 錄音功能實作
recordBtn.onclick = async () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            statusBar.innerText = "正在上傳錄音...";
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const url = await uploadToSupabase(audioBlob, 'audio');
            await sendToDB('', url, 'audio');
            statusBar.innerText = "";
        };

        mediaRecorder.start();
        recordBtn.classList.add('recording-active');
        statusBar.innerText = "🔴 錄音中...";
    } else {
        mediaRecorder.stop();
        recordBtn.classList.remove('recording-active');
    }
};

// 5. 圖片/影片上傳實作
fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    statusBar.innerText = "檔案上傳中...";
    const isVideo = file.type.startsWith('video');
    const type = isVideo ? 'video' : 'image';
    
    try {
        const url = await uploadToSupabase(file, type);
        await sendToDB('', url, type);
    } catch (err) {
        alert("上傳失敗");
    }
    statusBar.innerText = "";
};

// 6. 一般文字發送
document.getElementById('send-btn').onclick = () => {
    const content = document.getElementById('content').value;
    if (!content.trim()) return;
    sendToDB(content);
    document.getElementById('content').value = '';
};

// 初始化 (獲取歷史訊息與即時監聽請參考之前的 fetchMessages 和 setupRealtime)
// 程式啟動
fetchMessages(); // 載入舊訊息
setupRealtime(); // 啟動監聽