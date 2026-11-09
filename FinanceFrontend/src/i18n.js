import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./0_langs/en.json";

// Translations are bundled inline (no http backend). Most UI strings use the
// English text as key, so a missing key simply renders the key itself.
i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
    },
    lng: "en",
    fallbackLng: "en",
    debug: false,
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
