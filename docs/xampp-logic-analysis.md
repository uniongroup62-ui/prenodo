# Analisi logiche XAMPP BeautySuite

Origine analizzata: `C:\xampp\htdocs`.

Obiettivo: descrivere le logiche applicative reali da portare nella replica Next, non solo le schermate. Il PHP originale mescola router, handler, query e template nelle pagine, mentre molte regole riusabili sono in `app/lib`.

## Stato porting Next

Aggiornato al 2026-06-29:

- Autenticazione gestionale DB reale: `users`, password PHP bcrypt, rate limit `login_attempts`, cookie tenant-scoped.
- Data access tenant-aware: supporta tabelle condivise con `tenant_id`, tabelle prefissate legacy e fallback demo.
- API DB-first verificate: clienti, servizi, prodotti, appuntamenti, POS, report, costi, preventivi, permessi, giftcard, fidelity/wallet, pacchetti, prepagati, preordini, coupon, promozioni, giftbox, omaggi, rate, commissioni, automazioni e notifiche.
- Configurazione DB-first verificata: impostazioni preventivi/POS, categorie, stock, fornitori, schede, consensi, risorse, categorie servizi, consigliati, cabine, staff, disponibilita, orari, profilo, sedi, accessibilita, ruoli e marketplace.
- Booking pubblico DB-first verificato: contesto tenant, sedi, categorie, servizi, staff, slot da orari/eccezioni, hold temporanee DB, conferma appuntamento e cleanup smoke test.
- Il POS DB-first scrive vendite, righe vendita, stock prodotto, residui prepagati/pacchetti/giftcard e rate; l'annullo vendita ripristina stock e annulla residui/rate.
- Le notifiche restano derivate quando la tabella PHP dedicata non esiste, come emerso dallo schema XAMPP corrente.

## Metodo

- Router tenant: `index.php`.
- Chrome gestionale e menu: `app/lib/View.php`.
- Permessi: `app/lib/Auth.php` e `app/lib/RolePermissions.php`.
- Multi-tenant e DB: `app/lib/Tenant.php`, `app/lib/Db.php`.
- Pagine tenant: `app/pages/*.php`.
- Librerie business: `app/lib/*.php`.
- Flussi verificati via login reale su `/manage/login?slug=centroesteticoelite`.

## Runtime centrale

### Router tenant

File: `index.php`.

Logica:

- Deriva il path richiesto e lo normalizza rispetto al base path.
- Gestisce passthrough sicuro per `/uploads/...`.
- Divide le aree:
  - `/admin/...`: pannello SaaS.
  - `/manage/...`: accesso gestionale centrale.
  - `/account/...`: account cliente globale.
  - `/attivita/...`: marketplace pubblico.
  - `/{slug}/...`: tenant.
- Risolve lo slug tenant, carica configurazione, helpers e schema.
- Applica CSRF light a tutte le POST, tranne `api_sms_callback`.
- Mappa `page` verso `app/pages/*.php`.
- Distingue pagine pubbliche:
  - booking pubblico;
  - preventivo pubblico;
  - GDPR/consenso pubblico;
  - callback SMS;
  - voucher GiftCard/GiftBox/Omaggi con token.
- Se utente non autenticato:
  - API rispondono JSON 401;
  - pagine HTML redirect a login gestionale.
- Se email non verificata:
  - forza `accessibility` prima di usare il gestionale.
- Se onboarding incompleto:
  - forza `onboarding`, salvo accesso supporto.
- Se serve selezione sede:
  - API rispondono JSON 409;
  - pagine HTML mostrano gate sede.
- Se dashboard non permessa:
  - usa `Auth::landingPage()`.
- Errori su API tornano sempre JSON con `ref`.

### Tenant e sessioni

File: `app/lib/Tenant.php`.

Logica:

- Slug tenant in path, esempio `centroesteticoelite`.
- Prefisso tabella legacy: `{slug}__`.
- Session suffix isolato per tenant: `t_{slug}`.
- Modalita admin SaaS separata: suffix `saas`.
- Costruzione URL assoluti tenant-aware con rilevamento HTTPS/proxy.

### Database tenant

File: `app/lib/Db.php`.

Logica:

- `CrmTenantPDO` intercetta `prepare`, `query`, `exec`.
- `Db::rewriteSqlForTenant()` riscrive SQL sulle tabelle base tenant.
- Supporta due strategie:
  - tabelle fisiche prefissate per tenant;
  - tabelle condivise con `tenant_id` e viste compatibili.
- Mantiene elenco centrale `baseTables`.
- Runtime migration best-effort: `ensureTenantTable`, `ensureTenantSchema`, view compatibili, colonne opzionali.
- Cache per schema tenant, tenant id e controllo tabelle.

Implicazione Next:

- Il porting non puo usare query libere senza uno strato tenant-aware.
- Serve un data access layer unico prima di portare CRUD reali.

## Autenticazione e permessi

### Auth gestionale

File: `app/lib/Auth.php`.

Logica:

- Sessione tenant-isolata.
- Rate limit login best-effort su `login_attempts`.
- Login su `users.email` + `password_hash`.
- Blocco operatori disattivati su tabella `staff`.
- Session fixation hardening con `session_regenerate_id`.
- Flag `needs_email_verification`.
- Permessi caricati da DB per ruolo gestibile.
- Admin ha sempre accesso completo.
- Staff/Altro passano da `RolePermissions`.
- Accesso supporto con scadenza e tenant slug.
- `landingPage()` sceglie il primo modulo consentito in ordine operativo.
- `requirePerm` e `requireAnyPerm` producono 403 HTML.

### Permessi

File: `app/lib/RolePermissions.php`.

Logica:

- Catalogo centrale permessi e gruppi.
- Ruoli gestibili: `staff`, `altro`; admin escluso.
- Permessi padre legacy coprono figli.
- Alcuni permessi non assegnabili restano admin-only.
- Moduli con accesso padre speciale: esempio `packages.access`.
- Auto-enable parent rules per coerenza selezioni.
- Migrazione legacy dei permessi salvati.
- Seeding DB: `permissions`, `role_permissions`, audit.

