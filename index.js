import { registerRootComponent } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import App from './App';

// En la versión web (iPhone), Alert.alert no muestra nada: usamos los diálogos del navegador.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, msg, buttons) => {
    const text = [title, msg].filter(Boolean).join('\n\n');
    if (buttons && buttons.length > 1) {
      const ok = window.confirm(text);
      const b = ok ? buttons.find((x) => x.style !== 'cancel') : buttons.find((x) => x.style === 'cancel');
      if (b && b.onPress) b.onPress();
    } else { window.alert(text); if (buttons && buttons[0] && buttons[0].onPress) buttons[0].onPress(); }
  };
}

// Guarda el último error grave para poder diagnosticarlo.
try {
  const prev = global.ErrorUtils && global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils && global.ErrorUtils.setGlobalHandler((e, fatal) => {
    try { AsyncStorage.setItem('hito-last-error', String((e && (e.stack || e.message)) || e).slice(0, 2000)); } catch (x) {}
    if (prev) prev(e, fatal);
  });
} catch (x) {}

if (Platform.OS !== 'web') { try { require('./src/background'); } catch (x) {} }

registerRootComponent(App);
