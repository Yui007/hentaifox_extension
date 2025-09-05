chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'get-galleries') {
        const galleries = [];
        const galleryElements = document.querySelectorAll('.galleries_overview .thumb');
        
        galleryElements.forEach(gallery => {
            const titleElement = gallery.querySelector('.caption a');
            const urlElement = gallery.querySelector('.inner_thumb a'); // Corrected selector
            const thumbElement = gallery.querySelector('.inner_thumb img');

            if (titleElement && urlElement && thumbElement) {
                galleries.push({
                    title: titleElement.textContent.trim(),
                    url: urlElement.href,
                    thumbnail: thumbElement.dataset.src || thumbElement.src
                });
            }
        });
        
        sendResponse({ galleries: galleries });
    } else if (request.action === 'download') {
        const galleryUrl = window.location.href;
        chrome.runtime.sendMessage({
            action: 'download-gallery',
            url: galleryUrl
        });
    }
    return true; // Indicates that the response is sent asynchronously
});

// These functions are called by chrome.scripting.executeScript from background.js
// They need to be in the global scope of the content script
async function parseGalleryPage(galleryUrl) {
    const galleryResponse = await fetch(galleryUrl);
    const galleryText = await galleryResponse.text();
    const galleryDoc = new DOMParser().parseFromString(galleryText, 'text/html');

    const titleElement = galleryDoc.querySelector('h1');
    const title = titleElement ? titleElement.textContent.trim().replace(/[<>:"/\\|?*]+/g, '_') : 'gallery';

    const pagesElement = Array.from(galleryDoc.querySelectorAll('span.i_text')).find(el => el.textContent.includes('Pages:'));
    const pagesText = pagesElement ? pagesElement.textContent : 'Pages: 0';
    const pageCount = parseInt(pagesText.replace('Pages:', '').trim(), 10);

    const galleryIdMatch = galleryUrl.match(/\/gallery\/(\d+)/);
    const galleryId = galleryIdMatch ? galleryIdMatch[1] : null;

    return { title, pageCount, galleryId };
}

async function parseImagePage(pageUrl) {
    const pageResponse = await fetch(pageUrl);
    const pageText = await pageResponse.text();
    const pageDoc = new DOMParser().parseFromString(pageText, 'text/html');
    const imgElement = pageDoc.querySelector('#gimg');
    const imageUrl = imgElement ? (imgElement.dataset.src || imgElement.src) : null;
    return { imageUrl };
}

// This function will be executed in the content script context
async function fetchImageBlobs(imageUrls) {
    const fetchedBlobs = [];
    for (const image of imageUrls) {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            await new Promise(resolve => {
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    fetchedBlobs.push({ filename: image.filename, base64: base64 });
                    resolve();
                };
            });
        } catch (error) {
            console.error(`Failed to fetch blob for ${image.filename}:`, error);
        }
    }
    return fetchedBlobs;
}