Gruppi principali:

- Generale.
- Appuntamenti.
- Pagamenti.
- Scadenziario e Costi.
- Magazzino.
- Anagrafiche.
- Clienti.
- Pacchetti.
- Preventivi.
- Fidelizzazione.
- Risorse.
- Impostazioni.
- Amministrazione.

## Contesto sede

File: `app/lib/Helpers.php`.

Funzioni chiave:

- `app_locations`.
- `app_user_location_options`.
- `app_user_location_ids`.
- `app_location_allowed_for_user`.
- `app_location_selection_required`.
- `app_current_location_id`.
- `app_location_row`.
- `app_location_label`.

Logica:

- Gli utenti possono avere sedi assegnate.
- Alcuni moduli filtrano dati per sede corrente.
- Se piu sedi sono disponibili e non c'e selezione, il router blocca.
- Se non ci sono sedi attive assegnate, il router blocca.
- Booking pubblico usa solo sedi abilitate booking e marketplace.

## Marketplace e account cliente globale

### Marketplace

File: `app/lib/Marketplace.php`, `app/pages/public_marketplace.php`.

Logica:

- Crea e ripara tabelle marketplace.
- Sincronizza tenant, branding, servizi e sedi pubblicate.
- Gestisce tassonomie attivita e categorie servizi.
- Indicizza servizi pubblici.
- Filtra profili pubblici per:
  - query;
  - citta;
  - categoria;
  - servizio;
  - sede pubblicata.
- Suggerimenti ricerca tenant, servizi e citta.
- Scheda tenant e scheda sede.
- Preferiti account cliente globale.
- Handoff account globale verso booking tenant.

### Account cliente globale

File: `app/lib/Marketplace.php`, `app/pages/public_account.php`.

Logica:

- Registrazione e verifica email.
- Login globale separato dal login gestionale.
- Reset password.
- Preferiti.
- Attivita collegate tra account globale, tenant `clients` e `booking_users`.
- Sincronizzazione email/password verso tenant collegati.
- Handoff token temporaneo per booking.

## Accesso gestionale centrale

File: `app/pages/manage_account.php`, `app/lib/SaasProfessionalSignup.php`.

Logica:

- Login professionista con:
  - slug attivita;
  - email;
  - password.
- Verifica disponibilita slug.
- Registrazione professionista con codice email.
- Provisioning tenant dopo verifica.
- Avvio sessione owner tenant.
- Recupero password tenant-scoped.
- Suggerimenti slug alternativi.
- Controlli:
  - tenant esistente;
  - signup pendente;
  - email admin esistente;
  - token/codice verifica.

## Booking pubblico

File principale: `app/pages/booking.php`.

Librerie correlate:

- `BookingAuth.php`.
- `BookingPublicUi.php`.
- `QuoteAvailability.php`.
- `AppointmentLifecycle.php`.
- `ClientPackages.php`.
- `ClientPrepaidServices.php`.
- `GiftBox.php`.
- `GiftCard.php`.
- `Gifts.php`.
- `Fidelity.php`.
- `Promotions.php`.

### Autenticazione cliente booking

File: `app/lib/BookingAuth.php`.

Logica:

- Sessione cliente booking separata.
- Login/register cliente.
- Verifica email con codice.
- Profilo cliente e cambio email con verifica.
- Cambio password con password attuale.
- Collegamento o creazione `clients` tenant.
- Adozione sessione account globale marketplace.
- Consumo handoff token globale.
- Blocco cliente disattivato.
- Sede di riferimento cliente.

### Wizard booking

Step logici:

- Gate cliente.
- Scelta sede.
- Scelta categoria.
- Scelta servizi.
- Scelta professionista:
  - specifico;
  - qualsiasi;
  - per segmento/servizio;
  - auto assegnazione.
- Calcolo slot.
- Hold temporaneo.
- Coupon/promozioni/Fidelity/GiftCard/GiftBox/pacchetti/prepagati/omaggi.
- Conferma.
- Area cliente: appuntamenti, preventivi, pacchetti, prepagati, credito, GiftCard, GiftBox, prodotti, preordini, fidelity, profilo.

### Disponibilita slot

Funzioni chiave in `booking.php`:

- `build_slots`.
- `build_slots_any_staff`.
- `build_slots_all_staff`.
- `build_slots_multi_staff_segments`.
- `build_slots_auto_assign_services`.
- `find_assignment_for_slot`.
- `booking_filter_slots_by_cabins`.
- `filter_past_slots`.

Regole:

- Usa `business_hours`.
- Usa aperture/chiusure straordinarie `business_hours_exceptions`.
- Blocca date in `closures`.
- Considera appuntamenti esistenti e segmenti.
- Considera assenze/turni staff.
- Considera hold temporanei.
- Considera cabine richieste dai servizi.
- Considera risorse condivise.
- Nel booking pubblico non mostra slot passati per la data odierna.

### Hold temporaneo

Funzioni in `Helpers.php`:

- `ensure_appointment_holds_table`.
- `appointment_hold_create`.
- `appointment_hold_release`.
- `appointment_hold_renew`.
- `appointment_hold_assert_active_for_save`.
- `appointment_hold_mark_converted`.
- `appointment_hold_blocks_for_day`.
- `appointment_hold_blocks_for_staff`.
- `appointment_hold_blocks_by_staff`.
- `appointment_hold_blocks_by_cabin`.
- `appointment_hold_resource_blocks_for_range`.

Regole:

- Ogni hold ha token e owner key.
- Canale distinto, esempio `public`.
- TTL configurabile per canale.
- Lock per giorno/sede.
- Lock opzionali per risorse condivise.
- Lo stesso owner puo avere un solo hold attivo, salvo eccezioni.
- La conferma deve passare da `assert_active_for_save`.
- Dopo salvataggio l'hold viene marcato convertito.

### Vantaggi e residui

Regole:

- Coupon:
  - normalizzazione codice;
  - scope su servizi/prodotti/categorie;
  - limiti uso globali e per cliente;
  - minimo subtotale;
  - compatibilita con promozioni.
