document.addEventListener('DOMContentLoaded', () => {
    const galleryListContainer = document.getElementById('gallery-list-container');
    const singleDownloadContainer = document.getElementById('single-download-container');
    const galleryList = document.getElementById('gallery-list');
    const downloadSelectedButton = document.getElementById('download-selected-button');
    const downloadSingleButton = document.getElementById('download-single-button');
    const downloadOptionsSelected = document.getElementById('download-options-selected');
    const downloadSelectedImagesButton = document.getElementById('download-selected-images-button');
    const downloadSelectedZipButton = document.getElementById('download-selected-zip-button');
    const downloadOptionsSingle = document.getElementById('download-options-single');
    const downloadSingleImagesButton = document.getElementById('download-single-images-button');
    const downloadSingleZipButton = document.getElementById('download-single-zip-button');

    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        const currentUrl = tabs[0].url;

        if (currentUrl.includes('/gallery/')) {
            galleryListContainer.style.display = 'none';
            singleDownloadContainer.style.display = 'block';

            downloadSingleButton.addEventListener('click', () => {
                downloadSingleButton.style.display = 'none';
                downloadOptionsSingle.style.display = 'block';
            });

            downloadSingleImagesButton.addEventListener('click', () => {
                chrome.runtime.sendMessage({
                    action: 'download-gallery',
                    url: currentUrl,
                    type: 'images'
                });
            });

            downloadSingleZipButton.addEventListener('click', () => {
                chrome.runtime.sendMessage({
                    action: 'download-gallery',
                    url: currentUrl,
                    type: 'zip'
                });
            });

        } else {
            singleDownloadContainer.style.display = 'none';
            galleryListContainer.style.display = 'block';

            const maxRetries = 3;
            let attempt = 0;

            function getGalleries() {
                attempt++;
                chrome.tabs.sendMessage(tabs[0].id, { action: 'get-galleries' })
                    .then(response => {
                        if (response && response.galleries && response.galleries.length > 0) {
                            renderGalleries(response.galleries);
                        } else {
                            galleryList.innerHTML = '<p>No galleries found on this page.</p>';
                            downloadSelectedButton.disabled = true;
                        }
                    })
                    .catch(error => {
                        if (attempt < maxRetries) {
                            setTimeout(getGalleries, 250 * attempt); // Wait longer each time
                        } else {
                            console.error("Could not get galleries after multiple attempts:", error);
                            galleryList.innerHTML = '<p>Could not retrieve galleries. Please reload the page and try again.</p>';
                            downloadSelectedButton.disabled = true;
                        }
                    });
            }

            getGalleries();
        }
    });

    function renderGalleries(galleries) {
        galleryList.innerHTML = '';
        galleries.forEach((gallery) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <input type="checkbox" data-url="${gallery.url}">
                <img src="${gallery.thumbnail}" alt="${gallery.title}">
                <span class="title">${gallery.title}</span>
            `;
            galleryList.appendChild(item);
        });
    }

    downloadSelectedButton.addEventListener('click', () => {
        const selectedGalleries = [];
        const checkboxes = galleryList.querySelectorAll('input[type="checkbox"]:checked');
        
        checkboxes.forEach(checkbox => {
            selectedGalleries.push(checkbox.dataset.url);
        });

        if (selectedGalleries.length > 0) {
            downloadSelectedButton.style.display = 'none';
            downloadOptionsSelected.style.display = 'block';
        }
    });

    downloadSelectedImagesButton.addEventListener('click', () => {
        const selectedGalleries = [];
        const checkboxes = galleryList.querySelectorAll('input[type="checkbox"]:checked');
        
        checkboxes.forEach(checkbox => {
            selectedGalleries.push(checkbox.dataset.url);
        });

        if (selectedGalleries.length > 0) {
            chrome.runtime.sendMessage({
                action: 'download-multiple-galleries',
                urls: selectedGalleries,
                type: 'images'
            });
        }
    });

    downloadSelectedZipButton.addEventListener('click', () => {
        const selectedGalleries = [];
        const checkboxes = galleryList.querySelectorAll('input[type="checkbox"]:checked');
        
        checkboxes.forEach(checkbox => {
            selectedGalleries.push(checkbox.dataset.url);
        });

        if (selectedGalleries.length > 0) {
            chrome.runtime.sendMessage({
                action: 'download-multiple-galleries',
                urls: selectedGalleries,
                type: 'zip'
            });
        }
    });
});