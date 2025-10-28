import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter } from './router';
import App from './App.vue';
import './styles/tailwind.css';

const pinia = createPinia();
const router = createRouter();
const app = createApp(App);

app.use(pinia);
app.use(router);
app.mount('#app');
