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
supabase/
  schema.sql   Esquema de base de dades i polítiques de seguretat
```

## Posar en marxa la base de dades

1. Supabase → *Authentication → Sign In / Providers* → activar **Allow anonymous sign-ins**.
2. Supabase → **SQL Editor** → enganxar `supabase/schema.sql` → **Run**.
3. Comprovar a *Table Editor* que les 13 taules tenen «RLS enabled».

## Protecció de dades

Les dades es guarden pseudonimitzades: cap taula conté nom real ni correu, i cada
usuari només pot accedir a les seves pròpies files. Les fotos de progrés es queden
al mòbil. L'usuari pot exportar i esborrar totes les seves dades des de l'app.