- Promozioni:
  - target nuovo/inattivo/compleanno/fidelity;
  - finestre temporali;
  - blackout;
  - sedi;
  - esclusione clienti;
  - stack con coupon/fidelity.
- Fidelity:
  - accumulo punti su carrello;
  - redeem punti;
  - livelli card;
  - campagne;
  - scadenza lotti.
- Credito:
  - saldo wallet;
  - adeguamento credito;
  - controllo disponibilita.
- GiftCard:
  - selezione saldo disponibile;
  - redeem totale/parziale;
  - restore se salvataggio fallisce.
- GiftBox:
  - residui per item;
  - prenotazione utilizzo;
  - rollback su annullamento.
- Pacchetti:
  - sedute residue per servizio;
  - prenotazioni gia attive bloccano doppio uso.
- Prepagati:
  - servizi residui;
  - scadenze;
  - blocco doppio uso.
- Omaggi:
  - ricompense servizio;
  - disponibilita per cliente/sede;
  - lock su appuntamento.

## API appuntamenti

File: `app/pages/api_appointments.php`.

Azioni principali:

- `qb_residui_check`: verifica residui GiftBox/Pacchetti/Prepagati/Omaggi in quick booking.
- `staff_for_service`: operatori per servizio.
- `staff_for_services`: operatori per piu servizi.
- `cabins_for_services`: cabine compatibili.
- `hold_availability`: hold backend su slot.
- `release_hold`: rilascio hold.
- `renew_hold`: rinnovo hold.
- `availability`: slot backend.
- `promotion_preview`: preview promozione.
- `coupon_preview`: preview coupon.
- `fidelity_preview`: preview punti.
- `fidelity_gift_redeem`: redeem omaggio fidelity.
- `list`: lista eventi calendario.
- `get`: dettaglio appuntamento.
- `move`: drag/drop o spostamento.
- `swap_segment`: cambio operatore/segmento.
- `cancel_done_preview`: anteprima annullamento appuntamento eseguito.
- `cancel_done_apply`: applica storni e rollback.
- `delete`: cancellazione con lifecycle.
- `save`: crea o aggiorna appuntamento.

Logica salvataggio:

- Validazione permessi per azioni gestionali o quick booking.
- Validazione cliente accessibile in sede.
- Validazione disponibilita.
- Gestione segmenti servizi.
- Snapshot servizi.
- Cabine per segmento.
- Risorse condivise.
- GiftCard su appuntamento.
- Pacchetti, prepagati, GiftBox, omaggi.
- Coupon, promozioni, fidelity.
- Transazione DB estesa.
- Rollback in caso di errore.
- Automazioni dopo cambio stato.

## Lifecycle appuntamenti

File: `app/lib/AppointmentLifecycle.php`.

Scopo:

- Centralizza annullamento, cancellazione e rollback effetti collegati.

Status normalizzati:

- `pending`.
- `scheduled`.
- `done`.
- `canceled`.
- `no_show`.

Logiche:

- Anteprima impatto annullamento.
- Storno punti Fidelity guadagnati.
- Ripristino punti usati.
- Ripristino GiftCard usata.
- Rollback GiftBox.
- Rollback pacchetti.
- Rollback prepagati.
- Rollback omaggi.
- Ricalcolo progressi Fidelity.
- Motivo annullamento e metadati `cancelled_*`.
- Email automatica su rifiuto/annullamento richieste pendenti.
- Cancellazione fisica sicura dopo rollback.

## Calendario

File: `app/pages/calendar.php`, `api_calendar_notes.php`.

Logica:

- Vista calendario filtrata per sede.
- Dati da `api_appointments`.
- Note calendario per giorno/sede.
- Quick booking se permesso.
- Blocco eventi in base a disponibilita, assenze, appuntamenti, hold.

## Clienti

File: `app/pages/clients.php`, `api_clients.php`.

Logica:

- Anagrafica cliente.
- Search API.
- Creazione veloce.
- Scheda cliente.
- Storico appuntamenti.
- Storico vendite.
- Punti e card.
- GiftCard, GiftBox, omaggi.
- Pacchetti e prepagati.
- Documenti, consensi, schede tecniche.
- Tag cliente.
- Accesso filtrato da sede.

## Schede e consensi

File:

- `client_sheets.php`.
- `client_sheet_templates.php`.
- `client_consents.php`.
- `consent_modules.php`.
- `consent_public.php`.
- `gdpr_public.php`.
- `PrivacyConsent.php`.
- `PrivacyPdf.php`.

Logica:

- Template schede tecniche configurabili.
- Record cliente per template.
- Allegati schede.
- Moduli consenso GDPR e consensi informati.
- Invio firma cliente.
- Token pubblico.
- Generazione PDF.
- Upload manuale documento firmato.
- Stato `pending`/`signed`.

## POS e vendite

File:

- `pos.php`.
- `pos_history.php`.
- `pos_sale_detail.php`.
- `pos_success.php`.
- `PosSettings.php`.

Logica:

- Carrello vendita.
- Tipi riga:
  - servizio;
  - prodotto;
  - pacchetto;
  - prepagato;
  - GiftCard;
  - GiftBox;
  - ricarica credito.
- Cliente opzionale o obbligatorio in base al tipo riga.
- Pagamenti:
  - contanti;
  - carta;
  - bonifico;
  - credito cliente;
  - GiftCard;
  - saldo misto.
- Coupon/promozioni/fidelity su vendita.
- Snapshot righe e prezzi.
- Movimento stock prodotti.
- Emissione pacchetti/prepagati/GiftCard/GiftBox.
- Piano rateale.
- Commissioni staff.
- Storico vendite.
- Annullamento vendita con anteprima:
  - ripristino stock;
  - cancellazione o blocco GiftCard/GiftBox;
  - rollback pacchetti/prepagati;
  - storno credito/fidelity;
  - gestione rate pagate/non pagate.

## Rate

File: `app/lib/SaleInstallments.php`, `installments_manage.php`.

Logica:

