const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Gaming Tournament API',
      version: '1.0.0',
      description: 'REST API voor het beheren van gaming-toernooien, teams en wedstrijden.',
    },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id:      { type: 'string', example: '664abc123def456789012345' },
            username: { type: 'string', example: 'speler123' },
            email:    { type: 'string', example: 'speler@example.com' },
            role:     { type: 'string', enum: ['user', 'admin'], example: 'user' },
          },
        },
        Team: {
          type: 'object',
          properties: {
            _id:         { type: 'string', example: '664abc123def456789012345' },
            name:        { type: 'string', example: 'Team Thunder' },
            tag:         { type: 'string', example: 'THD' },
            description: { type: 'string', example: 'Een competitief team' },
            captain:     { $ref: '#/components/schemas/User' },
            members:     { type: 'array', items: { type: 'object' } },
            isActive:    { type: 'boolean', example: true },
            stats: {
              type: 'object',
              properties: {
                wins:              { type: 'integer', example: 5 },
                losses:            { type: 'integer', example: 2 },
                matchesPlayed:     { type: 'integer', example: 7 },
                tournamentsPlayed: { type: 'integer', example: 3 },
              },
            },
          },
        },
        Tournament: {
          type: 'object',
          properties: {
            _id:    { type: 'string', example: '664abc123def456789012345' },
            name:   { type: 'string', example: 'Zomer Kampioenschap 2025' },
            game:   { type: 'string', example: 'Valorant' },
            format: { type: 'string', enum: ['single_elimination'], example: 'single_elimination' },
            status: { type: 'string', enum: ['registration', 'ongoing', 'completed', 'cancelled'], example: 'registration' },
            admin:  { $ref: '#/components/schemas/User' },
            registeredTeams: { type: 'array', items: { $ref: '#/components/schemas/Team' } },
            settings: {
              type: 'object',
              properties: {
                maxTeams:    { type: 'integer', example: 8 },
                prizePool:   { type: 'string',  example: '€500' },
                startDate:   { type: 'string',  format: 'date-time' },
                description: { type: 'string',  example: 'Open toernooi voor iedereen' },
              },
            },
          },
        },
        Match: {
          type: 'object',
          properties: {
            _id:       { type: 'string', example: '664abc123def456789012345' },
            tournament:{ type: 'string', example: '664abc123def456789012345' },
            round:     { type: 'integer', example: 1 },
            roundName: { type: 'string',  example: 'Quarter Final' },
            teamA:     { $ref: '#/components/schemas/Team' },
            teamB:     { $ref: '#/components/schemas/Team' },
            winner:    { $ref: '#/components/schemas/Team' },
            status:    { type: 'string', enum: ['scheduled', 'ongoing', 'completed', 'forfeit'], example: 'scheduled' },
            scores: {
              type: 'object',
              properties: {
                teamAScore: { type: 'integer', example: 13 },
                teamBScore: { type: 'integer', example: 7  },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page:  { type: 'integer', example: 1  },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 42 },
            pages: { type: 'integer', example: 3  },
          },
        },
        Error: {
          type: 'object',
          properties: {
            status:  { type: 'string', example: 'fail' },
            message: { type: 'string', example: 'Omschrijving van de fout' },
          },
        },
      },
    },

    paths: {

      // ── AUTH ──────────────────────────────────────────────────────────────
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Nieuw account aanmaken',
          description: 'Registreert een nieuwe gebruiker en geeft direct een JWT-token terug.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'email', 'password'],
                  properties: {
                    username: { type: 'string', example: 'speler123' },
                    email:    { type: 'string', example: 'speler@example.com' },
                    password: { type: 'string', example: 'geheim1234' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Account aangemaakt' },
            400: { description: 'Ontbrekende of ongeldige velden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            409: { description: 'E-mail of gebruikersnaam al in gebruik' },
          },
        },
      },

      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Inloggen',
          description: 'Controleert de inloggegevens en stuurt een JWT-token terug bij succes.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email:    { type: 'string', example: 'speler@example.com' },
                    password: { type: 'string', example: 'geheim1234' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Succesvol ingelogd, token in response' },
            400: { description: 'E-mail of wachtwoord ontbreekt' },
            401: { description: 'Ongeldige inloggegevens' },
          },
        },
      },

      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Eigen profiel ophalen',
          description: 'Geeft de gegevens van de momenteel ingelogde gebruiker terug.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Gebruikersgegevens', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
            401: { description: 'Niet ingelogd of ongeldig token' },
          },
        },
      },

      // ── USERS ─────────────────────────────────────────────────────────────
      '/users': {
        get: {
          tags: ['Gebruikers'],
          summary: 'Alle gebruikers ophalen (admin)',
          description: 'Geeft een gepagineerde lijst van alle geregistreerde gebruikers. Alleen toegankelijk voor admins.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page',  in: 'query', schema: { type: 'integer', default: 1  }, description: 'Paginanummer' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: 'Aantal resultaten per pagina (max 50)' },
          ],
          responses: {
            200: { description: 'Lijst van gebruikers' },
            401: { description: 'Niet ingelogd' },
            403: { description: 'Geen admin-rechten' },
          },
        },
      },

      '/users/{id}': {
        get: {
          tags: ['Gebruikers'],
          summary: 'Gebruiker ophalen',
          description: 'Geeft de gegevens van één gebruiker terug. Alleen de eigen gebruiker of een admin heeft toegang.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'MongoDB ID van de gebruiker' }],
          responses: {
            200: { description: 'Gebruikersgegevens', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
            404: { description: 'Gebruiker niet gevonden' },
          },
        },
        put: {
          tags: ['Gebruikers'],
          summary: 'Gebruikersprofiel bijwerken',
          description: 'Werkt de gebruikersnaam of het e-mailadres bij. Gebruikers mogen alleen hun eigen profiel aanpassen; admins mogen elk profiel wijzigen. Wachtwoord en rol kunnen hier niet worden gewijzigd.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    username: { type: 'string', example: 'nieuweNaam' },
                    email:    { type: 'string', example: 'nieuw@example.com' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Profiel bijgewerkt' },
            403: { description: 'Geen toegang tot dit profiel' },
            409: { description: 'Gebruikersnaam of e-mail al in gebruik' },
          },
        },
        delete: {
          tags: ['Gebruikers'],
          summary: 'Gebruiker verwijderen (admin)',
          description: 'Verwijdert een gebruiker permanent. Alleen admins kunnen dit uitvoeren.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            204: { description: 'Gebruiker verwijderd' },
            403: { description: 'Geen admin-rechten' },
            404: { description: 'Gebruiker niet gevonden' },
          },
        },
      },

      // ── TEAMS ─────────────────────────────────────────────────────────────
      '/teams': {
        get: {
          tags: ['Teams'],
          summary: 'Alle actieve teams ophalen',
          description: 'Geeft een gepagineerde lijst van alle actieve teams terug. Openbaar toegankelijk.',
          parameters: [
            { name: 'page',  in: 'query', schema: { type: 'integer', default: 1  }, description: 'Paginanummer' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: 'Aantal per pagina (max 50)' },
          ],
          responses: {
            200: {
              description: 'Lijst van teams',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      results:    { type: 'integer' },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                      data:       { type: 'object', properties: { teams: { type: 'array', items: { $ref: '#/components/schemas/Team' } } } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Teams'],
          summary: 'Nieuw team aanmaken',
          description: 'Maakt een nieuw team aan. De ingelogde gebruiker wordt automatisch captain. Je kunt maar captain zijn van één team tegelijk.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'tag'],
                  properties: {
                    name:        { type: 'string', example: 'Team Thunder' },
                    tag:         { type: 'string', example: 'THD', description: 'Korte afkorting, wordt automatisch hoofdletters' },
                    description: { type: 'string', example: 'Het sterkste team van de regio' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Team aangemaakt' },
            409: { description: 'Je bent al captain van een team, of de naam/tag is al in gebruik' },
          },
        },
      },

      '/teams/{id}': {
        get: {
          tags: ['Teams'],
          summary: 'Team ophalen',
          description: 'Geeft de details van één team terug, inclusief captain en alle leden. Openbaar toegankelijk.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Teamgegevens', content: { 'application/json': { schema: { $ref: '#/components/schemas/Team' } } } },
            404: { description: 'Team niet gevonden' },
          },
        },
        put: {
          tags: ['Teams'],
          summary: 'Teamgegevens bijwerken',
          description: 'Werkt de teamomschrijving bij. Alleen de captain of een admin mag dit doen. Naam en tag aanpassen is voorbehouden aan admins.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    description: { type: 'string', example: 'Bijgewerkte beschrijving' },
                    name:        { type: 'string', example: 'Nieuwe naam (alleen admin)' },
                    tag:         { type: 'string', example: 'NEW' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Team bijgewerkt' },
            403: { description: 'Geen rechten om dit team aan te passen' },
          },
        },
        delete: {
          tags: ['Teams'],
          summary: 'Team ontbinden',
          description: 'Zet het team op inactief (soft delete). Alleen de captain of een admin kan het team ontbinden.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            204: { description: 'Team ontbonden' },
            403: { description: 'Geen rechten' },
            404: { description: 'Team niet gevonden' },
          },
        },
      },

      '/teams/{id}/join': {
        post: {
          tags: ['Teams'],
          summary: 'Deelnemen aan een team',
          description: 'Voegt de ingelogde gebruiker toe als lid van het team. Een team kan maximaal 10 leden hebben.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Succesvol lid geworden' },
            400: { description: 'Team is vol (max 10 leden)' },
            409: { description: 'Je bent al lid van dit team' },
          },
        },
      },

      '/teams/{id}/leave': {
        delete: {
          tags: ['Teams'],
          summary: 'Team verlaten',
          description: 'Verwijdert de ingelogde gebruiker uit het team. De captain kan het team niet verlaten; gebruik daarvoor "ontbinden".',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Succesvol het team verlaten' },
            400: { description: 'Captain kan het team niet verlaten' },
            404: { description: 'Je bent geen lid van dit team' },
          },
        },
      },

      // ── TOURNAMENTS ───────────────────────────────────────────────────────
      '/tournaments': {
        get: {
          tags: ['Toernooien'],
          summary: 'Alle toernooien ophalen',
          description: 'Geeft een gepagineerde lijst van toernooien, optioneel gefilterd op status of spelnaam. Openbaar toegankelijk.',
          parameters: [
            { name: 'page',   in: 'query', schema: { type: 'integer', default: 1 }, description: 'Paginanummer' },
            { name: 'limit',  in: 'query', schema: { type: 'integer', default: 20 }, description: 'Aantal per pagina (max 50)' },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['registration', 'ongoing', 'completed', 'cancelled'] }, description: 'Filter op status' },
            { name: 'game',   in: 'query', schema: { type: 'string' }, description: 'Filter op spelnaam (hoofdletterongevoelig)' },
          ],
          responses: {
            200: { description: 'Lijst van toernooien' },
            400: { description: 'Ongeldige statusfilter' },
          },
        },
        post: {
          tags: ['Toernooien'],
          summary: 'Nieuw toernooi aanmaken (admin)',
          description: 'Maakt een nieuw toernooi aan. Vereist: naam, spel, maximaal aantal teams en startdatum.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'game', 'settings'],
                  properties: {
                    name:   { type: 'string', example: 'Zomer Kampioenschap' },
                    game:   { type: 'string', example: 'Valorant' },
                    format: { type: 'string', enum: ['single_elimination'], default: 'single_elimination' },
                    settings: {
                      type: 'object',
                      required: ['maxTeams', 'startDate'],
                      properties: {
                        maxTeams:    { type: 'integer', example: 8, description: 'Minimaal 2' },
                        startDate:   { type: 'string', format: 'date-time', example: '2025-08-01T12:00:00Z' },
                        prizePool:   { type: 'string', example: '€500' },
                        description: { type: 'string', example: 'Open toernooi' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Toernooi aangemaakt' },
            400: { description: 'Ontbrekende of ongeldige velden' },
            403: { description: 'Geen admin-rechten' },
          },
        },
      },

      '/tournaments/{id}': {
        get: {
          tags: ['Toernooien'],
          summary: 'Toernooi ophalen',
          description: 'Geeft de volledige details van één toernooi terug, inclusief bracket-rondes en geregistreerde teams. Openbaar toegankelijk.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Toernooigegevens', content: { 'application/json': { schema: { $ref: '#/components/schemas/Tournament' } } } },
            404: { description: 'Toernooi niet gevonden' },
          },
        },
        put: {
          tags: ['Toernooien'],
          summary: 'Toernooi bijwerken (admin)',
          description: 'Werkt de toernooigegevens bij. Prijs en omschrijving zijn altijd aanpasbaar. Naam, spel, format, maxTeams en startdatum zijn alleen aanpasbaar zolang het toernooi in de registratiefase zit.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    game: { type: 'string' },
                    settings: {
                      type: 'object',
                      properties: {
                        maxTeams:    { type: 'integer' },
                        startDate:   { type: 'string', format: 'date-time' },
                        prizePool:   { type: 'string' },
                        description: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Toernooi bijgewerkt' },
            403: { description: 'Geen admin-rechten' },
            404: { description: 'Toernooi niet gevonden' },
          },
        },
        delete: {
          tags: ['Toernooien'],
          summary: 'Toernooi verwijderen (admin)',
          description: 'Verwijdert een toernooi inclusief alle bijbehorende wedstrijden. Een toernooi dat nog bezig is kan niet worden verwijderd — annuleer het eerst.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            204: { description: 'Toernooi verwijderd' },
            400: { description: 'Toernooi is nog bezig, annuleer het eerst' },
            403: { description: 'Geen admin-rechten' },
          },
        },
      },

      '/tournaments/{id}/register': {
        post: {
          tags: ['Toernooien'],
          summary: 'Team inschrijven voor toernooi',
          description: 'Schrijft een team in voor het opgegeven toernooi. Alleen de captain van het team (of een admin) mag dit doen. Het toernooi moet open zijn voor inschrijvingen.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['teamId'],
                  properties: {
                    teamId: { type: 'string', example: '664abc123def456789012345' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Team ingeschreven' },
            400: { description: 'Toernooi is niet open voor inschrijvingen of is vol' },
            403: { description: 'Alleen de captain of admin mag het team inschrijven' },
            409: { description: 'Team is al ingeschreven' },
          },
        },
      },

      '/tournaments/{id}/cancel': {
        patch: {
          tags: ['Toernooien'],
          summary: 'Toernooi annuleren (admin)',
          description: 'Zet de status van het toernooi op "geannuleerd". Werkt voor toernooien in de registratiefase én toernooien die al bezig zijn. Voltooide toernooien kunnen niet worden geannuleerd.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Toernooi geannuleerd' },
            400: { description: 'Toernooi is al voltooid of al geannuleerd' },
            403: { description: 'Geen admin-rechten' },
          },
        },
      },

      '/tournaments/{id}/start': {
        post: {
          tags: ['Toernooien'],
          summary: 'Toernooi starten (admin)',
          description: 'Sluit de inschrijvingen af en genereert automatisch het knock-outbracket op basis van de ingeschreven teams. Er zijn minimaal 2 teams nodig om te kunnen starten.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Toernooi gestart, bracket aangemaakt' },
            400: { description: 'Toernooi is niet in de inschrijvingsfase, of minder dan 2 teams ingeschreven' },
            403: { description: 'Geen admin-rechten' },
          },
        },
      },

      // ── MATCHES ───────────────────────────────────────────────────────────
      '/matches': {
        get: {
          tags: ['Wedstrijden'],
          summary: 'Wedstrijden ophalen',
          description: 'Geeft een gefilterde, gepagineerde lijst van wedstrijden. Je kunt filteren op toernooi, team en/of status. Openbaar toegankelijk.',
          parameters: [
            { name: 'tournamentId', in: 'query', schema: { type: 'string' }, description: 'Filter op toernooi-ID' },
            { name: 'teamId',       in: 'query', schema: { type: 'string' }, description: 'Filter op team-ID (teamA of teamB)' },
            { name: 'status',       in: 'query', schema: { type: 'string', enum: ['scheduled', 'ongoing', 'completed', 'forfeit'] }, description: 'Filter op status' },
            { name: 'page',         in: 'query', schema: { type: 'integer', default: 1  }, description: 'Paginanummer' },
            { name: 'limit',        in: 'query', schema: { type: 'integer', default: 20 }, description: 'Aantal per pagina (max 50)' },
          ],
          responses: {
            200: { description: 'Lijst van wedstrijden' },
            400: { description: 'Ongeldig filter' },
          },
        },
      },

      '/matches/{id}': {
        get: {
          tags: ['Wedstrijden'],
          summary: 'Wedstrijd ophalen',
          description: 'Geeft de volledige details van één wedstrijd terug, inclusief scores, events en deelnemende teams. Openbaar toegankelijk.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Wedstrijdgegevens', content: { 'application/json': { schema: { $ref: '#/components/schemas/Match' } } } },
            404: { description: 'Wedstrijd niet gevonden' },
          },
        },
      },

      '/matches/{id}/result': {
        put: {
          tags: ['Wedstrijden'],
          summary: 'Uitslag invoeren (admin)',
          description: 'Registreert de einduitslag van een wedstrijd en werkt automatisch het toernooi-bracket bij. Plaatst de winnaar in de volgende ronde, of sluit het toernooi af als het de finale was.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['teamAScore', 'teamBScore', 'winnerId'],
                  properties: {
                    teamAScore: { type: 'integer', example: 13 },
                    teamBScore: { type: 'integer', example: 7  },
                    winnerId:   { type: 'string',  example: '664abc123def456789012345', description: 'ID van het winnende team (moet teamA of teamB zijn)' },
                    notes:      { type: 'string',  example: 'Spannende wedstrijd' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Uitslag opgeslagen, bracket bijgewerkt' },
            400: { description: 'Ongeldige scores of winnerId, of uitslag al ingevoerd' },
            403: { description: 'Geen admin-rechten' },
          },
        },
      },

      '/matches/{id}/events': {
        post: {
          tags: ['Wedstrijden'],
          summary: 'Event toevoegen aan wedstrijd (admin)',
          description: 'Voegt een in-game event toe aan een lopende of geplande wedstrijd. Mogelijke types: kill, objective, round_win, penalty, custom. De wedstrijd wordt automatisch op "lopend" gezet als hij nog gepland was.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['type', 'teamId'],
                  properties: {
                    type:        { type: 'string', enum: ['kill', 'objective', 'round_win', 'penalty', 'custom'] },
                    teamId:      { type: 'string', example: '664abc123def456789012345', description: 'Team dat het event heeft behaald' },
                    description: { type: 'string', example: 'Bomtijdstip ingenomen' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Event toegevoegd' },
            400: { description: 'Ongeldig eventtype, teamId, of wedstrijd is al afgelopen' },
            403: { description: 'Geen admin-rechten' },
          },
        },
      },

      '/matches/{id}/forfeit': {
        patch: {
          tags: ['Wedstrijden'],
          summary: 'Forfait registreren (admin)',
          description: 'Markeert een wedstrijd als forfait. Het opgegeven team verliest automatisch; het andere team wordt als winnaar doorgezet in het bracket.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['forfeitingTeamId'],
                  properties: {
                    forfeitingTeamId: { type: 'string', example: '664abc123def456789012345', description: 'ID van het team dat forfait geeft' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Forfait geregistreerd, bracket bijgewerkt' },
            400: { description: 'Wedstrijd is al afgelopen of ongeldig team-ID' },
            403: { description: 'Geen admin-rechten' },
          },
        },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
