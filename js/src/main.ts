import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import './focus.css';
// Preserve Safari's native caret placement independently of Chromium's.
if (
  navigator.vendor === 'Apple Computer, Inc.' &&
  !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
) {
  document.documentElement.classList.add('safari');
}
createApp(App).mount('#app');