- Calcolo piano rateale.
- Acconto e importo residuo.
- Intervalli mensili/settimanali/personalizzati.
- Stato piano e stato rata.
- Rata pagata/non pagata.
- Alert rate in scadenza.
- Preview/cancel su annullamento vendita.

## Commissioni

File: `app/lib/Commissions.php`, `commissions.php`.

Logica:

- Impostazioni globali e per modulo.
- Aliquote staff.
- Periodi di validita.
- Commissioni su appuntamenti e vendite POS.
- Stato pagato/non pagato.
- Preview impatto annullamento vendita.
- Eliminazione movimenti commissione collegati.

## Magazzino

File:

- `products.php`.
- `stock_moves.php`.
- `suppliers.php`.
- `ProductPageHelpers.php`.

Logica:

- Prodotti con categorie, immagini, brand, codici, prezzo.
- Stock per prodotto e sede.
- Fornitori.
- Movimenti carico/scarico.
- Documenti stock e allegati.
- Prodotti pubblici per booking.
- Nome prodotto normalizzato.
- Gestione stock su vendita e annullamento vendita.

## Servizi, risorse e staff

File:

- `services.php`.
- `resources.php`.
- `cabins.php`.
- `staff.php`.
- `staff_availability.php`.
- `hours.php`.

Logica servizi:

- Categorie servizi.
- Servizi consigliati.
- Durata, prezzo, descrizione, online/offline.
- Sedi abilitate.
- Cabine compatibili.
- Risorse condivise richieste.
- Staff abilitato.
- Snapshot servizio in appuntamenti e vendite.

Logica risorse:

- Risorse con quantita per sede.
- Associazione servizio-risorsa.
- Calcolo occupazione picco per segmento.
- Lock risorse durante hold/salvataggio.

Logica staff:

- Anagrafica operatori.
- Collegamento a utente gestionale.
- Ruolo e sedi abilitate.
- Servizi abilitati.
- Foto.
- Disponibilita settimanale.
- Assenze/timeoff.
- Conflitti con appuntamenti.

Logica orari:

- Orari settimanali per sede.
- Doppia fascia giornaliera.
- Chiusure.
- Aperture/chiusure straordinarie.
- Usati dal booking e dal calendario.

## Pacchetti e prepagati

File:

- `packages.php`.
- `package_settings.php`.
- `ClientPackages.php`.
- `ClientPackageSnapshot.php`.
- `ClientPrepaidServices.php`.

Logica pacchetti:

- Catalogo pacchetti.
- Righe servizi/prodotti.
- Pricing.
- Pacchetti cliente.
- Sedute residue.
- Snapshot catalogo.
- Transazioni pacchetto.
- Assegnazione da vendita o preventivo.
- Uso in appuntamento.
- Rollback su annullamento.

Logica prepagati:

- Servizi prepagati emessi da vendita.
- Scadenza opzionale.
- Utilizzi manuali.
- Utilizzi in appuntamento.
- Doppio uso bloccato da prenotazioni attive.
- Preview e rollback annullamento vendita.

## GiftCard, GiftBox e omaggi

File:

- `GiftCard.php`.
- `GiftBox.php`.
- `Gifts.php`.
- `GiftLoyaltyAttribution.php`.

Logica GiftCard:

- Emissione.
- Codice e token pubblico.
- Eventi template.
- Voucher/QR.
- Saldo iniziale e residuo.
- Riscatto importo o item.
- Modifica scadenza/note.
- Annullamento.
- Scadenza automatica.
- Transazioni.

Logica GiftBox:

- Template con item.
- Emissione istanza.
- Voucher pubblico.
- Riscatti parziali.
- Snapshot destinatario.
- Lock modifica destinatario.
- Riscatto su appuntamento.
- Rollback appuntamento.
- Annullamento/scadenza.

Logica omaggi:

- Regole reward.
- Regole per prodotti, servizi, appuntamenti e fidelity.
- Esclusione clienti.
- Disponibilita per sede.
- Emissione istanze.
- Riscatto manuale o appuntamento.
- Tracking progressi.
- Scadenza batch.
- Rollback source invalidation.

## Fidelity e promozioni

File:

- `Fidelity.php`.
- `Promotions.php`.
- `fidelity*.php`.
- `promotions.php`.
- `recharges.php`.
- `wallet.php`.
- `credit_movements.php`.

Logica Fidelity:

- Attivazione globale e moduli.
- Punti disponibili, riservati, lotti e scadenze.
- Calcolo punti da importo/carrello.
- Campagne per data.
- Regole per linea.
- Redeem punti come sconto.
- Livelli card.
- Tessere e adesione.
- Omaggi fidelity.
- Scadenza lotti batch.

Logica credito:

- Wallet credito cliente.
- Ricariche.
- Movimenti credito.
- Saldo attivo.
- Storno su vendita/appuntamento.

Logica promozioni:

- Promozioni avanzate.
- Sedi abilitate.
- Servizi/prodotti target.
- Finestre orarie.
- Blackout date.
- Target clienti.
- Esclusioni clienti.
- Stack con Fidelity e coupon.
- Badge marketplace.

## Costi e report

File:

- `costs.php`.
- `reports.php`.

Logica costi:

- Scadenziario.
- Costi singoli e ricorrenti.
- Categorie costo.
- Fornitori.
- Allegati.
- Stato aperto/pagato/scaduto.
- Filtri periodo/sede.

Logica report:

- Range predefiniti e custom.
- Vendite, appuntamenti, clienti, costi, commissioni.
- Periodo precedente.
- Breakdown per staff/servizio/prodotto.
- Filtri sede.

## Notifiche e automazioni

File:

- `BrowserNotifications.php`.
- `notifications*.php`.
- `automation.php`.
- helper `automation_*` in `Helpers.php`.

Logica notifiche:

- Feed notifiche utente.
- Preferenze per canale/tipo.
- Richieste appuntamento pending.
- Decisioni preventivi.
- Rate in scadenza.
- Compleanni clienti.
- Card fidelity in scadenza.

Logica automazioni:

- Template email e SMS.
- Reminder appuntamenti.
- Email su approvazione/modifica/rifiuto.
- SMS reminder con provider OpenApiSms.
- Coda reminder.
- Pulizia storico comunicazioni.
- Reminder scadenza card fidelity.
- Callback SMS.

