# Prenodo — Roadmap di migrazione PHP → Next.js su Supabase

Documento di pianificazione. Fonti: `docs/xampp-function-analysis.md`, `docs/xampp-logic-analysis.md`, analisi di gap multi-dominio del 2026-06-29 (24 domini), introspezione DB live e prove di connessione Supabase.

Obiettivo: abbandonare il PHP e portare **BeautySuite/Prenodo** su Next.js mantenendo **identici** funzioni, logiche e grafica. DB di destinazione: **Supabase (PostgreSQL)**.

---

## 1. Stato attuale (verità a terra)

| Metrica | Legacy PHP | Rewrite Next attuale |
|---|---|---|
| Codice | ~220.000 LOC PHP + ~40.000 JS + ~14.000 CSS | ~40.000 LOC TS/TSX + 42 righe CSS |
| Tabelle | 157 (MySQL `yfcfhsvd_test`) | stesso DB live via `mysql2` |
| Design system | Bootstrap 5.3.3 + Bootstrap Icons + Chart.js + `app.css` (4.578) | Tailwind 4 + lucide-react (palette diversa) |
| UI fidelity | — | **~8% — "diversa" su tutti i domini** |
| Completezza funzionale media | — | **~28%** (16 domini su 24 = sforzo "XL") |

**Completezza per dominio** (crescente):

| % | Sforzo | Dominio |
|---:|---|---|
| 5 | XL | Schede cliente, consensi, GDPR & PDF privacy |
| 6 | XL | Fidelity: punti, lotti, tessere & adesione |
| 7 | XL | Omaggi (motore reward) |
| 8 | XL | **UI / fedeltà grafica (trasversale)** |
| 9 | XL | GiftCard & GiftBox |
| 9 | XL | Promozioni, coupon, wallet & credito |
| 9 | XL | Notifiche, automazioni, SMS & cron |
| 12 | XL | Pacchetti & prepagati |
| 12 | XL | Preventivi |
| 14 | XL | Rate vendita & provvigioni staff |
| 14 | XL | Clienti (anagrafica & API) |
| 17 | XL | Appuntamenti, calendario & lifecycle annullo |
| 22 | L | Shell gestionale: sidebar/topbar & JS globale |
| 22 | XL | Booking pubblico (wizard) |
| 22 | XL | POS: carrello, vendite, pagamenti & dettaglio |
| 28 | XL | Marketplace pubblico |
| 38 | XL | Costi (scadenziario) & report |
| 46 | L | Magazzino: prodotti, stock & fornitori |
| 52 | L | Account cliente globale, booking auth & handoff |
| 55 | L | Routing, runtime multi-tenant & data layer |
| 58 | L | Auth gestionale, sessioni & permessi |
| 62 | L | Servizi, risorse, cabine, staff & orari |
| 62 | L | Signup pro, onboarding, accessibilità & profilo |
| 78 | M | Pannello SaaS admin & operazioni tenant |

### Conclusioni dell'analisi
- Il rewrite è un **prototipo funzionale**: routing, auth, signup/onboarding, SaaS admin e molte API operative funzionano sul DB reale. Ma i moduli più complessi e a maggior LOC (appuntamenti, POS, omaggi, fidelity, giftcard, pacchetti) sono allo stadio iniziale.
- **La grafica NON è identica** (è un redesign Tailwind con palette/icone diverse, zero asset originali copiati). → vedi §3.4 e Fase 3.
- **Rischi di correttezza/sicurezza nel data layer**: nessun *tenant SQL rewriter* (isolamento opt-in su 352 query manuali), nessun `@app_tenant_id`, **nessun CSRF**, secret di sessione con default hardcoded, fallback demo silenzioso che maschera errori DB.
- **Rischio finanziario**: POS e appuntamenti Next **non muovono** i saldi wallet/giftcard/punti fidelity. Far girare Next sullo stesso DB live del PHP **desincronizzerebbe silenziosamente denaro e punti dei clienti**. → motivo in più per il cutover pulito su Supabase.

---

## 2. Decisioni prese (2026-06-29)

