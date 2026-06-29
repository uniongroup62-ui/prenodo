# Deploy su AWS Amplify

Guida al deploy del gestionale Next.js (Prenodo) su **AWS Amplify Hosting** con
SSR/compute (API routes, middleware), database **Supabase**, email via **SES** e
SMS via **OpenAPI SMS**. L'app non dipende più da PHP/Apache/MySQL.

## 1. Hosting Amplify

1. Crea un'app in **Amplify Hosting** e collega il repository `prenodo`
   (è un repo git a sé). Se invece colleghi il monorepo esterno, imposta
   l'**app root** su `prenodo`.
2. La build usa [`amplify.yml`](../amplify.yml) (già nel repo). Amplify rileva
   Next.js e provisiona la piattaforma **WEB_COMPUTE** (SSR + API routes).
3. **Next.js 16.2.9**: verifica che la versione gestita di Next su Amplify
   supporti la 16. Se il supporto è in ritardo, valuta in alternativa un deploy
   container (App Runner/ECS) o l'adapter `output: 'standalone'`.

## 2. Variabili d'ambiente (Amplify console → Environment variables)

Sono **segreti**: impostale nella console, non nel repo.

| Variabile | Obbligatoria | Descrizione |
|-----------|:---:|-------------|
| `PRENODO_DATABASE_URL` | ✅ | Connection string Supabase (pooler IPv4 `aws-0-eu-west-1.pooler.supabase.com:5432`, `?sslmode=require`). |
| `PRENODO_SESSION_SECRET` | ✅ | Segreto per firmare le sessioni. |
| `CRON_SECRET` | ✅ | Bearer token che protegge le route `/api/cron/*` (vedi §4). |
| `SES_FROM_EMAIL` | per email | Identità mittente **verificata in SES** (es. `noreply@tuodominio.it`). Se assente, l'invio email è disabilitato. |
| `SES_FROM_NAME` | no | Nome visualizzato mittente (default `Prenodo`). |
| `SES_REGION` / `AWS_REGION` | no | Region SES (default `eu-west-1`). |
| `OPENAPI_SMS_TOKEN` | per SMS | Bearer token OpenAPI SMS. Se assente, l'invio SMS è disabilitato. |
| `OPENAPI_SMS_ENV` | no | `sandbox` (default) o `production`. |
| `OPENAPI_SMS_SENDER` | no | Mittente alfanumerico 3–11 char (default `Prenodo`). |
| `OPENAPI_SMS_ENABLED` | no | `false`/`0` per disabilitare anche con token presente. |
| `OPENAPI_SMS_BASE_URL` | no | Override endpoint. |
| `OPENAPI_SMS_CALLBACK_SECRET` / `OPENAPI_SMS_CALLBACK_URL` | no | Per i callback di consegna SMS. |

## 3. Amazon SES (email)

1. **Verifica l'identità mittente** (dominio consigliato, con DKIM) nella region
   scelta; imposta `SES_FROM_EMAIL` su un indirizzo di quel dominio.
2. **Esci dalla sandbox SES** (richiesta di production access) per inviare a
   destinatari non verificati.
3. **Permessi IAM**: il ruolo di esecuzione dell'app Amplify deve avere
   `ses:SendEmail` / `ses:SendRawEmail`. L'SDK usa la catena credenziali AWS
   di default (ruolo IAM su Amplify; in locale `AWS_ACCESS_KEY_ID`/`SECRET`).
4. Finché `SES_FROM_EMAIL` non è impostata, `emailConfigured()` è `false` e i
   cron di invio (reminders/giftbox/giftcard) **riportano** gli item dovuti
   senza inviarli né consumarli.

## 4. Cron: Amazon EventBridge Scheduler

Amplify **non ha cron nativo** (a differenza di Vercel — `vercel.json` è inerte
qui). I 7 job sono route `/api/cron/*` da invocare a schedule via **EventBridge
Scheduler**, che colpisce l'URL pubblico con l'header
`Authorization: Bearer ${CRON_SECRET}` (gestito da `assertCronAuth`).

Schedule consigliati (da `vercel.json`, qui da replicare su EventBridge):

| Route | Cron (UTC) |
|-------|-----------|
| `/api/cron/reminders` | `*/10 * * * *` |
| `/api/cron/giftbox-send` | `*/30 * * * *` |
| `/api/cron/giftcard-send` | `*/30 * * * *` |
| `/api/cron/quotes` | `0 2 * * *` |
| `/api/cron/fidelity-expire` | `0 3 * * *` |
| `/api/cron/fidelity-reconcile-lots` | `0 4 * * 0` |
| `/api/cron/saas-tenant-health` | `0 5 * * *` |

Esempio (uno schedule, via AWS CLI — ripeti per ciascuna route). Richiede una
**EventBridge Connection** (header Authorization) + una **API destination**:

```bash
# 1) Connection con l'header Authorization: Bearer <CRON_SECRET>
aws events create-connection \
  --name prenodo-cron \
  --authorization-type API_KEY \
  --auth-parameters '{"ApiKeyAuthParameters":{"ApiKeyName":"Authorization","ApiKeyValue":"Bearer <CRON_SECRET>"}}'

# 2) API destination verso la route
aws events create-api-destination \
  --name prenodo-cron-reminders \
  --connection-arn <CONNECTION_ARN> \
  --invocation-endpoint "https://<APP_DOMAIN>/api/cron/reminders" \
  --http-method POST

# 3) Schedule EventBridge Scheduler (target = API destination, ruolo con events:InvokeApiDestination)
aws scheduler create-schedule \
  --name prenodo-reminders \
  --schedule-expression "cron(*/10 * * * ? *)" \
  --flexible-time-window '{"Mode":"OFF"}' \
  --target '{"Arn":"<API_DESTINATION_ARN>","RoleArn":"<SCHEDULER_ROLE_ARN>"}'
```

In alternativa una piccola Lambda schedulata che fa `fetch` delle 7 URL con il
Bearer, o `pg_cron`/Supabase Scheduled Functions con `net.http_post`.

## 5. Spegnere il PHP

Quando SES + OpenAPI SMS sono configurati e gli schedule EventBridge attivi:
i cron di invio passano `SEND_ENABLED` a `true` automaticamente (gate su
`emailConfigured()`/`smsConfigured()`) e inviano davvero. A quel punto
**Apache/PHP/MySQL si possono dismettere**.
