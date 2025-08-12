// @ts-check
/* global chrome, extractContentFromTab, dropboxClient */
// AICODE-LINK: ./dropbox_client.js#DropboxClient
// AICODE-LINK: ./extractContent.js#extractContentFromTab

document.addEventListener('DOMContentLoaded', function() {
    const exportBtn = /** @type {HTMLButtonElement} */ (document.getElementById('exportBtn'));
    const uploadToDropboxCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('uploadToDropbox'));
    const settingsBtn = /** @type {HTMLButtonElement} */ (document.getElementById('settingsBtn'));
    const progress = /** @type {HTMLDivElement} */ (document.getElementById('progress'));
    const progressBar = /** @type {HTMLDivElement} */ (document.getElementById('progressBar'));
    const status = /** @type {HTMLDivElement} */ (document.getElementById('status'));

    // Инициализация
    initializePopup();

    // Event Listeners
    exportBtn.addEventListener('click', handleExport);
    settingsBtn.addEventListener('click', openSettings);
    uploadToDropboxCheckbox.addEventListener('change', handleDropboxToggle);

    /**
     * Инициализация popup
     */
    async function initializePopup() {
        try {
            // Проверяем статус Dropbox подключения
            await updateDropboxStatus();
            
            // Загружаем сохраненные настройки
            await loadSettings();
            
            // Проверяем возможность экспорта
            await checkExportAvailability();
        } catch (error) {
            console.error('Error initializing popup:', error);
        }
    }

    /**
     * Обновляет статус Dropbox подключения
     */
    async function updateDropboxStatus() {
        try {
            const dropboxStatus = /** @type {HTMLDivElement} */ (document.getElementById('dropboxStatus'));
            const isConnected = await dropboxClient.isConnected();
            
            if (isConnected) {
                dropboxStatus.textContent = '📁 Dropbox подключен';
                dropboxStatus.className = 'dropbox-status connected';
                uploadToDropboxCheckbox.disabled = false;
            } else {
                dropboxStatus.textContent = '📁 Dropbox не подключен';
                dropboxStatus.className = 'dropbox-status disconnected';
                uploadToDropboxCheckbox.disabled = true;
                uploadToDropboxCheckbox.checked = false;
            }
        } catch (error) {
            console.error('Error updating Dropbox status:', error);
        }
    }

    /**
     * Загружает сохраненные настройки
     */
    async function loadSettings() {
        try {
            const settings = await chrome.storage.local.get(['autoUploadToDropbox']);
            
            // Устанавливаем чекбокс автозагрузки если Dropbox подключен
            if (!uploadToDropboxCheckbox.disabled && settings.autoUploadToDropbox) {
                uploadToDropboxCheckbox.checked = true;
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /**
     * Проверяет доступность экспорта для текущей страницы
     */
    async function checkExportAvailability() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            
            if (!currentTab || !currentTab.url) {
                setStatus('⚠️ Экспорт недоступен', 'error');
                exportBtn.disabled = true;
                return;
            }
            
            if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://')) {
                setStatus('⚠️ Экспорт недоступен для системных страниц', 'error');
                exportBtn.disabled = true;
            } else {
                setStatus('Готов к экспорту');
                exportBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error checking export availability:', error);
            setStatus('⚠️ Ошибка проверки страницы', 'error');
            exportBtn.disabled = true;
        }
    }

    /**
     * Основная функция экспорта
     */
    async function handleExport() {
        const shouldUploadToDropbox = uploadToDropboxCheckbox.checked;
        
        try {
            // Шаг 1: Инициализация
            setMultiStepStatus([
                { text: 'Инициализация...', active: true },
                { text: 'Извлечение контента', active: false },
                { text: 'Создание EPUB файла', active: false },
                shouldUploadToDropbox ? { text: 'Загрузка в Dropbox', active: false } : null
            ].filter(Boolean));
            setProgress(5);
            
            // Получаем активную вкладку
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (!tab?.id) {
                throw new Error('Не удалось получить текущую вкладку');
            }
            
            // Шаг 2: Извлечение контента
            setMultiStepStatus([
                { text: 'Инициализация', completed: true },
                { text: 'Извлечение контента...', active: true },
                { text: 'Создание EPUB файла', active: false },
                shouldUploadToDropbox ? { text: 'Загрузка в Dropbox', active: false } : null
            ].filter(Boolean));
            setProgress(20);
            
            const response = await extractContentFromTab(tab.id);
            
            if (!response || !response.success) {
                throw new Error(response?.error || 'Не удалось извлечь контент');
            }
            
            // Шаг 3: Создание EPUB
            setMultiStepStatus([
                { text: 'Инициализация', completed: true },
                { text: 'Извлечение контента', completed: true },
                { text: 'Создание EPUB файла...', active: true },
                shouldUploadToDropbox ? { text: 'Загрузка в Dropbox', active: false } : null
            ].filter(Boolean));
            setProgress(50);
            
            const epubResponse = await chrome.runtime.sendMessage({
                action: 'createEPUB',
                data: response.data
            });
            
            if (!epubResponse || !epubResponse.success) {
                throw new Error(epubResponse?.error || 'Ошибка создания EPUB');
            }
            
            // Шаг 4: Загрузка в Dropbox (если включена)
            if (shouldUploadToDropbox) {
                setMultiStepStatus([
                    { text: 'Инициализация', completed: true },
                    { text: 'Извлечение контента', completed: true },
                    { text: 'Создание EPUB файла', completed: true },
                    { text: 'Загрузка в Dropbox...', active: true }
                ]);
                setProgress(75);
                
                await uploadToDropbox(epubResponse.downloadUrl, epubResponse.filename);
                
                setMultiStepStatus([
                    { text: 'Инициализация', completed: true },
                    { text: 'Извлечение контента', completed: true },
                    { text: 'Создание EPUB файла', completed: true },
                    { text: 'Загрузка в Dropbox', completed: true }
                ]);
                setProgress(95);
            } else {
                setProgress(85);
            }
            
            // Финальная загрузка файла
            await chrome.downloads.download({
                url: epubResponse.downloadUrl,
                filename: epubResponse.filename
            });
            
            setProgress(100);
            
            const successMessage = shouldUploadToDropbox ? 
                '✅ EPUB создан и загружен в Dropbox!' : 
                '✅ EPUB файл успешно создан!';
            
            setStatus(successMessage, 'success');
            
            // Закрываем popup через 2 секунды
            setTimeout(() => {
                window.close();
            }, 2000);
            
        } catch (error) {
            const err = /** @type {Error} */ (error);
            console.error('Ошибка экспорта:', err);
            setStatus(`❌ ${err.message}`, 'error');
            setProgress(0);
        }
    }

    /**
     * Загружает файл в Dropbox
     * @param {string} downloadUrl - URL для скачивания файла
     * @param {string} filename - Имя файла
     */
    async function uploadToDropbox(downloadUrl, filename) {
        try {
            // Преобразуем URL в Blob
            const response = await fetch(downloadUrl);
            const blob = await response.blob();
            
            // Загружаем в Dropbox
            const dropboxPath = await dropboxClient.uploadFile(blob, filename);
            console.log('File uploaded to Dropbox:', dropboxPath);
            
        } catch (error) {
            console.error('Dropbox upload failed:', error);
            throw new Error(`Ошибка загрузки в Dropbox: ${error.message}`);
        }
    }

    /**
     * Обрабатывает изменение чекбокса Dropbox
     */
    async function handleDropboxToggle() {
        // Если пользователь включил загрузку в Dropbox, но не подключен - открываем настройки
        if (uploadToDropboxCheckbox.checked && uploadToDropboxCheckbox.disabled) {
            uploadToDropboxCheckbox.checked = false;
            openSettings();
        }
    }

    /**
     * Открывает страницу настроек
     */
    function openSettings() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('settings.html')
        });
        window.close();
    }

    /**
     * Устанавливает статус сообщение
     * @param {string} message
     * @param {string} type
     */
    function setStatus(message, type = '') {
        status.innerHTML = message;
        status.className = `status ${type}`;
    }

    /**
     * Устанавливает мульти-шаговый статус
     * @param {Array<{text: string, active?: boolean, completed?: boolean}>} steps
     */
    function setMultiStepStatus(steps) {
        const stepsHtml = steps.map(step => {
            let className = 'step';
            let icon = '🔸';
            
            if (step.completed) {
                className += ' completed';
                icon = '✅';
            } else if (step.active) {
                className += ' active';
                icon = '🔄';
            }
            
            return `<div class="${className}">${icon} ${step.text}</div>`;
        }).join('');
        
        status.innerHTML = `<div class="multi-step">${stepsHtml}</div>`;
        status.className = 'status';
    }

    /**
     * Устанавливает прогресс
     * @param {number} percent
     */
    function setProgress(percent) {
        if (percent > 0) {
            progress.style.display = 'block';
            progressBar.style.width = `${percent}%`;
            exportBtn.disabled = true;
            exportBtn.textContent = 'Экспорт...';
        } else {
            progress.style.display = 'none';
            progressBar.style.width = '0%';
            exportBtn.disabled = false;
            exportBtn.textContent = 'Экспорт в EPUB';
        }
    }
});