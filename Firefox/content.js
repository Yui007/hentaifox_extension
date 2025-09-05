browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
        browser.runtime.sendMessage({
            action: 'download-gallery',
            url: galleryUrl
        });
    }
    return true; // Indicates that the response is sent asynchronously
});