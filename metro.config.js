// Version web (contrôle visuel) : expo-sqlite a besoin du fichier .wasm et des en-têtes COOP/COEP.
// Voir https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/ (« Web setup »).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