1. **DB → Supabase Postgres**, si abbandona MySQL/XAMPP. Progetto Supabase pronto (`eu-west-1`, Postgres 17.6, **schema vuoto**, connesso via pooler IPv4+SSL). ✅ connessione verificata.
2. **Data layer = SQL diretto** (`pg`/`postgres`), si traduce il dialetto MySQL→Postgres mantenendo query/transazioni. Niente ORM, niente PostgREST.
3. **Auth = custom mantenuta** (tabella `users` + bcrypt + sessioni per-tenant). Niente Supabase Auth.
4. **Dati = migrazione** del MySQL esistente (157 tabelle, 2 tenant) su Postgres.
5. **UI = Path A (CONFERMATO 2026-06-29)**: portare CSS/asset originali + Bootstrap e riusare il markup legacy, per grafica pixel-identica (vedi §3.4). Conseguenza: gran parte dell'attuale UI Tailwind va riscritta/riallineata alle classi legacy.

---

## 3. Strategia architetturale

### 3.1 Data layer tenant-aware (Postgres)
Sostituire `mysql2` con un pool `pg` verso Supabase. Ricreare la semantica di `CrmTenantPDO`/`Db::rewriteSqlForTenant` con **un unico wrapper** attraverso cui passano TUTTE le query, che inietta automaticamente il filtro `tenant_id`. In Postgres si può inoltre usare `SET app.tenant_id` + (in futuro) RLS per una rete di sicurezza a livello DB. Migrare i 352 call-site raw sul wrapper. Rimuovere il fallback demo silenzioso: errore onesto con `ref` come nel PHP.

### 3.2 Conversione schema MySQL→Postgres (meccanica)
0 viste / 0 trigger / 0 stored procedure / 1 FK ⇒ nessuna logica in-DB da portare. Da tradurre: `AUTO_INCREMENT`→identity (235), `enum(...)`→enum nativi o `CHECK` (48), `tinyint(1)`→`boolean` (106, impatta i `WHERE x=1`), `ON UPDATE CURRENT_TIMESTAMP`→trigger/`moddatetime` (73), `unsigned`→drop (11). Nelle query: `ON DUPLICATE KEY`→`ON CONFLICT`, `IFNULL`→`COALESCE`, `GROUP_CONCAT`→`string_agg`, backtick→virgolette, `NOW()`, `DATE_FORMAT`, ecc.

### 3.3 Sicurezza & gate di richiesta
Ricreare l'ordine dei controlli di `index.php` in un punto centrale (middleware): support-token → sessione → verifica email → onboarding → gate sede → permesso. Aggiungere **CSRF** su tutte le richieste non-GET. `PRENODO_SESSION_SECRET` obbligatorio (fail-closed). Gate `saas_tenants.is_active` + regex/reserved-list slug → 404 uniforme. `TenantFeatureGate` su booking/marketplace.

### 3.4 Fedeltà grafica — **Path A (CONFERMATO)**
Per "grafica identica" la via più economica e affidabile è **portare il design system originale**, non ricostruirlo in Tailwind:
- Copiare in `public/assets/` (path invariato): `app.css` + ~58 CSS di pagina, `app.js` + ~67 JS di pagina + `italy-geo.js`, 35 immagini, `italy_geo.json`.
- Caricare in `app/layout.tsx`, nello stesso ordine di `View.php`: Bootstrap 5.3.3 CSS, Bootstrap Icons 1.11.3, poi `app.css`, poi CSS di pagina; Chart.js 4.4.1.
- **Neutralizzare Tailwind** (disabilitare preflight/scoping) per non sovrascrivere il reset Bootstrap.
- Ricreare lo scaffold di `View.php` (`.app-shell`/`.app-sidebar`, sidebar **bianca**, accent `#0d6efd`, collapse via `localStorage`, off-canvas mobile) con le **classi originali**; sostituire lucide con Bootstrap Icons (`<i class="bi bi-...">`).
- Portare il markup pagina-per-pagina con le classi Bootstrap legacy, così il CSS copiato si applica.
- Harness di **screenshot-diff** (Playwright) Next vs PHP live, divergenza ~0 prima di "fatto".

> Implicazione: gran parte dell'attuale UI Tailwind (es. `management-app.tsx`, 7.004 righe) va **ri-allineata o scartata**. Prima si decide, meno lavoro si spreca. Path B (continuare in Tailwind) **non può** essere pixel-identico.

