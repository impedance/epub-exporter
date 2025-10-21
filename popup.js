// @ts-check
/* global chrome, extractContentFromTab, dropboxClient */

document.addEventListener('DOMContentLoaded', function() {
    const exportBtn = /** @type {HTMLButtonElement} */ (document.getElementById('exportBtn'));
    const uploadToDropboxCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('uploadToDropbox'));
    const settingsBtn = /** @type {HTMLButtonElement} */ (document.getElementById('settingsBtn'));
    const progress = /** @type {HTMLDivElement} */ (document.getElementById('progress'));
    const progressBar = /** @type {HTMLDivElement} */ (document.getElementById('progressBar'));
    const status = /** @type {HTMLDivElement} */ (document.getElementById('status'));

    const debugLog = (...args) => {
        console.log('[popup]', ...args);
    };

    // Инициализация
    debugLog('Popup mounted, starting initialization');
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
            debugLog('Initializing popup');
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
     * Загружает сохраненные настройки
     */
    async function loadSettings() {
        try {
            const settings = await chrome.storage.local.get(['autoUploadToDropbox']);
            debugLog('Loaded settings', settings);
            
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
            debugLog('Active tab info', currentTab);
            
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
        debugLog('Starting export flow', { shouldUploadToDropbox });
        
        try {
            // Шаг 1: Инициализация
            renderWorkflowStage('init', shouldUploadToDropbox);
            setProgress(5);
            
            // Получаем активную вкладку
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            debugLog('Queried tabs', tabs);
            if (!tab?.id) {
                throw new Error('Не удалось получить текущую вкладку');
            }
            
            // Шаг 2: Извлечение контента
            renderWorkflowStage('extract', shouldUploadToDropbox);
            setProgress(20);
            
            const response = await extractContentFromTab(tab.id);
            debugLog('Content extraction response', response);
            
            if (!response || !response.success) {
                throw new Error(response?.error || 'Не удалось извлечь контент');
            }
            
            // Шаг 3: Создание EPUB
            renderWorkflowStage('epub', shouldUploadToDropbox);
            setProgress(50);
            
            const epubResponse = await chrome.runtime.sendMessage({
                action: 'createEPUB',
                data: response.data,
                uploadToDropbox: shouldUploadToDropbox
            });
            debugLog('EPUB generation response', epubResponse);
            
            if (!epubResponse || !epubResponse.success) {
                throw new Error(epubResponse?.error || 'Ошибка создания EPUB');
            }
            
            // Шаг 4: Загрузка в Dropbox (если включена)
            renderWorkflowStage('done', shouldUploadToDropbox);
            setProgress(shouldUploadToDropbox ? 95 : 85);
            
            // Финальная загрузка файла
            await chrome.downloads.download({
                url: epubResponse.downloadUrl,
                filename: epubResponse.filename
            });
            debugLog('Triggered download', { filename: epubResponse.filename });
            
            setProgress(100);
            
            const successMessage = shouldUploadToDropbox ? 
                `✅ EPUB создан и загружен в Dropbox${epubResponse.dropboxPath ? ` (${epubResponse.dropboxPath})` : ''}!` : 
                '✅ EPUB файл успешно создан!';
            
            setStatus(successMessage, 'success');
            
            // Закрываем popup через 2 секунды
            setTimeout(() => {
                window.close();
            }, 2000);
            
        } catch (error) {
            const err = /** @type {Error} */ (error);
            console.error('Ошибка экспорта:', err);
            debugLog('Export flow failed', err);
            setStatus(`❌ ${err.message}`, 'error');
            setProgress(0);
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
        debugLog('Dropbox toggle changed', {
            checked: uploadToDropboxCheckbox.checked,
            disabled: uploadToDropboxCheckbox.disabled
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
     * @param {'init'|'extract'|'epub'|'done'} stage
     * @param {boolean} includeDropbox
     */
    function renderWorkflowStage(stage, includeDropbox) {
        const steps = [
            { key: 'init', text: 'Инициализация' },
            { key: 'extract', text: 'Извлечение контента' },
            { key: 'epub', text: 'Создание EPUB файла' }
        ];

        if (includeDropbox) {
            steps.push({ key: 'upload', text: 'Загрузка в Dropbox' });
        }
        debugLog('Render workflow stage', { stage, includeDropbox });

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
        debugLog('Progress updated', { percent });
    }
});
