# Carnet d'aube

Appli mobile (Android) de journal, de suivi d'habitudes et d'emploi du temps, avec objectifs hebdomadaires, mensuels et annuels.

- **Stack** : Expo SDK 58 (React Native, TypeScript), Expo Router, SQLite chiffrée (SQLCipher), react-native-keyboard-controller.
- **Code** : `src/app` (écrans), `src/components`, `src/db` (base, chiffrement, actions, sauvegarde), `src/logic` (calculs purs), `src/notifications` (rappels ; versions `.web.ts` sans notifications).
- **Base** : schéma versionné dans `src/db/schema.ts` (v5 : matin, planning validé, notes rapides). Ne jamais modifier un bloc de migration déjà publié.

## Mises à jour et versions

- **Mise à jour à distance** : chaque modification de `main` lance `.github/workflows/mise-a-jour.yml` (TypeScript, tests, puis EAS Update sur le canal `preview`).
- **Nouvelle version complète** (brique native ajoutée ou changée) : workflow « Nouvelle version Android » (`version-android.yml`, lancement manuel). Augmenter `version` dans `app.json` : les mises à jour à distance ne visent que les applis de la même version.

## Tests

- `npx tsx tests/logic.test.ts` : calculs (`src/logic`).
- `npx tsx tests/db.test.ts` : migrations et lecture/écriture de la base (SQLite de Node).
- `npx tsx tests/backup.test.ts` : sauvegarde chiffrée.
- **Contrôle béton** (lancement manuel, `.github/workflows/controle-beton.yml`) : lint sans alerte, TypeScript, expo-doctor, tous les tests, puis contrôle visuel de la version web avec Playwright (`tests/e2e/visual.mjs`) : débordements, textes coupés, textes cassés (`undefined`, pluriels…), erreurs JavaScript, interactions minutées aussi sur processeur ralenti ×6. Données de test : version web ouverte avec `?seed=extreme` ou `?seed=empty` (`src/db/test-seed.ts`, jamais utilisé sur le téléphone). Le rapport complet et des captures sont publiés sur la branche `controle-beton-rapport`.

Données : tout reste sur le téléphone, dans une base chiffrée dont la clé est gardée par le stockage sécurisé du système.
