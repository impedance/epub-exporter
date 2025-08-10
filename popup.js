// @ts-check
/* global chrome, extractContentFromTab */
document.addEventListener('DOMContentLoaded', function() {
    const exportBtn = /** @type {HTMLButtonElement} */ (document.getElementById('exportBtn'));
    const progress = /** @type {HTMLDivElement} */ (document.getElementById('progress'));
    const progressBar = /** @type {HTMLDivElement} */ (document.getElementById('progressBar'));
    const status = /** @type {HTMLDivElement} */ (document.getElementById('status'));

    exportBtn.addEventListener('click', async function() {
        try {
            setStatus('Инициализация...', 'loading');
            setProgress(10);
            
            // Получаем активную вкладку
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (!tab?.id) {
                throw new Error('Не удалось получить текущую вкладку');
            }
            
            setStatus('Извлечение контента...', 'loading');
            setProgress(30);
            
            // Отправляем сообщение в content script
            // AICODE-LINK: ./extractContent.js#extractContentFromTab
            const response = await extractContentFromTab(tab.id);
            
            if (!response || !response.success) {
                throw new Error(response?.error || 'Не удалось извлечь контент');
            }
            
            setStatus('Создание EPUB файла...', 'loading');
            setProgress(60);
            
            // Отправляем данные в background script для создания EPUB
            const epubResponse = await chrome.runtime.sendMessage({
                action: 'createEPUB',
                data: response.data
            });
            
            if (!epubResponse || !epubResponse.success) {
                throw new Error(epubResponse?.error || 'Ошибка создания EPUB');
            }
            
            setStatus('Загрузка файла...', 'loading');
            setProgress(90);
            
            // Скачиваем файл
            await chrome.downloads.download({
                url: epubResponse.downloadUrl,
                filename: epubResponse.filename
            });
            
            setProgress(100);
            setStatus('✅ EPUB файл успешно создан!', 'success');
            
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
    });

    function setStatus(message, type = '') {
        status.textContent = message;
        status.className = `status ${type}`;
    }

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

    // Проверяем, можно ли экспортировать контент с текущей страницы
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
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
        }
    });
});