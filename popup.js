// @ts-check
/* global chrome, extractContentFromTab, dropboxClient */

document.addEventListener('DOMContentLoaded', function () {
    const exportBtn = /** @type {HTMLButtonElement} */ (document.getElementById('exportBtn'));
    const uploadToDropboxCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('uploadToDropbox'));
    const sendToKindleCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('sendToKindle'));
    const settingsBtn = /** @type {HTMLButtonElement} */ (document.getElementById('settingsBtn'));
    const progress = /** @type {HTMLDivElement} */ (document.getElementById('progress'));
    const progressBar = /** @type {HTMLDivElement} */ (document.getElementById('progressBar'));
    const status = /** @type {HTMLDivElement} */ (document.getElementById('status'));
    const previewBtn = /** @type {HTMLButtonElement} */ (document.getElementById('previewBtn'));

    const debugLog = (...args) => {
        console.log('[popup]', ...args);
    };

    // Инициализация
    debugLog('Popup mounted, starting initialization');
    initializePopup();

    // Event Listeners
    exportBtn.addEventListener('click', handleExport);
    previewBtn.addEventListener('click', handlePreview);
    settingsBtn.addEventListener('click', openSettings);
    uploadToDropboxCheckbox.addEventListener('change', () => {
        handleDropboxToggle();
        updateExportButtonText();
    });
    sendToKindleCheckbox.addEventListener('change', () => {
        handleKindleToggle();
        updateExportButtonText();
    });

    /**
     * Инициализация popup
     */
    async function initializePopup() {
        try {
            // Проверяем статусы подключений
            debugLog('Initializing popup');
            await Promise.all([
                updateDropboxStatus(),
                updateGmailStatus()
            ]);

            updateExportButtonText();

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
            // @ts-ignore
            const isConnected = await window.dropboxClient.isConnected();
            debugLog('Dropbox connection status', { isConnected });

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
     * Обновляет статус Gmail/Kindle подключения
     */
    async function updateGmailStatus() {
        try {
            const kindleStatus = /** @type {HTMLDivElement} */ (document.getElementById('kindleStatus'));
            // @ts-ignore
            const isConnected = await window.gmailClient.isConnected();
            debugLog('Gmail connection status', { isConnected });

            if (isConnected) {
                kindleStatus.textContent = '📧 Gmail подключен';
                kindleStatus.className = 'kindle-status connected';
                sendToKindleCheckbox.disabled = false;
            } else {
                kindleStatus.textContent = '📧 Gmail не подключен';
                kindleStatus.className = 'kindle-status disconnected';
                sendToKindleCheckbox.disabled = false;
            }
        } catch (error) {
            console.error('Error updating Gmail status:', error);
        }
    }

    /**
     * Загружает сохраненные настройки
     */
    async function loadSettings() {
        try {
            const settings = await chrome.storage.local.get(['autoUploadToDropbox', 'autoSendToKindle']);
            debugLog('Loaded settings', settings);

            // Устанавливаем чекбокс автозагрузки если Dropbox подключен
            if (!uploadToDropboxCheckbox.disabled && settings.autoUploadToDropbox) {
                uploadToDropboxCheckbox.checked = true;
            }

            // Устанавливаем чекбокс Kindle
            if (settings.autoSendToKindle) {
                sendToKindleCheckbox.checked = true;
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
            debugLog('Active tab info', currentTab);

            if (!currentTab || !currentTab.url) {
                setStatus('⚠️ Экспорт недоступен', 'error');
                exportBtn.disabled = true;
                previewBtn.disabled = true;
                return;
            }

            const url = currentTab.url;

            // Добавляем проверку на ограничения безопасности
            if (url.startsWith('https://chrome.google.com/webstore')) {
                setStatus('⚠️ Chrome Web Store ограничивает работу всех расширений на своих страницах.', 'error');
                exportBtn.disabled = true;
                previewBtn.disabled = true;
                return;
            }

            // Список запрещенных протоколов
            const restrictedSchemes = [
                'chrome:',
                'chrome-extension:',
                'about:',
                'view-source:',
                'edge:',
                'devtools:',
                'data:'
            ];

            if (restrictedSchemes.some(scheme => url.startsWith(scheme))) {
                setStatus('⚠️ Экспорт недоступен для системных страниц', 'error');
                exportBtn.disabled = true;
                previewBtn.disabled = true;
            } else {
                setStatus('Готов к экспорту');
                exportBtn.disabled = false;
                previewBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error checking export availability:', error);
            setStatus('⚠️ Ошибка доступа к контенту страницы. Попробуйте обновить страницу.', 'error');
            exportBtn.disabled = true;
            previewBtn.disabled = true;
        }
    }

    /**
     * Основная функция экспорта
     */
    async function handleExport() {
        const shouldUploadToDropbox = uploadToDropboxCheckbox.checked;
        const shouldSendToKindle = sendToKindleCheckbox.checked;
        debugLog('Starting export flow', { shouldUploadToDropbox, shouldSendToKindle });

        try {
            // Шаг 1: Инициализация
            renderWorkflowStage('init', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
            setProgress(5);

            // Получаем активную вкладку
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            debugLog('Queried tabs', tabs);
            if (!tab?.id) {
                throw new Error('Не удалось получить текущую вкладку');
            }

            // Шаг 2: Извлечение контента
            renderWorkflowStage('extract', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
            setProgress(20);

            const response = await extractContentFromTab(tab.id);
            debugLog('Content extraction response', response);

            if (!response || !response.success) {
                throw new Error(response?.error || 'Не удалось извлечь контент');
            }

            // Шаг 3: Создание EPUB (и отправка в Dropbox/Kindle в фоне)
            renderWorkflowStage('epub', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
            setProgress(40);

            const epubResponse = await chrome.runtime.sendMessage({
                action: 'createEPUB',
                data: response.data,
                uploadToDropbox: shouldUploadToDropbox,
                sendToKindle: shouldSendToKindle
            });
            debugLog('EPUB generation response', epubResponse);

            if (!epubResponse || !epubResponse.success) {
                throw new Error(epubResponse?.error || 'Ошибка создания EPUB');
            }

            // Шаг 4: Визуализация завершения (Dropbox/Kindle уже обработаны в фоне)
            if (shouldUploadToDropbox) {
                renderWorkflowStage('upload', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
                setProgress(60);
            }

            if (shouldSendToKindle) {
                renderWorkflowStage('kindle', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
                setProgress(shouldUploadToDropbox ? 80 : 70);
            }

            renderWorkflowStage('done', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
            setProgress(100);

            // Финальная загрузка файла - ТОЛЬКО если не выбрана отправка на Kindle
            if (!shouldSendToKindle) {
                debugLog('Triggering local download');
                await chrome.downloads.download({
                    url: epubResponse.downloadUrl,
                    filename: epubResponse.filename
                });
            } else {
                debugLog('Skipping local download as Kindle was selected');
            }

            setProgress(100);

            const successMessage = []
            successMessage.push('✅ EPUB файл успешно создан!');
            if (shouldUploadToDropbox) successMessage.push('📁 Загружен в Dropbox.');
            if (shouldSendToKindle) successMessage.push('📩 Отправлен на Kindle.');

            setStatus(successMessage.join('<br>'), 'success');

            // Закрываем popup через 3 секунды
            setTimeout(() => {
                window.close();
            }, 3000);

        } catch (error) {
            const err = /** @type {Error} */ (error);
            console.error('Ошибка экспорта:', err);
            debugLog('Export flow failed', err);
            setStatus(`❌ ${err.message}`, 'error');
            setProgress(0);
        }
    }

    /**
     * Обработчик предпросмотра (Clean)
     */
    async function handlePreview() {
        debugLog('Starting clean preview flow');
        try {
            setStatus('⌛ Подготовка предпросмотра...');
            previewBtn.disabled = true;
            exportBtn.disabled = true;

            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (!tab?.id) throw new Error('Не удалось получить текущую вкладку');

            // Извлекаем "чистый" контент
            const response = await extractCleanContentFromTab(tab.id);
            if (!response || !response.success) {
                throw new Error(response?.error || 'Не удалось извлечь контент');
            }

            const { title, content } = response.data;

            // Создаем HTML для предпросмотра
            const previewHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Предпросмотр: ${title}</title>
                    <style>
                        body {
                            max-width: 800px;
                            margin: 40px auto;
                            padding: 0 20px;
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            background-color: #f9f9f9;
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 8px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
                        img { max-width: 100%; height: auto; display: block; margin: 20px auto; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>${title}</h1>
                        ${content}
                    </div>
                </body>
                </html>
            `;

            // Открываем новую вкладку с контентом
            const blob = new Blob([previewHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            chrome.tabs.create({ url });

            setStatus('✅ Предпросмотр открыт в новой вкладке');

            // Возвращаем кнопки в нормальное состояние через секунду
            setTimeout(() => {
                previewBtn.disabled = false;
                exportBtn.disabled = false;
                setStatus('Готов к экспорту');
            }, 1000);

        } catch (error) {
            const err = /** @type {Error} */ (error);
            console.error('Ошибка предпросмотра:', err);
            setStatus(`❌ Ошибка: ${err.message}`, 'error');
            previewBtn.disabled = false;
            exportBtn.disabled = false;
        }
    }

    /**
     * Отправляет запрос на извлечение "чистого" контента из вкладки.
     * @param {number} tabId
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     */
    async function extractCleanContentFromTab(tabId) {
        try {
            return await chrome.tabs.sendMessage(tabId, { action: 'extractCleanContent' });
        } catch (err) {
            const error = /** @type {Error} */ (err);
            if (error.message && error.message.includes('Could not establish connection')) {
                // @ts-ignore
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['lib/readability.js', 'lib/dompurify.js', 'content_script.js']
                });
                return await chrome.tabs.sendMessage(tabId, { action: 'extractCleanContent' });
            }
            throw error;
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

        // Сохраняем настройку
        await chrome.storage.local.set({ autoUploadToDropbox: uploadToDropboxCheckbox.checked });

        debugLog('Dropbox toggle changed', {
            checked: uploadToDropboxCheckbox.checked,
            disabled: uploadToDropboxCheckbox.disabled
        });
    }

    /**
     * Обрабатывает изменение чекбокса Kindle
     */
    async function handleKindleToggle() {
        if (sendToKindleCheckbox.checked) {
            try {
                // @ts-ignore
                const isConnected = await window.gmailClient.isConnected();
                if (!isConnected) {
                    // Пытаемся авторизоваться сразу
                    // @ts-ignore
                    await window.gmailClient.getAccessToken(true);
                    await updateGmailStatus();
                }
            } catch (error) {
                console.error('Auth failed', error);
                sendToKindleCheckbox.checked = false;
                setStatus('❌ Ошибка авторизации Gmail', 'error');
                return;
            }
        }

        // Сохраняем настройку
        await chrome.storage.local.set({ autoSendToKindle: sendToKindleCheckbox.checked });

        debugLog('Kindle toggle changed', {
            checked: sendToKindleCheckbox.checked
        });
    }

    /**
     * Открывает страницу настроек
     */
    function openSettings() {
        debugLog('Opening settings page');
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
        debugLog('Status updated', { message, type });
    }

    /**
     * Обновляет визуализацию этапов экспорта, избегая дублирования разметки.
     * @param {'init'|'extract'|'epub'|'upload'|'kindle'|'done'} stage
     * @param {{dropbox: boolean, kindle: boolean}} options
     */
    function renderWorkflowStage(stage, options) {
        const steps = [
            { key: 'init', text: 'Инициализация' },
            { key: 'extract', text: 'Извлечение контента' },
            { key: 'epub', text: 'Создание EPUB файла' }
        ];

        if (options.dropbox) {
            steps.push({ key: 'upload', text: 'Загрузка в Dropbox' });
        }
        if (options.kindle) {
            steps.push({ key: 'kindle', text: 'Отправка на Kindle' });
        }
        debugLog('Render workflow stage', { stage, options });

        let viewSteps;
        if (stage === 'done') {
            viewSteps = steps.map(step => ({ text: step.text, completed: true }));
        } else {
            const currentIndex = steps.findIndex(s => s.key === stage);
            if (currentIndex === -1) {
                throw new Error(`Unknown workflow stage: ${stage}`);
            }

            viewSteps = steps.map((step, index) => {
                if (index < currentIndex) {
                    return { text: step.text, completed: true };
                }

                if (index === currentIndex) {
                    return { text: `${step.text}...`, active: true };
                }

                return { text: step.text };
            });
        }

        setMultiStepStatus(viewSteps);
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
        debugLog('Multi-step status rendered', steps);
    }

    /**
     * Обновляет текст кнопки экспорта в зависимости от выбранных опций
     */
    function updateExportButtonText() {
        const toDropbox = uploadToDropboxCheckbox.checked;
        const toKindle = sendToKindleCheckbox.checked;

        if (toDropbox && toKindle) {
            exportBtn.textContent = 'Экспорт, Kindle и Dropbox';
        } else if (toKindle) {
            exportBtn.textContent = 'Экспорт и Kindle';
        } else if (toDropbox) {
            exportBtn.textContent = 'Экспорт и Dropbox';
        } else {
            exportBtn.textContent = 'Экспорт в EPUB';
        }
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
            exportBtn.textContent = 'Выполняется...';
        } else {
            progress.style.display = 'none';
            progressBar.style.width = '0%';
            exportBtn.disabled = false;
            updateExportButtonText();
        }
        debugLog('Progress updated', { percent });
    }

    /**
     * Конвертирует data URL в Blob
     * @param {string} dataUrl
     * @returns {Promise<Blob>}
     */
    async function dataURLToBlob(dataUrl) {
        const parts = dataUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/epub+zip';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }
});
