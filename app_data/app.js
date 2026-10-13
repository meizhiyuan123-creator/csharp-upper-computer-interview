// ==========================================================
// C# 上位机面试知识库 & 自测记忆系统 - 交互逻辑核心
// ==========================================================

(function() {
  // 1. 状态管理
  const STORAGE_KEY_STATUS = 'csharp_interview_question_status';
  const STORAGE_KEY_THEME = 'csharp_interview_theme';

  let currentModule = 'ALL';
  let currentStars = 'ALL';
  let currentStatusFilter = 'ALL';
  let searchQuery = '';
  let viewMode = 'flashcard'; // 'flashcard' (自测) | 'browse' (全部展开)
  
  // 本地持久化的各题状态: { [id]: 'mastered' | 'review' | 'urgent' }
  let userStatusMap = {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATUS);
    if (raw) userStatusMap = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load user status', e);
  }

  // 2. DOM 元素引用
  const elQuestionList = document.getElementById('questionList');
  const elTotalCount = document.getElementById('totalCount');
  const elMasteredCount = document.getElementById('masteredCount');
  const elReviewCount = document.getElementById('reviewCount');
  const elUrgentCount = document.getElementById('urgentCount');
  const elProgressBar = document.getElementById('progressBar');
  const elProgressPercent = document.getElementById('progressPercent');
  const elSearchInput = document.getElementById('searchInput');
  const elModuleTabs = document.getElementById('moduleTabs');
  const elThemeToggle = document.getElementById('themeToggle');
  const elModeFlashcard = document.getElementById('modeFlashcard');
  const elModeBrowse = document.getElementById('modeBrowse');
  const elToggleAllBtn = document.getElementById('toggleAllBtn');

  // 初始化题库
  const questions = window.INTERVIEW_QUESTIONS || [];

  // 3. 计算与更新统计数据
  function updateDashboard() {
    const total = questions.length;
    let mastered = 0;
    let review = 0;
    let urgent = 0;

    questions.forEach(q => {
      const s = userStatusMap[q.id];
      if (s === 'mastered') mastered++;
      else if (s === 'review') review++;
      else if (s === 'urgent') urgent++;
    });

    elTotalCount.textContent = total;
    elMasteredCount.textContent = mastered;
    elReviewCount.textContent = review;
    elUrgentCount.textContent = urgent;

    const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;
    elProgressPercent.textContent = `${percent}%`;
    elProgressBar.style.width = `${percent}%`;
  }

  // 4. 保存状态
  function saveStatus(id, newStatus) {
    if (userStatusMap[id] === newStatus) {
      delete userStatusMap[id]; // 再次点击取消标记
    } else {
      userStatusMap[id] = newStatus;
    }
    try {
      localStorage.setItem(STORAGE_KEY_STATUS, JSON.stringify(userStatusMap));
    } catch (e) {}
    updateDashboard();
    renderQuestions();
  }

  // 5. 过滤逻辑
  function getFilteredQuestions() {
    return questions.filter(q => {
      // 模块匹配
      if (currentModule !== 'ALL' && q.module !== currentModule) return false;
      
      // 星级匹配
      if (currentStars !== 'ALL' && q.stars !== parseInt(currentStars)) return false;
      
      // 状态匹配
      const status = userStatusMap[q.id] || 'unmarked';
      if (currentStatusFilter === 'UNMASTERED' && status === 'mastered') return false;
      if (currentStatusFilter === 'URGENT' && status !== 'urgent') return false;
      if (currentStatusFilter === 'REVIEW' && status !== 'review') return false;
      if (currentStatusFilter === 'MASTERED' && status !== 'mastered') return false;

      // 搜索匹配
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const inTitle = q.title.toLowerCase().includes(query);
        const inTags = q.tags.some(t => t.toLowerCase().includes(query));
        const inSummary = q.summary.toLowerCase().includes(query);
        const inDetail = q.detail.toLowerCase().includes(query);
        if (!inTitle && !inTags && !inSummary && !inDetail) return false;
      }

      return true;
    });
  }

  // 6. 渲染题目列表
  function renderQuestions() {
    const list = getFilteredQuestions();

    if (list.length === 0) {
      elQuestionList.innerHTML = `
        <div class="empty-state">
          <h3>🔍 未找到符合条件的面试题</h3>
          <p style="margin-top: 8px;">尝试更换筛选条件或清除搜索关键字</p>
        </div>
      `;
      return;
    }

    elQuestionList.innerHTML = list.map((q, index) => {
      const status = userStatusMap[q.id] || null;
      const isVisible = viewMode === 'browse'; // 浏览模式下默认全展开

      let statusBadgeHtml = '';
      if (status === 'mastered') statusBadgeHtml = `<span class="status-badge mastered">✅ 已掌握</span>`;
      else if (status === 'review') statusBadgeHtml = `<span class="status-badge review">🤔 待复习</span>`;
      else if (status === 'urgent') statusBadgeHtml = `<span class="status-badge urgent">🔥 重点攻关</span>`;

      // 格式化 30秒提纲 Markdown 粗体
      const formattedSummary = q.summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\n/g, '<br/>');

      // 格式化追问列表
      const followUpsHtml = q.follow_ups.map(item => `<li>${item}</li>`).join('');

      // 格式化代码块与代码行
      let detailFormatted = q.detail
        .replace(/```csharp([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '<br/><br/>');

      return `
        <div class="question-card" id="card-${q.id}">
          <div class="card-top">
            <div class="card-meta">
              <span class="id-badge">${q.id}</span>
              <span class="module-badge">${q.module}</span>
              <span class="stars-badge">${'⭐'.repeat(q.stars)}</span>
              ${statusBadgeHtml}
            </div>
          </div>

          <h3 class="card-title">${index + 1}. ${q.title}</h3>

          <div class="tag-list">
            ${q.tags.map(t => `<span class="tag-item">#${t}</span>`).join('')}
          </div>

          <!-- 核心回答区域（自测模式下折叠） -->
          <div class="answer-box ${isVisible ? 'visible' : ''}" id="answer-${q.id}">
            <div class="summary-block">
              <div class="summary-title">💡 30秒速记提纲（面试张口就来）</div>
              <div class="summary-content">${formattedSummary}</div>
            </div>

            <div class="detail-section">
              <div class="section-label">🔍 深入原理解析与底层机制</div>
              <div>${detailFormatted}</div>
            </div>

            <div class="practice-block">
              <div class="practice-title">🛠️ 上位机实战避坑案例</div>
              <div>${q.practice}</div>
            </div>

            <div class="followups-block">
              <div class="followups-title">⚠️ 面试官连环追问与挖坑</div>
              <ul class="followups-list">
                ${followUpsHtml}
              </ul>
            </div>
          </div>

          <div class="card-footer">
            <button class="toggle-answer-btn" onclick="window.toggleAnswer('${q.id}')">
              <span id="btn-text-${q.id}">${isVisible ? '🙈 收起解答' : '👁️ 查看解答 / 自测'}</span>
            </button>

            <button class="ask-ai-card-btn" onclick="window.askAiWithQuestion('${q.id}')" title="唤起 AI 对本题进行深入追问与实战拓展">
              🤖 AI 追问
            </button>

            <div class="status-actions">
              <button class="status-btn btn-mastered ${status === 'mastered' ? 'active' : ''}" 
                      onclick="window.setCardStatus('${q.id}', 'mastered')" title="标记为熟练掌握">
                ✅ 已掌握
              </button>
              <button class="status-btn btn-review ${status === 'review' ? 'active' : ''}" 
                      onclick="window.setCardStatus('${q.id}', 'review')" title="标记为待复习">
                🤔 待复习
              </button>
              <button class="status-btn btn-urgent ${status === 'urgent' ? 'active' : ''}" 
                      onclick="window.setCardStatus('${q.id}', 'urgent')" title="标记为重点攻关">
                🔥 重点
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 7. 展开/折叠单题
  window.toggleAnswer = function(id) {
    const box = document.getElementById(`answer-${id}`);
    const textSpan = document.getElementById(`btn-text-${id}`);
    if (!box) return;

    if (box.classList.contains('visible')) {
      box.classList.remove('visible');
      if (textSpan) textSpan.textContent = '👁️ 查看解答 / 自测';
    } else {
      box.classList.add('visible');
      if (textSpan) textSpan.textContent = '🙈 收起解答';
    }
  };

  // 8. 设置题目状态
  window.setCardStatus = function(id, status) {
    saveStatus(id, status);
  };

  // 9. 模块筛选绑定
  elModuleTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentModule = tab.dataset.module;
    renderQuestions();
  });

  // 10. 星级与状态筛选
  document.querySelectorAll('.star-filters .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.star-filters .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStars = btn.dataset.star;
      renderQuestions();
    });
  });

  document.querySelectorAll('.status-filters .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-filters .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatusFilter = btn.dataset.status;
      renderQuestions();
    });
  });

  // 11. 搜索输入联动
  elSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderQuestions();
  });

  // 12. 视图模式切换
  elModeFlashcard.addEventListener('click', () => {
    viewMode = 'flashcard';
    elModeFlashcard.classList.add('active');
    elModeBrowse.classList.remove('active');
    renderQuestions();
  });

  elModeBrowse.addEventListener('click', () => {
    viewMode = 'browse';
    elModeBrowse.classList.add('active');
    elModeFlashcard.classList.remove('active');
    renderQuestions();
  });

  // 13. 一键展开/折叠全部
  let allExpanded = false;
  elToggleAllBtn.addEventListener('click', () => {
    allExpanded = !allExpanded;
    document.querySelectorAll('.answer-box').forEach(box => {
      if (allExpanded) box.classList.add('visible');
      else box.classList.remove('visible');
    });
    document.querySelectorAll('.toggle-answer-btn span').forEach(span => {
      span.textContent = allExpanded ? '🙈 收起解答' : '👁️ 查看解答 / 自测';
    });
    elToggleAllBtn.textContent = allExpanded ? '📦 一键折叠' : '📖 一键展开';
  });

  // 14. 明暗主题切换
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    elThemeToggle.textContent = theme === 'light' ? '🌙 深色模式' : '☀️ 明亮模式';
  }

  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'dark';
  setTheme(savedTheme);

  elThemeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    setTheme(cur === 'light' ? 'dark' : 'light');
  });

  // ==========================================================
  // 15. DeepSeek 上位机技术与面试 AI 智能辅导模块
  // ==========================================================
  const STORAGE_KEY_AI_KEY = 'csharp_ai_api_key';
  const STORAGE_KEY_AI_ENDPOINT = 'csharp_ai_api_endpoint';
  const STORAGE_KEY_AI_MODEL = 'csharp_ai_model';

  // 资深上位机面试导师与架构专家系统提示词 (精简干练风格)
  const SYSTEM_PROMPT = `你是一位精通 C# / .NET 8 / WPF / 工业测控与通信架构的【资深上位机架构专家与工控大厂面试导师】。
你的任务是为工程师快速解答上位机求职面试题、自由技术咨询、通信排错与架构选型。

【⚡ 核心原则：回答简明扼要、直切要害、拒绝长篇大论】
用户在侧边抽屉快速查阅，需要高效吸收，严禁冗长铺垫与大段套话：
1. 【字数严格受限】：全篇严格控制在 150 ~ 300 字左右，言简意赅、句句干货。
2. 【清晰分点】：按 1~3 点归纳，每点仅用 1~2 句话切中底层本质与工业现场经验。
3. 【极简代码】：若需提供代码，仅贴 5~12 行最核心关键实现，禁止贴大段无意义样板代码。
4. 【面试亮点】：若是面试题，给出 1 句张口就来的“定性金句” + 1 个现场避坑警示。`;

  // AI 交互 DOM
  const elAiFabBtn = document.getElementById('aiFabBtn');
  const elAiDrawer = document.getElementById('aiDrawer');
  const elAiCloseBtn = document.getElementById('aiCloseBtn');
  const elAiConfigToggleBtn = document.getElementById('aiConfigToggleBtn');
  const elAiClearHistoryBtn = document.getElementById('aiClearHistoryBtn');
  const elAiConfigPanel = document.getElementById('aiConfigPanel');
  const elAiApiKeyInput = document.getElementById('aiApiKeyInput');
  const elAiApiEndpointInput = document.getElementById('aiApiEndpointInput');
  const elAiModelSelect = document.getElementById('aiModelSelect');
  const elAiSaveConfigBtn = document.getElementById('aiSaveConfigBtn');
  const elAiChatStream = document.getElementById('aiChatStream');
  const elAiUserInput = document.getElementById('aiUserInput');
  const elAiSendBtn = document.getElementById('aiSendBtn');
  const elAiResizeHandle = document.getElementById('aiResizeHandle');

  // 本地会话消息历史 (保存当前会话的上下文，最多保留最近 8 条避免超 token)
  let chatHistory = [];
  let isAiGenerating = false;

  // 更新页面内容推挤避让宽度 (防止遮挡主内容)
  function updateDrawerPush(isOpen) {
    if (window.innerWidth >= 900 && isOpen) {
      const curWidth = elAiDrawer ? (elAiDrawer.offsetWidth || 580) : 580;
      document.documentElement.style.setProperty('--ai-drawer-width', `${curWidth}px`);
      document.body.classList.add('ai-drawer-open');
    } else {
      document.documentElement.style.setProperty('--ai-drawer-width', '0px');
      document.body.classList.remove('ai-drawer-open');
    }
  }

  // 侧边栏拖拽调宽交互
  if (elAiResizeHandle && elAiDrawer) {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    elAiResizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = elAiDrawer.offsetWidth;
      elAiDrawer.classList.add('resizing');
      document.body.classList.add('ai-resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      // 抽屉贴在屏幕右边，向左拖增加宽度，向右拖缩小宽度
      const deltaX = startX - e.clientX;
      let newWidth = startWidth + deltaX;
      const minWidth = 360;
      const maxWidth = Math.min(window.innerWidth * 0.92, 1400);
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      elAiDrawer.style.width = `${newWidth}px`;
      
      // 桌面端同时动态推挤页面内容，完全避免遮挡
      if (window.innerWidth >= 900) {
        document.documentElement.style.setProperty('--ai-drawer-width', `${newWidth}px`);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        elAiDrawer.classList.remove('resizing');
        document.body.classList.remove('ai-resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        try {
          localStorage.setItem('csharp_ai_drawer_width', elAiDrawer.offsetWidth);
        } catch (_) {}
      }
    });

    // 恢复历史宽度
    try {
      const savedWidth = localStorage.getItem('csharp_ai_drawer_width');
      if (savedWidth && window.innerWidth > 640) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 360) {
          elAiDrawer.style.width = `${Math.min(parsed, window.innerWidth * 0.92)}px`;
        }
      }
    } catch (_) {}

    // 窗口尺寸变化时自适应推挤
    window.addEventListener('resize', () => {
      if (elAiDrawer && elAiDrawer.classList.contains('open')) {
        updateDrawerPush(true);
      }
    });
  }

  // 读取已保存的 API 配置
  function loadAiConfig() {
    const savedKey = localStorage.getItem(STORAGE_KEY_AI_KEY) || '';
    const savedEndpoint = localStorage.getItem(STORAGE_KEY_AI_ENDPOINT) || 'https://api.deepseek.com/chat/completions';
    const savedModel = localStorage.getItem(STORAGE_KEY_AI_MODEL) || 'deepseek-chat';

    if (elAiApiKeyInput) elAiApiKeyInput.value = savedKey;
    if (elAiApiEndpointInput) elAiApiEndpointInput.value = savedEndpoint;
    if (elAiModelSelect) elAiModelSelect.value = savedModel;

    // 如果还没有 Key，首次打开抽屉时自动展开配置面板
    if (!savedKey && elAiConfigPanel) {
      elAiConfigPanel.classList.add('open');
    }
  }

  // 保存 API 配置
  if (elAiSaveConfigBtn) {
    elAiSaveConfigBtn.addEventListener('click', () => {
      const key = elAiApiKeyInput.value.trim();
      const endpoint = elAiApiEndpointInput.value.trim() || 'https://api.deepseek.com/chat/completions';
      const model = elAiModelSelect.value;

      localStorage.setItem(STORAGE_KEY_AI_KEY, key);
      localStorage.setItem(STORAGE_KEY_AI_ENDPOINT, endpoint);
      localStorage.setItem(STORAGE_KEY_AI_MODEL, model);

      elAiConfigPanel.classList.remove('open');
      appendBotMessage(`✅ 配置已保存！当前模型：<strong>${model}</strong>。<br>您可以随时自由提问，或点击卡片下方的 <strong>[🤖 AI 追问]</strong>。`);
    });
  }

  // 切换抽屉显隐 (同时联动推挤页面主内容)
  function openAiDrawer() {
    if (elAiDrawer) {
      elAiDrawer.classList.add('open');
      updateDrawerPush(true);
      if (elAiUserInput) elAiUserInput.focus();
    }
  }

  function closeAiDrawer() {
    if (elAiDrawer) {
      elAiDrawer.classList.remove('open');
      updateDrawerPush(false);
    }
  }

  if (elAiFabBtn) elAiFabBtn.addEventListener('click', openAiDrawer);
  if (elAiCloseBtn) elAiCloseBtn.addEventListener('click', closeAiDrawer);

  if (elAiConfigToggleBtn) {
    elAiConfigToggleBtn.addEventListener('click', () => {
      if (elAiConfigPanel) elAiConfigPanel.classList.toggle('open');
    });
  }

  if (elAiClearHistoryBtn) {
    elAiClearHistoryBtn.addEventListener('click', () => {
      if (confirm('确定要清空当前的对话历史吗？')) {
        chatHistory = [];
        if (elAiChatStream) {
          elAiChatStream.innerHTML = `
            <div class="ai-msg ai-msg-bot">
              <div class="ai-avatar">🤖</div>
              <div class="ai-bubble">
                会话已重置。你好！我是你的 <strong>C# 上位机技术与面试 AI 导师</strong>，请随时提出你的问题！
              </div>
            </div>
          `;
        }
      }
    });
  }

  // 快捷问题点击直接发送
  document.querySelectorAll('.ai-quick-tag').forEach(tagBtn => {
    tagBtn.addEventListener('click', () => {
      const prompt = tagBtn.dataset.prompt;
      if (prompt) {
        openAiDrawer();
        handleUserSend(prompt);
      }
    });
  });

  // 全局卡片追问触发函数 (精炼版)
  window.askAiWithQuestion = function(id) {
    const q = questions.find(item => item.id === id);
    if (!q) return;

    openAiDrawer();

    const promptText = `请简要剖析上位机面试题【${q.id} ${q.title}】：
1. 核心本质与底层考点（1-2句概括）；
2. 面试张口即答的高分亮点；
3. 一句工业实战避坑提醒。
（请保持回答精炼，严控在200字以内，无需冗长铺垫）`;

    handleUserSend(promptText);
  };


  // HTML 字符转义工具
  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 轻量级 Markdown 语法解析器
  function formatMarkdown(text) {
    if (!text) return '';

    // 1. 抽取多行代码块
    const codeBlocks = [];
    let safeText = text.replace(/```([a-zA-Z0-9_\-\.]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push({ lang: lang || 'csharp', code: escapeHtml(code.trim()) });
      return `___AI_CODE_BLOCK_${idx}___`;
    });

    // 2. 转义常规文本中的 HTML 标签
    safeText = escapeHtml(safeText);

    // 3. 粗体支持 **text**
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 4. 单行行内代码 `code`
    safeText = safeText.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 5. 换行与段落
    safeText = safeText.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');

    // 6. 还原代码块
    codeBlocks.forEach((item, idx) => {
      const placeholder = `___AI_CODE_BLOCK_${idx}___`;
      const codeHtml = `
        <div class="ai-code-wrapper">
          <div class="ai-code-header">
            <span>${item.lang}</span>
            <button class="ai-copy-btn" onclick="copyCode(this)">复制</button>
          </div>
          <pre><code class="language-${item.lang}">${item.code}</code></pre>
        </div>
      `;
      safeText = safeText.replace(placeholder, codeHtml);
    });

    return safeText;
  }

  // 复制代码助手
  window.copyCode = function(btn) {
    try {
      const codeEl = btn.closest('.ai-code-wrapper').querySelector('code');
      if (codeEl) {
        navigator.clipboard.writeText(codeEl.innerText).then(() => {
          btn.innerText = '已复制!';
          setTimeout(() => btn.innerText = '复制', 1600);
        });
      }
    } catch (e) {
      btn.innerText = '复制失败';
    }
  };

  // 添加用户消息到聊天流
  function appendUserMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg ai-msg-user';
    msgDiv.innerHTML = `
      <div class="ai-bubble">${escapeHtml(text).replace(/\n/g, '<br/>')}</div>
      <div class="ai-avatar">👤</div>
    `;
    elAiChatStream.appendChild(msgDiv);
    elAiChatStream.scrollTop = elAiChatStream.scrollHeight;
  }

  // 添加机器人消息（支持流式逐步填充）
  function appendBotMessage(initText = '') {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg ai-msg-bot';
    msgDiv.innerHTML = `
      <div class="ai-avatar">🤖</div>
      <div class="ai-bubble">${initText}</div>
    `;
    elAiChatStream.appendChild(msgDiv);
    elAiChatStream.scrollTop = elAiChatStream.scrollHeight;
    return msgDiv.querySelector('.ai-bubble');
  }

  // 核心：调用 DeepSeek API 进行流式生成
  async function handleUserSend(textToSend) {
    const text = (textToSend || (elAiUserInput ? elAiUserInput.value : '')).trim();
    if (!text || isAiGenerating) return;

    // 清空输入框并重置高度
    if (elAiUserInput) elAiUserInput.value = '';

    // 检查 API Key
    const apiKey = localStorage.getItem(STORAGE_KEY_AI_KEY);
    if (!apiKey) {
      if (elAiConfigPanel) elAiConfigPanel.classList.add('open');
      appendBotMessage(`⚠️ <strong>尚未配置 DeepSeek API Key</strong><br>请在上方配置栏中填入您的 DeepSeek API Key（例如 <code>sk-xxxxxxxx</code>），然后点击“保存配置”。<br><small style="color:var(--text-muted)">Key 仅保存在您本地浏览器中，绝不上云。</small>`);
      return;
    }

    const endpoint = localStorage.getItem(STORAGE_KEY_AI_ENDPOINT) || 'https://api.deepseek.com/chat/completions';
    const model = localStorage.getItem(STORAGE_KEY_AI_MODEL) || 'deepseek-chat';

    // 1. 界面呈现用户消息
    appendUserMessage(text);
    chatHistory.push({ role: 'user', content: text });

    // 2. 准备机器人气泡与状态
    isAiGenerating = true;
    if (elAiSendBtn) elAiSendBtn.disabled = true;

    const botBubble = appendBotMessage('<span class="ai-typing-cursor"></span>');

    // 3. 构建发送给模型的完整上下文
    const messagesPayload = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...chatHistory.slice(-8) // 保留最近 8 轮对话上下文
    ];

    let fullAnswer = '';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messagesPayload,
          stream: true,
          temperature: 0.6
        })
      });

      if (!response.ok) {
        let errDetail = '';
        try {
          const errJson = await response.json();
          errDetail = errJson.error ? errJson.error.message : JSON.stringify(errJson);
        } catch (_) {
          errDetail = await response.text();
        }

        if (response.status === 401) {
          botBubble.innerHTML = `❌ <strong>API Key 认证失败 (401)</strong><br>请检查您的 API Key 是否正确。`;
          if (elAiConfigPanel) elAiConfigPanel.classList.add('open');
        } else {
          botBubble.innerHTML = `❌ <strong>请求出错 (${response.status})</strong>: ${escapeHtml(errDetail)}`;
        }
        isAiGenerating = false;
        if (elAiSendBtn) elAiSendBtn.disabled = false;
        return;
      }

      // 4. 流式读取响应数据
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留尚未结束的行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          if (trimmed === 'data: [DONE]') break;

          try {
            const data = JSON.parse(trimmed.slice(5).trim());
            const delta = data.choices && data.choices[0] && data.choices[0].delta;
            if (delta && delta.content) {
              fullAnswer += delta.content;
              // 实时更新渲染
              botBubble.innerHTML = formatMarkdown(fullAnswer) + '<span class="ai-typing-cursor"></span>';
              elAiChatStream.scrollTop = elAiChatStream.scrollHeight;
            }
          } catch (e) {
            // 忽略碎片 json 解析异常
          }
        }
      }

      // 生成完毕，移除光标
      botBubble.innerHTML = formatMarkdown(fullAnswer);
      chatHistory.push({ role: 'assistant', content: fullAnswer });

    } catch (err) {
      console.error('AI Error:', err);
      botBubble.innerHTML = `❌ <strong>连接失败</strong>: 无法连接至接口（${escapeHtml(err.message)}）。<br>提示：若官方端点被浏览器跨域阻断，可在配置面板中使用中转代理端点。`;
    } finally {
      isAiGenerating = false;
      if (elAiSendBtn) elAiSendBtn.disabled = false;
    }
  }

  // 发送按钮点击与回车键绑定
  if (elAiSendBtn) {
    elAiSendBtn.addEventListener('click', () => handleUserSend());
  }

  if (elAiUserInput) {
    elAiUserInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleUserSend();
      }
    });
  }

  // 加载配置
  loadAiConfig();

  // 16. 初始化运行
  updateDashboard();
  renderQuestions();
})();

