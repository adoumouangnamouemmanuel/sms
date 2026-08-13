import { DEFAULT_LOCALE } from '@edutrack/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  fr: {
    translation: {
      shell: {
        brandPanelLabel: 'Présentation EduTrack Africa',
        brandSubtitle: 'Gestion scolaire',
        eyebrow: 'Accès sécurisé',
        footer:
          'Pensé pour les écoles qui travaillent sur ordinateur local, même sans connexion fiable.',
        heading: 'Bienvenue sur EduTrack Africa',
        summary: 'Gérez les dossiers scolaires avec une session locale sécurisée.',
      },
      auth: {
        apiUnavailable: "Le service local n'est pas prêt. Réessayez dans un instant.",
        errors: {
          accountLocked: 'Le compte est temporairement verrouillé. Réessayez dans 15 minutes.',
          forbidden: "Vous n'êtes pas autorisé à effectuer cette opération.",
          generic: 'La connexion locale a échoué. Réessayez.',
          invalidCredentials: "L'identifiant ou le mot de passe est incorrect.",
          invalidCurrentPassword: 'Le mot de passe actuel est incorrect.',
          sessionExpired: 'La session locale est expirée. Reconnectez-vous.',
          userNotFound: 'Utilisateur introuvable.',
        },
        loginPanelLabel: 'Connexion locale',
        password: 'Mot de passe',
        passwordPlaceholder: 'Votre mot de passe',
        phase: 'Espace personnel',
        role: 'Rôle',
        roles: {
          SCHOOL_MASTER: 'Direction',
          TEACHER: 'Enseignant',
        },
        schoolCode: 'Code école',
        schoolCodePlaceholder: 'Ex. NDS-DEMO',
        sessionActive: 'Session locale active',
        sessionPanelLabel: 'Session authentifiée',
        submit: 'Se connecter',
        submitting: 'Connexion...',
        subtitle: 'Entrez vos identifiants fournis par la direction.',
        successTitle: 'Accès confirmé',
        title: 'Connexion du personnel',
        username: "Nom d'utilisateur",
        usernamePlaceholder: 'Ex. directeur',
        validation: {
          passwordRequired: 'Le mot de passe est requis.',
          schoolCodeRequired: 'Le code école est requis.',
          usernameRequired: "Le nom d'utilisateur est requis.",
        },
      },
    },
  },
  ar: {
    translation: {
      shell: {
        brandPanelLabel: 'تعريف EduTrack Africa',
        brandSubtitle: 'إدارة مدرسية',
        eyebrow: 'وصول آمن',
        footer: 'مصمم للمدارس التي تعمل على حاسوب محلي حتى مع اتصال غير مستقر.',
        heading: 'مرحباً بك في EduTrack Africa',
        summary: 'سجل الدخول لإدارة ملفات المدرسة عبر جلسة محلية محمية.',
      },
      auth: {
        apiUnavailable: 'الخدمة المحلية غير جاهزة. حاول مرة أخرى بعد قليل.',
        errors: {
          accountLocked: 'الحساب مقفل مؤقتاً. حاول مرة أخرى بعد 15 دقيقة.',
          forbidden: 'غير مسموح لك بتنفيذ هذه العملية.',
          generic: 'فشل تسجيل الدخول المحلي. حاول مرة أخرى.',
          invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
          invalidCurrentPassword: 'كلمة المرور الحالية غير صحيحة.',
          sessionExpired: 'انتهت الجلسة المحلية. سجل الدخول مرة أخرى.',
          userNotFound: 'المستخدم غير موجود.',
        },
        loginPanelLabel: 'تسجيل الدخول المحلي',
        password: 'كلمة المرور',
        passwordPlaceholder: 'كلمة المرور',
        phase: 'المساحة الشخصية',
        role: 'الدور',
        roles: {
          SCHOOL_MASTER: 'الإدارة',
          TEACHER: 'معلم',
        },
        schoolCode: 'رمز المدرسة',
        schoolCodePlaceholder: 'مثال NDS-DEMO',
        sessionActive: 'الجلسة المحلية نشطة',
        sessionPanelLabel: 'جلسة مصادق عليها',
        submit: 'تسجيل الدخول',
        submitting: 'جار تسجيل الدخول...',
        subtitle: 'أدخل بيانات الدخول التي وفرتها الإدارة.',
        successTitle: 'تم تأكيد الوصول',
        title: 'تسجيل دخول الموظفين',
        username: 'اسم المستخدم',
        usernamePlaceholder: 'مثال المدير',
        validation: {
          passwordRequired: 'كلمة المرور مطلوبة.',
          schoolCodeRequired: 'رمز المدرسة مطلوب.',
          usernameRequired: 'اسم المستخدم مطلوب.',
        },
      },
    },
  },
  en: {
    translation: {
      shell: {
        brandPanelLabel: 'EduTrack Africa introduction',
        brandSubtitle: 'School management',
        eyebrow: 'Secure access',
        footer: 'Designed for schools working on a local computer, even with unreliable internet.',
        heading: 'Welcome to EduTrack Africa',
        summary: 'Sign in to manage school records with a protected local session.',
      },
      auth: {
        apiUnavailable: 'The local service is not ready. Try again in a moment.',
        errors: {
          accountLocked: 'The account is temporarily locked. Try again in 15 minutes.',
          forbidden: 'You are not allowed to perform this action.',
          generic: 'Local login failed. Try again.',
          invalidCredentials: 'The username or password is incorrect.',
          invalidCurrentPassword: 'The current password is incorrect.',
          sessionExpired: 'The local session has expired. Sign in again.',
          userNotFound: 'User not found.',
        },
        loginPanelLabel: 'Local login',
        password: 'Password',
        passwordPlaceholder: 'Your password',
        phase: 'Personal space',
        role: 'Role',
        roles: {
          SCHOOL_MASTER: 'School management',
          TEACHER: 'Teacher',
        },
        schoolCode: 'School code',
        schoolCodePlaceholder: 'E.g. NDS-DEMO',
        sessionActive: 'Local session active',
        sessionPanelLabel: 'Authenticated session',
        submit: 'Sign in',
        submitting: 'Signing in...',
        subtitle: 'Enter the credentials provided by school management.',
        successTitle: 'Access confirmed',
        title: 'Staff login',
        username: 'Username',
        usernamePlaceholder: 'E.g. principal',
        validation: {
          passwordRequired: 'Password is required.',
          schoolCodeRequired: 'School code is required.',
          usernameRequired: 'Username is required.',
        },
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
