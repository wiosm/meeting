const targetUrlInput = document.getElementById('targetUrl');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b00' : '#0a5';
}

chrome.runtime.sendMessage({ type: 'get-target-url' }, (response) => {
  if (!response?.ok) {
    setStatus(response?.error || 'Failed to load saved URL.', true);
    return;
  }

  targetUrlInput.value = response.targetUrl;
});

saveBtn.addEventListener('click', () => {
  const value = targetUrlInput.value.trim();
  if (!value) {
    setStatus('Please enter a URL.', true);
    return;
  }

  try {
    new URL(value);
  } catch {
    setStatus('URL is invalid.', true);
    return;
  }

  chrome.runtime.sendMessage({ type: 'set-target-url', targetUrl: value }, (response) => {
    if (!response?.ok) {
      setStatus(response?.error || 'Failed to save URL.', true);
      return;
    }

    setStatus('Saved.');
  });
});
