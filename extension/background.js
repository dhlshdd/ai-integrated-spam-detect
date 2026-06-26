// Change this to your public deployed server URL (e.g. on Render/Railway) in production:
const API_URL = 'https://ai-integrated-spam-detect.onrender.com/api.php';
// const API_URL = 'http://localhost:8000/api.php';
const tabData = {};
const sessionBypassWhitelist = new Set();

// Helper: Levenshtein distance
function levenshtein(a, b) {
    const tmp = [];
    const alen = a.length;
    const blen = b.length;
    if (alen === 0) return blen;
    if (blen === 0) return alen;
    for (let i = 0; i <= alen; i++) tmp[i] = [i];
    for (let j = 0; j <= blen; j++) tmp[0][j] = j;
    for (let i = 1; i <= alen; i++) {
        for (let j = 1; j <= blen; j++) {
            tmp[i][j] = Math.min(
                tmp[i - 1][j] + 1,
                tmp[i][j - 1] + 1,
                tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return tmp[alen][blen];
}

// Helper: Check local URL heuristics
function checkUrlHeuristics(url) {
    const domain = extractDomain(url);
    if (!domain) return null;

    const domainLower = domain.toLowerCase();
    
    // Ignore local development
    if (domainLower === 'localhost' || domainLower === '127.0.0.1' || domainLower.startsWith('192.168.')) {
        return null;
    }

    const popularBrands = ['paypal', 'google', 'facebook', 'microsoft', 'apple', 'amazon', 'netflix', 'chase', 'bankofamerica'];
    
    for (const brand of popularBrands) {
        // Brand spoof
        if (domainLower.includes(brand) && !new RegExp("(^|\\.)" + brand + "\\.(com|org|net)$").test(domainLower)) {
            return `Domain attempts to spoof the brand: ${brand.charAt(0).toUpperCase() + brand.slice(1)}`;
        }

        // Levenshtein typosquat
        const domainParts = domainLower.split('.');
        const mainDomain = domainParts.length >= 2 ? domainParts[domainParts.length - 2] : '';
        if (mainDomain && mainDomain !== brand) {
            const distance = levenshtein(mainDomain, brand);
            if (distance > 0 && distance <= 2 && mainDomain.length > 4) {
                return `Visual Clone Detected: Domain '${mainDomain}' is a typosquat of '${brand}'.`;
            }
        }
    }

    // IP address validation
    const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipv4Regex.test(domain)) {
        const isValidIp = domain.split('.').every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
        if (isValidIp) {
            return "URL uses an IP address instead of a domain name.";
        }
    }

    return null;
}

// Intercept navigations before page loading
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return; // Only main frame

    const url = details.url;
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
        return;
    }

    const domain = extractDomain(url);
    if (!domain) return;

    if (sessionBypassWhitelist.has(domain)) {
        return;
    }

    const alertReason = checkUrlHeuristics(url);
    if (alertReason) {
        const blockedUrl = chrome.runtime.getURL(`blocked.html?url=${encodeURIComponent(url)}&reason=${encodeURIComponent(alertReason)}`);
        chrome.tabs.update(details.tabId, { url: blockedUrl });
    }
});

// Helper: Extract domain from URL

// Helper: Extract domain from URL
function extractDomain(url) {
    try {
        return new URL(url).hostname;
    } catch(e) {
        return null;
    }
}

// Track visited domains in local storage to establish a baseline
function trackDomainVisit(domain) {
    if (!domain) return;
    chrome.storage.local.get(['domainHistory'], (result) => {
        let history = result.domainHistory || {};
        history[domain] = (history[domain] || 0) + 1;
        chrome.storage.local.set({ domainHistory: history });
    });
}

// Check if domain is an anomaly (never visited before or visited very rarely)
async function getAnomalyScore(domain) {
    if (!domain) return 0;
    
    return new Promise((resolve) => {
        chrome.storage.local.get(['domainHistory'], (result) => {
            let history = result.domainHistory || {};
            let visitCount = history[domain] || 0;
            
            // If visited less than 3 times, it's slightly anomalous.
            // If never visited, it's highly anomalous.
            if (visitCount === 0) resolve(20);
            else if (visitCount < 3) resolve(10);
            else resolve(0);
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyzePage') {
        const tabId = sender.tab.id;
        const domain = extractDomain(request.url);
        
        // Track the visit
        trackDomainVisit(domain);

        // Call the PHP API
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: request.url,
                text: request.text,
                forms: request.forms,
                hiddenInputs: request.hiddenInputs,
                crossOriginForms: request.crossOriginForms
            })
        })
        .then(response => response.json())
        .then(async (data) => {
            // Personal Anomaly Detection
            const anomalyScore = await getAnomalyScore(domain);
            
            if (anomalyScore > 0) {
                // Only penalize if the backend already found *some* risk, 
                // we don't want to flag every new site as dangerous.
                if (data.riskScore > 20 || data.typosquat) {
                    data.riskScore += anomalyScore;
                    data.warnings.push(`Anomaly Detection: You rarely or have never visited this domain before.`);
                }
            }

            // Cap score at 100
            data.riskScore = Math.min(100, data.riskScore);

            tabData[tabId] = data;
            sendResponse({ success: true, data: data });
            
            if (data.riskScore >= 60) {
                chrome.action.setBadgeText({ text: '!', tabId: tabId });
                chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId: tabId });
            } else if (data.riskScore >= 30) {
                chrome.action.setBadgeText({ text: '?', tabId: tabId });
                chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId: tabId });
            } else {
                chrome.action.setBadgeText({ text: '✓', tabId: tabId });
                chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tabId });
            }
        })
        .catch(error => {
            console.error("API Error:", error);
            sendResponse({ success: false, error: error.message });
        });
        
        return true; 
    }
    
    if (request.action === 'getTabData') {
        sendResponse({ data: tabData[request.tabId] });
    }

    if (request.action === 'sendFeedback') {
        // Relay feedback to backend to retrain Native PHP ML
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'train',
                text: request.text,
                label: request.label
            })
        }).then(() => {
            sendResponse({ success: true });
        }).catch(() => {
            sendResponse({ success: false });
        });
        return true;
    }

    if (request.action === 'bypassBlock') {
        const domain = extractDomain(request.url);
        if (domain) {
            sessionBypassWhitelist.add(domain);
            sendResponse({ success: true });
        }
        return true;
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabData[tabId];
});
