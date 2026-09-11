# OperaStep v0.2

OperaStep è un assistente mobile-first per pianificare e controllare una ristrutturazione.

## Moduli
- Preventivi: fornitori, categorie, voci dettagliate, importi, allegati e avanzamento per voce.
- Piano lavori: checklist per fase, scadenze e promemoria.
- Costi & acquisti: materiali, manodopera, professionisti, trasporti, noleggi e altri costi.
- Pagamenti: controllo automatico rispetto al valore maturato.
- Assistente OperaStep: tips dinamici su ritardi, budget, acquisti, pagamenti e sequenze a rischio.
- Promemoria locali Android per attività e acquisti con scadenza.

## Logica economica
Il costo previsto finale = preventivi + costi esterni ai preventivi + extra approvati.
I costi marcati come "già compresi in un preventivo" non vengono conteggiati due volte.

Per ogni preventivo, il valore maturato deriva dalle singole voci:
`valore voce × % avanzamento`.

Il pagamento consigliato rispetta avanzamento, ritenuta di sicurezza e pagamenti già effettuati.
