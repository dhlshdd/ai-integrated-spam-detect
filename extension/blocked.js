document.addEventListener('DOMContentLoaded', () => {
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search);
    const blockedUrl = params.get('url') || 'Unknown URL';
    const reason = params.get('reason') || 'Suspicious indicators detected.';

    // Populate DOM elements
    document.getElementById('blockedUrl').textContent = blockedUrl;
    document.getElementById('blockedReason').textContent = reason;

    // Advanced Option toggle
    const toggleAdvanced = document.getElementById('toggleAdvanced');
    const advancedContent = document.getElementById('advancedContent');

    toggleAdvanced.addEventListener('click', (e) => {
        e.preventDefault();
        if (advancedContent.style.display === 'none') {
            advancedContent.style.display = 'block';
            toggleAdvanced.textContent = 'Hide Advanced Options';
        } else {
            advancedContent.style.display = 'none';
            toggleAdvanced.textContent = 'Advanced Options';
        }
    });

    // Go Back action
    document.getElementById('goBackBtn').addEventListener('click', () => {
        if (document.referrer) {
            history.back();
        } else {
            // Fallback if there's no back history
            window.location.href = 'https://www.google.com';
        }
    });

    // Proceed (bypass) action
    document.getElementById('proceedBtn').addEventListener('click', () => {
        // Send a message to background script to temporarily whitelist this domain
        chrome.runtime.sendMessage({
            action: 'bypassBlock',
            url: blockedUrl
        }, (response) => {
            if (response && response.success) {
                // Navigate back to the original URL (now whitelisted)
                window.location.href = blockedUrl;
            } else {
                alert("Failed to whitelist the domain. Please try going back to safety.");
            }
        });
    });
});
