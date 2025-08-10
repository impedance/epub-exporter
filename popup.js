document.addEventListener('DOMContentLoaded', function() {
    const exportBtn = document.getElementById('exportBtn');
    const progress = document.getElementById('progress');
    const progressBar = document.getElementById('progressBar');
    const status = document.getElementById('status');

    exportBtn.addEventListener('click', async function() {
        try {
            setStatus('Инициализация...', 'loading');
            setProgress(10);
            
            // Получаем активную вкладку
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            setStatus('Извлечение контента...', 'loading');
            setProgress(30);
            
            // Отправляем сообщение в content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
            
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
            console.error('Ошибка экспорта:', error);
            setStatus(`❌ ${error.message}`, 'error');
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
        if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://')) {
            setStatus('⚠️ Экспорт недоступен для системных страниц', 'error');
            exportBtn.disabled = true;
        } else {
            setStatus('Готов к экспорту');
        }
    });
});