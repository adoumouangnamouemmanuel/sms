import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE } from '@edutrack/shared';

const resources = {
  fr: {
    translation: {
      shell: {
        status: 'Fondation locale',
        phase: 'Phase 1.7.1',
        heading: 'Un socle fiable pour les workflows hors ligne.',
        summary:
          "L'interface produit est prête pour le squelette Vite/Tauri, avec les garde-fous de qualité avant les écrans métier.",
        statusPanelLabel: 'Etat du socle applicatif',
        qualityLabel: 'Qualite',
        storageLabel: 'Stockage',
        networkLabel: 'Reseau',
        quality: 'Contrôles qualité activés',
        sqlite: 'SQLite local uniquement',
        offline: 'Internet non requis pour le socle',
        footer:
          'Version 1 cible les ordinateurs Windows des écoles avec une expérience française complète.',
      },
    },
  },
  ar: {
    translation: {
      shell: {
        status: 'أساس محلي',
        phase: 'المرحلة 1.7.1',
        heading: 'أساس موثوق لسير العمل دون اتصال.',
        summary: 'واجهة المنتج جاهزة لهيكل Vite وTauri مع ضوابط الجودة قبل شاشات العمل.',
        statusPanelLabel: 'حالة أساس التطبيق',
        qualityLabel: 'الجودة',
        storageLabel: 'التخزين',
        networkLabel: 'الشبكة',
        quality: 'ضوابط الجودة مفعلة',
        sqlite: 'SQLite المحلي فقط',
        offline: 'الإنترنت غير مطلوب للأساس',
        footer: 'الإصدار الأول يستهدف حواسيب Windows في المدارس مع تجربة فرنسية كاملة.',
      },
    },
  },
  en: {
    translation: {
      shell: {
        status: 'Local foundation',
        phase: 'Phase 1.7.1',
        heading: 'A reliable base for offline workflows.',
        summary:
          'The product UI is ready for the Vite/Tauri skeleton, with quality guardrails before domain screens.',
        statusPanelLabel: 'Application foundation status',
        qualityLabel: 'Quality',
        storageLabel: 'Storage',
        networkLabel: 'Network',
        quality: 'Quality checks enabled',
        sqlite: 'Local SQLite only',
        offline: 'Internet not required for the foundation',
        footer: 'Version 1 targets school Windows computers with a complete French experience.',
      },
    },
  },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
