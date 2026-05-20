// Download tracker for file renaming automation
console.log('🚀 Download File Renamer Extension Started!');

// Konfigürasyon
const CONFIG = {
  createTrackingFile: false, // JSON dosyası oluşturulsun mu?
  keepTrackingData: true,    // Storage'da tracking verisi tutulsun mu?
  maxRecords: 50            // Maksimum kayıt sayısı
};

console.log('⚙️ Configuration:', CONFIG);

// Dinamik prefix etiketlerini (placeholders) çözümle
function parsePrefixTemplate(template, domain) {
  const now = new Date();
  
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${year}-${month}-${day}`;
  
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const time = `${hours}-${minutes}-${seconds}`;
  
  const timestamp = String(now.getTime());
  
  return template
    .replace(/{date}/g, date)
    .replace(/{time}/g, time)
    .replace(/{domain}/g, domain)
    .replace(/{year}/g, year)
    .replace(/{month}/g, month)
    .replace(/{day}/g, day)
    .replace(/{timestamp}/g, timestamp);
}

// Dosyanın uzantısını alan yardımcı fonksiyon
function getFileExtension(filename) {
  if (!filename) return '';
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return filename.substring(dotIndex + 1).toLowerCase().trim();
}

// Dosya uzantısının kuralla eşleşip eşleşmediğini kontrol eden yardımcı fonksiyon
function matchExtension(filename, ruleExt) {
  if (!ruleExt || ruleExt.trim() === '*' || ruleExt.trim() === '') {
    return true;
  }
  const fileExt = getFileExtension(filename);
  if (!fileExt) return false;

  const allowedExts = ruleExt.split(',').map(e => e.trim().toLowerCase());
  return allowedExts.includes(fileExt);
}

// Kural eşleşmesini kontrol eden yardımcı fonksiyon
function matchRule(domain, filename, ruleKey, ruleVal) {
  let ruleDomain = '';
  let prefix = '';
  let matchType = 'subdomain';
  let fileExtension = '*';

  if (typeof ruleVal === 'object' && ruleVal !== null) {
    // Yeni nesne formatı (ID-tabanlı kural veya yeni eşleşme kuralı)
    if (ruleKey.startsWith('rule_')) {
      ruleDomain = ruleVal.domain || '';
      prefix = ruleVal.prefix || '';
      matchType = ruleVal.matchType || 'subdomain';
      fileExtension = ruleVal.fileExtension || '*';
    } else {
      // Eski geçiş aşamasındaki nesne formatı (anahtar domain idi)
      ruleDomain = ruleKey;
      prefix = ruleVal.prefix || '';
      matchType = ruleVal.matchType || 'subdomain';
      fileExtension = ruleVal.fileExtension || '*';
    }
  } else {
    // Eski düz metin formatı (anahtar domain, değer prefix)
    ruleDomain = ruleKey;
    prefix = ruleVal;
  }

  if (!ruleDomain) return { isMatch: false, prefix: '' };

  const host = domain.toLowerCase();
  const rule = ruleDomain.toLowerCase();

  let isDomainMatch = false;
  if (matchType === 'exact') {
    isDomainMatch = (host === rule);
  } else if (matchType === 'subdomain') {
    isDomainMatch = (host === rule || host.endsWith('.' + rule));
  } else if (matchType === 'wildcard') {
    // Özel regex karakterlerini kaçır, * karakterlerini ise .* Regex'e dönüştür
    const escapedRule = ruleDomain.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp('^' + escapedRule + '$', 'i');
    isDomainMatch = regex.test(domain);
  }

  if (!isDomainMatch) {
    return { isMatch: false, prefix: '' };
  }

  // Alan adı eşleşti, şimdi dosya uzantısını kontrol et
  const isExtMatch = matchExtension(filename, fileExtension);

  return { isMatch: isExtMatch, prefix };
}

// İndirme dosya adı belirleme - EN ÖNEMLİ KISIM!
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  console.log('🎯 Determining filename for:', downloadItem.url);
  
  async function processDownload() {
    try {
      // Storage'dan kuralları yükle
      const result = await chrome.storage.local.get(['urlPrefixRules']);
      const rules = result.urlPrefixRules || {};
      
      // URL'den domain'i çıkar
      const url = new URL(downloadItem.url);
      const domain = url.hostname;
      console.log('🏠 Domain extracted:', domain);
      
      // Prefix'i belirle
      let prefix = '';
      for (const [ruleId, ruleVal] of Object.entries(rules)) {
        const { isMatch, prefix: matchedPrefix } = matchRule(domain, downloadItem.filename, ruleId, ruleVal);
        if (isMatch) {
          prefix = matchedPrefix;
          console.log('✅ Prefix template found:', prefix, 'for domain:', domain, 'via rule:', ruleId);
          break;
        }
      }
      
      if (prefix && downloadItem.filename) {
        // Dinamik etiketleri çözümle
        const parsedPrefix = parsePrefixTemplate(prefix, domain);
        
        // Dosya adının başına prefix ekle
        const originalFilename = downloadItem.filename;
        const newFilename = parsedPrefix + originalFilename;
        
        console.log('📝 Original filename:', originalFilename);
        console.log('🔄 New filename:', newFilename);
        
        // Yeni dosya adını öner
        suggest({filename: newFilename});
        console.log('✅ Filename changed successfully!');
        
        // Tracking için kaydet (isteğe bağlı)
        if (CONFIG.keepTrackingData) {
          await saveTrackingData({
            downloadId: downloadItem.id,
            originalFilename: originalFilename,
            newFilename: newFilename,
            url: downloadItem.url,
            domain: domain,
            prefix: parsedPrefix,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log('❌ No prefix rule found for domain:', domain);
        suggest(); // Dosya adını değiştirme
      }
    } catch (error) {
      console.error('❌ Error determining filename:', error);
      suggest(); // Hata durumunda dosya adını değiştirme
    }
  }
  
  processDownload();
  return true; // Asenkron suggest çağrısı için
});

// İndirme başladığında çalışır (bilgi amaçlı)
chrome.downloads.onCreated.addListener((downloadItem) => {
  console.log('📥 Download started:', downloadItem.url);
});

// İndirme tamamlandığında çalışır
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    console.log('✅ Download completed:', downloadDelta.id);
  }
});

// Tracking verilerini kaydet
async function saveTrackingData(data) {
  console.log('💾 Saving tracking data:', data);
  try {
    const result = await chrome.storage.local.get(['downloadTrackingData']);
    let existingData = result.downloadTrackingData || [];
    existingData.push(data);
    
    // Son N kaydı tut (performans için)
    if (existingData.length > CONFIG.maxRecords) {
      existingData = existingData.slice(-CONFIG.maxRecords);
    }
    
    await chrome.storage.local.set({downloadTrackingData: existingData});
    console.log('✅ Tracking data saved to storage');
    console.log('📊 Total tracking records:', existingData.length);
    
    // JSON dosyasını oluştur (sadece istenirse)
    if (CONFIG.createTrackingFile) {
      await createTrackingFile(existingData);
    } else {
      console.log('📋 JSON file creation disabled');
    }
  } catch (error) {
    console.error('❌ Error saving tracking data:', error);
  }
}

// Tracking dosyasını oluştur (Service Worker uyumlu)
async function createTrackingFile(data) {
  console.log('💾 Creating tracking file...');
  try {
    const jsonContent = JSON.stringify(data, null, 2);
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonContent);
    
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: 'download_tracker.json',
      conflictAction: 'overwrite',
      saveAs: false
    });
    console.log('✅ Tracking file created:', downloadId);
  } catch (error) {
    console.error('❌ Failed to create tracking file:', error);
  }
}

// Extension kurulduğunda veya güncellendiğinde çalışır
chrome.runtime.onInstalled.addListener(async () => {
  console.log('🎉 Download File Renamer Extension installed / updated');
  try {
    const result = await chrome.storage.local.get(['urlPrefixRules']);
    if (!result.urlPrefixRules) {
      await chrome.storage.local.set({
        urlPrefixRules: {},
        config: CONFIG,
        extensionVersion: '1.4.0'
      });
      console.log('⚙️ Initial configuration saved with empty rules');
    } else {
      console.log('⚙️ Rules exist, checking if migration needed...');
      let rules = result.urlPrefixRules || {};
      let migrated = false;
      const migratedRules = {};
      for (const [key, val] of Object.entries(rules)) {
        if (!key.startsWith('rule_')) {
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
        await chrome.storage.local.set({ urlPrefixRules: migratedRules });
        console.log('⚙️ Storage auto-migrated successfully in background:', migratedRules);
      } else {
        console.log('⚙️ Rules already in latest format, no migration needed');
      }
    }
  } catch (error) {
    console.error('❌ Error during installation:', error);
  }
});

console.log('🔄 Background script loaded and ready!');