// Popup JavaScript - Download Prefixer
console.log('🎯 Popup script loaded');

// DOM Elements - tanımlar DOMContentLoaded içinde yapılacak
let pageList, pageAdd;
let rulesList, addPrefixBtn, exportRulesBtn, importRulesBtn, importFileInput, statusMessage;
let backBtn, domainInput, matchTypeSelect, fileExtensionInput, prefixInput, saveRuleBtn, cancelBtn;

// Sayfa yüklendiğinde çalışır
document.addEventListener('DOMContentLoaded', function () {
  console.log('🚀 Popup DOM loaded');

  // DOM Elements - Pages
  pageList = document.getElementById('pageList');
  pageAdd = document.getElementById('pageAdd');

  // DOM Elements - List Page
  rulesList = document.getElementById('rulesList');
  addPrefixBtn = document.getElementById('addPrefixBtn');
  exportRulesBtn = document.getElementById('exportRulesBtn');
  importRulesBtn = document.getElementById('importRulesBtn');
  importFileInput = document.getElementById('importFileInput');
  statusMessage = document.getElementById('statusMessage');

  // DOM Elements - Add Page
  backBtn = document.getElementById('backBtn');
  domainInput = document.getElementById('domainInput');
  matchTypeSelect = document.getElementById('matchTypeSelect');
  fileExtensionInput = document.getElementById('fileExtensionInput');
  prefixInput = document.getElementById('prefixInput');
  saveRuleBtn = document.getElementById('saveRuleBtn');
  cancelBtn = document.getElementById('cancelBtn');

  loadRules();
  setupEventListeners();
});

// Event listeners kurulumu
function setupEventListeners() {
  // List page events
  if (addPrefixBtn) addPrefixBtn.addEventListener('click', showAddPage);
  if (exportRulesBtn) exportRulesBtn.addEventListener('click', exportRules);
  if (importRulesBtn) importRulesBtn.addEventListener('click', triggerImport);
  if (importFileInput) importFileInput.addEventListener('change', handleFileImport);

  // Add page events
  if (backBtn) backBtn.addEventListener('click', showListPage);
  if (cancelBtn) cancelBtn.addEventListener('click', showListPage);
  if (saveRuleBtn) saveRuleBtn.addEventListener('click', addNewRule);

  // Enter tuşu ile kural ekleme
  if (prefixInput) {
    prefixInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') addNewRule();
    });
  }

  // Dinamik etiketlere tıklama olayı
  const helperTags = document.querySelectorAll('.helper-tag');
  helperTags.forEach(tag => {
    tag.addEventListener('click', function () {
      insertTagIntoPrefixInput(this.textContent);
    });
  });
}

// Sayfa Geçişleri
async function showAddPage() {
  // Aktif sekmenin URL'sini al
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      domainInput.value = url.hostname;
    }
  } catch (error) {
    console.error('Error getting active tab:', error);
    domainInput.value = '';
  }

  // Sayfayı değiştir
  pageList.classList.remove('active');
  pageAdd.classList.add('active');

  // Form alanlarını sıfırla
  if (matchTypeSelect) matchTypeSelect.value = 'subdomain';
  if (fileExtensionInput) fileExtensionInput.value = '';
  prefixInput.value = '';
  prefixInput.focus();
}

function showListPage() {
  pageAdd.classList.remove('active');
  pageList.classList.add('active');

  // Formu temizle
  domainInput.value = '';
  if (fileExtensionInput) fileExtensionInput.value = '';
  prefixInput.value = '';
}

// Kuralları yükle ve görüntüle
async function loadRules() {
  try {
    const result = await chrome.storage.local.get(['urlPrefixRules']);
    let rules = result.urlPrefixRules || {};

    // Otomatik Veri Migrasyonu
    let migrated = false;
    const migratedRules = {};
    for (const [key, val] of Object.entries(rules)) {
      if (!key.startsWith('rule_')) {
        // Eski kural (anahtar alan adı idi)
        const ruleId = 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        if (typeof val === 'object' && val !== null) {
          migratedRules[ruleId] = {
            domain: key,
            prefix: val.prefix || '',
            matchType: val.matchType || 'subdomain',
            fileExtension: val.fileExtension || '*'
          };
        } else {
          migratedRules[ruleId] = {
            domain: key,
            prefix: val,
            matchType: 'subdomain',
            fileExtension: '*'
          };
        }
        migrated = true;
      } else {
        migratedRules[key] = val;
      }
    }

    if (migrated) {
      rules = migratedRules;
      await chrome.storage.local.set({ urlPrefixRules: rules });
      console.log('🔄 Rules auto-migrated successfully in popup:', rules);
    }

    console.log('📋 Loading rules:', rules);
    displayRules(rules);
  } catch (error) {
    console.error('❌ Error loading rules:', error);
    showStatus('Kurallar yüklenirken hata oluştu', 'error');
  }
}

