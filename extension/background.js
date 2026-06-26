// Change this to your public deployed server URL (e.g. on Render/Railway) in production:
const API_URL = 'https://ai-integrated-spam-detect.onrender.com/api.php';
// const API_URL = 'http://localhost:8000/api.php';
const tabData = {};

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
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabData[tabId];
});
