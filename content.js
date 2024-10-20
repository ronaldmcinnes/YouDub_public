(function() {
    let isActive = false;
    let synthesizedAudio = null;
    let selectedVoice = 'default';

    console.log('YouDub content script loaded');

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log('Message received in content script:', request);
        if (request.action === 'activate') {
            console.log('Activating YouDube');
            selectedVoice = request.selectedVoice;
            startAlternativeAudio()
                .then(() => {
                    console.log('Alternative audio started successfully');
                    sendResponse({success: true, message: 'Activated successfully'});
                })
                .catch(error => {
                    console.error('Error in startAlternativeAudio:', error);
                    sendResponse({success: false, message: error.message});
                });
            return true; // Keeps the message channel open for asynchronous response
        } else if (request.action === 'deactivate') {
            isActive = false;
            console.log('Deactivating YouDube');
            stopAlternativeAudio();
            sendResponse({success: true, message: 'Deactivated'});
        } else {
            sendResponse({success: false, message: 'Unknown action'});
        }
    });

    async function startAlternativeAudio() {
        console.log('Starting alternative audio process');
        try {
            const transcript = await getTranscript();
            if (!transcript) {
                throw new Error('No transcript available. The video might not have captions.');
            }
            console.log('Transcript obtained:', transcript.substring(0, 100) + '...');

            const dataUrl = await getSynthesizedAudio(transcript);
            console.log('Synthesized audio obtained');

            // Create audio element
            synthesizedAudio = new Audio(dataUrl);

            const video = document.querySelector('video');
            if (!video) {
                throw new Error('No video element found.');
            }

            // Mute the video
            video.muted = true;

            // Sync playback
            video.addEventListener('play', onVideoPlay);
            video.addEventListener('pause', onVideoPause);
            video.addEventListener('seeked', onVideoSeeked);

            console.log('Alternative audio setup complete');
            // Notify the popup that the process is complete
            chrome.runtime.sendMessage({ action: 'process_complete' });
        } catch (error) {
            console.error('Error in startAlternativeAudio:', error);
            // Unmute the video in case of error
            const video = document.querySelector('video');
            if (video) {
                video.muted = false;
            }
            // Notify the popup that an error occurred
            chrome.runtime.sendMessage({ action: 'process_error', error: error.message });
        }
    }

    function stopAlternativeAudio() {
        const video = document.querySelector('video');
  
        // Unmute the video
        video.muted = false;
  
        if (synthesizedAudio) {
            synthesizedAudio.pause();
            synthesizedAudio.currentTime = 0;
            synthesizedAudio = null;
        }
  
        // Remove event listeners
        video.removeEventListener('play', onVideoPlay);
        video.removeEventListener('pause', onVideoPause);
        video.removeEventListener('seeked', onVideoSeeked);
    }

    function onVideoPlay() {
        if (synthesizedAudio) {
            synthesizedAudio.play().catch(error => console.error('Error playing audio:', error));
        }
    }

    function onVideoPause() {
        if (synthesizedAudio) {
            synthesizedAudio.pause();
        }
    }

    function onVideoSeeked() {
        if (synthesizedAudio) {
            synthesizedAudio.currentTime = video.currentTime % synthesizedAudio.duration;
        }
    }

    async function getTranscript() {
        console.log('Getting transcript');
        
        // Wait for the player to be ready
        await new Promise(resolve => {
            const checkPlayer = () => {
                if (window.ytInitialPlayerResponse || document.querySelector('#movie_player')) {
                    resolve();
                } else {
                    setTimeout(checkPlayer, 100);
                }
            };
            checkPlayer();
        });

        console.log('Player found, attempting to get player response');

        let playerResponse;
        
        // Try different methods to get the player response
        if (window.ytInitialPlayerResponse) {
            console.log('Using ytInitialPlayerResponse');
            playerResponse = window.ytInitialPlayerResponse;
        } else {
            console.log('Attempting to get player response from movie_player element');
            const playerElement = document.querySelector('#movie_player');
            if (playerElement && playerElement.getPlayerResponse) {
                playerResponse = playerElement.getPlayerResponse();
            }
        }

        if (!playerResponse) {
            console.log('Attempting to extract player response from page source');
            const pageSource = document.documentElement.outerHTML;
            const match = pageSource.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
            if (match) {
                try {
                    playerResponse = JSON.parse(match[1]);
                } catch (error) {
                    console.error('Error parsing player response from page source:', error);
                }
            }
        }

        if (!playerResponse) {
            console.error('No player response found');
            return null;
        }

        console.log('Player response found');

        const captions = playerResponse.captions;
        if (!captions) {
            console.error('No captions found in player response');
            return null;
        }

        const captionTracks = captions.playerCaptionsTracklistRenderer.captionTracks;
        if (!captionTracks || captionTracks.length === 0) {
            console.error('No caption tracks found');
            return null;
        }

        // Find the English caption track, or use the first available one
        let track = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];

        const captionUrl = track.baseUrl;
        console.log('Caption URL:', captionUrl);

        try {
            const response = await fetch(captionUrl);
            const captionXml = await response.text();

            // Parse the XML and extract the text
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(captionXml, 'text/xml');
            const texts = xmlDoc.getElementsByTagName('text');

            let transcript = '';
            for (let i = 0; i < texts.length; i++) {
                transcript += texts[i].textContent + ' ';
            }

            console.log('Transcript retrieved successfully');
            return transcript.trim();
        } catch (error) {
            console.error('Error fetching transcript:', error);
            return null;
        }
    }

    async function getSynthesizedAudio(transcript) {
        console.log('Getting synthesized audio');
        console.log('Transcript length:', transcript.length);
        return new Promise((resolve, reject) => {
            console.log('Sending message to background script');
            chrome.runtime.sendMessage({ 
                action: 'get_audio', 
                transcript: transcript,
                selectedVoice: selectedVoice, // Use the selectedVoice variable here
                translate: true // Or get this from user preference
            }, function(response) {
                console.log('Received response from background script:', response);
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    console.log('Audio data received successfully');
                    resolve(response.audioData);
                } else {
                    console.error('Error in response:', response);
                    reject(new Error(response ? response.error : 'Unknown error'));
                }
            });
        });
    }
})();