### 3.5 Auth & sessioni
Mantenere login per slug+email+password, bcrypt (`bcryptjs`), rate-limit `login_attempts`, blocco staff disattivato, `needs_email_verification`, permessi per ruolo, `landingPage()`. Valutare store di sessione server-side per `support_access`/`needs_*` come nel PHP.

---

## 4. Fasi della roadmap

> Le fasi 0–3 sono **fondamenta bloccanti** (tutto il resto dipende da loro). Le fasi 4+ completano i moduli e possono procedere in parallelo per dominio.

### Fase 0 — Setup & decisioni
- `.env.local` (gitignored) con stringa pooler Supabase; `PRENODO_SESSION_SECRET`.
- Confermare strategia UI (Path A/B). Definire struttura repo (oggi `prenodo/` è repo annidato nel repo esterno con vecchio scaffold da rimuovere).
- Installare `pg`; impostare CI/lint/test minimi. Harness screenshot-diff.

### Fase 1 — Migrazione DB (fondamentale)
1. Generare schema Postgres dalle 157 tabelle (conversione §3.2).
2. Wrapper data layer `pg` tenant-aware (§3.1); sostituire `lib/tenant-db.ts`, `lib/xampp-config.ts`→`supabase-config.ts`.
3. Migrare i dati (export MySQL → import Postgres) per i 2 tenant; verificare conteggi.
4. Tradurre il dialetto SQL in tutte le query esistenti; **rivalidare** ogni route "DB-first" su Postgres.

### Fase 2 — Sicurezza & parità runtime
- CSRF + middleware con ordine gate centralizzato; secret obbligatorio; gate `is_active`/feature; parità URL legacy (`?page=` completo, `/saloni`→`/attivita`, passthrough `/uploads`, `*_attachment`, `*_voucher`, endpoint pubblici).

### Fase 3 — Fondamenta UI (design system)
- Import asset + Bootstrap/Icons/Chart.js; neutralizzazione Tailwind; scaffold `View.php` fedele; sostituzione icone; helper `assetUrl ?v=`.

### Fase 4 — Anagrafiche & configurazione (sblocca le operations)
Sedi; Servizi/Risorse/Cabine/Staff/Orari (62%→100); Magazzino prodotti/stock/fornitori (46→100); **Clienti** (14→100, scheda cliente aggregata).

### Fase 5 — Operatività core
**Appuntamenti + Calendario + Lifecycle** (17%, XL): save transazionale, multi-servizio/segmenti/cabine/risorse, availability completa, move/swap/delete, **lifecycle annullo con rollback** (fidelity/giftcard/giftbox/pacchetti/prepagati/omaggi), UI calendario fedele (blocchi proporzionali, drag/resize, settimana/mese). **Booking pubblico** (22%, XL): wizard completo + vantaggi + area cliente.

### Fase 6 — Modulo denaro (parità finanziaria)
**POS + dettaglio/ricevuta + annullo-con-preview** (side-effect reali su wallet/giftcard/fidelity); **Rate** & **Provvigioni**; **Pacchetti/Prepagati**; **GiftCard/GiftBox**; **Omaggi**; **Fidelity/Punti/Tessere**; **Promozioni/Coupon/Wallet/Ricariche**; **Preventivi** (+PDF, convert→vendita).

### Fase 7 — Periferia & comunicazioni
Costi/Report (38→100); **Schede/Consensi/GDPR/PDF** (5→100); **Notifiche/Automazioni/SMS** (9→100); Marketplace pubblico (28→100); Account cliente globale (52→100); SaaS admin (78→100).

### Fase 8 — Cron (7 job)
`reminders`, `fidelity_expire`, `fidelity_reconcile_lots`, `giftbox_send`, `giftcard_send`, `quotes`, `saas_tenant_health` → route schedulate (Supabase cron / scheduled functions / Vercel cron).

### Fase 9 — Verifica & cutover
Smoke/parity test per modulo vs PHP; screenshot-diff a ~0; freeze dati, migrazione finale, switch DNS, dismissione PHP.

---

## 5. Rischi principali
1. **Scala**: ~220k LOC, parità reale ~28% funzionale / ~8% visiva → impegno pluri-mensile. Pianificare per fasi verificabili.
2. **UI**: senza Path A la grafica resta permanentemente divergente (requisito mancato) e si accumula rework.
3. **Isolamento tenant**: senza rewriter centrale, una query che dimentica `tenant_id` fa leak cross-tenant.
4. **Parità finanziaria**: i side-effect su denaro/punti vanno implementati e testati con transazioni prima di dismettere il PHP.
5. **Coabitazione PHP↔Next sullo stesso dato**: evitare; il cutover su Supabase deve essere netto per dominio.