// Kuralları görüntüle
function displayRules(rules) {
  rulesList.innerHTML = '';

  if (Object.keys(rules).length === 0) {
    rulesList.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <p>Henüz prefix eklenmemiş</p>
      </div>
    `;
    return;
  }

  Object.entries(rules).forEach(([ruleId, ruleVal]) => {
    const ruleElement = createRuleElement(ruleId, ruleVal);
    rulesList.appendChild(ruleElement);
  });
}

// Kural elementi oluştur
function createRuleElement(ruleId, ruleVal) {
  const ruleDiv = document.createElement('div');
  ruleDiv.className = 'rule-item';

  let domain = '';
  let prefix = '';
  let matchType = 'subdomain';
  let fileExtension = '*';

  if (typeof ruleVal === 'object' && ruleVal !== null) {
    domain = ruleVal.domain || '';
    prefix = ruleVal.prefix || '';
    matchType = ruleVal.matchType || 'subdomain';
    fileExtension = ruleVal.fileExtension || '*';
  } else {
    domain = ruleId;
    prefix = ruleVal;
  }

  const matchTypeLabels = {
    'subdomain': 'Alt Alan',
    'exact': 'Tam',
    'wildcard': 'Joker'
  };
  const matchLabel = matchTypeLabels[matchType] || 'Alt Alan';
  
  const extLabel = (!fileExtension || fileExtension === '*') ? 'Tümü' : fileExtension;

  ruleDiv.innerHTML = `
    <div class="rule-info">
      <div class="rule-header">
        <span class="rule-domain" title="${escapeHtml(domain)}">${escapeHtml(domain)}</span>
        <span class="rule-match-badge" title="Eşleşme Tipi: ${matchType}">${escapeHtml(matchLabel)}</span>
        <span class="rule-ext-badge" title="Dosya Uzantıları: ${escapeHtml(extLabel)}">${escapeHtml(extLabel)}</span>
      </div>
      <div class="rule-prefix" title="${escapeHtml(prefix)}">${escapeHtml(prefix)}</div>
    </div>
    <div class="rule-actions">
      <button class="btn-small btn-delete" data-id="${escapeHtml(ruleId)}" title="Kuralı Sil">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `;

  const deleteBtn = ruleDiv.querySelector('.btn-delete');
  deleteBtn.addEventListener('click', function () {
    const idToDelete = this.getAttribute('data-id');
    deleteRule(idToDelete);
  });

  return ruleDiv;
}

// Yeni kural ekle
async function addNewRule() {
  const domain = domainInput.value.trim();
  const prefix = prefixInput.value.trim();
  const matchType = matchTypeSelect ? matchTypeSelect.value : 'subdomain';
  
  let fileExtension = fileExtensionInput ? fileExtensionInput.value.trim() : '';
  if (fileExtension) {
    // Başındaki noktaları kaldır, temizle ve küçük harfe çevir
    fileExtension = fileExtension.split(',')
      .map(ext => ext.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean)
      .join(', ');
  }
  if (!fileExtension) {
    fileExtension = '*';
  }

  if (!domain || !prefix) {
    showStatus('Domain ve prefix alanları doldurulmalıdır', 'error');
    return;
  }

  if (!isValidDomain(domain)) {
    showStatus('Geçerli bir domain veya maske giriniz', 'error');
    return;
  }

  try {
    const result = await chrome.storage.local.get(['urlPrefixRules']);
    const rules = result.urlPrefixRules || {};

    const ruleId = 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    rules[ruleId] = {
      domain: domain,
      prefix: prefix,
      matchType: matchType,
      fileExtension: fileExtension
    };

    await chrome.storage.local.set({ urlPrefixRules: rules });

    console.log('✅ Rule added:', domain, '->', prefix, '(', matchType, ', ext:', fileExtension, ')');

    // Ana sayfaya dön
    showListPage();

    // Kuralları yeniden yükle
    loadRules();

    showStatus(`Prefix eklendi: ${domain} → ${prefix}`, 'success');

  } catch (error) {
    console.error('❌ Error adding rule:', error);
    showStatus('Prefix eklenirken hata oluştu', 'error');
  }
}

// Kural sil
async function deleteRule(ruleId) {
  try {
    const result = await chrome.storage.local.get(['urlPrefixRules']);
    const rules = result.urlPrefixRules || {};
    const rule = rules[ruleId];

    if (!rule) {
      showStatus('Kural bulunamadı', 'error');
      return;
    }

    const domain = typeof rule === 'object' ? (rule.domain || 'Bilinmeyen') : ruleId;
    if (!confirm(`"${domain}" için tanımlanan bu prefix kuralını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    delete rules[ruleId];

    await chrome.storage.local.set({ urlPrefixRules: rules });

    console.log('🗑️ Rule deleted:', ruleId);
    showStatus(`Prefix silindi: ${domain}`, 'info');

    loadRules();

  } catch (error) {
    console.error('❌ Error deleting rule:', error);
    showStatus('Prefix silinirken hata oluştu', 'error');
  }
}

