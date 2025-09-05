browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'download-gallery') {
        await handleDownload(request.url, request.type);
    } else if (request.action === 'download-multiple-galleries') {
        for (const url of request.urls) {
            await handleDownload(url, request.type);
        }
    }
});

async function handleDownload(galleryUrl, downloadType) {
    try {
        // 1. Fetch the main gallery page to get title and page count
        const galleryResponse = await fetch(galleryUrl);
        const galleryText = await galleryResponse.text();
        const galleryDoc = new DOMParser().parseFromString(galleryText, 'text/html');

        const titleElement = galleryDoc.querySelector('h1');
        const title = titleElement ? titleElement.textContent.trim().replace(/[<>:"/\\|?*]+/g, '_') : 'gallery';

        const pagesElement = Array.from(galleryDoc.querySelectorAll('span.i_text')).find(el => el.textContent.includes('Pages:'));
        const pagesText = pagesElement ? pagesElement.textContent : 'Pages: 0';
        const pageCount = parseInt(pagesText.replace('Pages:', '').trim(), 10);

        if (pageCount === 0) {
            console.error('Could not determine the number of pages.');
            return;
        }

        const galleryIdMatch = galleryUrl.match(/\/gallery\/(\d+)/);
        if (!galleryIdMatch || !galleryIdMatch[1]) {
            console.error('Could not extract gallery ID from URL:', galleryUrl);
            return;
        }
        const galleryId = galleryIdMatch[1];
        const baseUrl = `https://hentaifox.com/g/${galleryId}`;

        const imageUrls = [];

        for (let i = 1; i <= pageCount; i++) {
            const pageUrl = `${baseUrl}/${i}/`;
            
            // 2. Fetch each individual image page
            const pageResponse = await fetch(pageUrl);
            const pageText = await pageResponse.text();
            const pageDoc = new DOMParser().parseFromString(pageText, 'text/html');

            // 3. Extract the direct image source URL
            const imgElement = pageDoc.querySelector('#gimg');
            if (imgElement) {
                const imageUrl = imgElement.dataset.src || imgElement.src;
                imageUrls.push({ url: imageUrl, filename: `${String(i).padStart(3, '0')}.${imageUrl.split('.').pop()}` });
            } else {
                console.error(`Could not find image on page: ${pageUrl}`);
            }
        }

        if (downloadType === 'zip') {
            await downloadImagesAsZip(title, imageUrls);
        } else { // Default to images
            imageUrls.forEach(image => {
                browser.downloads.download({
                    url: image.url,
                    filename: `${title}/${image.filename}`,
                    conflictAction: 'uniquify'
                });
            });
        }
    } catch (error) {
        console.error('Error during download:', error);
    }
}

async function downloadImagesAsZip(title, imageUrls) {
    const zip = new JSZip();
    const folder = zip.folder(title);

    for (const image of imageUrls) {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            folder.file(image.filename, blob);
        } catch (error) {
            console.error(`Failed to add ${image.filename} to zip:`, error);
        }
    }

    zip.generateAsync({ type: "blob" })
        .then(function(content) {
            const url = URL.createObjectURL(content);
            browser.downloads.download({
                url: url,
                filename: `${title}.zip`,
                saveAs: true // Prompt user to save as
            });
        })
        .catch(error => {
            console.error('Error generating zip:', error);
        });
}