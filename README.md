# Gaming Tournament API

REST API voor het beheren van gaming toernooien, teams en matches.

**Live API:** `https://staatnognietonline`
**Documentatie:** `https://url/api-docs`

---

## Technologie

- **Node.js / Express** — REST API met 27 endpoints
- **MongoDB + Mongoose** — 4 gekoppelde collecties (User, Team, Tournament, Match)
- **JWT** — authenticatie met vervaltijd, drie toegangsniveaus (publiek / gebruiker / admin)

## Installatie

```bash
git clone <repo-url>
cd gaming-tournament-api
npm install
cp .env.example .env   # vul je eigen waarden in
npm run dev
```

Vereist Node.js ≥ 18 en een draaiende MongoDB instantie (lokaal of Atlas).

## Omgevingsvariabelen

| Variabele       | Beschrijving                        |
|-----------------|-------------------------------------|
| `PORT`          | Poort waarop de server draait       |
| `MONGODB_URI`   | Verbindingsstring naar MongoDB      |
| `JWT_SECRET`    | Geheime sleutel voor JWT signing    |
| `JWT_EXPIRES_IN`| Vervaltijd van tokens (bv. `1h`)    |

## Tests

```bash
npm test
```

## Deployment

De API wordt gehost op **Railway**, de database op **MongoDB Atlas**. Beide hebben een gratis tier.

---

## 1. MongoDB Atlas

1. Maak een account op [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Maak een gratis cluster aan (M0)
3. Ga naar **Database Access** → voeg een gebruiker toe met een wachtwoord
4. Ga naar **Network Access** → voeg `0.0.0.0/0` toe (Railway heeft een dynamisch IP)
5. Ga naar **Connect** → kies *Drivers* → kopieer de connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/gaming-tournament
   ```

---

## 2. Railway

1. Maak een account op [railway.app](https://railway.app)
2. Klik **New Project** → **Deploy from GitHub repo** → selecteer je repository
3. Railway detecteert automatisch dat het een Node.js project is en voert `npm start` uit
4. Ga naar **Variables** en voeg de volgende omgevingsvariabelen toe:

| Variabele        | Waarde                              |
|------------------|-------------------------------------|
| `PORT`           | `3000`                              |
| `NODE_ENV`       | `production`                        |
| `MONGODB_URI`    | je Atlas connection string          |
| `JWT_SECRET`     | een lang willekeurig geheim         |
| `JWT_EXPIRES_IN` | `1h`                                |

5. Railway deployt automatisch bij elke push naar je hoofdbranch
6. Ga naar **Settings** → **Domains** → genereer een publieke URL

Plak die URL als `https://jouw-app.up.railway.app` in je README.