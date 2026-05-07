# FolioPEA

Dashboard de suivi de portefeuille PEA, construit avec Next.js 14 App Router, Recharts et l'API Alpha Vantage.

## Fonctionnalités

- Dashboard principal avec valeur totale, plus-value et cash
- Page détail par ligne avec cours en temps réel (Alpha Vantage)
- Historique d'achats et dividendes par titre
- Calcul du PRU pondéré automatique
- API interne `/api/quote` et `/api/search`
- Fallback mock si la clé API n'est pas définie

## Lancer

```bash
npm install
npm run dev
```

## Variables d'environnement

```bash
cp .env.example .env.local
# Renseigne ta clé Alpha Vantage
```

Tu peux obtenir une clé gratuite sur [alphavantage.co](https://www.alphavantage.co/support/#api-key).
