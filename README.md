# Gaming Tournament API

REST API voor het beheren van gaming toernooien, teams en matches.

**Live API:** `https://node-js-eindopdracht.onrender.com`
Render is gratis, het kan dus even duren voordat de API opstart als hij in slaapmodus ging.

**Documentatie:** `https://node-js-eindopdracht.onrender.com/api-docs`
De documentatie staat via swagger op dezelfde link bij /api-docs


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

## Data-ontwerp: embedded vs. references

De vuistregel in dit project is: **embed wat altijd samen wordt gelezen; gebruik een reference als de data ook zelfstandig wordt bevraagd of te groot kan worden**.

| Relatie | Strategie | Reden |
|---|---|---|
| `Tournament.rounds` + `bracketMatches` | Embedded | Een bracket heeft geen waarde buiten het toernooi; wordt altijd in één keer opgehaald |
| `Match.events` | Embedded | Events zijn niet-herbruikbare logentries die alleen betekenis hebben bij hun match |
| `Team.members` | Embedded subdocument | Ledenlijst is klein (max 10) en wordt altijd samen met het team gelezen |
| `Match → Tournament` | Reference | Matches worden ook zelfstandig bevraagd via `GET /api/matches` |
| `Match → Team (teamA/teamB)` | Reference | Teams bestaan onafhankelijk van matches en worden in meerdere matches hergebruikt |
| `Tournament → Team (registeredTeams)` | Reference | Teams kunnen aan meerdere toernooien deelnemen |
| `Team → User (captain, members.userId)` | Reference | Users bestaan onafhankelijk en worden in meerdere contexten gebruikt |

---

## Deployment

De API wordt gehost op **Render**, de database op **MongoDB Atlas**. Beide hebben een gratis tier.

> **Let op:** de gratis laag van Render laat de server na inactiviteit in slaapstand gaan. Het eerste verzoek na een slaapperiode kan 30–60 seconden duren.

---

## 1. MongoDB Atlas

1. Maak een account op [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Maak een gratis cluster aan (M0)
3. Ga naar **Database Access** → voeg een gebruiker toe met een wachtwoord
4. Ga naar **Network Access** → voeg `0.0.0.0/0` toe (Render heeft een dynamisch IP)
5. Ga naar **Connect** → kies *Drivers* → kopieer de connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/gaming-tournament
   ```

---

## 2. Render

1. Maak een account op [render.com](https://render.com)
2. Klik **New +** → **Web Service**
3. Verbind je GitHub-account en selecteer je repository
4. Vul de instellingen in:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Ga naar **Environment** en voeg de volgende omgevingsvariabelen toe:

| Variabele        | Waarde                              |
|------------------|-------------------------------------|
| `PORT`           | `3000`                              |
| `NODE_ENV`       | `production`                        |
| `MONGODB_URI`    | je Atlas connection string          |
| `JWT_SECRET`     | een lang willekeurig geheim         |
| `JWT_EXPIRES_IN` | `1h`                                |

6. Klik **Create Web Service** — Render deployt automatisch bij elke push naar je hoofdbranch
7. Je publieke URL vind je bovenaan de service-pagina: `https://jouw-app.onrender.com`

Plak die URL als live link in je README.