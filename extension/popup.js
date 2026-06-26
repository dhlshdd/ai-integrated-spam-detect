document.addEventListener('DOMContentLoaded', () => {
    // Get current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (!currentTab) return;

        // Ask background script for data for this tab
        chrome.runtime.sendMessage({ action: 'getTabData', tabId: currentTab.id }, (response) => {
            if (response && response.data) {
                updateUI(response.data);
            } else {
                document.getElementById('warningsList').innerHTML = '<li class="safe-item">No active analysis. Page might be internal or not loaded yet.</li>';
                document.getElementById('statusBadge').innerText = 'Idle';
            }
        });
    });

    document.getElementById('btnSafe').addEventListener('click', () => submitFeedback('safe'));
    document.getElementById('btnScam').addEventListener('click', () => submitFeedback('scam'));
});

function updateUI(data) {
    const scoreText = document.getElementById('scoreText');
    const scoreCircle = document.getElementById('scoreCircle');
    const statusBadge = document.getElementById('statusBadge');
    const warningsList = document.getElementById('warningsList');
    const feedbackSection = document.getElementById('feedbackSection');

    // Update Score
    scoreText.textContent = data.riskScore;
    scoreCircle.setAttribute('stroke-dasharray', `${data.riskScore}, 100`);

    // Determine Status Colors
    let color = '#10b981'; // Green
    let statusText = 'Safe';
    let badgeClass = 'safe';
    let listItemClass = 'safe-item';

    if (data.riskScore >= 60) {
        color = '#ef4444'; // Red
        statusText = 'High Risk';
        badgeClass = 'danger';
        listItemClass = 'danger-item';
    } else if (data.riskScore >= 30) {
        color = '#f59e0b'; // Yellow
        statusText = 'Suspicious';
        badgeClass = 'warning';
        listItemClass = 'warning-item';
    }

    scoreCircle.setAttribute('stroke', color);
    
    statusBadge.textContent = statusText;
    statusBadge.className = `status-badge ${badgeClass}`;

    // Update Warnings List
    warningsList.innerHTML = '';
    if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach(warning => {
            const li = document.createElement('li');
            li.className = listItemClass;
            li.textContent = warning;
            warningsList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.className = 'safe-item';
        li.textContent = 'No suspicious indicators detected.';
        warningsList.appendChild(li);
    }

    // Show feedback section
    feedbackSection.style.display = 'block';
}

function submitFeedback(type) {
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => btn.disabled = true);
    
    // Get the page text to send back for training
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        
        // We need the page text to train the model. We can execute a quick script to grab it.
        chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            func: () => document.body.innerText.substring(0, 5000)
        }, (results) => {
            let pageText = "";
            if (results && results[0] && results[0].result) {
                pageText = results[0].result;
            }

            // Send to background to relay to PHP
            chrome.runtime.sendMessage({
                action: 'sendFeedback',
                text: pageText,
                label: type === 'safe' ? 'ham' : 'spam'
            });

            document.getElementById('feedbackSection').innerHTML = '<p style="text-align:center;color:var(--success);font-size:13px;margin:0;">Thanks! The AI is learning from your feedback.</p>';
        });
    });
}