## SaaS admin

File:

- `SaasAuth.php`.
- `SaasTenantManager.php`.
- `TenantProvisioner.php`.
- `SaasProfessionalSignup.php`.
- `SaasBackupManager.php`.
- `SaasSupportAccessManager.php`.
- `SaasSmsBilling.php`.
- `SaasTenantAudit.php`.

Logiche:

- Login admin SaaS.
- Bootstrap admin.
- Creazione tenant.
- Validazione slug.
- Provisioning schema tenant.
- Repair schema/admin.
- Health check.
- Support access token temporaneo.
- Audit.
- Backup tenant.
- SMS billing e wallet.
- Eliminazione/archiviazione tenant.

## Tabelle principali per dominio

Tenant/core:

- `users`, `staff`, `permissions`, `role_permissions`, `login_attempts`, `user_email_verifications`.

Sedi e operativita:

- `locations`, `user_locations`, `businesses`, `business_hours`, `business_hours_exceptions`, `closures`.

Appuntamenti:

- `appointments`, `appointment_segments`, `appointment_services`, `appointment_staff`, `appointment_locations`, `appointment_holds`.

Clienti:

- `clients`, `customer_documents`, `customer_tags`, `customer_tag_map`.

Consensi/schede:

- `consent_modules`, `client_consent_records`, `client_sheet_templates`, `client_sheet_template_locations`, `client_sheet_records`.

POS:

- `sales`, `sale_items`, `pos_settings`, `sale_installment_plans`, `sale_installments`.

Magazzino:

- `products`, `product_categories`, `product_images`, `product_stocks`, `stock_docs`, `stock_doc_items`, `stock_moves`, `suppliers`, `supplier_locations`.

Servizi e risorse:

- `services`, `service_categories`, `service_locations`, `service_cabins`, `service_recommendations`, `resources`, `resource_locations`, `service_resources`, `cabins`.

Pacchetti/prepagati:

- `packages`, `package_items`, `package_services`, `package_locations`, `package_pricing`, `client_packages`, `client_package_items`, `client_package_services`, `client_package_usages`, `client_package_transactions`, `client_prepaid_services`, `client_prepaid_service_usages`.

Fidelizzazione:

- `cards`, `card_code_registry`, `transactions`, `point_lots`, `fidelity_campaigns`, `recharge_templates`, `recharges`, `credit_adjustments`.

Gift:

- `giftcards`, `giftcard_items`, `giftcard_transactions`, `giftboxes`, `giftbox_items`, `giftbox_instances`, `giftbox_instance_items`, `giftbox_redemptions`, `giftbox_redemption_items`, `gifts`, `gift_instances`, `gift_rules`, `gift_rule_sets`, `gift_transactions`.

Marketing:

- `coupons`, `coupon_locations`, `promotions`, `promotion_services`, `promotion_products`, `promotion_locations`, `promotion_time_windows`, `promotion_blackout_dates`, `promotion_redemptions`.

Marketplace/global:

- tabelle marketplace centrali gestite da `Marketplace::ensureTables`.

## Gap della replica Next attuale

Gia presente:

