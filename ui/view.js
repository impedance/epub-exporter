// @ts-check

/**
 * @param {{
 *   status: HTMLDivElement,
 *   progress: HTMLDivElement,
 *   progressBar: HTMLDivElement
 * }} elements
 * @param {(message: string, payload?: any) => void} debugLog
 */
export function createPopupView(elements, debugLog) {
  const { status, progress, progressBar } = elements;

  /**
   * @param {string} message
   * @param {string} [type]
   */
  function setStatus(message, type = '') {
    status.innerHTML = message;
    status.className = `status ${type}`;
    debugLog('Status updated', { message, type });
  }

  /**
   * @param {Array<{text: string, active?: boolean, completed?: boolean}>} steps
   */
  function setMultiStepStatus(steps) {
    const stepsHtml = steps
      .map((step) => {
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
      })
      .join('');

    status.innerHTML = `<div class="multi-step">${stepsHtml}</div>`;
    status.className = 'status';
    debugLog('Multi-step status rendered', steps);
  }

  /**
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

    let viewSteps;
    if (stage === 'done') {
      viewSteps = steps.map((step) => ({ text: step.text, completed: true }));
    } else {
      const currentIndex = steps.findIndex((step) => step.key === stage);
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
   * @param {number} percent
   * @param {HTMLButtonElement[]} controls
   */
  function setProgress(percent, controls) {
    if (percent > 0) {
      progress.style.display = 'block';
      progressBar.style.width = `${percent}%`;
      controls.forEach((control) => {
        control.disabled = true;
      });
    } else {
      progress.style.display = 'none';
      progressBar.style.width = '0%';
    }
    debugLog('Progress updated', { percent });
  }

  return {
    setStatus,
    setMultiStepStatus,
    renderWorkflowStage,
    setProgress
  };
}