## 6. Stato esecuzione

**Fase 1 — DB foundation: in gran parte COMPLETATA (2026-06-29):**
- ✅ Connessione Supabase verificata (pooler `eu-west-1`, Postgres 17.6, IPv4+SSL).
- ✅ Schema convertito MySQL→Postgres e applicato: **157 tabelle, 609 indici, 220 trigger** (147 `tenant_id` + 73 `updated_at`). Generatore: `db/tools/generate-schema.mjs` → `db/schema.sql`. Dump legacy: `db/legacy/mysql_schema.sql`.
- ✅ Rete di sicurezza multi-tenant ricreata in Postgres: trigger `BEFORE INSERT` che riempiono `tenant_id` da `current_setting('app.tenant_id')` — **verificato** (insert con `SET app.tenant_id='25'` → `tenant_id=25`).
- ✅ Dati migrati: **537 righe**, conteggi verificati 1:1 (`db/tools/migrate-data.mjs`). Entrambi i tenant + utenti/bcrypt intatti.
- ✅ `pg` installato; `.env.local` con `PRENODO_DATABASE_URL` (gitignored) e `PRENODO_SESSION_SECRET`.
- ✅ Decisione UI: **Path A** (porto design originale).

**Data layer — COMPLETATO e VERIFICATO (2026-06-29):**
- ✅ `lib/tenant-db.ts` riscritto da `mysql2` a un pool `pg` con shim runtime (`?`→`$n`, backtick→`"`, `DATABASE()`→`current_schema()`, `RETURNING id`), type-parser date-as-string, helper `withTenant()` (`SET app.tenant_id`). I tipi `mysql2` restano solo come alias strutturali (mysql2 non gira a runtime).
- ✅ `lib/manage-auth.ts` corretto (DATE_SUB→interval, DDL Postgres-safe).
- ✅ Sweep dialetto SQL su 16/21 moduli (71 fix: `ON DUPLICATE`→`ON CONFLICT`, `DATE_ADD/SUB`→interval, `GROUP_CONCAT`→`string_agg`, `IF()`→`CASE`, DDL `ensure*` guardate con `tableExists`/`columnExists`).
- ✅ Bug Postgres corretti a mano: `row.COLUMN_NAME`→`row.column_name` in 6 `filterColumns` (pg minuscola le chiavi); `HAVING` su alias→espressione aggregata nel marketplace.
- ✅ `tsc --noEmit` = 0 errori. **Smoke test runtime su Supabase: 8/8 endpoint su `database`** (login, marketplace, booking context, clients, services, products, dashboard, reports, config). Login end-to-end via route reale OK.

**Scritture — VALIDATE su Supabase (2026-06-29):** create+delete cliente (`tenantInsert`/`RETURNING id`/`tenant_id`), checkout POS multi-tabella (`sales`+`sale_items`)+cancel, insert via `filterColumns` (prodotto con sede). Tutte con cleanup verificato (tenant 25 pristino). Le validazioni applicative (sede/cabina obbligatorie) girano correttamente prima dell'insert. Tool: `db/tools/cleanup-test-rows.mjs`.

**Prossimo (Fase 1 residuo → Fase 2):**
- ⏳ Esercitare i percorsi di scrittura più complessi: **save appuntamento** (multi-tabella + hold→converted), upsert marketplace/onboarding (`ON CONFLICT`), emissione giftcard/pacchetti.
- ⏳ Rischi residui minori: doppia unique key su `public_customer_tenant_links` (upsert account), ordinamento `string_agg` marketplace (sort_order→alfabetico).
- ⏳ Sicurezza: CSRF, gate centralizzati, secret obbligatorio in prod.
- ⏳ Spegnere definitivamente MySQL/XAMPP una volta validate le scritture.

> Strumenti DB in `db/tools/` (`generate-schema`/`migrate-data`/`verify`/`verify-login`/`apply-sql`): eseguire dal tool PowerShell (il sandbox Bash blocca l'egress verso Supabase). `migrate-data.mjs` è idempotente.
