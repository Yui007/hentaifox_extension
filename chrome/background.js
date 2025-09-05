importScripts('jszip.min.js');

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'download-gallery') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            await handleDownload(request.url, request.type, tab.id);
        }
    } else if (request.action === 'download-multiple-galleries') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            for (const url of request.urls) {
                await handleDownload(url, request.type, tab.id);
            }
        }
    }
});

async function handleDownload(galleryUrl, downloadType, tabId) {
    try {
        const galleryDataResponse = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (url) => {
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
                return parseGalleryPage(url);
            },
            args: [galleryUrl]
        });

        if (!galleryDataResponse || !galleryDataResponse[0] || !galleryDataResponse[0].result) {
            console.error('Failed to get gallery data from content script.');
            return;
        }

        const { title, pageCount, galleryId } = galleryDataResponse[0].result;

        if (!title || pageCount === 0 || !galleryId) {
            console.error('Could not determine the number of pages or title or ID.');
            return;
        }

        const baseUrl = `https://hentaifox.com/g/${galleryId}`;
        const imageUrls = [];

        for (let i = 1; i <= pageCount; i++) {
            const pageUrl = `${baseUrl}/${i}/`;

            const imageResponse = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (url) => {
                    async function parseImagePage(pageUrl) {
                        const pageResponse = await fetch(pageUrl);
                        const pageText = await pageResponse.text();
                        const pageDoc = new DOMParser().parseFromString(pageText, 'text/html');
                        const imgElement = pageDoc.querySelector('#gimg');
                        const imageUrl = imgElement ? (imgElement.dataset.src || imgElement.src) : null;
                        return { imageUrl };
                    }
                    return parseImagePage(url);
                },
                args: [pageUrl]
            });

            if (!imageResponse || !imageResponse[0] || !imageResponse[0].result || !imageResponse[0].result.imageUrl) {
                console.error(`Could not find image on page: ${pageUrl}`);
                continue;
            }

            const imageUrl = imageResponse[0].result.imageUrl;
            imageUrls.push({ url: imageUrl, filename: `${String(i).padStart(3, '0')}.${imageUrl.split('.').pop()}` });
        }

        if (downloadType === 'zip') {
            const imagesData = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (urls) => {
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
                    return fetchImageBlobs(urls);
                },
                args: [imageUrls]
            });

            if (!imagesData || !imagesData[0] || !imagesData[0].result) {
                console.error('Failed to get image blobs from content script.');
                return;
            }
            await downloadImagesAsZip(title, imagesData[0].result);
        } else { // Default to images
            imageUrls.forEach(image => {
                chrome.downloads.download({
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
            folder.file(image.filename, image.base64, { base64: true });
        } catch (error) {
            console.error(`Failed to add ${image.filename} to zip:`, error);
        }
    }

    zip.generateAsync({ type: "base64" })
        .then(function(content) {
            const url = `data:application/zip;base64,${content}`;
            chrome.downloads.download({
                url: url,
                filename: `${title}.zip`,
                saveAs: true
            });
        })
        .catch(error => {
            console.error('Error generating zip:', error);
        });
}
