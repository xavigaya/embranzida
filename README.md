# Embranzida

App mòbil (PWA per a Android) per planificar i seguir la millora de la condició física.
L'app actua com a entrenador: fa una valoració inicial, genera o segueix un pla
i fa progressar les càrregues a partir del que l'usuari registra al gimnàs.

## Estat

En desenvolupament. Primera fita: MVP per a un grup reduït d'usuaris.

## Stack

| Peça | Tecnologia |
| --- | --- |
| Interfície | React + TypeScript, PWA instal·lable |
| Dades locals | IndexedDB (Dexie), funcionament sense connexió |
| Backend | Supabase (regió UE): Postgres, autenticació anònima, Row Level Security |
| Allotjament | Cloudflare Pages |
| Futur | Capacitor (app nativa, Health Connect) |

## Estructura

```
app/                 App React + TypeScript (PWA)
  src/components/    Pantalles: alta, entrenament d'avui, temporitzador
  src/lib/           Supabase, base de dades local, sincronització, progressió
  src/data/          Biblioteca d'exercicis (exercises.json, font única)
  scripts/           Generador de supabase/seed.sql
supabase/
  schema.sql         Esquema de base de dades i polítiques de seguretat
  seed.sql           Biblioteca d'exercicis (generat amb `npm run seed`)
```

## Desenvolupament

```bash
cd app
npm install
npm run dev      # servidor local
npm test         # proves de la lògica de progressió
npm run build    # versió de producció a app/dist
npm run seed     # regenera supabase/seed.sql després d'editar exercises.json
```

## Publicar a Cloudflare Pages

1. Cloudflare → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → repositori `embranzida`.
2. Configuració de la compilació:
   - Framework preset: **Vite** (o cap)
   - Root directory: **app**
   - Build command: **npm run build**
   - Build output directory: **dist**
3. *Save and Deploy*. Cada `git push` a `main` publica una nova versió.
4. Al mòbil, obre l'adreça `….pages.dev` amb Chrome → menú ⋮ → **Instal·la l'aplicació**.

## Posar en marxa la base de dades

1. Supabase → *Authentication → Sign In / Providers* → activar **Allow anonymous sign-ins**.
2. Supabase → **SQL Editor** → enganxar `supabase/schema.sql` → **Run**.
3. Comprovar a *Table Editor* que les 13 taules tenen «RLS enabled».
4. Executar també `supabase/seed.sql` per carregar els exercicis inicials.

## Protecció de dades

Les dades es guarden pseudonimitzades: cap taula conté nom real ni correu, i cada
usuari només pot accedir a les seves pròpies files. Les fotos de progrés es queden
al mòbil. L'usuari pot exportar i esborrar totes les seves dades des de l'app.