- Routing pubblico principale.
- Marketplace demo.
- Scheda pubblica tenant demo.
- Booking wizard collegato a `/api/booking` con fallback demo.
- Login/registrazione gestionale demo.
- Dashboard gestionale navigabile con mappa funzioni.
- Compatibilita base `/{slug}/index.php?page=...`.
- Porting TypeScript iniziale di `RolePermissions`, landing page permessi, tenant prefix/session suffix e location gate demo.
- Porting TypeScript iniziale dell'engine appuntamenti: durata servizi, disponibilita slot, conflitti operatore, hold temporanei, release/renew e save demo.
- API Next demo per permessi/sedi e appuntamenti: `/api/manage/permissions`, `/api/manage/appointments?action=availability`, `hold_availability`, `release_hold`, `renew_hold`, `save`, `status`.
- Store tenant-aware demo condiviso per appuntamenti, hold, clienti, servizi e prodotti.
- API CRUD demo per clienti, servizi e prodotti: `/api/manage/clients`, `/api/manage/services`, `/api/manage/products`.
- UI gestionale collegata alle API demo per creare/archiviare clienti, creare/disattivare servizi e movimentare stock rapido.
- Porting POS demo: checkout servizi/prodotti, pagamenti, storico vendite, annullamento vendita e ripristino stock.
- Report demo basato su vendite POS, incassi per metodo, mix servizi/prodotti e sotto-scorta.
- Porting amministrazione/fidelizzazione/comunicazioni demo: costi ricorrenti, preventivi, wallet/fidelity, ricariche, GiftCard, notifiche e automazioni manuali.
- API Next demo per i nuovi moduli: `/api/manage/costs`, `/api/manage/quotes`, `/api/manage/fidelity`, `/api/manage/giftcards`, `/api/manage/notifications`, `/api/manage/automation`.
- UI gestionale collegata per `costs`, `quotes`, `fidelity`, `wallet`, `recharges`, `giftcard`, `notifications` e `automation`.
- Porting residui/marketing/amministrazione avanzata demo: pacchetti, prepagati, preordini, coupon, promozioni, GiftBox, omaggi, rate e commissioni.
- Vendita POS estesa con righe speciali demo: `prepaid`, `giftcard`, `package`, `giftbox`, coupon, promozione, piano rateale e commissioni staff.
- API Next demo aggiuntive: `/api/manage/packages`, `/api/manage/prepaids`, `/api/manage/preorders`, `/api/manage/coupons`, `/api/manage/promotions`, `/api/manage/giftboxes`, `/api/manage/gifts`, `/api/manage/installments`, `/api/manage/commissions`.
- UI gestionale collegata per `packages`, `pos_prepaids`, `pos_preorders`, `coupons`, `promotions`, `giftbox`, `gifts`, `installments_manage` e `commissions`.
- Porting configurazioni/risorse/documenti demo tramite `/api/manage/configuration?module=...`: impostazioni preventivi/POS, categorie prodotti/servizi, movimenti stock, fornitori, schede e consensi cliente, risorse, cabine, staff, disponibilita, orari, profilo attivita, sedi, moduli consenso, accessibilita, ruoli e marketplace.
- UI gestionale collegata anche per `quote_settings`, `pos_settings`, `product_categories`, `stock_moves`, `suppliers`, `client_sheets`, `client_consents`, `resources`, `service_categories`, `service_recommendations`, `cabins`, `staff`, `staff_availability`, `hours`, `business_profile`, `locations`, `consent_modules`, `accessibility`, `roles` e `marketplace`.
- Data layer DB XAMPP reale aggiunto: lettura `config.php`, pool MySQL, supporto schema condiviso con `tenant_id`, supporto tabelle prefissate legacy e helper CRUD tenant-aware.
- Login gestionale Next collegato al DB reale: verifica `users.password_hash` compatibile con `password_hash` PHP/bcrypt, rate limit `login_attempts`, controllo staff attivo, cookie sessione tenant e redirect protetto come `Auth::login`.
- Recupero/reset password gestionale migrato in Next: token SHA-256 in `password_resets`, scadenza 60 minuti, throttle 2 minuti, invalidazione token precedenti, minimo 8 caratteri e update `users.password_hash` bcrypt compatibile PHP.
- Accessibilita gestionale migrata: `/api/manage/accessibility` espone utente sessione, cambio password interno con password attuale/conferma/minimo 8, verifica email corrente, richiesta cambio email con password attuale, codice SHA-256 a 6 cifre su `user_email_verifications`, scadenza 15 minuti, reinvio 60 secondi, massimo 5 tentativi, sync email staff e invalidazione reset pendenti.
- Registrazione professionista migrata in Next: `saas_professional_signups`, codice verifica SHA-256 a 6 cifre, TTL 15 minuti, reinvio 60 secondi, massimo 5 tentativi, lock 15 minuti, validazione slug/email/password/termini, provisioning tenant shared `tenant_id`, seed admin/sede/orari/permessi/POS/automazioni/onboarding e cookie sessione owner.
- API gestionali multi-tenant: `lib/manage-request.ts` risolve lo slug da query/header/referer e le route operative `/api/manage/*` non restano piu vincolate al tenant demo `centroesteticoelite`.
- Onboarding gestionale migrato: `tenant_onboarding_progress`, gate admin su dashboard, compatibilita `/{slug}/index.php?page=onboarding`, pagina `/{slug}/onboarding`, salvataggio step business/sede/categorie/orari/operatori/cabine/categorie servizi/servizi/booking.
- `/manage/check-url` e DB-first: verifica slug su `saas_tenants`, signup pendenti e tabelle tenant reali.
- Dashboard e `/{slug}/index.php?page=...` protetti da sessione, con eccezione booking pubblico.
- Sidebar gestionale filtrata con i permessi della sessione reale, mantenendo visibilita completa per ruolo admin.
- Sedi gestionali DB-first: `/api/manage/locations` legge sedi XAMPP, filtra per sessione/utente e salva la sede corrente nel cookie sessione.
- Availability gestionale DB-first: `/api/manage/appointments?action=availability`, `hold_availability`, `release_hold` e `renew_hold` riusano orari, staff, sede e hold DB dell'engine booking.
- Salvataggio appuntamenti gestionale DB-first: `save` valida il token hold, crea snapshot servizio/staff/sede, inserisce `appointment_segments` e marca l'hold `converted`.
- La sede corrente DB viene risolta server-side da `lib/manage-locations.ts` e propagata a clienti, servizi, prodotti, movimenti stock, POS, costi e appuntamenti; smoke test appuntamento gestionale ha verificato `appointments.location_id=21`, `appointment_locations`, segmento e hold `converted`.
- API DB-first aggiunte per dati reali: clienti, servizi, prodotti, appuntamenti, POS/report, costi, preventivi e permessi sessione. Se MySQL non risponde resta fallback demo.
- API booking pubblico DB-first aggiunta: `/api/booking` espone `context`, `slots`, `hold`, `release_hold` e `confirm` su DB XAMPP reale con fallback demo.
- API marketplace DB-first aggiunta: `/api/marketplace` espone profili pubblici da tenant attivi, sedi marketplace, servizi prenotabili e categorie.

Mancante rispetto alle logiche PHP:

- Persistenza completa di tutti i moduli su DB reale; il data layer e attivo ma alcune route usano ancora fallback demo.
- Rifiniture avanzate onboarding: sync marketplace completa e validazioni geografiche identiche al PHP.
- CRUD reali dei moduli su database, audit, validazioni complete e permessi per azione.
- API appuntamenti completa con risorse condivise avanzate, assenze/turni staff avanzati, rollback lifecycle e transazioni DB estese.
- Lifecycle completo annullamento/cancellazione.
- POS con rollback transazionale completo su tutti i side-effect PHP e ricevute/dettaglio vendita.
- Fidelity avanzata con lotti punti, livelli card e campagne complete.
- GiftCard/GiftBox avanzate con token/voucher/QR, eventi template e transazioni dettagliate.
- Pacchetti e prepagati con snapshot completo catalogo, prenotazioni attive bloccanti e rollback appuntamento/vendita.
- Consensi, PDF e documenti.
- Automazioni email/SMS reali con provider e code reminder.
- Marketplace globale con account cliente e handoff.
- CRUD specifici completi per configurazioni, risorse e documenti con allegati, audit e permessi per campo.
- Rifiniture SaaS residue: restore backup, pagamenti provider reali per ricariche SMS, sync marketplace completa e validazioni onboarding avanzate.

## Sequenza consigliata per porting

1. Data layer tenant-aware.
2. Auth gestionale reale.
3. Persistenza permessi e menu filtrato.
4. Sedi e location gate reali.
5. Clienti/servizi/staff/sedi come CRUD base.
6. Appuntamenti e calendario.
7. Availability engine completo con hold.
8. Booking pubblico reale.
9. POS e vendite.
10. Pacchetti/prepagati/GiftCard/GiftBox/omaggi.
11. Fidelity, coupon e promozioni.
12. Lifecycle rollback completo.
13. Consensi/documenti/PDF.
14. Automazioni/notifiche.
15. Marketplace globale e account cliente.
16. SaaS admin e provisioning.

