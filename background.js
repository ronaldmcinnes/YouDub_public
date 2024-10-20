import { config } from './config.js';

const elevenlabsApiKey = config.ELEVENLABS_API_KEY;
const googleTranslateApiKey = config.GOOGLE_TRANSLATE_API_KEY;

// Voice ID mapping
const voiceIdMap = {
    'default': 'BtWabtumIemAotTjP5sk',
    'Grandpa Spuds Oxley': 'NOpBlnGInO9m6vDvFkFC',
    'Boston Bob': 'Gf1KYedBUv2F4rCJhVFJ',
    'David Martin': 'y6WtESLj18d0diFRruBs',
    'Mark - Robust': 'uQvlBZB2vlJePJeb1waf',
    'Ana - British': 'wJqPPQ618aTW29mptyoc',
    'Ayesha - Energetic': '0ZOhGcBopt9S6GBK8tnj',
    'Farshid - Turkish': 'Emv9kLcuxJRj7yEDU8CT',
    'Mademoiselle': 'QbsdzCokdlo98elkq4Pc',
    'Niraj - Hindi': 'zgqefOY5FPQ3bB7OZTVR',
    'Donny - NY': 'BfDbhCUVGzNgO4WXDRdy',
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Background script received message:', request);
    if (request.action === 'get_audio') {
        handleGetAudio(request)
            .then(response => {
                console.log('Sending response back to content script:', response);
                sendResponse(response);
            })
            .catch(error => {
                console.error('Error in handleGetAudio:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Indicates that the response is sent asynchronously
    }
});

async function handleGetAudio(request) {
    console.log('Starting handleGetAudio');
    const transcript = request.transcript;
    const selectedVoice = request.selectedVoice;
    const translate = request.translate;

    try {
        let translatedTranscript = transcript;
        if (translate) {
            console.log('Translating transcript');
            translatedTranscript = await translateText(transcript);
            console.log('Translation complete');
        }

        const voiceId = voiceIdMap[selectedVoice] || voiceIdMap['default'];
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

        const data = {
            text: translatedTranscript,
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.5
            }
        };

        console.log('Sending request to ElevenLabs API');
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'xi-api-key': elevenlabsApiKey,
                'Content-Type': 'application/json',
                'accept': 'audio/mpeg'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        console.log('Received response from ElevenLabs API');
        const buffer = await response.arrayBuffer();
        console.log('Processing audio data');
        const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        const dataUrl = `data:audio/mpeg;base64,${base64}`;
        console.log('Audio data processed successfully');
        return { success: true, audioData: dataUrl };
    } catch (error) {
        console.error('Error in handleGetAudio:', error);
        return { success: false, error: error.message };
    }
}

async function translateText(text, targetLanguage = 'en') {
    console.log('Starting translation');
    const url = `https://translation.googleapis.com/language/translate/v2?key=${googleTranslateApiKey}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: text,
                target: targetLanguage
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Translation complete');
        return data.data.translations[0].translatedText;
    } catch (error) {
        console.error('Error in translation:', error);
        throw error;
    }
}
