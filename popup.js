console.log('Popup script loaded');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    const toggleExtension = document.getElementById('toggleExtension');
    const toggleText = document.getElementById('toggleText');
    const voiceSelect = document.getElementById('voiceSelect');
    const status = document.getElementById('status');
    const youtubeMessage = document.getElementById('youtubeMessage');
    const extensionControls = document.getElementById('extensionControls');

    // Check if we're on a YouTube page
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].url.includes('youtube.com')) {
            // We're on a YouTube page
            extensionControls.style.display = 'block';
            youtubeMessage.style.display = 'none';
            initializeExtension();
        } else {
            // We're not on a YouTube page
            extensionControls.style.display = 'none';
            youtubeMessage.style.display = 'block';
        }
    });

    function initializeExtension() {
        // Load saved voice selection and extension state
        chrome.storage.sync.get(['selectedVoice', 'extensionEnabled'], function(data) {
            if (data.selectedVoice) {
                voiceSelect.value = data.selectedVoice;
            }
            if (data.extensionEnabled) {
                toggleExtension.checked = true;
                toggleText.textContent = 'Enabled Alt Audio!';
                toggleText.classList.add('enabled');
            }
        });

        // Save voice selection when changed
        voiceSelect.addEventListener('change', function() {
            chrome.storage.sync.set({selectedVoice: voiceSelect.value});
        });

        toggleExtension.addEventListener('change', function() {
            const action = this.checked ? 'activate' : 'deactivate';
            
            if (this.checked) {
                toggleText.textContent = 'Enabling...';
                toggleText.classList.add('enabling');
                toggleText.classList.remove('enabled');
            } else {
                toggleText.textContent = 'Enable Alternative Audio';
                toggleText.classList.remove('enabling', 'enabled');
            }

            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: action,
                        selectedVoice: voiceSelect.value
                    }, function(response) {
                        if (chrome.runtime.lastError) {
                            status.textContent = 'Error: ' + chrome.runtime.lastError.message;
                            toggleExtension.checked = false;
                            toggleText.textContent = 'Enable Alternative Audio';
                            toggleText.classList.remove('enabling', 'enabled');
                        } else if (response && response.success) {
                            status.textContent = 'Success!';
                            if (action === 'activate') {
                                toggleText.textContent = 'Enabled Alt Audio!';
                                toggleText.classList.remove('enabling');
                                toggleText.classList.add('enabled');
                            }
                            chrome.storage.sync.set({extensionEnabled: toggleExtension.checked});
                        } else {
                            status.textContent = 'Failed to ' + action;
                            toggleExtension.checked = false;
                            toggleText.textContent = 'Enable Alternative Audio';
                            toggleText.classList.remove('enabling', 'enabled');
                        }
                    });
                } else {
                    status.textContent = 'No active tab found';
                }
            });
        });
    }
});
