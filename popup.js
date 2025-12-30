// Popup JavaScript - Download Prefixer
console.log('🎯 Popup script loaded');

// DOM Elements - tanımlar DOMContentLoaded içinde yapılacak
let pageList, pageAdd;
let rulesList, addPrefixBtn, exportRulesBtn, importRulesBtn, importFileInput, statusMessage;
let backBtn, domainInput, prefixInput, saveRuleBtn, cancelBtn;

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

  // Prefix input'a fokusla
  prefixInput.value = '';
  prefixInput.focus();
}

function showListPage() {
  pageAdd.classList.remove('active');
  pageList.classList.add('active');

  // Formu temizle
  domainInput.value = '';
  prefixInput.value = '';
}

// Kuralları yükle ve görüntüle
async function loadRules() {
  try {
    const result = await chrome.storage.local.get(['urlPrefixRules']);
    const rules = result.urlPrefixRules || {};

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

  Object.entries(rules).forEach(([domain, prefix]) => {
    const ruleElement = createRuleElement(domain, prefix);
    rulesList.appendChild(ruleElement);
  });
}

// Kural elementi oluştur
function createRuleElement(domain, prefix) {
  const ruleDiv = document.createElement('div');
  ruleDiv.className = 'rule-item';

  ruleDiv.innerHTML = `
    <div class="rule-info">
      <div class="rule-domain">${escapeHtml(domain)}</div>
      <div class="rule-prefix">${escapeHtml(prefix)}</div>
    </div>
    <div class="rule-actions">
      <button class="btn-small btn-delete" data-domain="${escapeHtml(domain)}">Sil</button>
    </div>
  `;

  const deleteBtn = ruleDiv.querySelector('.btn-delete');
  deleteBtn.addEventListener('click', function () {
    const domainToDelete = this.getAttribute('data-domain');
    deleteRule(domainToDelete);
  });

  return ruleDiv;
}

// Yeni kural ekle
async function addNewRule() {
  const domain = domainInput.value.trim();
  const prefix = prefixInput.value.trim();

  if (!domain || !prefix) {
    showStatus('Domain ve prefix alanları doldurulmalıdır', 'error');
    return;
  }

  if (!isValidDomain(domain)) {
    showStatus('Geçerli bir domain giriniz', 'error');
    return;
  }

  try {
    const result = await chrome.storage.local.get(['urlPrefixRules']);
    const rules = result.urlPrefixRules || {};

    rules[domain] = prefix;

    await chrome.storage.local.set({ urlPrefixRules: rules });

    chrome.runtime.sendMessage({
      action: 'updateRules',
      rules: rules
    });

    console.log('✅ Rule added:', domain, '->', prefix);

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
async function deleteRule(domain) {
  if (!confirm(`"${domain}" prefixini silmek istediğinizden emin misiniz?`)) {
    return;
  }

  try {
    const result = await chrome.storage.local.get(['urlPrefixRules']);
    const rules = result.urlPrefixRules || {};

    delete rules[domain];

    await chrome.storage.local.set({ urlPrefixRules: rules });

    chrome.runtime.sendMessage({
      action: 'updateRules',
      rules: rules
    });

    console.log('🗑️ Rule deleted:', domain);
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

    for (const [domain, prefix] of Object.entries(rules)) {
      if (typeof domain === 'string' && typeof prefix === 'string' &&
        domain.trim() && prefix.trim() && isValidDomain(domain.trim())) {
        validRules[domain.trim()] = prefix.trim();
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

    chrome.runtime.sendMessage({
      action: 'updateRules',
      rules: validRules
    });

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
  return domainRegex.test(domain) || domain.includes('.');
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

console.log('✅ Popup script initialized');