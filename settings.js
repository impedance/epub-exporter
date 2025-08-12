// @ts-check
/* global chrome, dropboxClient */
// Логика страницы настроек
// AICODE-WHY: Separate settings management improves user experience and code organization [2025-08-12]

document.addEventListener('DOMContentLoaded', async function() {
    const connectBtn = /** @type {HTMLButtonElement} */ (document.getElementById('connectBtn'));
    const disconnectBtn = /** @type {HTMLButtonElement} */ (document.getElementById('disconnectBtn'));
    const backBtn = /** @type {HTMLButtonElement} */ (document.getElementById('backBtn'));
    const folderPathInput = /** @type {HTMLInputElement} */ (document.getElementById('folderPath'));
    const saveFolderBtn = /** @type {HTMLButtonElement} */ (document.getElementById('saveFolderBtn'));
    const autoUploadCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('autoUpload'));
    const loading = /** @type {HTMLDivElement} */ (document.getElementById('loading'));
    const errorMessage = /** @type {HTMLDivElement} */ (document.getElementById('errorMessage'));
    const successMessage = /** @type {HTMLDivElement} */ (document.getElementById('successMessage'));

    // Инициализация страницы
    await initializePage();

    // Event Listeners
    connectBtn.addEventListener('click', handleConnect);
    disconnectBtn.addEventListener('click', handleDisconnect);
    backBtn.addEventListener('click', () => window.close());
    saveFolderBtn.addEventListener('click', handleSaveFolder);
    autoUploadCheckbox.addEventListener('change', handleAutoUploadChange);

    /**
     * Показывает сообщение об успехе
     * @param {string} message
     */
    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        
        // Автоматически скрываем через 3 секунды
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }

    /**
     * Скрывает все сообщения
     */
    function hideMessages() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }
}); Инициализирует страницу настроек
     */
    async function initializePage() {
        try {
            // Загружаем сохраненные настройки
            await loadSettings();
            
            // Проверяем статус подключения к Dropbox
            await updateDropboxStatus();
        } catch (error) {
            console.error('Error initializing settings page:', error);
            showError('Ошибка инициализации настроек');
        }
    }

    /**
     * Загружает сохраненные настройки
     */
    async function loadSettings() {
        try {
            const settings = await chrome.storage.local.get([
                'dropboxFolderPath',
                'autoUploadToDropbox'
            ]);

            if (settings.dropboxFolderPath) {
                folderPathInput.value = settings.dropboxFolderPath;
            }

            autoUploadCheckbox.checked = settings.autoUploadToDropbox || false;
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /**
     * Обновляет отображение статуса Dropbox
     */
    async function updateDropboxStatus() {
        try {
            const isConnected = await dropboxClient.isConnected();
            
            const dropboxStatus = document.getElementById('dropboxStatus');
            const statusText = document.getElementById('statusText');
            const connectSection = document.getElementById('connectSection');
            const connectedSection = document.getElementById('connectedSection');
            const userInfo = document.getElementById('userInfo');

            if (isConnected) {
                // Показываем подключенное состояние
                dropboxStatus.className = 'status connected';
                statusText.textContent = 'Dropbox подключен';
                connectSection.style.display = 'none';
                connectedSection.style.display = 'block';

                // Загружаем информацию о пользователе
                try {
                    const userInfoData = await dropboxClient.getUserInfo();
                    displayUserInfo(userInfoData);
                    userInfo.style.display = 'flex';
                } catch (error) {
                    console.error('Error loading user info:', error);
                    userInfo.style.display = 'none';
                }
            } else {
                // Показываем отключенное состояние
                dropboxStatus.className = 'status disconnected';
                statusText.textContent = 'Dropbox не подключен';
                connectSection.style.display = 'block';
                connectedSection.style.display = 'none';
                userInfo.style.display = 'none';
            }
        } catch (error) {
            console.error('Error updating Dropbox status:', error);
            showError('Ошибка проверки статуса Dropbox');
        }
    }

    /**
     * Отображает информацию о пользователе
     * @param {Object} userInfo
     */
    function displayUserInfo(userInfo) {
        const userInitial = document.getElementById('userInitial');
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');

        if (userInfo && userInfo.name) {
            const displayName = userInfo.name.display_name || userInfo.name.familiar_name || 'User';
            const email = userInfo.email || '';

            userInitial.textContent = displayName.charAt(0).toUpperCase();
            userName.textContent = displayName;
            userEmail.textContent = email;
        }
    }

    /**
     * Обрабатывает подключение к Dropbox
     */
    async function handleConnect() {
        showLoading(true);
        hideMessages();

        try {
            await dropboxClient.authorize();
            await updateDropboxStatus();
            showSuccess('Dropbox успешно подключен!');
        } catch (error) {
            console.error('Connection failed:', error);
            showError(`Ошибка подключения: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }

    /**
     * Обрабатывает отключение от Dropbox
     */
    async function handleDisconnect() {
        if (!confirm('Вы уверены, что хотите отключить Dropbox?')) {
            return;
        }

        try {
            await dropboxClient.disconnect();
            await updateDropboxStatus();
            showSuccess('Dropbox отключен');
        } catch (error) {
            console.error('Disconnect failed:', error);
            showError(`Ошибка отключения: ${error.message}`);
        }
    }

    /**
     * Сохраняет настройки папки
     */
    async function handleSaveFolder() {
        try {
            const folderPath = folderPathInput.value.trim();
            
            if (!folderPath) {
                showError('Введите путь к папке');
                return;
            }

            // Нормализуем путь
            let normalizedPath = folderPath;
            if (!normalizedPath.startsWith('/')) {
                normalizedPath = '/' + normalizedPath;
            }

            await chrome.storage.local.set({
                dropboxFolderPath: normalizedPath
            });

            folderPathInput.value = normalizedPath;
            showSuccess('Настройки папки сохранены');
        } catch (error) {
            console.error('Error saving folder settings:', error);
            showError('Ошибка сохранения настроек');
        }
    }

    /**
     * Обрабатывает изменение настройки автоматической загрузки
     */
    async function handleAutoUploadChange() {
        try {
            await chrome.storage.local.set({
                autoUploadToDropbox: autoUploadCheckbox.checked
            });

            const message = autoUploadCheckbox.checked ? 
                'Автоматическая загрузка включена' : 
                'Автоматическая загрузка отключена';
            
            showSuccess(message);
        } catch (error) {
            console.error('Error saving auto-upload setting:', error);
            showError('Ошибка сохранения настройки');
        }
    }

    /**
     * Показывает/скрывает индикатор загрузки
     * @param {boolean} show
     */
    function showLoading(show) {
        loading.style.display = show ? 'block' : 'none';
        connectBtn.disabled = show;
        disconnectBtn.disabled = show;
    }

    /**
     * Показывает сообщение об ошибке
     * @param {string} message
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
        
        // Автоматически скрываем через 5 секунд
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    /**
     *