## Nota importante

La logica PHP non e organizzata come API separate: molte regole sono dentro pagine grandi come `booking.php`, `api_appointments.php`, `pos.php`, `clients.php`, `services.php` e `pos_history.php`. Prima di portare tutto in Next conviene isolare le regole in servizi TypeScript testabili, altrimenti la replica rischia di ricreare lo stesso accoppiamento pagina-logica-template.

## Porting Next eseguito - 2026-06-28

Moduli TypeScript aggiunti:

- `lib/role-permissions.ts`: definizioni permessi, ereditarieta padre legacy, normalizzazione selezioni, accesso modulo Pacchetti e landing page da permessi.
- `lib/tenant-runtime.ts`: slug tenant, prefix tenant, suffix sessione, URL tenant, sedi demo, opzioni sede per utente e risoluzione location.
- `lib/appointment-engine.ts`: normalizzazione stati appuntamento, parser durata/prezzo, staff compatibili, slot per sede/orario, conflitti appuntamento/hold, store demo, hold temporanei e creazione appuntamento validata.
- `lib/tenant-store.ts`: store demo per tenant con repository per appuntamenti, hold, clienti, servizi, prodotti e movimenti stock.
- `lib/tenant-store.ts`: repository demo anche per costi, preventivi, wallet/fidelity, GiftCard, notifiche e automazioni.
- `lib/api-utils.ts`: parser body JSON/form e helper comuni per route API.
- `lib/xampp-config.ts`: lettura sicura server-side della configurazione MySQL XAMPP o variabili ambiente.
- `lib/tenant-db.ts`: pool MySQL, risoluzione tabelle tenant shared/prefixed, `tenant_id`, CRUD base e status DB.
- `lib/manage-auth.ts`: login gestionale DB, verifica bcrypt PHP, session cookie tenant, rate limit e permessi ruolo.
- `lib/manage-signup.ts`: registrazione professionista, verifica codice, disponibilita slug, provisioning tenant shared e seed iniziale.
- `lib/manage-request.ts`: risoluzione tenant per API gestionali da `slug`, `x-tenant-slug` o `Referer`.
- `lib/manage-onboarding.ts`: stato onboarding, step PHP, salvataggio dati iniziali e gate dashboard.
- `lib/db-repositories.ts`: repository DB-first per clienti, servizi, prodotti, appuntamenti, POS/report.
- `lib/public-booking-db.ts`: repository booking pubblico DB-first con contesto, slot 5 minuti, orari/eccezioni, hold `appointment_holds`, conferma appuntamento, servizi/staff/sedi/segmenti e benefici coupon/promozioni base.

Route API aggiunte:

- `GET /api/manage/permissions`: restituisce tenant demo, utente demo, permessi normalizzati, gruppi permesso e landing page.
- `GET /api/manage/appointments?action=availability`: restituisce slot disponibili/non disponibili per data, servizio, operatore e sede.
- `POST /api/manage/appointments` con `action=hold_availability`, `release_hold`, `renew_hold`, `save`, `status`, `reset_demo`.
- `GET/POST /api/manage/clients`: lista, create, update, archive/delete con protezione se il cliente ha appuntamenti.
- `GET/POST /api/manage/services`: lista, create, update, delete; se il servizio ha appuntamenti viene disattivato invece di essere rimosso.
- `GET/POST /api/manage/products`: lista, create, update, delete e `move_stock` con controllo giacenza.
- `GET/POST /api/manage/pos`: catalogo cassa, storico, summary, `checkout` e `cancel`.
- `GET /api/manage/reports`: KPI incassi, ticket medio, mix vendite e sotto-scorta.
- `GET/POST /api/manage/costs`: scadenze, riepilogo aperti/scaduti, creazione costo e pagamento con ricorrenza.
- `GET/POST /api/manage/quotes`: lista, creazione, invio, accettazione e conversione preventivo in vendita POS.
- `GET/POST /api/manage/fidelity`: clienti con saldo wallet, movimenti credito/punti e ricariche.
- `GET/POST /api/manage/giftcards`: emissione e riscatto GiftCard con saldo residuo.
- `GET/POST /api/manage/notifications`: feed notifiche e marcatura lettura.
- `GET/POST /api/manage/automation`: regole automatiche, toggle e run manuale.
- `GET/POST /api/manage/packages`: catalogo pacchetti, emissione pacchetto cliente e consumo sedute.
- `GET/POST /api/manage/prepaids`: servizi prepagati, emissione e consumo residui.
- `GET/POST /api/manage/preorders`: preordini prodotto, acconti e ritiro con scarico stock.
- `GET/POST /api/manage/coupons`: lista, creazione, preview e redeem coupon.
- `GET/POST /api/manage/promotions`: lista, toggle e preview promozione.
- `GET/POST /api/manage/giftboxes`: emissione e riscatto GiftBox.
- `GET/POST /api/manage/gifts`: emissione e riscatto omaggi.
- `GET/POST /api/manage/installments`: piani rateali e pagamento rata.
- `GET/POST /api/manage/commissions`: riepilogo commissioni e liquidazione.
- `GET/POST /api/manage/configuration?module=...`: registro configurabile, record attivi e aggiornamento demo per moduli impostazioni/risorse/documenti.
- `POST /api/manage/auth/login`: login DB reale con cookie sessione tenant.
- `POST /api/manage/auth/logout`: logout sessione tenant.
- `GET /api/manage/db-status`: verifica connessione DB, configurazione e modalita tenant.
- `POST /api/manage/signup/register`: registrazione professionista DB-first con codice verifica locale/dev o email provider futuro.
- `POST /api/manage/signup/resend`: reinvio codice verifica con cooldown.
- `POST /api/manage/signup/verify`: verifica codice, provisioning tenant e sessione admin tenant.
- `GET/POST /api/manage/onboarding`: stato onboarding, salvataggio step, skip e completamento.
- `GET/POST /api/booking`: contesto pubblico, slot, hold, release hold e conferma prenotazione su DB reale.
- `GET /api/marketplace`: lista profili tenant pubblicabili con servizi, sedi e categorie da DB reale.

