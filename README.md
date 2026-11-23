# Habit tracker

Appli mobile de journal, de suivi d'habitudes et d'emploi du temps, avec objectifs hebdomadaires, mensuels et annuels.

- **Stack** : Expo (React Native, TypeScript), Expo Router, SQLite chiffrée (SQLCipher).
- **Code** : `src/app` (écrans), `src/components`, `src/db` (base, chiffrement, actions), `src/logic` (calculs purs, testés dans `tests/`).
- **Mises à jour** : chaque modification de `main` publie une mise à jour à distance (`.github/workflows/mise-a-jour.yml`) vers les applis installées sur le canal `preview`.
- **Nouvelle version complète** (brique native ajoutée) : `npx eas-cli@latest build -p android --profile preview`.

Données : tout reste sur le téléphone, dans une base chiffrée dont la clé est gardée par le stockage sécurisé du système.
