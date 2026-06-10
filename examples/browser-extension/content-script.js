const selection = window.getSelection();
const text = selection ? selection.toString().trim() : '';

if (!text) {
    alert('Select taQu rule text first.');
} else {
    alert('Selected taQu rule text length: ' + text.length);
}
