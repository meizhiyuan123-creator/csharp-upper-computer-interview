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

  // 15. 初始化运行
  updateDashboard();
  renderQuestions();
})();
