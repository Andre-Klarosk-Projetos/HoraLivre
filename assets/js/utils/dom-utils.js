export function setText(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.textContent = value ?? '-';
}

export function setHtml(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.innerHTML = value ?? '';
}

export function clearElement(element) {
  if (!element) {
    return;
  }

  element.innerHTML = '';
}

export function createListItem(html) {
  const li = document.createElement('li');
  li.innerHTML = html;
  return li;
}

export function showFeedback(element, message, type = 'success') {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = `feedback ${type}`;
}