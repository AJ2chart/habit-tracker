// Déclare les feuilles de style importées par le modèle Expo (version web),
// exigé par TypeScript 6 pour les imports de fichiers .css.
declare module '*.css';
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