UI collegata:

- `components/management-app.tsx` usa l'engine slot nella prenotazione rapida.
- Gli orari occupati vengono disabilitati in base ai conflitti operatore.
- Il form passa dalla sede selezionata e dalla logica tenant/location.
- La dashboard mostra un pannello "Logiche clonate" con landing page permessi, gate sedi e slot liberi.
- Le viste Clienti, Servizi e Magazzino leggono dalle nuove API e inviano azioni CRUD demo.
- Le viste Pagamenti, Movimenti e Report leggono dalle nuove API POS/report.
- La vendita POS scarica il prodotto dal magazzino; l'annullamento puo ripristinare lo stock.
- Le viste Costi, Preventivi, Fidelity, Wallet, Ricariche, GiftCard, Notifiche e Automazione leggono dalle nuove API operative.
- Il preventivo accettato puo essere convertito in vendita POS; le automazioni generano notifiche demo.
- Le viste Pacchetti, Prepagati, Preordini, Buoni, Promozioni, GiftBox, Omaggi, Rate e Commissioni leggono dalle nuove API operative.
- La vendita POS puo generare residui speciali, piani rateali e commissioni; l'annullamento blocca i residui emessi dalla vendita demo.
- Le viste impostazioni, risorse, staff, orari, consensi, categorie, fornitori, marketplace e ruoli leggono da `/api/manage/configuration` con record attivi e azione di aggiornamento.
- Le viste Clienti, Servizi, Magazzino, Appuntamenti, POS, Report, Costi e Preventivi ora provano prima il DB XAMPP reale e indicano `sourceMode=database` nelle API quando i dati arrivano da MySQL.
- `components/public-booking-wizard.tsx` usa `/api/booking`: carica dati DB, filtra servizi per sede/categoria, mostra disponibilita reali, crea hold al click sullo slot e conferma appuntamenti pending.
- `components/public-center-page.tsx` usa `/api/booking` anche per la scheda attivita: dati sede/servizi/staff reali, slot reali e richiesta rapida con hold/conferma.
- `components/public-marketplace.tsx` usa `/api/marketplace`: ricerca e card partono dai tenant reali pubblicabili; `/attivita/[slug]` accetta anche slug presenti solo nel DB.
- `components/manage-account-page.tsx` usa le API signup reali: registrazione con conferma password/termini, verifica codice non piu demo, reinvio codice e redirect al gestionale tenant.
- `components/manage-onboarding-app.tsx` espone il wizard onboarding DB-first e viene servito da `/{slug}/onboarding` e `/{slug}/index.php?page=onboarding`.

## Porting Next eseguito - SaaS Admin - 2026-06-29

Logiche PHP analizzate e portate:

- `admin/_bootstrap.php`, `admin/_layout.php`, `admin/pages/dashboard.php`, `tenants.php`, `tenant_detail.php`, `tenant_settings.php`, `tenant_visibility.php`, `tenant_admin.php`, `tenant_onboarding.php`, `tenant_health.php`, `tenant_support.php`, `tenant_danger.php`, `maintenance.php`, `admins.php`.
- `app/lib/SaasAuth.php`: bootstrap primo admin, login admin SaaS, cookie `beautysuite_session_saas`, rate limit e account disattivati.
- `app/lib/SaasAdminManager.php`: ruoli owner/admin/viewer, creazione admin, modifica, disattivazione protetta e reset password.
- `app/lib/SaasTenantManager.php`: schema `saas_tenants`, stati tenant, visibilita pubblica, onboarding reset, health check, repair schema/admin, audit, manutenzione massiva e cancellazione con conferma slug.
- `app/lib/SaasTenantAudit.php`: audit best-effort su azioni tenant/admin/support.
- `app/lib/SaasSupportAccessManager.php`: token supporto monouso, scadenza, revoca, storico e consumo token.

Implementazione Next:

- `lib/saas-admin-auth.ts`: auth SaaS con bcrypt PHP, bootstrap, cookie firmato, rate limit e permessi ruolo.
- `lib/saas-tenant-manager.ts`: tenant manager DB-first su tabelle `saas_*`, health, audit, support token, CRUD admin SaaS e provisioning admin-created tenant su schema shared `tenant_id`.
- `components/saas-admin-app.tsx`: console operativa `/admin` con dashboard, tenant, dettaglio tenant a tab, backup, controlli SMS, piani SMS, movimenti invii, manutenzione, audit e admin SaaS.
- `lib/saas-operations.ts`: replica `SaasBackupManager`, `SaasSmsBilling`, `SaasCommunicationMonitor` e diagnostica SMS tenant/provider.
- `app/admin/page.tsx` e `app/admin/login/page.tsx`: route Next per pannello SaaS senza PHP.
- `app/api/admin/auth/status`, `login`, `logout`: sessione SaaS.
- `app/api/admin/tenants`: lista, dettaglio e azioni tenant/support/manutenzione.
- `app/api/admin/admins`: gestione admin SaaS riservata agli owner.
- `app/api/admin/operations`: controlli provider SMS, piani/prezzi SMS, ordini, ricarica manuale con accredito wallet, movimenti invii SMS/email, backup tenant e download.
- `/{tenantSlug}?support_token=...`: consumo token supporto e creazione sessione gestionale Next.

Smoke test 2026-06-29:

- `/admin/login` HTTP 200.
- `/api/admin/auth/status` restituisce `bootstrapped=true`.
- `/api/admin/tenants` senza cookie restituisce 401.
- Login SaaS con `info@artebrand.it` e password fornita riuscito.
- `/admin` autenticato HTTP 200.
- `/api/admin/tenants?slug=elite` autenticato restituisce dettaglio tenant reale, health, token supporto e audit.
- `/api/admin/operations?section=controls`, `sms_plans`, `send_movements` e `backups&slug=centroesteticoelite` autenticati restituiscono HTTP 200.