// HTML escape fonksiyonu
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Kuralları dışa aktar
async function exportRules() {
  try {
    const result = await chrome.storage.local.get(['urlPrefixRules']);
    const rules = result.urlPrefixRules || {};

    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.3',
      rules: rules
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `download-prefixer-rules-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);

    console.log('📤 Rules exported');
    showStatus('Kurallar dışa aktarıldı', 'success');

  } catch (error) {
    console.error('❌ Error exporting rules:', error);
    showStatus('Kurallar dışa aktarılırken hata oluştu', 'error');
  }
}

// Dosya seçme dialogunu tetikle
function triggerImport() {
  importFileInput.click();
}

// Dosya içe aktarma işlemi
async function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
    showStatus('Lütfen JSON formatında bir dosya seçin', 'error');
    return;
  }

  try {
    const fileContent = await readFile(file);
    const importData = JSON.parse(fileContent);

    if (!importData.rules || typeof importData.rules !== 'object') {
      showStatus('Geçersiz dosya formatı', 'error');
      return;
    }

    const rules = importData.rules;
    const validRules = {};
    let validCount = 0;
    let invalidCount = 0;

    for (const [key, val] of Object.entries(rules)) {
      let domain = '';
      let prefix = '';
      let matchType = 'subdomain';
      let fileExtension = '*';

      if (key.startsWith('rule_')) {
        // ID-based kural
        if (typeof val === 'object' && val !== null && typeof val.domain === 'string' && val.domain.trim() && typeof val.prefix === 'string' && val.prefix.trim()) {
          domain = val.domain.trim();
          prefix = val.prefix.trim();
          matchType = val.matchType || 'subdomain';
          fileExtension = val.fileExtension || '*';
        } else {
          invalidCount++;
          continue;
        }
      } else {
        // Eski kural (anahtar alan adı idi)
        if (typeof key === 'string' && key.trim()) {
          domain = key.trim();
          if (typeof val === 'string' && val.trim()) {
            prefix = val.trim();
          } else if (typeof val === 'object' && val !== null && typeof val.prefix === 'string' && val.prefix.trim()) {
            prefix = val.prefix.trim();
            matchType = val.matchType || 'subdomain';
            fileExtension = val.fileExtension || '*';
          } else {
            invalidCount++;
            continue;
          }
        } else {
          invalidCount++;
          continue;
        }
      }

      if (domain && prefix && isValidDomain(domain)) {
        // ID koru veya yeni oluştur
        const ruleId = key.startsWith('rule_') ? key : ('rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
        validRules[ruleId] = {
          domain: domain,
          prefix: prefix,
          matchType: matchType,
          fileExtension: fileExtension
        };
        validCount++;
      } else {
        invalidCount++;
      }
    }

    if (validCount === 0) {
      showStatus('Dosyada geçerli prefix bulunamadı', 'error');
      return;
    }

    const confirmMessage = `${validCount} prefix içe aktarılacak. Devam?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    await chrome.storage.local.set({ urlPrefixRules: validRules });

    console.log('📥 Rules imported:', validRules);
    showStatus(`${validCount} prefix içe aktarıldı`, 'success');

    loadRules();
    importFileInput.value = '';

  } catch (error) {
    console.error('❌ Error importing rules:', error);
    showStatus('Dosya içe aktarılırken hata oluştu', 'error');
    importFileInput.value = '';
  }
}

// Dosyayı oku
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

// Domain formatını kontrol et
function isValidDomain(domain) {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
  return domainRegex.test(domain) || domain.includes('.') || domain.includes('*');
}

// Status mesajı göster
function showStatus(message, type = 'info') {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type} show`;

  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, 3000);
}

// Girdi alanına seçili etiket şablonunu imleç konumuna ekler
function insertTagIntoPrefixInput(tagText) {
  if (!prefixInput) return;
  
  const startPos = prefixInput.selectionStart;
  const endPos = prefixInput.selectionEnd;
  const currentValue = prefixInput.value;
  
  // Metni imleç yerine yerleştir
  prefixInput.value = currentValue.substring(0, startPos) + tagText + currentValue.substring(endPos);
  
  // İmleci eklenen etiketin hemen sonrasına konumlandır ve odaklan
  const newCursorPos = startPos + tagText.length;
  prefixInput.selectionStart = newCursorPos;
  prefixInput.selectionEnd = newCursorPos;
  prefixInput.focus();
}

console.log('✅ Popup script initialized');