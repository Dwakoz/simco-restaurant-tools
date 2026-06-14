# SimCo Restaurant Tools

Dashboard de gestion des stocks restaurants pour [Sim Companies](https://www.simcompanies.com/).

## Fonctionnalités

- Vue globale du stock entrepôt (besoin/cycle, besoin/jour, cycles restants avec badges colorés)
- Gestion par restaurant (R1–R15) : ingrédients, niveaux, type ECO/LUXE, ON/OFF
- Renommage et réorganisation libre des restaurants
- Historique des prix par phase économique (récession / normal / boom)
- Calcul du seuil de frais comptables (cash, obligations, bonus cadres)
- Synchronisation automatique avec le jeu (stock entrepôt + cash) via un petit
  serveur Node local

## Installation

### 1. Prérequis

- [Node.js](https://nodejs.org/) installé sur ta machine

### 2. Lancement

Double-clique sur `lancer-restaurant.bat` (Windows). Le serveur démarre sur
`http://localhost:3001` et ouvre automatiquement le dashboard dans Chrome.

### 3. Configuration de tes identifiants

Ces informations sont **personnelles** et ne doivent jamais être partagées ou
commitées sur GitHub.

1. Va dans l'onglet **⚙️ Configuration**
2. Renseigne pour chaque realm :
   - **ID entreprise** : l'identifiant numérique de ton entreprise (visible
     dans l'URL de ta page d'entreprise sur simcompanies.com)
   - **Cookie de session** (`sessionid=...`, voir ci-dessous)
3. Clique sur **Sauvegarder la configuration**

Le fichier `simco-config.json` est créé/mis à jour automatiquement — tu n'as
rien à éditer à la main.

#### Comment récupérer ton `sessionid` :

1. Connecte-toi sur [simcompanies.com](https://www.simcompanies.com/)
2. Ouvre les outils de développement du navigateur (F12) → onglet
   **Application** (Chrome) ou **Stockage** (Firefox) → **Cookies** →
   `https://www.simcompanies.com`
3. Copie la valeur du cookie `sessionid`
4. Colle-la dans l'onglet Configuration au format `sessionid=VALEUR_COPIEE`

⚠️ Ce cookie expire après quelques jours — il faudra le renouveler
régulièrement (même onglet, même procédure).

### 4. Tes données

Une fois tes restaurants configurés (ingrédients, niveaux, types...), clique
sur **💾 Sauvegarder** : `simco-data.json` est créé automatiquement et
contiendra toutes tes données (stock, prix, frais comptables, noms et ordre
des restaurants...).

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `simco-restaurant.html` | Interface du dashboard |
| `server-restaurant.js` | Serveur local (proxy API + sauvegarde) |
| `lancer-restaurant.bat` | Lanceur Windows |
| `simco-config.json` | **Ta config privée**, créée via l'onglet Configuration |
| `simco-data.json` | **Tes données privées**, créées au premier "Sauvegarder" |

## Notes

- Toutes les données (stock, prix, frais comptables...) sont sauvegardées
  localement dans `simco-data.json` via le bouton 💾.
- La synchronisation automatique (bouton 🔄 Tout synchroniser) nécessite que
  le serveur local soit lancé et ta configuration renseignée.
